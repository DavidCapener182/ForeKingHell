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
});
