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
