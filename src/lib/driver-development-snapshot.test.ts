import { describe, expect, it } from "vitest";
import {
  buildDriverDevelopmentSnapshot,
  type DevelopmentShot,
} from "./driver-development-snapshot";
function shot(i: number, patch: Partial<DevelopmentShot> = {}): DevelopmentShot {
  return {
    id: String(i),
    sessionId: "today",
    clubId: "driver",
    clubType: "driver",
    shotAt: new Date(`2026-09-06T15:${String(i % 60).padStart(2, "0")}:00Z`),
    sessionSource: "rapsodo",
    sessionType: "practice",
    playContext: "range",
    fileName: "today.csv",
    carryYd: 200,
    totalYd: 220,
    ballSpeedMph: 130,
    clubSpeedMph: 88,
    smashFactor: 1.48,
    launchAngleDeg: 13,
    attackAngleDeg: 4,
    apexFt: 80,
    sideCarryYd: 5,
    launchDirectionDeg: 0,
    spinRate: null,
    spinAxis: null,
    clubDataEstType: "0",
    reviewStatus: "included",
    qualityTag: null,
    shotCategory: "full",
    ...patch,
  };
}
const history = Array.from({ length: 12 }, (_, i) =>
  shot(i + 100, {
    sessionId: "before",
    shotAt: new Date("2026-09-01T12:00:00Z"),
    carryYd: 190,
    ballSpeedMph: 126,
  }),
);
describe("shared Driver development", () => {
  it("compares like-for-like samples and calculates the actual 200+ numerator", () => {
    const rows = Array.from({ length: 10 }, (_, i) => shot(i, { carryYd: i < 7 ? 205 : 195 }));
    const s = buildDriverDevelopmentSnapshot([...rows, ...history])!;
    expect(s.repeatability).toMatchObject({ count: 7, sampleSize: 10, percent: 70 });
    expect(s.changes.find((c) => c.key === "carry")?.status).toBe("improved");
    expect(s.project).toMatchObject({ goal: 220, bestGap: 15 });
  });
  it("misalignment cannot poison control comparisons or remove carry", () => {
    const s = buildDriverDevelopmentSnapshot([
      ...Array.from({ length: 10 }, (_, i) =>
        shot(i, { sideCarryYd: -41.2, dataConfidence: { alignment: "misaligned" } }),
      ),
      ...history,
    ])!;
    expect(s.metrics.offline.value).toBeNull();
    expect(s.metrics.carry.value).toBe(200);
    expect(s.changes.find((c) => c.key === "offline")?.status).toBe("uncertain");
    expect(s.directionOmittedCount).toBe(10);
  });
  it("questioned historical direction cannot contaminate the comparison baseline", () => {
    const s = buildDriverDevelopmentSnapshot([
      ...Array.from({ length: 10 }, (_, i) => shot(i)),
      ...history.map((s) => ({
        ...s,
        sideCarryYd: 99,
        dataConfidence: { alignment: "misaligned" as const },
      })),
    ])!;
    expect(s.changes.find((c) => c.key === "offline")?.delta).toBeNull();
    expect(s.changes.find((c) => c.key === "carry")?.delta).toBe(10);
  });
  it("retains excluded mishits in raw counts but not stock, capability or performance evidence", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => shot(i)),
      shot(11, { carryYd: 30, reviewStatus: "user_excluded" }),
    ];
    const s = buildDriverDevelopmentSnapshot(rows)!;
    expect(s.rawShotCount).toBe(11);
    expect(s.currentShotCount).toBe(10);
    expect(s.stockCarry).toBe(200);
    expect(rows[10].carryYd).toBe(30);
  });
  it("capability and peaks never become course numbers or invented PBs", () => {
    const s = buildDriverDevelopmentSnapshot([
      ...Array.from({ length: 19 }, (_, i) => shot(i)),
      shot(20, { carryYd: 240, clubSpeedMph: 95 }),
    ])!;
    expect(s.bestCarry).toBe(240);
    expect(s.courseCarry).toBeLessThan(240);
    expect(s.project.bestGap).toBe(0);
    expect(s.nextAction).toContain("peak alone does not establish speed transfer");
    expect(s.conclusion).not.toContain("PB");
  });
  it("never borrows another club, source, context, future day or round as a baseline", () => {
    const s = buildDriverDevelopmentSnapshot(
      [
        shot(1),
        ...history.map((s) => ({ ...s, playContext: "simulator" })),
        shot(22, { shotAt: new Date("2026-09-08T12:00:00Z") }),
        shot(23, { sessionType: "round", carryYd: 999 }),
      ],
      "2026-09-06",
    )!;
    expect(s.metrics.carry.value).toBe(200);
    expect(s.changes[0].delta).toBeNull();
  });
  it("estimated club data cannot create playing speed or a speed milestone", () => {
    const s = buildDriverDevelopmentSnapshot([
      shot(1, { clubDataEstType: "estimated", clubSpeedMph: 120 }),
    ])!;
    expect(s.metrics.clubSpeed.value).toBeNull();
    expect(s.peakSpeed).toBeNull();
    expect(s.metrics.carry.value).toBe(200);
  });
  it("inherits the existing carry project instead of resetting a previously achieved 220 target", () => {
    const s = buildDriverDevelopmentSnapshot([shot(1, { carryYd: 217.1 })], undefined, {
      targetCarryYd: 230,
      currentBestCarryYd: 221,
      carrySource: "Existing Speed evidence",
    })!;
    expect(s.bestCarry).toBe(217.1);
    expect(s.project).toMatchObject({ goal: 230, evidenceBestCarry: 221, bestGap: 9 });
  });
  it("empty data has no invented zero-valued progress", () =>
    expect(buildDriverDevelopmentSnapshot([])).toBeNull());
});
