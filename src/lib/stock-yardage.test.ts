import { describe, expect, it } from "vitest";

import {
  calculatePersonalBestTotalYd,
  calculateStockCarryTrend,
  calculateStockYardage,
  classifyStockShotRole,
  explainStockExclusions,
  selectLatestReliableStockShots,
  selectPersonalBestCarryShot,
  selectPersonalBestTotalShot,
  selectStockYardageShots,
  summarizeStockShotRoles,
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
    expect(result.bestStockCarryYd).toBe(151.5);
    expect(result.personalBestCarryYd).toBe(153);
    expect(result.stockExclusionReasons).toEqual([
      { key: "outlier", label: "Outlier filter", count: 1 },
    ]);
    expect(result.latestReliableCarryYd).toBeNull();
    expect(result.coursePlayCarryYd).toBeNull();
    expect(result.recommendedPlayNumberYd).toBeNull();
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
    expect(result.stockExclusionCount).toBe(5);
  });

  it("excludes every non-evidence lifecycle state while restored overrides compatibility tags", () => {
    const rows = [
      { ...shot(140, 148, 0), id: "included", reviewStatus: "included" as const },
      {
        ...shot(141, 149, 0),
        id: "restored",
        reviewStatus: "restored" as const,
        qualityTag: "mishit",
      },
      {
        ...shot(230, 240, 0),
        id: "suggested",
        reviewStatus: "suggested_exclusion" as const,
      },
      {
        ...shot(231, 241, 0),
        id: "excluded",
        reviewStatus: "user_excluded" as const,
        qualityTag: null,
      },
      {
        ...shot(232, 242, 0),
        id: "legacy-quality",
        reviewStatus: "included" as const,
        qualityTag: "mishit",
      },
    ];

    expect(selectStockYardageShots(rows).filteredShots.map((row) => row.id)).toEqual([
      "restored",
      "included",
    ]);
    expect(calculateStockYardage(rows).stockExclusionReasons).toEqual(
      expect.arrayContaining([
        { key: "review-status", label: "Review status", count: 2 },
        { key: "quality-tag", label: "Quality tag", count: 1 },
      ]),
    );
  });

  it("lets restoration override a legacy warm-up classification but not a real chip role", () => {
    const restoredWarmUp = {
      ...shot(135, 142, 0),
      id: "restored-warm-up",
      reviewStatus: "restored" as const,
      shotCategory: "warm_up",
    };
    const restoredChip = {
      ...shot(30, 34, 0),
      id: "restored-chip",
      reviewStatus: "restored" as const,
      shotCategory: "chip",
    };

    expect(selectStockYardageShots([restoredWarmUp, restoredChip]).filteredShots).toEqual([
      restoredWarmUp,
    ]);
  });

  it("keeps sand wedge chips and pitches out of full-stock yardage", () => {
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

    expect(result.sampleSize).toBe(0);
    expect(result.carryMedianYd).toBeNull();
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
    expect(result.bestStockCarryYd).toBe(145.5);
    expect(result.personalBestCarryYd).toBe(156);
    expect(result.bestSampleFloorYd).toBe(136);
    expect(sampleIds).toContain("new-best");
    expect(sampleIds).toContain("baseline-154");
    expect(sampleIds).toContain("baseline-136");
    expect(sampleIds).not.toContain("baseline-135");
    expect(sampleIds).not.toContain("baseline-130");
  });

  it("shows a one-off clean personal best without turning Best Stock into the max", () => {
    const steadyDriver = Array.from({ length: 20 }, (_, index) => ({
      ...shot(210, 225, 0, dateForSequence(index)),
      id: `steady-${index}`,
    }));
    const personalBest = { ...shot(227, 241, 0, dateForSequence(25)), id: "pb-driver" };
    const allShots = [...steadyDriver, personalBest];
    const result = calculateStockYardage(allShots, allShots.length, { clubType: "driver" });
    const personalBestShot = selectPersonalBestCarryShot(allShots, allShots.length, {
      clubType: "driver",
    });

    expect(result.bestStockCarryYd).toBe(210);
    expect(result.personalBestCarryYd).toBe(227);
    expect(personalBestShot?.id).toBe("pb-driver");
  });

  it("tracks clean personal best total separately from carry", () => {
    const shots = [
      { ...shot(210, 241, 0, dateForSequence(1)), id: "long-total" },
      { ...shot(227, 238, 0, dateForSequence(2)), id: "long-carry" },
      { ...shot(235, 260, 0, dateForSequence(3)), id: "bad-data", qualityTag: "bad_data" },
    ];
    const personalBestCarryShot = selectPersonalBestCarryShot(shots, shots.length, {
      clubType: "driver",
    });
    const personalBestTotalShot = selectPersonalBestTotalShot(shots, shots.length, {
      clubType: "driver",
    });

    expect(personalBestCarryShot?.id).toBe("long-carry");
    expect(personalBestTotalShot?.id).toBe("long-total");
    expect(calculatePersonalBestTotalYd(shots, shots.length, { clubType: "driver" })).toBe(241);
  });

  it("keeps personal bests all-time even when the record is older than the latest 50 shots", () => {
    const allTimeBest = { ...shot(230, 252, 0, dateForSequence(0)), id: "all-time-best" };
    const recentShots = Array.from({ length: 60 }, (_, index) => ({
      ...shot(205 + (index % 5), 225 + (index % 5), 0, dateForSequence(index + 1)),
      id: `recent-${index}`,
    }));

    expect(selectPersonalBestCarryShot([allTimeBest, ...recentShots])?.id).toBe("all-time-best");
    expect(selectPersonalBestTotalShot([allTimeBest, ...recentShots])?.id).toBe("all-time-best");
  });

  it("uses latest reliable carry from recent chronological shots, not longest shots", () => {
    const olderBest = Array.from({ length: 20 }, (_, index) =>
      shot(220, 235, 0, dateForSequence(index)),
    );
    const latestNormal = Array.from({ length: 20 }, (_, index) =>
      shot(200, 214, 0, dateForSequence(index + 20)),
    );
    const allShots = [...olderBest, ...latestNormal];
    const result = calculateStockYardage(allShots, allShots.length);
    const latestSample = selectLatestReliableStockShots(allShots, allShots.length);

    expect(result.bestStockCarryYd).toBe(220);
    expect(result.latestReliableSampleSize).toBe(20);
    expect(result.latestReliableCarryYd).toBe(200);
    expect(result.latestReliableCarryP25Yd).toBe(200);
    expect(result.latestReliableCarryP75Yd).toBe(200);
    expect(result.coursePlayCarryYd).toBe(210);
    expect(latestSample.filteredShots.every((sampleShot) => sampleShot.carryYd === 200)).toBe(true);
  });

  it("adds a latest reliable carry window from the recent filtered sample", () => {
    const olderBest = Array.from({ length: 20 }, (_, index) =>
      shot(220, 235, 0, dateForSequence(index)),
    );
    const latestWindow = [
      192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210,
      211,
    ].map((carryYd, index) => shot(carryYd, carryYd + 12, 0, dateForSequence(index + 20)));
    const result = calculateStockYardage([...olderBest, ...latestWindow], 50);

    expect(result.latestReliableCarryYd).toBe(201.5);
    expect(result.latestReliableCarryP25Yd).toBe(196.8);
    expect(result.latestReliableCarryP75Yd).toBe(206.3);
  });

  it("hybrid course play keeps an optimistic driver and honest pitching wedge number", () => {
    const driverShots = [
      ...Array.from({ length: 20 }, (_, index) => shot(220, 235, 0, dateForSequence(index))),
      ...Array.from({ length: 20 }, (_, index) => shot(200, 214, 0, dateForSequence(index + 20))),
    ];
    const pitchingWedgeShots = [
      ...Array.from({ length: 20 }, (_, index) => shot(125, 132, 0, dateForSequence(index))),
      ...Array.from({ length: 20 }, (_, index) => shot(115, 120, 0, dateForSequence(index + 20))),
    ];

    expect(calculateStockYardage(driverShots, driverShots.length).coursePlayCarryYd).toBe(210);
    expect(
      calculateStockYardage(pitchingWedgeShots, pitchingWedgeShots.length).coursePlayCarryYd,
    ).toBe(120);
  });

  it("classifies wedge roles and keeps only full wedge shots in stock samples", () => {
    const shots = [
      { ...shot(22, 25, 1), id: "chip", clubType: "sw", shotCategory: "chip" },
      { ...shot(52, 57, 1), id: "pitch", clubType: "sw", shotCategory: "full" },
      { ...shot(84, 88, 1), id: "full-1", clubType: "sw", shotCategory: "full" },
      { ...shot(92, 96, 1), id: "full-2", clubType: "sw", shotCategory: "full" },
    ];
    const sample = selectStockYardageShots(shots, 50, { clubType: "sw" });
    const roleSummaries = summarizeStockShotRoles(shots, 50, { clubType: "sw" });

    expect(classifyStockShotRole(shots[0], { clubType: "sw" })).toBe("chip-touch");
    expect(classifyStockShotRole(shots[1], { clubType: "sw" })).toBe("pitch");
    expect(classifyStockShotRole(shots[2], { clubType: "sw" })).toBe("full");
    expect(sample.filteredShots.map((sampleShot) => sampleShot.id)).toEqual(["full-2", "full-1"]);
    expect(roleSummaries).toEqual([
      {
        role: "full",
        sampleSize: 2,
        carryMedianYd: 88,
        carryP25Yd: 86,
        carryP75Yd: 90,
        longestCarryYd: 92,
      },
      {
        role: "pitch",
        sampleSize: 1,
        carryMedianYd: 52,
        carryP25Yd: 52,
        carryP75Yd: 52,
        longestCarryYd: 52,
      },
      {
        role: "chip-touch",
        sampleSize: 1,
        carryMedianYd: 22,
        carryP25Yd: 22,
        carryP75Yd: 22,
        longestCarryYd: 22,
      },
    ]);
  });

  it("filters lifecycle and domain exclusions before applying the role-summary window", () => {
    const excludedStatuses = [
      "suggested_exclusion",
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ] as const;
    const excludedRows = excludedStatuses.map((reviewStatus, index) => ({
      ...shot(220 + index, 230 + index, 0, dateForDay(20 + index)),
      clubType: "sw",
      reviewStatus,
    }));
    const roleSummaries = summarizeStockShotRoles(
      [
        { ...shot(90, 96, 0, dateForDay(1)), clubType: "sw", reviewStatus: "included" },
        {
          ...shot(92, 98, 0, dateForDay(2)),
          clubType: "sw",
          reviewStatus: "restored",
          qualityTag: "mishit",
        },
        {
          ...shot(240, 250, 0, dateForDay(30)),
          clubType: "sw",
          reviewStatus: "included",
          shotCategory: "recovery",
        },
        ...excludedRows,
      ],
      2,
      { clubType: "sw" },
    );

    expect(roleSummaries).toEqual([
      {
        role: "full",
        sampleSize: 2,
        carryMedianYd: 91,
        carryP25Yd: 90.5,
        carryP75Yd: 91.5,
        longestCarryYd: 92,
      },
    ]);
  });

  it("explains why rows did not feed the best-stock sample", () => {
    const rows = [
      ...Array.from({ length: 21 }, (_, index) =>
        shot(150 + index, 165, 0, dateForSequence(index)),
      ),
      { ...shot(25, 28, 0, dateForSequence(30)), clubType: "sw", shotCategory: "chip" },
      { ...shot(50, 55, 0, dateForSequence(31)), clubType: "sw", shotCategory: "full" },
      { ...shot(180, 190, 0, dateForSequence(32)), qualityTag: "mishit" },
      { ...shot(0, 0, 0, dateForSequence(33)), carryYd: null },
    ];
    const reasons = explainStockExclusions(rows, rows.length, { clubType: "sw" });

    expect(reasons).toEqual(
      expect.arrayContaining([
        { key: "best-stock-rank", label: "Outside top-20 sample", count: 1 },
        { key: "shot-category", label: "Chip/pitch/recovery", count: 1 },
        { key: "shot-role", label: "Derived wedge role", count: 1 },
        { key: "quality-tag", label: "Quality tag", count: 1 },
        { key: "missing-carry", label: "Missing carry", count: 1 },
      ]),
    );
  });

  it("does not lock sand wedge course play until enough full-role shots exist", () => {
    const result = calculateStockYardage(
      Array.from({ length: 9 }, (_, index) => ({
        ...shot(80 + index, 85 + index, 0, dateForSequence(index)),
        clubType: "sw",
      })),
      50,
      { clubType: "sw" },
    );

    expect(result.sampleSize).toBe(9);
    expect(result.bestStockCarryYd).toBe(84);
    expect(result.latestReliableSampleSize).toBe(9);
    expect(result.latestReliableCarryYd).toBeNull();
    expect(result.coursePlayCarryYd).toBeNull();
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

function dateForSequence(index: number) {
  return new Date(Date.UTC(2026, 4, index + 1, 12)).toISOString();
}
