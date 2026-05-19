import { describe, expect, it } from "vitest";

import {
  calculateHandicapSummary,
  calculatePlayingHandicapSummary,
  calculateRoundDifferential,
  formatHandicapDelta,
  handicapBandFromValue,
  normaliseHandicapRoundInput,
} from "./round-handicap";

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

  it("normalizes 9-hole differentials to an 18-hole equivalent", () => {
    expect(
      calculateRoundDifferential({
        totalScore: 43,
        totalPar: 35,
        courseRating: 34.3,
        slopeRating: 110,
        holesPlayed: 9,
      }),
    ).toBeCloseTo(17.9, 1);
  });

  it("doubles 9-hole score, par, and rating for handicap display inputs", () => {
    expect(
      normaliseHandicapRoundInput({
        totalScore: 43,
        totalPar: 35,
        courseRating: 34.3,
        slopeRating: 110,
        holesPlayed: 9,
      }),
    ).toMatchObject({
      totalScore: 86,
      totalPar: 70,
      courseRating: 68.6,
      slopeRating: 110,
      holesPlayed: 18,
      originalHolesPlayed: 9,
      isNineHoleEquivalent: true,
    });
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
      10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 0,
    ]);

    expect(summary.sampleSize).toBe(21);
    expect(summary.usedDifferentialCount).toBe(8);
    expect(summary.value).toBe(4.5);
    expect(summary.methodLabel).toBe("Lowest 8 of latest 20 differentials");
  });

  it("calculates realistic playing handicap from averaged adjusted recent rounds", () => {
    const summary = calculatePlayingHandicapSummary([
      { handicapDifferential: 7, type: "simulated_course" },
      { handicapDifferential: 18, type: "real_round" },
      { handicapDifferential: 11, type: "simulator" },
      { handicapDifferential: 16, type: "real_round" },
      { handicapDifferential: 20, type: "real_round" },
    ]);

    expect(summary.value).toBe(16);
    expect(summary.usedDifferentialCount).toBe(5);
    expect(summary.realDifferentialCount).toBe(3);
    expect(summary.simulatorDifferentialCount).toBe(2);
    expect(summary.methodLabel).toBe("Average latest 5 adjusted differentials; simulator +4.0");
  });

  it("requires enough rounds before showing a realistic playing handicap", () => {
    const summary = calculatePlayingHandicapSummary([
      { handicapDifferential: 12, type: "real_round" },
      { handicapDifferential: 10, type: "simulated_course" },
    ]);

    expect(summary.value).toBeNull();
    expect(summary.sampleSize).toBe(2);
    expect(summary.usedDifferentialCount).toBe(2);
    expect(summary.methodLabel).toBe("Needs 3 eligible rounds; 2 available");
  });

  it("formats generated handicap bands from handicap estimates", () => {
    expect(handicapBandFromValue(16.4)).toBe("16 - 18");
    expect(handicapBandFromValue(0.2)).toBe("0 - 3");
    expect(handicapBandFromValue(-1.1)).toBe("Plus / scratch");
    expect(handicapBandFromValue(null)).toBeNull();
  });
});
