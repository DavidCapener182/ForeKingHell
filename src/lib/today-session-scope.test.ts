import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: vi.fn(async () => "owner") }));
import { getDb } from "@/db/client";
import { getTodayPracticeData } from "@/lib/today-session-data";

const neighbouringShot = {
  id: "other-shot",
  sessionId: "other-session",
  source: "manual",
  fileName: null,
  sessionType: "range",
  courseName: null,
  sessionDate: new Date("2026-08-22T12:00:00Z"),
  shotAt: new Date("2026-08-22T12:00:00Z"),
  shotNumber: 1,
  clubType: "7i",
  clubBrand: null,
  clubModel: null,
  shotCategory: "full",
  reviewStatus: "included",
  qualityTag: null,
  carryYd: 140,
  totalYd: 150,
  sideCarryYd: 2,
  launchDirectionDeg: 1,
  launchAngleDeg: 18,
  ballSpeedMph: 100,
  clubSpeedMph: 80,
  smashFactor: 1.25,
  apexFt: 70,
  descentAngleDeg: 40,
  attackAngleDeg: -3,
  clubPathDeg: 0,
  faceAngleDeg: 0,
  clubDataEstType: null,
};
function query(rows: unknown[]) {
  const q = {
    from: vi.fn(() => q),
    innerJoin: vi.fn(() => q),
    where: vi.fn(() => q),
    orderBy: vi.fn(() => q),
    limit: vi.fn(() => q),
    as: vi.fn(() => q),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return q;
}
beforeEach(() => {
  const select = vi.fn((fields: Record<string, unknown>) => {
    if (Object.keys(fields).length === 1 && "date" in fields)
      return query([{ date: new Date("2026-08-22T12:00:00Z") }]);
    if ("sessionDate" in fields && "source" in fields && select.mock.calls.length <= 2)
      return query([neighbouringShot]);
    return query([]);
  });
  vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>);
});

describe("explicit session evidence scope", () => {
  it("keeps all round types out of completed practice without changing normal day reviews", async () => {
    const rounds = ["round", "real_round", "simulator", "simulated_course"].map((sessionType) => ({
      ...neighbouringShot,
      id: `${sessionType}-shot`,
      sessionId: `${sessionType}-session`,
      sessionType,
      carryYd: 210,
    }));
    const select = vi
      .fn()
      .mockReturnValueOnce(query([neighbouringShot, ...rounds]))
      .mockReturnValue(query([]));
    vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>);
    const data = await getTodayPracticeData({
      date: "2026-08-22",
      scope: "day",
      practiceOnly: true,
    });
    expect(data.sessions.map((session) => session.id)).toEqual(["other-session"]);
    expect(data.rawShots.map((shot) => shot.id)).toEqual(["other-shot"]);
    expect(data.allTodayShotCount).toBe(1);
    expect(data.overall.today.carryAverageYd).toBe(140);

    select.mockReset().mockReturnValueOnce(query(rounds)).mockReturnValue(query([]));
    const roundOnly = await getTodayPracticeData({
      date: "2026-08-22",
      scope: "day",
      practiceOnly: true,
    });
    expect(roundOnly.rawShots).toEqual([]);
    expect(roundOnly.sessions).toEqual([]);

    select
      .mockReset()
      .mockReturnValueOnce(query([neighbouringShot, ...rounds]))
      .mockReturnValue(query([]));
    const fullDay = await getTodayPracticeData({ date: "2026-08-22", scope: "day" });
    expect(fullDay.rawShots).toHaveLength(5);
    expect(fullDay.sessions).toHaveLength(5);
  });
  it("exposes the exact earlier sample separately from current comparable shots", async () => {
    const older = {
      ...neighbouringShot,
      id: "earlier-shot",
      sessionId: "earlier-session",
      carryYd: 150,
      sessionDate: new Date("2026-08-20T12:00:00Z"),
      shotAt: new Date("2026-08-20T12:00:00Z"),
    };
    const select = vi
      .fn()
      .mockReturnValueOnce(
        query([neighbouringShot, { ...neighbouringShot, id: "chip", shotCategory: "chip" }]),
      )
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(
        query([
          older,
          { ...older, id: "excluded", reviewStatus: "user_excluded" },
          { ...older, id: "old-chip", shotCategory: "chip" },
        ]),
      );
    vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>);
    const result = await getTodayPracticeData({ date: "2026-08-22", scope: "day" });
    expect(result.shots.map((s) => s.id)).toEqual(["other-shot", "chip"]);
    expect(result.comparisonShots.map((s) => s.id)).toEqual(["other-shot"]);
    expect(result.previousComparisonShots?.map((s) => s.id)).toEqual(["earlier-shot"]);
    expect(result.clubComparisons[0].today.carryAverageYd).toBe(140);
    expect(result.clubComparisons[0].previous.carryAverageYd).toBe(150);
  });
  it("keeps an empty saved session empty beside another measured upload", async () => {
    const result = await getTodayPracticeData({ sessionId: "empty-session" });
    expect(result.rawShots).toEqual([]);
    expect(result.shots).toEqual([]);
    expect(result.clubComparisons).toEqual([]);
    expect(result.overall.today.shotCount).toBe(0);
    expect(result.overall.today.carryAverageYd).toBeNull();
    expect(result.allTodayShotCount).toBe(1);
  });
  it("retains the intentional full-day view for Today", async () => {
    const result = await getTodayPracticeData({ sessionId: "empty-session", scope: "day" });
    expect(result.rawShots.map((shot) => shot.id)).toEqual(["other-shot"]);
    expect(result.shots.map((shot) => shot.id)).toEqual(["other-shot"]);
  });
});
