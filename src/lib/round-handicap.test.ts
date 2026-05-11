import { describe, expect, it } from "vitest";

import { calculateHandicapSummary, calculateRoundDifferential, formatHandicapDelta } from "./round-handicap";

describe("round handicap", () => {
  it("calculates a rated course differential", () => {
    expect(
      calculateRoundDifferential({
        totalScore: 86,
        totalPar: 72,
        courseRating: 70.8,
        slopeRating: 138,
      }),
    ).toBeCloseTo(12.45, 2);
  });

  it("falls back to par for simulator scorecards without rating data", () => {
    expect(
      calculateRoundDifferential({
        totalScore: 94,
        totalPar: 72,
        courseRating: null,
        slopeRating: null,
      }),
    ).toBe(22);
  });

  it("reports a handicap trend from newest-first values", () => {
    const summary = calculateHandicapSummary([8, 10, 12]);

    expect(summary.value).toBe(6);
    expect(summary.usedDifferentialCount).toBe(1);
    expect(summary.adjustment).toBe(-2);
    expect(summary.trend.previous).toBe(9);
    expect(summary.trend.direction).toBe("down");
    expect(formatHandicapDelta(summary.trend.delta)).toBe("-3.0");
  });

  it("uses the lowest 8 of the latest 20 differentials when enough scores exist", () => {
    const summary = calculateHandicapSummary([
      10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 0,
    ]);

    expect(summary.sampleSize).toBe(21);
    expect(summary.usedDifferentialCount).toBe(8);
    expect(summary.value).toBe(4.5);
    expect(summary.methodLabel).toBe("Lowest 8 of latest 20 differentials");
  });
});
