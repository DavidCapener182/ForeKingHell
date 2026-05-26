import { describe, expect, it } from "vitest";

import {
  calculateStockCarryTrend,
  calculateStockYardage,
  selectStockYardageShots,
} from "@/lib/stock-yardage";

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

  it("excludes chip, pitch, recovery, mishit, and bad-data rows", () => {
    const result = calculateStockYardage([
      shot(140, 148, 0),
      shot(142, 149, 1),
      { ...shot(40, 44, 1), shotCategory: "chip" },
      { ...shot(80, 90, 1), shotCategory: "pitch" },
      { ...shot(100, 120, 1), shotCategory: "recovery" },
      { ...shot(50, 80, 1), qualityTag: "mishit" },
      { ...shot(200, 220, 1), qualityTag: "bad_data" },
    ]);

    expect(result.sampleSize).toBe(2);
    expect(result.carryMedianYd).toBe(141);
  });

  it("uses sand wedge shots at 40 yards and above while ignoring chip-distance shots", () => {
    const result = calculateStockYardage(
      [
        { ...shot(48, 52, 2), clubType: "sw", courseHoleNumber: 4, shotCategory: "pitch" },
        { ...shot(52, 56, -2), clubType: "sw", courseHoleNumber: 5, shotCategory: "approach" },
        { ...shot(55, 59, 1), clubType: "sw", courseHoleNumber: null, shotCategory: "full" },
        { ...shot(36, 38, 1), clubType: "sw", courseHoleNumber: 5, shotCategory: "chip" },
      ],
      50,
      { clubType: "sw" },
    );

    expect(result.sampleSize).toBe(3);
    expect(result.carryMedianYd).toBe(52);
  });

  it("uses the upper sand wedge cluster for full-stock carry when partial wedges dominate", () => {
    const result = calculateStockYardage(
      [
        { ...shot(22, 25, 1), clubType: "sw", shotCategory: "chip" },
        { ...shot(42, 47, 1), clubType: "sw", shotCategory: "pitch" },
        { ...shot(47, 52, 1), clubType: "sw", shotCategory: "pitch" },
        { ...shot(52, 57, 1), clubType: "sw", shotCategory: "pitch" },
        { ...shot(58, 63, 1), clubType: "sw", shotCategory: "full" },
        { ...shot(62, 67, 1), clubType: "sw", shotCategory: "full" },
        { ...shot(84, 88, 1), clubType: "sw", shotCategory: "full" },
        { ...shot(88, 92, 1), clubType: "sw", shotCategory: "full" },
        { ...shot(90, 94, 1), clubType: "sw", shotCategory: "full" },
        { ...shot(92, 96, 1), clubType: "sw", shotCategory: "full" },
        { ...shot(95, 99, 1), clubType: "sw", shotCategory: "full" },
        { ...shot(96, 100, 1), clubType: "sw", shotCategory: "full" },
      ],
      50,
      { clubType: "sw" },
    );

    expect(result.sampleSize).toBe(6);
    expect(result.carryMedianYd).toBe(91);
  });

  it("keeps lob wedge out of stock yardage", () => {
    const result = calculateStockYardage(
      [
        { ...shot(62, 66, 1), clubType: "lw", courseHoleNumber: null, sessionType: "range" },
        { ...shot(64, 68, -1), clubType: "lw", courseHoleNumber: null, sessionType: "range" },
        { ...shot(60, 64, 0), clubType: "lw", courseHoleNumber: null, sessionType: "range" },
      ],
      50,
      { clubType: "lw" },
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
      "clean-long",
      "clean-mid",
      "clean-right",
      "clean-left",
    ]);
  });

  it("uses the best 20 stock shots so stronger new shots replace weaker ones", () => {
    const baseline = Array.from({ length: 25 }, (_, index) => ({
      ...shot(130 + index, 140 + index, 0, dateForDay(index + 1)),
      id: `baseline-${130 + index}`,
    }));
    const newBest = { ...shot(156, 166, 0, dateForDay(30)), id: "new-best" };
    const result = calculateStockYardage([...baseline, newBest], 50);
    const sample = selectStockYardageShots([...baseline, newBest], 50);
    const sampleIds = sample.cleanShots.map((sampleShot) => sampleShot.id);

    expect(result.sampleSize).toBe(20);
    expect(result.carryMedianYd).toBe(145.5);
    expect(result.bestSampleFloorYd).toBe(136);
    expect(sampleIds).toContain("new-best");
    expect(sampleIds).toContain("baseline-154");
    expect(sampleIds).toContain("baseline-136");
    expect(sampleIds).not.toContain("baseline-135");
    expect(sampleIds).not.toContain("baseline-130");
  });

  it("reports when the latest clean carry window is trending better", () => {
    const previous = Array.from({ length: 10 }, (_, index) =>
      shot(150 + (index % 3), 160, 0, dateForDay(index + 1)),
    );
    const latest = Array.from({ length: 5 }, (_, index) =>
      shot(158 + (index % 2), 168, 0, dateForDay(index + 20)),
    );

    const result = calculateStockCarryTrend([...previous, ...latest]);

    expect(result.status).toBe("better");
    expect(result.latestSampleSize).toBe(5);
    expect(result.previousSampleSize).toBe(10);
    expect(result.deltaYd).toBe(7);
  });

  it("reports when the latest clean carry window is trending worse", () => {
    const previous = Array.from({ length: 8 }, (_, index) =>
      shot(158 + (index % 2), 168, 0, dateForDay(index + 1)),
    );
    const latest = Array.from({ length: 5 }, (_, index) =>
      shot(151 + (index % 2), 160, 0, dateForDay(index + 20)),
    );

    const result = calculateStockCarryTrend([...previous, ...latest]);

    expect(result.status).toBe("worse");
    expect(result.deltaYd).toBe(-7.5);
  });

  it("keeps the trend building until both windows have enough clean shots", () => {
    const result = calculateStockCarryTrend([
      shot(150, 160, 0, dateForDay(1)),
      shot(151, 161, 0, dateForDay(2)),
      shot(152, 162, 0, dateForDay(3)),
      shot(153, 163, 0, dateForDay(4)),
      shot(154, 164, 0, dateForDay(5)),
    ]);

    expect(result.status).toBe("building");
    expect(result.deltaYd).toBeNull();
  });
});

function shot(
  carryYd: number,
  totalYd: number,
  sideCarryYd: number,
  shotAt = "2026-05-08T12:00:00.000Z",
) {
  return {
    carryYd,
    totalYd,
    sideCarryYd,
    ballSpeedMph: 120,
    launchAngleDeg: 14,
    shotCategory: "full",
    qualityTag: null,
    shotAt,
  };
}

function dateForDay(day: number) {
  return `2026-05-${day.toString().padStart(2, "0")}T12:00:00.000Z`;
}
