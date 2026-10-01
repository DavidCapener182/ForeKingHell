import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import * as database from "@/db/client";
import { getClubProgressData } from "@/lib/club-progress-data";
import { compareClubSessions } from "@/lib/today-club-trends";
import { getTodayPracticeData, type TodayPracticeShot } from "@/lib/today-session-data";
const actor = vi.hoisted(() => ({ userId: "", error: null as Error | null }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => {
    if (actor.error) throw actor.error;
    return actor.userId;
  },
}));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error(
      "Shared progress mutations require the designated localhost:55432/fkh_redesign disposable fixture.",
    );
}
describe("shared history failure boundary", () => {
  afterEach(() => {
    actor.error = null;
    vi.restoreAllMocks();
  });
  it("keeps authentication errors outside the history fallback", async () => {
    actor.error = new Error("Authentication required");
    await expect(getClubProgressData([])).rejects.toThrow("Authentication required");
  });
  it("empty explicit scope does not open a database", async () => {
    const spy = vi.spyOn(database, "getDb");
    expect((await getClubProgressData([])).clubs).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
  it("preserves current values and failed status when the database is unavailable", async () => {
    vi.spyOn(database, "getDb").mockImplementation(() => {
      throw new Error("Fixture connection unavailable");
    });
    const rows = [
      {
        id: "s",
        sessionId: "current",
        clubId: "driver",
        clubActive: true,
        clubType: "driver",
        source: "fixture",
        sessionType: "range",
        sessionDate: new Date("2026-09-22T12:00:00Z"),
        shotAt: new Date("2026-09-22T12:00:00Z"),
        shotCategory: "full",
        carryYd: 150,
        reviewStatus: "included",
        qualityTag: null,
        dataIntegrityIssue: null,
      },
    ] as TodayPracticeShot[];
    const result = await getClubProgressData(rows);
    expect(result.history).toBe("failed");
    expect(result.clubs[0].points[0].values.carryYd).toBe(150);
    expect(
      compareClubSessions(result.clubs[0], "current", "carryYd", "measured", result.history).text,
    ).toBe("History loading failed");
  });
});
describe.skipIf(!enabled)("owner-scoped bounded progress loader on disposable database", () => {
  const db = enabled ? postgres(url!, { max: 1 }) : null;
  let owner = "";
  let foreign = "";
  let driverId = "";
  beforeAll(async () => {
    owner = (
      await db!`insert into fkh_users(name) values('Shared progress isolated owner') returning id`
    )[0].id;
    foreign = (
      await db!`insert into fkh_users(name) values('Shared progress foreign fixture') returning id`
    )[0].id;
    actor.userId = owner;
    const equipment =
      await db!`insert into fkh_clubs(user_id,type,brand,model,normalized_club_key,active) values(${owner},'driver','Fixture','Current Driver','shared-driver',true),(${owner},'7i','Fixture','Current Iron','shared-iron',true),(${owner},'6i','Fixture','Retired','shared-retired',false),(${foreign},'driver','Fixture','Foreign Driver','foreign-driver',true) returning id,user_id,type,active`;
    driverId = equipment.find((c) => c.user_id === owner && c.type === "driver")!.id;
    for (let day = 1; day <= 23; day++) {
      const timestamp = `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`;
      const [s] =
        await db!`insert into fkh_sessions(user_id,source,type,play_context,date,file_name,raw_csv_text) values(${owner},'fixture','range','outdoor',${timestamp},${`Shared upload ${day}.csv`},'fixture') returning id`;
      for (const c of equipment.filter((c) => c.user_id === owner)) {
        // Latest uploads contain Driver only. Dashboard must still retain the practised Iron.
        if (day > 21 && c.type !== "driver") continue;
        await db!`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,play_context,shot_category,carry_yd,ball_speed_mph,side_carry_yd,source_raw_json)
     select ${owner},${s.id},${c.id},${c.type},${timestamp}::timestamptz,'outdoor','full',${day === 22 ? null : 150 + day},130,case when x % 2 = 0 then -12 else 12 end,'{}'::jsonb from generate_series(1,12) as x`;
      }
    }
    // Many uploads in another context cannot consume outdoor's twenty-session allowance.
    const distractors =
      await db!`insert into fkh_sessions(user_id,source,type,play_context,date,raw_csv_text) select ${owner},'fixture','range','indoor','2026-09-23T13:00:00Z'::timestamptz + x * interval '1 second','fixture' from generate_series(1,85) x returning id,date`;
    for (const s of distractors)
      await db!`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,play_context,shot_category,carry_yd,source_raw_json) values(${owner},${s.id},${driverId},'driver',${s.date},'indoor','full',250,'{}')`;
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await database.closeDb();
    if (owner) await db!`delete from fkh_users where id=${owner}`;
    if (foreign) await db!`delete from fkh_users where id=${foreign}`;
    await db?.end();
  });
  it("loads separate series in two batched selects with active-owner isolation", async () => {
    const spy = vi.spyOn(
      (
        database.getDb() as ReturnType<typeof database.getDb> & {
          $client: ReturnType<typeof postgres>;
        }
      ).$client,
      "unsafe",
    );
    const result = await getClubProgressData();
    expect(result.history).toBe("bounded");
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
    expect(result.clubs.map((c) => c.label).join(" ")).not.toMatch(/Retired|Foreign/);
    const outdoor = result.clubs.find((c) => c.clubId === driverId && c.playContext === "outdoor")!;
    expect(outdoor.points).toHaveLength(22);
    expect(result.clubs.some((c) => c.clubType === "7i")).toBe(true);
    const last = outdoor.points.at(-1)!;
    const comparison = compareClubSessions(outdoor, last.sessionId, "carryYd");
    expect(comparison.text).toBe("Previous reading unavailable");
    expect(last.values.accuracy).toBe(12);
  });
  it("keeps historical Today scope and excludes future uploads", async () => {
    const data = await getTodayPracticeData({
      date: "2026-09-21",
      club: "driver",
      scope: "day",
      practiceOnly: true,
    });
    const result = await getClubProgressData(data.rawShots);
    expect(result.history).toBe("complete");
    expect(result.clubs).toHaveLength(1);
    expect(result.clubs[0].points.at(-1)!.date).toContain("21 Sept");
    expect(result.clubs[0].points.at(-1)!.values.carryYd).toBe(171);
    const dashboard = await getClubProgressData();
    const sameSeries = dashboard.clubs.find((c) => c.id === result.clubs[0].id)!;
    const current = result.clubs[0].points.at(-1)!;
    const dashboardPoint = sameSeries.points.find((p) => p.sessionId === current.sessionId)!;
    expect(dashboardPoint.values).toEqual(current.values);
    expect(dashboardPoint.counts).toEqual(current.counts);
    expect(compareClubSessions(sameSeries, current.sessionId, "carryYd").delta).toBe(
      compareClubSessions(result.clubs[0], current.sessionId, "carryYd").delta,
    );
    expect(
      result.clubs[0].points.every(
        (p) => p.timestamp <= new Date("2026-09-21T12:00:00Z").getTime(),
      ),
    ).toBe(true);
  });
  it("does not borrow another date to populate an empty Today scope", async () => {
    const data = await getTodayPracticeData({
      date: "2026-08-01",
      scope: "day",
      practiceOnly: true,
    });
    const result = await getClubProgressData(data.rawShots);
    expect(result.clubs).toEqual([]);
  });
  it("replaces summaries after corrections, review changes and active-club changes", async () => {
    const [latest] =
      await db!`select id from fkh_sessions where user_id=${owner} and play_context='outdoor' order by date desc limit 1`;
    try {
      await db!`update fkh_shots set carry_yd=183 where user_id=${owner} and session_id=${latest.id} and club_id=${driverId}`;
      const refreshed = await getClubProgressData();
      expect(
        refreshed.clubs
          .find((c) => c.clubId === driverId && c.playContext === "outdoor")!
          .points.at(-1)!.values.carryYd,
      ).toBe(183);
      await db!`update fkh_shots set review_status='user_excluded' where user_id=${owner} and session_id=${latest.id} and club_id=${driverId}`;
      const reviewed = await getClubProgressData();
      expect(
        reviewed.clubs
          .find((c) => c.clubId === driverId && c.playContext === "outdoor")!
          .points.at(-1)!.values.carryYd,
      ).toBeNull();
      await db!`update fkh_clubs set active=false where user_id=${owner} and id=${driverId}`;
      expect((await getClubProgressData()).clubs.some((c) => c.clubId === driverId)).toBe(false);
    } finally {
      await db!`update fkh_clubs set active=true where user_id=${owner} and id=${driverId}`;
      await db!`update fkh_shots set carry_yd=173,review_status='included' where user_id=${owner} and session_id=${latest.id} and club_id=${driverId}`;
    }
  });
});
