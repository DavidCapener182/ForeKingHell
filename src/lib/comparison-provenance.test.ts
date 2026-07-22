import { describe, expect, it } from "vitest";

import { buildComparisonProvenance } from "@/lib/comparison-provenance";
import type { CompareData, CompareSampleSummary } from "@/lib/compare-data";

const sample = (stockShots: number, sessions: number): CompareSampleSummary => ({
  label: "Sample",
  detail: "21 Jul 2026",
  rawShots: stockShots + 2,
  stockShots,
  sessions,
  clubs: 2,
  carryMedianYd: 150,
  carryAverageYd: 151,
  totalMedianYd: 160,
  ballSpeedAverageMph: 110,
  launchAverageDeg: 16,
  absoluteOfflineAverageYd: 8,
  shotConeWidthYd: 24,
  playableRate: 80,
  bigMissRate: 10,
  leftMissRate: 10,
  rightMissRate: 10,
  primaryMiss: "Balanced",
  dispersion: [],
  sessionBreakdown: [],
});

describe("comparison metric provenance", () => {
  it("labels improvement direction and exposes source/method/caveat", () => {
    const rows = buildComparisonProvenance({
      focus: sample(30, 3),
      baseline: sample(28, 3),
      delta: {
        carryDeltaYd: 3,
        ballSpeedDeltaMph: 1,
        launchDeltaDeg: 0.5,
        offlineDeltaYd: -2,
        coneDeltaYd: 4,
        playableRateDelta: 5,
        bigMissRateDelta: -3,
      },
    } as CompareData);

    expect(rows.find((row) => row.key === "offlineDeltaYd")?.direction).toBe("better");
    expect(rows.find((row) => row.key === "coneDeltaYd")?.direction).toBe("worse");
    expect(rows.find((row) => row.key === "launchDeltaDeg")?.direction).toBe("mixed");
    expect(rows.every((row) => row.source && row.method && row.caveat)).toBe(true);
  });

  it("marks low-sample comparisons as early signals", () => {
    const rows = buildComparisonProvenance({
      focus: sample(5, 1),
      baseline: sample(6, 1),
      delta: {
        carryDeltaYd: null,
        ballSpeedDeltaMph: null,
        launchDeltaDeg: null,
        offlineDeltaYd: null,
        coneDeltaYd: null,
        playableRateDelta: null,
        bigMissRateDelta: null,
      },
    } as CompareData);

    expect(rows[0]?.confidence).toBe("early");
    expect(rows[0]?.caveat).toContain("Small sample");
  });
});
