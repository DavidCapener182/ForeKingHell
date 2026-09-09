import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

import { closeDb } from "@/db/client";
import { getTodayPracticeData } from "@/lib/today-session-data";
import { roundSessionTypes } from "@/lib/round-sessions";

const actor = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.userId,
}));

const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  ) {
    throw new Error(
      "Today default-practice tests require the disposable localhost:55432/fkh_redesign database.",
    );
  }
}

describe.skipIf(!enabled)("Today defaults to the latest measured practice day", () => {
  let sql: ReturnType<typeof postgres>;
  let owner: string;
  let foreign: string;
  let iron: string;
  let driver: string;
  let foreignClub: string;

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, connect_timeout: 2 });
    await sql`select 1`;
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 00:30 on 9 September in London, shortly after the previous practice day ended.
    vi.setSystemTime(new Date("2026-09-08T23:30:00.000Z"));
    [owner, foreign] = (
      await sql`insert into fkh_users(name) values('Today rollover fixture owner'),('Today rollover fixture foreign') returning id`
    ).map((row) => row.id);
    actor.userId = owner;
    [iron, driver] = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'7i','rollover_7i'),(${owner},'driver','rollover_driver') returning id`
    ).map((row) => row.id);
    foreignClub = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${foreign},'7i','rollover_foreign') returning id`
    )[0].id;
  });
  afterEach(async () => {
    // Remove deliberately mismatched-owner shot rows before cascading fixture users.
    await sql`delete from fkh_shots where user_id in ${sql([owner, foreign])}`;
    await sql`delete from fkh_users where id in ${sql([owner, foreign])}`;
    vi.useRealTimers();
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });

  async function session({
    userId = owner,
    type = "range",
    date = "2026-09-09T12:00:00Z",
  }: { userId?: string; type?: string; date?: string } = {}) {
    return (
      await sql`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text)
      values(${userId},'csv',${type},${date},'Today rollover fixture.csv','Synthetic rollover fixture') returning id`
    )[0].id as string;
  }

  async function shot(
    sessionId: string,
    shotAt: string,
    {
      userId = owner,
      clubId = iron,
      clubType = "7i",
      reviewStatus = "included",
    }: { userId?: string; clubId?: string; clubType?: string; reviewStatus?: string } = {},
  ) {
    return (
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_category,review_status,carry_yd,total_yd,side_carry_yd,ball_speed_mph,launch_angle_deg,source_raw_json)
      values(${userId},${sessionId},${clubId},${clubType},${shotAt},'full',${reviewStatus},140,150,4,100,18,'{}'::jsonb) returning id`
    )[0].id as string;
  }

  it("keeps yesterday's two uploads after midnight despite newer rounds, an empty upload and a larger older practice", async () => {
    const older = await session();
    for (let index = 0; index < 3; index++) {
      await shot(older, "2026-09-06T12:00:00Z", { clubId: driver, clubType: "driver" });
    }
    const firstUpload = await session();
    const secondUpload = await session();
    const first = await shot(firstUpload, "2026-09-08T18:00:00Z");
    const second = await shot(secondUpload, "2026-09-08T19:00:00Z");
    await session();
    for (const type of roundSessionTypes) {
      const round = await session({ type });
      await shot(round, "2026-09-09T00:00:00Z");
      await shot(round, "2026-09-08T20:00:00Z");
    }

    const result = await getTodayPracticeData();
    expect(result.dateKey).toBe("2026-09-08");
    expect(result.bounds.start.toISOString()).toBe("2026-09-07T23:00:00.000Z");
    expect(result.bounds.end.toISOString()).toBe("2026-09-08T23:00:00.000Z");
    expect(result.rawShots.map((row) => row.id).sort()).toEqual([first, second].sort());
    expect(result.sessions.map((row) => row.id).sort()).toEqual([firstUpload, secondUpload].sort());
    // A club filter cannot silently move the review back to an older practice.
    expect((await getTodayPracticeData({ club: "driver" })).dateKey).toBe("2026-09-08");
  });

  it("uses the shot's London calendar day even when upload metadata has a different date", async () => {
    vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
    const upload = await session({ date: "2026-08-01T12:00:00Z" });
    const id = await shot(upload, "2026-09-08T23:15:00Z");

    const result = await getTodayPracticeData({ scope: "day", practiceOnly: true });
    expect(result.dateKey).toBe("2026-09-09");
    expect(result.rawShots.map((row) => row.id)).toEqual([id]);
  });

  it("retains a latest excluded shot for review and ignores future or foreign measurements", async () => {
    const previous = await session();
    await shot(previous, "2026-09-06T12:00:00Z");
    const latest = await session();
    const excluded = await shot(latest, "2026-09-08T12:00:00Z", {
      reviewStatus: "user_excluded",
    });
    await shot(await session(), "2026-09-10T12:00:00Z");
    const otherSession = await session({ userId: foreign });
    await shot(otherSession, "2026-09-09T00:00:00Z", {
      userId: foreign,
      clubId: foreignClub,
    });
    await shot(otherSession, "2026-09-09T00:00:00Z");
    await shot(await session(), "2026-09-09T00:00:00Z", { clubId: foreignClub });

    const result = await getTodayPracticeData();
    expect(result.dateKey).toBe("2026-09-08");
    expect(result.rawShots.map((row) => row.id)).toEqual([excluded]);
    expect(result.shots).toEqual([]);
  });

  it("preserves an explicitly empty date and an explicitly empty upload", async () => {
    const practice = await session({ date: "2026-09-08T12:00:00Z" });
    await shot(practice, "2026-09-08T12:00:00Z");
    const emptyUpload = await session({ date: "2026-09-08T12:00:00Z" });
    await shot(await session({ type: "round" }), "2026-09-09T00:00:00Z");

    const emptyDate = await getTodayPracticeData({
      date: "2026-09-09",
      scope: "day",
      practiceOnly: true,
    });
    expect(emptyDate.dateKey).toBe("2026-09-09");
    expect(emptyDate.rawShots).toEqual([]);

    const emptySession = await getTodayPracticeData({ sessionId: emptyUpload });
    expect(emptySession.dateKey).toBe("2026-09-08");
    expect(emptySession.rawShots).toEqual([]);
    expect(emptySession.allTodayShotCount).toBe(1);
  });

  it("returns an empty current practice day when only rounds and empty uploads exist", async () => {
    await session();
    await shot(await session({ type: "round" }), "2026-09-09T00:00:00Z");
    const result = await getTodayPracticeData();
    expect(result.dateKey).toBe("2026-09-09");
    expect(result.rawShots).toEqual([]);
  });
});
