import { describe, expect, it } from "vitest";

import {
  benchmarkDisplayProgressPercent,
  benchmarkLevelProgressPercent,
  buildClubBenchmarkRows,
  compareClubCarryToBenchmark,
  getClubBenchmarkMetricLevels,
  getClubDistanceBenchmark,
  getClubSpeedBenchmarkTarget,
} from "@/lib/club-benchmarks";

describe("club distance benchmarks", () => {
  it("maps numbered hybrids to the hybrid benchmark", () => {
    const benchmark = getClubDistanceBenchmark("4h");

    expect(benchmark?.clubType).toBe("hybrid");
    expect(benchmark?.levels.map((level) => level.yards)).toEqual([145, 180, 190, 210, 242]);
  });

  it("classifies carry against the highest achieved level and next target", () => {
    const comparison = compareClubCarryToBenchmark("7i", 154);

    expect(comparison?.levelLabel).toBe("Good");
    expect(comparison?.nextLevel?.label).toBe("Advanced");
    expect(comparison?.yardsToNextLevel).toBe(11);
  });

  it("marks carries above the top reference as tour plus", () => {
    const comparison = compareClubCarryToBenchmark("driver", 305);

    expect(comparison?.levelLabel).toBe("Tour+");
    expect(comparison?.nextLevel).toBeNull();
    expect(comparison?.progressPercent).toBe(100);
  });

  it("keeps clubs without carry data in benchmark order", () => {
    const rows = buildClubBenchmarkRows([
      {
        clubId: "seven",
        clubType: "7i",
        brandModel: "Model",
        carryYd: null,
        sampleSize: 0,
        confidenceScore: 0,
      },
      {
        clubId: "driver",
        clubType: "driver",
        brandModel: "Model",
        carryYd: 230,
        sampleSize: 12,
        confidenceScore: 55,
      },
    ]);

    expect(rows.map((row) => row.clubType)).toEqual(["driver", "7i"]);
    expect(rows[1].comparison.levelLabel).toBe("Needs data");
  });

  it("positions uneven benchmark ticks on the same yard scale as the carry marker", () => {
    const benchmark = getClubDistanceBenchmark("sw");
    const comparison = compareClubCarryToBenchmark("sw", 90.3);

    expect(benchmark).not.toBeNull();
    expect(comparison?.levelLabel).toBe("Average");
    expect(comparison?.yardsToNextLevel).toBe(4.7);

    const goodTick = benchmarkLevelProgressPercent(benchmark!, 95);

    expect(comparison?.progressPercent).toBeLessThan(goodTick);
  });

  it("keeps compact meter progress inside the current level band", () => {
    const benchmark = getClubDistanceBenchmark("sw");
    const displayProgress = benchmarkDisplayProgressPercent(benchmark!, 90.3);

    expect(displayProgress).toBeGreaterThan(25);
    expect(displayProgress).toBeLessThan(50);
  });

  it("infers club speed benchmark levels from the same carry ladder", () => {
    const levels = getClubBenchmarkMetricLevels("7i", "clubSpeedMph", 1);

    expect(levels?.map((level) => [level.key, level.value])).toEqual([
      ["beginner", 69.4],
      ["average", 78.3],
      ["good", 81],
      ["advanced", 85],
      ["tour", 90],
    ]);
  });

  it("picks the next club speed benchmark as the system target", () => {
    const target = getClubSpeedBenchmarkTarget("7i", 78.9);

    expect(target).toMatchObject({
      targetSpeedMph: 81,
      targetLevelKey: "good",
      targetLevelLabel: "Good",
      currentLevelKey: "average",
      currentLevelLabel: "Average",
      gapMph: 2.1,
    });
  });

  it("advances the system target after the current benchmark is reached", () => {
    const target = getClubSpeedBenchmarkTarget("7i", 81);

    expect(target).toMatchObject({
      targetSpeedMph: 85,
      targetLevelKey: "advanced",
      targetLevelLabel: "Advanced",
      currentLevelKey: "good",
      currentLevelLabel: "Good",
      gapMph: 4,
    });
  });
});
