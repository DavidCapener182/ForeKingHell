import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

import * as database from "@/db/client";
import {
  withDirectionalConfidence,
  type SessionDataConfidence,
} from "@/lib/session-data-confidence";
import { isComparisonShot } from "@/lib/today-practice-evidence";
import { getTodayProgressHistory } from "@/lib/today-progress-data";

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
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  ) {
    throw new Error(
      "Today progress integration tests require the disposable localhost:55432/fkh_redesign database.",
    );
  }
}

describe("Today progress history failure states", () => {
  afterEach(() => {
    actor.error = null;
    vi.restoreAllMocks();
  });

  it("rejects invalid calendar dates before opening a database connection", async () => {
    const connection = vi.spyOn(database, "getDb");
    await expect(getTodayProgressHistory({ beforeDateKey: "2026-02-30" })).rejects.toThrow(
      "valid selected practice date",
    );
    expect(connection).not.toHaveBeenCalled();
  });

  it("preserves authentication failures", async () => {
    actor.error = new Error("Authentication required");
    const connection = vi.spyOn(database, "getDb");
    await expect(getTodayProgressHistory({ beforeDateKey: "2026-09-08" })).rejects.toThrow(
      "Authentication required",
    );
    expect(connection).not.toHaveBeenCalled();
  });

  it("reports unavailable storage instead of inventing an empty history", async () => {
    vi.spyOn(database, "getDb").mockImplementation(() => {
      throw new Error("History connection unavailable");
    });
    await expect(getTodayProgressHistory({ beforeDateKey: "2026-09-08" })).rejects.toThrow(
      "History connection unavailable",
    );
  });
});

