import { describe, expect, it } from "vitest";
import {
  buildPerformanceIntelligence,
  performanceMetricValue,
  performanceReadiness,
  selectPerformancePotentialShots,
  type PerformanceShot,
} from "./performance-intelligence";
// Synthetic edge cases only; these fixtures are never used for live screens.
const asOf = new Date("2026-10-18T12:00:00Z");
function shot(id: string, overrides: Partial<PerformanceShot> = {}): PerformanceShot {
  return {
    id,
    sessionId: "recent",
    clubId: "driver",
    shotAt: "2026-10-17T12:00:00Z",
    carryYd: 180,
    ballSpeedMph: 130,
    clubSpeedMph: 90,
    sideCarryYd: 10,
    shotCategory: "full",
    source: "rapsodo",
    equipmentId: "driver-v1",
    settingsKey: "raw-v1",
    ballType: "range",
    environment: "range",
    normalization: "raw",
    ...overrides,
  };
}
const analyze = (shots: PerformanceShot[]) =>
  buildPerformanceIntelligence(shots, { asOf }).groups[0]!;
describe("performance intelligence evidence sets", () => {
  it("allows 220-yard selected potential beside lower recent stock without distance trimming", () => {
    const historical = Array.from({ length: 30 }, (_, i) =>
      shot(`old-${i}`, { sessionId: "old", shotAt: "2026-01-01", carryYd: 220 }),
    );
    const group = analyze([
      ...historical,
      shot("normal"),
      shot("ordinary", { carryYd: 160 }),
      shot("top", { carryYd: 20, qualityTag: "severe-mishit" }),
    ]);
    expect(group.potential.meanYd).toBe(220);
    expect(group.current.stockCarryYd).toBe(170);
    expect(group.current.count).toBe(3);
    expect(group.current.mishitRate).toBeCloseTo(1 / 3);
    expect(group.current.exclusions[0]?.reason).toContain("retained in all attempts");
    expect(group.current.carryObservations.find((s) => s.shotId === "top")?.stock).toBe(false);
  });
  it("does not infer intent or mishits from a short wedge carry", () => {
    const groups = buildPerformanceIntelligence(
      [
        shot("partial", { clubId: "sw", carryYd: 20, shotCategory: "pitch" }),
        shot("unknown", { clubId: "sw", carryYd: 20, shotCategory: null }),
        shot("full", { clubId: "sw", carryYd: 20 }),
      ],
      { asOf },
    ).groups;
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.current.stockCount)).toEqual([0, 0, 1]);
    expect(groups.every((g) => g.current.mishitRate === 0)).toBe(true);
  });
  it("never backfills missing measurements into carry-selected potential IDs", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      shot(String(i), { carryYd: 200 + i, clubSpeedMph: i >= 22 ? 90 : null }),
    );
    const selected = selectPerformancePotentialShots(rows);
    expect(selected).toHaveLength(30);
    expect(selected.map((s) => s.id)).toEqual(Array.from({ length: 30 }, (_, i) => String(39 - i)));
    expect(selected.filter((s) => performanceMetricValue(s, "clubSpeedMph") !== null)).toHaveLength(
      18,
    );
  });
  it("keeps otherwise valid speed when carry is invalid; lateral zero and negative survive", () => {
    const row = shot("bad-carry", {
      carryYd: 0,
      sideCarryYd: -1,
      metricStatus: { carryYd: "invalid", ballSpeedMph: "measured" },
    });
    const group = analyze([row, shot("zero", { sideCarryYd: 0 })]);
    expect(group.current.count).toBe(1);
    expect(group.current.metricCounts.ballSpeedMph).toBe(2);
    expect(group.current.provenance.ballSpeedMph).toEqual({ measured: 1, unknown: 1 });
    expect(performanceMetricValue(row, "sideCarryYd")).toBe(-1);
    expect(group.current.signedBiasYd).toBe(-0.5);
  });
  it("does not deduplicate matching rounded values; deduplicates confirmed physical swings only", () => {
    const group = analyze([
      shot("a"),
      shot("b"),
      shot("c", { canonicalSwingId: "confirmed", canonicalDuplicateConfirmed: true }),
      shot("d", { canonicalSwingId: "confirmed", canonicalDuplicateConfirmed: true }),
    ]);
    expect(group.current.count).toBe(3);
    expect(group.current.exclusions).toContainEqual({
      reason: "Confirmed canonical duplicate",
      count: 1,
      shotIds: ["d"],
    });
  });
  it("never pools clubs, source, settings, equipment, environment or normalization", () => {
    const rows = [
      shot("a"),
      shot("b", { source: "trackman" }),
      shot("c", { equipmentId: "new" }),
      shot("d", { settingsKey: "normalized" }),
      shot("e", { normalization: "normalized" }),
      shot("f", { environment: "course" }),
      shot("g", { clubId: "7i" }),
    ];
    expect(buildPerformanceIntelligence(rows, { asOf }).groups).toHaveLength(7);
  });
  it("preserves restored user decisions over legacy excluded quality tags", () => {
    expect(
      analyze([shot("restored", { qualityTag: "excluded", reviewStatus: "restored" })]).current
        .count,
    ).toBe(1);
    expect(analyze([shot("excluded", { reviewStatus: "user_excluded" })]).current.count).toBe(0);
  });
  it("separates speed tests and makes unknown intent evidence explicit", () => {
    const group = analyze([shot("speed", { sessionType: "speed-test" })]);
    expect(group.current.count).toBe(0);
    expect(group.exclusions[0]?.reason).toContain("speed-training");
  });
});
describe("session-aware recent form", () => {
  it("uses latest five within 90 days and preceding five within 180, without overlap", () => {
    const rows = Array.from({ length: 13 }, (_, i) =>
      shot(String(i), {
        sessionId: `session-${i}`,
        shotAt: new Date(asOf.getTime() - (i * 15 + 1) * 86400000).toISOString(),
      }),
    );
    const group = analyze(rows);
    expect(group.current.sessionIds).toHaveLength(5);
    expect(group.baseline.sessionIds).toHaveLength(5);
    expect(group.current.sessionIds.filter((id) => group.baseline.sessionIds.includes(id))).toEqual(
      [],
    );
    expect(group.baseline.sessionIds).not.toContain("session-12");
  });
  it("does not silently extend sparse recent windows", () => {
    const group = analyze([shot("old", { shotAt: "2026-05-01" })]);
    expect(group.current.count).toBe(0);
    expect(group.baseline.count).toBe(0);
    expect(group.comparison.state).toBe("Not enough evidence");
  });
  it("weights session comparisons equally while stock display stays actual pooled median", () => {
    const rows = [
      ...Array.from({ length: 100 }, (_, i) => shot(`large-${i}`, { carryYd: 200 })),
      shot("small", { sessionId: "small", carryYd: 100, shotAt: "2026-10-16" }),
      shot("baseline", { sessionId: "before", carryYd: 140, shotAt: "2026-06-01" }),
    ];
    const group = buildPerformanceIntelligence(rows, { asOf, sessionLimit: 2 }).groups[0]!;
    expect(group.current.stockCarryYd).toBe(200);
    expect(group.comparison.deltas.stockCarryYd).toBe(10);
    expect(group.comparison.label).toBe("Early signal");
  });
  it("does not mistake signed cancellation for accuracy", () => {
    const group = analyze([shot("left", { sideCarryYd: -20 }), shot("right", { sideCarryYd: 20 })]);
    expect(group.current.signedBiasYd).toBe(0);
    expect(group.current.absoluteLateralYd).toBe(20);
  });
  it("unknown session identity cannot create independent sessions or strong evidence", () => {
    const group = analyze(
      Array.from({ length: 40 }, (_, i) => shot(String(i), { sessionId: null })),
    );
    expect(group.current.readiness).toBe("Provisional");
    expect(group.current.sessionIds).toHaveLength(1);
    expect(group.comparison.state).toBe("Not enough evidence");
  });
  it("uses product evidence rules without guaranteeing accuracy", () => {
    expect(performanceReadiness(9, 3)).toBe("Provisional");
    expect(performanceReadiness(30, 1)).toBe("Provisional");
    expect(performanceReadiness(10, 2)).toBe("Establishing");
    expect(performanceReadiness(30, 3)).toBe("Well sampled");
  });
  it("only measures repeatability against an explicit valid target window", () => {
    const rows = [
      shot("a", { carryYd: 100 }),
      shot("b", { carryYd: 120 }),
      shot("c", { carryYd: 100, sideCarryYd: null }),
    ];
    expect(analyze(rows).current.repeatability).toBeNull();
    expect(
      buildPerformanceIntelligence(rows, {
        asOf,
        target: { carryYd: 100, toleranceYd: 5, lateralToleranceYd: 15 },
      }).groups[0]!.current.repeatability,
    ).toBe(0.5);
    expect(() =>
      buildPerformanceIntelligence(rows, { target: { carryYd: 100, toleranceYd: -1 } }),
    ).toThrow();
  });
  it("provides truthful deterministic action, evidence and retest when data is sparse", () => {
    const recommendation = analyze([shot("only")]).recommendation;
    expect(recommendation.shotIds).toEqual(["only"]);
    expect(recommendation.action).toContain("retest");
    expect(recommendation.successCriterion).toContain("two independent sessions");
    expect(recommendation.limitations.join(" ")).toContain("no swing-mechanics diagnosis");
  });
});

