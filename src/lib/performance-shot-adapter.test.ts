import { describe, expect, it } from "vitest";
import { performanceSourceContext, type PerformanceSourceRow } from "./performance-shot-adapter";
const row: PerformanceSourceRow = {
  id: "synthetic-shot",
  clubId: "club",
  sessionId: "session",
  shotAt: new Date("2026-10-18"),
  sessionDate: new Date("2026-10-17"),
  carryYd: 170,
  sideCarryYd: -1,
  ballSpeedMph: 110,
  clubSpeedMph: 80,
  source: "synthetic",
  sessionType: "range",
  playContext: "unknown",
  shotPlayContext: "unknown",
  shotCategory: "full",
  qualityTag: null,
  reviewStatus: "included",
  clubDataEstType: null,
  sourceRawJson: {},
  dataConfidence: {},
};
describe("performance source adapter", () => {
  it("keeps missing context unknown and preserves original session dates and negative side", () => {
    const output = performanceSourceContext(row);
    expect(output.equipmentId).toBeNull();
    expect(output.normalization).toBeNull();
    expect(output.shotAt).toEqual(row.sessionDate);
    expect(output.sideCarryYd).toBe(-1);
    expect(output.metricStatus?.ballSpeedMph).toBeUndefined();
  });
  it("uses historical configuration only within its effective period", () => {
    const period = {
      id: "old",
      clubId: "club",
      effectiveFrom: new Date("2026-10-01"),
      effectiveTo: new Date("2026-10-19"),
      ballModelId: "ball",
    };
    expect(performanceSourceContext(row, [period]).equipmentId).toBe("old");
    expect(
      performanceSourceContext({ ...row, shotAt: new Date("2026-10-20") }, [period]).equipmentId,
    ).toBeNull();
  });
  it("reads adapter status without turning arbitrary flags into measured certainty", () => {
    const output = performanceSourceContext({
      ...row,
      sourceRawJson: {
        __lmwtMetricProvenance: JSON.stringify({
          carryYd: { status: "measured" },
          clubSpeedMph: { status: "bogus" },
        }),
      },
    });
    expect(output.metricStatus?.carryYd).toBe("measured");
    expect(output.metricStatus?.clubSpeedMph).toBeUndefined();
    expect(
      performanceSourceContext({ ...row, clubDataEstType: "unmapped" }).metricStatus?.clubSpeedMph,
    ).toBe("unknown");
  });
  it("separates explicitly identified maximum and no-ball swings even inside range uploads", () => {
    expect(
      performanceSourceContext({ ...row, sourceRawJson: { __lmwtSwingIntent: "no_ball" } })
        .intentKey,
    ).toBe("no-ball");
    expect(
      performanceSourceContext({ ...row, sourceRawJson: { swingIntent: "maximum_ball" } })
        .intentKey,
    ).toBe("maximum-effort");
    expect(
      performanceSourceContext({ ...row, sourceRawJson: { swingIntent: "normal_ball" } }).intentKey,
    ).toBe("full");
  });
});
