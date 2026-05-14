import { describe, expect, it } from "vitest";

import {
  buildClubBenchmarkRows,
  compareClubCarryToBenchmark,
  getClubDistanceBenchmark,
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
});
