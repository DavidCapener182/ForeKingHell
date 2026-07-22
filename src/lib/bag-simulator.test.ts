import { describe, expect, it } from "vitest";
import { simulateBagChange } from "@/lib/bag-simulator";

describe("bag simulator", () => {
  it("models add/remove coverage using carry bands and dispersion", () => {
    const clubs = [
      {
        id: "7i",
        label: "7 Iron",
        carryYd: 150,
        p25Yd: 145,
        p75Yd: 155,
        leftYd: 12,
        rightYd: 14,
        confidence: 80,
      },
    ];
    const result = simulateBagChange({
      clubs,
      candidate: { label: "6 Iron", carryYd: 170, p25Yd: 164, p75Yd: 176, leftYd: 14, rightYd: 16 },
    });
    expect(result.projectedCoverage).toBeGreaterThan(result.currentCoverage);
    expect(result.warning).toContain("15 measured shots");
  });
});
