import { describe, expect, it } from "vitest";
import { performanceSourceContext, type PerformanceSourceRow } from "./performance-shot-adapter";
import { performanceMetricValue } from "./performance-intelligence";
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
    expect(output.metricStatus?.clubSpeedMph).toBe("unknown");
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
  it.each([
    ["0", "measured"],
    ["0.0", "measured"],
    ["false", "measured"],
    ["measured", "measured"],
    ["1", "estimated"],
    ["1.0", "estimated"],
    ["true", "estimated"],
    ["estimated", "estimated"],
  ] as const)(
    "recovers legacy Rapsodo flag %s as %s without losing recorded speed",
    (flag, status) => {
      const output = performanceSourceContext({ ...row, source: "rapsodo", clubDataEstType: flag });
      expect(output.metricStatus?.clubSpeedMph).toBe(status);
      expect(performanceMetricValue(output, "clubSpeedMph")).toBe(80);
      expect(output.clubSpeedMph).toBe(row.clubSpeedMph);
    },
  );
  it.each(["unknown", "unavailable", "invalid", "estimated"] as const)(
    "preserves explicit %s provenance over a legacy measured flag",
    (status) => {
      const output = performanceSourceContext({
        ...row,
        source: "rapsodo",
        clubDataEstType: "0",
        sourceRawJson: {
          __lmwtMetricProvenance: JSON.stringify({ clubSpeedMph: { status } }),
        },
      });
      expect(output.metricStatus?.clubSpeedMph).toBe(status);
      expect(performanceMetricValue(output, "clubSpeedMph")).toBe(
        status === "estimated" ? 80 : null,
      );
    },
  );
  it("keeps unknown Rapsodo codes unresolved and does not use their mapping for other providers", () => {
    for (const input of [
      { source: "rapsodo", clubDataEstType: "106-unmapped" },
      { source: "trackman", clubDataEstType: "0" },
    ]) {
      const output = performanceSourceContext({ ...row, ...input });
      expect(output.metricStatus?.clubSpeedMph).toBe("unknown");
      expect(performanceMetricValue(output, "clubSpeedMph")).toBeNull();
      expect(output.clubSpeedMph).toBe(80);
    }
  });
  it("does not invent measured provenance when a historical flag is absent", () => {
    const output = performanceSourceContext({ ...row, source: "rapsodo", clubDataEstType: null });
    expect(output.metricStatus?.clubSpeedMph).toBeUndefined();
  });
  it.each([
    "broken",
    "null",
    "[]",
    JSON.stringify({ clubSpeedMph: null }),
    JSON.stringify({ clubSpeedMph: { status: "bogus" } }),
  ])(
    "does not bypass explicit malformed speed metadata with a legacy measured flag: %s",
    (metadata) => {
      const output = performanceSourceContext({
        ...row,
        source: "rapsodo",
        clubDataEstType: "0",
        sourceRawJson: { __lmwtMetricProvenance: metadata },
      });
      expect(output.metricStatus?.clubSpeedMph).toBe("unknown");
      expect(performanceMetricValue(output, "clubSpeedMph")).toBeNull();
    },
  );
  it("uses a legacy speed flag when valid partial metadata makes no speed claim", () => {
    const output = performanceSourceContext({
      ...row,
      source: "rapsodo",
      clubDataEstType: "0",
      sourceRawJson: {
        __lmwtMetricProvenance: JSON.stringify({ carryYd: { status: "measured" } }),
      },
    });
    expect(output.metricStatus?.clubSpeedMph).toBe("measured");
    expect(performanceMetricValue(output, "clubSpeedMph")).toBe(80);
  });
  it("honours explicit unresolved provenance inside an encoded historical source object", () => {
    const output = performanceSourceContext({
      ...row,
      source: "rapsodo",
      clubDataEstType: "0",
      sourceRawJson: JSON.stringify({
        __lmwtMetricProvenance: JSON.stringify({ clubSpeedMph: { status: "unknown" } }),
      }),
    });
    expect(output.metricStatus?.clubSpeedMph).toBe("unknown");
    expect(performanceMetricValue(output, "clubSpeedMph")).toBeNull();
  });
});
