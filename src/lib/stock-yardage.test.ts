import { describe, expect, it } from "vitest";

import { calculateStockYardage, selectStockYardageShots } from "@/lib/stock-yardage";

describe("calculateStockYardage", () => {
  it("uses median carry and removes extreme MAD outliers", () => {
    const result = calculateStockYardage([
      shot(150, 160, -8),
      shot(152, 162, -4),
      shot(151, 161, 6),
      shot(153, 164, 4),
      shot(70, 90, 2),
    ]);

    expect(result.sampleSize).toBe(4);
    expect(result.excludedCount).toBe(1);
    expect(result.carryMedianYd).toBe(151.5);
    expect(result.carryMeanYd).toBe(151.5);
    expect(result.totalMedianYd).toBe(161.5);
    expect(result.dispersionLeftYd).toBe(8);
    expect(result.dispersionRightYd).toBe(6);
    expect(result.recommendedPlayNumberYd).toBe(150);
  });

  it("excludes chip, pitch, recovery, and mishit rows", () => {
    const result = calculateStockYardage([
      shot(140, 148, 0),
      shot(142, 149, 1),
      { ...shot(40, 44, 1), shotCategory: "chip" },
      { ...shot(80, 90, 1), shotCategory: "pitch" },
      { ...shot(100, 120, 1), shotCategory: "recovery" },
      { ...shot(50, 80, 1), qualityTag: "mishit" },
    ]);

    expect(result.sampleSize).toBe(2);
    expect(result.carryMedianYd).toBe(141);
  });

  it("does not treat sand wedge round touch shots as stock yardage", () => {
    const result = calculateStockYardage(
      [
        { ...shot(82, 86, 2), clubType: "sw", courseHoleNumber: 4, shotCategory: "approach" },
        { ...shot(36, 38, 1), clubType: "sw", courseHoleNumber: 5, shotCategory: "chip" },
        { ...shot(92, 96, -3), clubType: "sw", courseHoleNumber: null, sessionType: "simulated_course" },
      ],
      50,
      { clubType: "sw" },
    );

    expect(result.sampleSize).toBe(0);
    expect(result.carryMedianYd).toBeNull();
  });

  it("keeps sand wedge out of stock yardage until a dedicated full-swing mode exists", () => {
    const result = calculateStockYardage(
      [
        { ...shot(92, 96, 1), clubType: "sw", courseHoleNumber: null, sessionType: "range" },
        { ...shot(94, 98, -1), clubType: "sw", courseHoleNumber: null, sessionType: "range" },
        { ...shot(90, 94, 0), clubType: "sw", courseHoleNumber: null, sessionType: "range" },
      ],
      50,
      { clubType: "sw" },
    );

    expect(result.sampleSize).toBe(0);
    expect(result.carryMedianYd).toBeNull();
  });

  it("returns an empty result when no usable carry values exist", () => {
    const result = calculateStockYardage([
      { carryYd: null, totalYd: null, sideCarryYd: null, shotCategory: "full" },
    ]);

    expect(result.sampleSize).toBe(0);
    expect(result.carryMedianYd).toBeNull();
    expect(result.confidenceScore).toBe(0);
    expect(result.label).toBe("Do not trust yet");
  });

  it("exposes the same clean sample used for stock dispersion", () => {
    const shots = [
      { ...shot(150, 160, -8), id: "clean-left" },
      { ...shot(152, 162, -4), id: "clean-mid" },
      { ...shot(151, 161, 6), id: "clean-right" },
      { ...shot(153, 164, 4), id: "clean-long" },
      { ...shot(70, 90, 2), id: "short-outlier" },
    ];
    const result = calculateStockYardage(shots);
    const sample = selectStockYardageShots(shots);

    expect(result.sampleSize).toBe(4);
    expect(sample.filteredShots.map((sampleShot) => sampleShot.id)).toEqual([
      "clean-left",
      "clean-mid",
      "clean-right",
      "clean-long",
    ]);
  });
});

function shot(carryYd: number, totalYd: number, sideCarryYd: number) {
  return {
    carryYd,
    totalYd,
    sideCarryYd,
    ballSpeedMph: 120,
    launchAngleDeg: 14,
    shotCategory: "full",
    qualityTag: null,
    shotAt: "2026-05-08T12:00:00.000Z",
  };
}
