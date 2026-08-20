import { describe, expect, it } from "vitest";

import { calculateShortGameTouchSummary } from "@/lib/short-game";

describe("calculateShortGameTouchSummary", () => {
  it("summarizes round wedge touch shots separately from full stock", () => {
    const result = calculateShortGameTouchSummary(
      [
        { carryYd: 18, courseHoleNumber: 1, shotCategory: "chip" },
        { carryYd: 42, courseHoleNumber: 2, shotCategory: "pitch" },
        {
          carryYd: 86,
          courseHoleNumber: null,
          sessionType: "simulated_course",
          shotCategory: "full",
        },
        { carryYd: 118, courseHoleNumber: 4, shotCategory: "approach" },
        { carryYd: 94, courseHoleNumber: null, shotCategory: "full" },
      ],
      80,
      { clubType: "sw" },
    );

    expect(result.sampleSize).toBe(2);
    expect(result.carryMedianYd).toBe(30);
    expect(result.longestCarryYd).toBe(42);
    expect(result.under30YdCount).toBe(1);
  });

  it("uses only included or restored lifecycle evidence for touch summaries", () => {
    const result = calculateShortGameTouchSummary(
      [
        { carryYd: 20, shotCategory: "chip", reviewStatus: "included" },
        {
          carryYd: 30,
          shotCategory: "chip",
          reviewStatus: "restored",
          qualityTag: "mishit",
        },
        { carryYd: 80, shotCategory: "pitch", reviewStatus: "suggested_exclusion" },
        { carryYd: 81, shotCategory: "pitch", reviewStatus: "user_excluded" },
        { carryYd: 82, shotCategory: "pitch", reviewStatus: "calibration" },
        { carryYd: 83, shotCategory: "pitch", reviewStatus: "warm_up" },
        { carryYd: 84, shotCategory: "pitch", reviewStatus: "launch_monitor_error" },
        { carryYd: 85, shotCategory: "pitch", reviewStatus: "included", qualityTag: "mishit" },
      ],
      80,
      { clubType: "sw" },
    );

    expect(result).toMatchObject({
      sampleSize: 2,
      carryMedianYd: 25,
      longestCarryYd: 30,
      under30YdCount: 2,
    });
  });
});
