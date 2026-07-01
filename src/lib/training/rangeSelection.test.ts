import { describe, expect, it } from "vitest";

import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import type { TrainingOverTimeData } from "@/lib/training/trainingData";

describe("selectTrainingRangeData", () => {
  it("slices the already-loaded series without mutating the base payload", () => {
    const series = Array.from({ length: 10 }, (_, index): FitnessFreshnessPoint => {
      const day = index + 1;
      return {
        date: `2026-07-${String(day).padStart(2, "0")}`,
        load: day * 10,
        fitness: 80,
        fatigue: 40,
        readiness: 90,
        form: 100,
      };
    });
    const baseData = {
      rangeKey: "1y",
      rangeDays: 365,
      chartStartDate: "2026-07-01",
      today: "2026-07-10",
      series,
      sessionMarkers: [
        { date: "2026-07-03", sessionCount: 1, totalLoad: 30, title: "Old range" },
        { date: "2026-07-05", sessionCount: 1, totalLoad: 50, title: "Range" },
      ],
    } as TrainingOverTimeData;

    const selected = selectTrainingRangeData(baseData, "7d");

    expect(selected.rangeKey).toBe("7d");
    expect(selected.rangeDays).toBe(7);
    expect(selected.chartStartDate).toBe("2026-07-04");
    expect(selected.series.map((point) => point.date)).toEqual([
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
    ]);
    expect(selected.sessionMarkers.map((marker) => marker.date)).toEqual(["2026-07-05"]);
    expect(selected.averageTrainingLoad).toBe(70);
    expect(baseData.rangeKey).toBe("1y");
    expect(baseData.series).toHaveLength(10);
  });
});