describe("review regressions", () => {
  it("retains ordinary thin contact in stock and rejects it only from clean potential", () => {
    const group = analyze([shot("thin", { qualityTag: "thin", carryYd: 120 }), shot("normal")]);
    expect(group.current.stockCount).toBe(2);
    expect(group.potential.selectedCount).toBe(1);
    expect(group.current.mishitRate).toBe(0.5);
  });
  it("excluded-only sessions cannot consume the five comparable session slots", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) =>
        shot(`warm-${i}`, {
          sessionId: `warm-${i}`,
          qualityTag: "warm-up",
          shotAt: `2026-10-${String(17 - i).padStart(2, "0")}`,
        }),
      ),
      shot("valid", { sessionId: "valid", shotAt: "2026-10-01" }),
    ];
    expect(analyze(rows).current.sessionIds).toEqual(["valid"]);
  });
  it("a single directional reading cannot establish improvement among many carry observations", () => {
    const rows = Array.from({ length: 80 }, (_, i) =>
      shot(String(i), {
        sessionId: `session-${Math.floor(i / 20)}`,
        shotAt: i < 40 ? "2026-10-17" : "2026-06-01",
        sideCarryYd: i === 0 ? 5 : i === 40 ? 30 : null,
        metricStatus: { carryYd: "measured", sideCarryYd: "measured" },
      }),
    );
    const group = buildPerformanceIntelligence(rows, { asOf, sessionLimit: 2 }).groups[0]!;
    expect(group.comparison.deltas.absoluteLateralYd).toBe(-25);
    // Flat, well-covered carry spread can only support steady, never the sparse lateral gain.
    expect(group.comparison.state).not.toBe("Improving");
  });
  it("unknown context limits high-count evidence and unknown measurement provenance limits strong form", () => {
    const rows = Array.from({ length: 80 }, (_, i) =>
      shot(String(i), {
        sessionId: `session-${Math.floor(i / 20)}`,
        shotAt: i < 40 ? "2026-10-17" : "2026-06-01",
        sideCarryYd: i < 40 ? 5 : 30,
      }),
    );
    expect(
      buildPerformanceIntelligence(rows, { asOf, sessionLimit: 2 }).groups[0]!.comparison.state,
    ).toBe("Not enough evidence");
    expect(
      buildPerformanceIntelligence(
        rows.map((s) => ({
          ...s,
          settingsKey: null,
          metricStatus: { carryYd: "measured", sideCarryYd: "measured" },
        })),
        { asOf, sessionLimit: 2 },
      ).groups[0]!.comparison.state,
    ).toBe("Not enough evidence");
  });
});

it("does not prescribe a lateral gain from one reading beside many carry shots", () => {
  const rows = Array.from({ length: 40 }, (_, i) =>
    shot(String(i), {
      sessionId: `s-${Math.floor(i / 20)}`,
      sideCarryYd: i === 0 ? 30 : null,
      metricStatus: { carryYd: "measured", sideCarryYd: "measured" },
    }),
  );
  const recommendation = analyze(rows).recommendation;
  expect(recommendation.successCriterion).not.toContain("27.0");
  expect(recommendation.limitations.join(" ")).toContain("Directional evidence is sparse");
});