describe.skipIf(!enabled)("Today progress history with the real database", () => {
  let sql: ReturnType<typeof postgres>;
  let owner: string;
  let foreign: string;
  let iron: string;
  let replacementIron: string;
  let wedge: string;
  let foreignClub: string;

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, connect_timeout: 2 });
    await sql`select 1`;
  });
  beforeEach(async () => {
    [owner, foreign] = (
      await sql`insert into fkh_users(name) values('Today progress fixture owner'),('Today progress fixture foreign') returning id`
    ).map((row) => row.id);
    actor.userId = owner;
    [iron, replacementIron, wedge] = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'7i','progress_7i'),(${owner},'7i','progress_replacement_7i'),(${owner},'pw','progress_pw') returning id`
    ).map((row) => row.id);
    foreignClub = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${foreign},'7i','progress_foreign_7i') returning id`
    )[0].id;
  });
  afterEach(async () => {
    // Explicit shot cleanup also handles deliberately mismatched ownership fixtures.
    await sql`delete from fkh_shots where user_id in ${sql([owner, foreign])}`;
    await sql`delete from fkh_users where id in ${sql([owner, foreign])}`;
  });
  afterAll(async () => {
    await database.closeDb();
    await sql.end();
  });

  async function seedSession({
    userId = owner,
    type = "range",
    confidence = {},
  }: {
    userId?: string;
    type?: string;
    confidence?: SessionDataConfidence;
  } = {}) {
    return (
      await sql`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text,data_confidence_json)
      values(${userId},'csv',${type},'2026-01-01T12:00:00Z','Today progress fixture.csv','Synthetic practice history',${sql.json(confidence)}) returning id`
    )[0].id as string;
  }

  async function seedShot(
    sessionId: string,
    shotAt: string,
    overrides: Record<string, string | number | null> = {},
  ) {
    const row = {
      user_id: owner,
      session_id: sessionId,
      club_id: iron,
      club_type: "7i",
      shot_at: shotAt,
      shot_number: 1,
      shot_category: "full",
      carry_yd: 150,
      total_yd: 155,
      side_carry_yd: 3,
      ball_speed_mph: 100,
      launch_angle_deg: 20,
      launch_direction_deg: 2,
      apex_ft: 65,
      review_status: "included",
      source_raw_json: '{"fixture":"today-progress"}',
      ...overrides,
    };
    return (await sql`insert into fkh_shots ${sql(row)} returning id`)[0].id as string;
  }

  it("loads the five latest complete practice days and combines every upload without a shot cap", async () => {
    const firstUpload = await seedSession();
    const secondUpload = await seedSession();
    const dayIds: string[] = [];
    for (let index = 0; index < 65; index += 1) {
      dayIds.push(
        await seedShot(index % 2 ? firstUpload : secondUpload, "2026-09-07T12:00:00Z", {
          shot_number: index + 1,
          club_id: index % 2 ? iron : replacementIron,
        }),
      );
    }
    for (const date of ["06", "05", "04", "03", "02"]) {
      await seedShot(firstUpload, `2026-09-${date}T12:00:00Z`);
    }
    await seedShot(firstUpload, "2026-09-07T23:00:00Z"); // Selected London day.
    await seedShot(firstUpload, "2026-09-09T12:00:00Z");

    const history = await getTodayProgressHistory({ beforeDateKey: "2026-09-08" });
    expect(history.map((day) => day.dateKey)).toEqual([
      "2026-09-07",
      "2026-09-06",
      "2026-09-05",
      "2026-09-04",
      "2026-09-03",
    ]);
    expect(history[0].rawShots.map((shot) => shot.id).sort()).toEqual(dayIds.sort());
    expect(new Set(history[0].rawShots.map((shot) => shot.sessionId))).toEqual(
      new Set([firstUpload, secondUpload]),
    );
    expect(new Set(history[0].rawShots.map((shot) => shot.clubId))).toEqual(
      new Set([iron, replacementIron]),
    );
    // The upload timestamp was deliberately in January; shot timestamps define the day.
    expect(history[0].rawShots[0].sessionDate.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });

  it.each([
    {
      dateKey: "2026-03-29",
      beforeDateKey: "2026-03-30",
      instants: ["2026-03-29T00:00:00Z", "2026-03-29T01:30:00Z", "2026-03-29T22:59:59Z"],
      nextMidnight: "2026-03-29T23:00:00Z",
    },
    {
      dateKey: "2026-10-25",
      beforeDateKey: "2026-10-26",
      instants: [
        "2026-10-24T23:00:00Z",
        "2026-10-25T00:30:00Z",
        "2026-10-25T01:30:00Z",
        "2026-10-25T23:59:59Z",
      ],
      nextMidnight: "2026-10-26T00:00:00Z",
    },
  ])("respects the complete London DST practice day $dateKey", async (fixture) => {
    const sessionId = await seedSession();
    const expected = [];
    for (const instant of fixture.instants) expected.push(await seedShot(sessionId, instant));
    await seedShot(sessionId, fixture.nextMidnight);
    const history = await getTodayProgressHistory({ beforeDateKey: fixture.beforeDateKey });
    expect(history).toHaveLength(1);
    expect(history[0].dateKey).toBe(fixture.dateKey);
    expect(history[0].rawShots.map((shot) => shot.id)).toEqual(expected);
  });

  it("excludes every round type and requires the current owner on shots, sessions and clubs", async () => {
    const validSession = await seedSession();
    const validId = await seedShot(validSession, "2026-09-01T12:00:00Z");
    for (const type of ["round", "simulator", "simulated_course", "real_round"]) {
      await seedShot(await seedSession({ type }), "2026-09-07T12:00:00Z");
    }
    const foreignSession = await seedSession({ userId: foreign });
    await seedShot(foreignSession, "2026-09-07T12:00:00Z");
    await seedShot(validSession, "2026-09-07T12:00:00Z", { club_id: foreignClub });
    await seedShot(validSession, "2026-09-07T12:00:00Z", { user_id: foreign });
    await seedShot(foreignSession, "2026-09-07T12:00:00Z", {
      user_id: foreign,
      club_id: foreignClub,
    });

    const history = await getTodayProgressHistory({ beforeDateKey: "2026-09-08" });
    expect(history.map((day) => day.dateKey)).toEqual(["2026-09-01"]);
    expect(history[0].rawShots.map((shot) => shot.id)).toEqual([validId]);
  });

  it("retains review, integrity and directional evidence for the shared comparison policy", async () => {
    const sessionId = await seedSession();
    const at = "2026-09-07T12:00:00Z";
    const included = await seedShot(sessionId, at);
    await seedShot(sessionId, at, { review_status: "user_excluded" });
    await seedShot(sessionId, at, { review_status: "suggested_exclusion" });
    await seedShot(sessionId, at, { quality_tag: "needs_review" });
    await seedShot(sessionId, at, { shot_category: "chip" });
    await seedShot(sessionId, at, { shot_category: "recovery" });
    const pitch = await seedShot(sessionId, at, { shot_category: "pitch" });
    const questionableWedge = {
      club_id: wedge,
      club_type: "pw",
      carry_yd: 50,
      total_yd: 90,
      launch_angle_deg: 5,
      apex_ft: 5,
    };
    const integrity = await seedShot(sessionId, at, questionableWedge);
    const restored = await seedShot(sessionId, at, {
      ...questionableWedge,
      review_status: "restored",
      quality_tag: "bad_data",
    });
    const uncertainSession = await seedSession({ confidence: { alignment: "misaligned" } });
    const uncertain = await seedShot(uncertainSession, at);

    const [history] = await getTodayProgressHistory({ beforeDateKey: "2026-09-08" });
    expect(history.rawShots).toHaveLength(10);
    expect(history.rawShots.find((shot) => shot.id === integrity)?.dataIntegrityIssue).toBe(
      "trajectory-review",
    );
    expect(
      history.rawShots
        .filter(isComparisonShot)
        .map((shot) => shot.id)
        .sort(),
    ).toEqual([included, pitch, restored, uncertain].sort());
    const rawUncertain = history.rawShots.find((shot) => shot.id === uncertain)!;
    expect(rawUncertain.sideCarryYd).toBe(3);
    expect(rawUncertain.dataConfidence?.alignment).toBe("misaligned");
    expect(withDirectionalConfidence(rawUncertain)).toMatchObject({
      carryYd: 150,
      ballSpeedMph: 100,
      sideCarryYd: null,
      launchDirectionDeg: null,
    });
  });

  it("returns an empty history when the owner has no earlier practice shots", async () => {
    await seedShot(await seedSession(), "2026-09-08T12:00:00Z");
    await expect(getTodayProgressHistory({ beforeDateKey: "2026-09-08" })).resolves.toEqual([]);
  });

  it("retains the latest prior practice day even when every shot was excluded", async () => {
    const sessionId = await seedSession();
    const excluded = await seedShot(sessionId, "2026-09-07T12:00:00Z", {
      review_status: "user_excluded",
    });
    await seedShot(sessionId, "2026-09-06T12:00:00Z");
    const history = await getTodayProgressHistory({ beforeDateKey: "2026-09-08" });
    expect(history.map((day) => day.dateKey)).toEqual(["2026-09-07", "2026-09-06"]);
    expect(history[0].rawShots.map((shot) => shot.id)).toEqual([excluded]);
    expect(history[0].rawShots.filter(isComparisonShot)).toEqual([]);
    expect(history[1].rawShots.filter(isComparisonShot)).toHaveLength(1);
  });
});
