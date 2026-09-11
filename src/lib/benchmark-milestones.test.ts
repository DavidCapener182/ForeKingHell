import { describe, expect, it } from "vitest";
import { benchmarkMilestones, nearestBenchmarkUnlocks } from "./benchmark-milestones";
import { buildClubBenchmarkRows } from "./club-benchmarks";

describe("benchmark level-ups", () => {
  const snapshot = (sessionId: string, carryYd: number, day: number) => ({
    sessionId,
    carryYd,
    date: `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`,
    sampleSize: 30,
  });
  it("celebrates the exact Average threshold, preserving its source session", () => {
    expect(
      benchmarkMilestones("driver", [snapshot("before", 219.9, 1), snapshot("unlock", 220, 2)]),
    ).toEqual([
      expect.objectContaining({
        sessionId: "unlock",
        from: "Beginner",
        to: "Average",
        carryYd: 220,
      }),
    ]);
  });
  it("does not invent a promotion for an initial sample or no data", () => {
    expect(benchmarkMilestones("driver", [snapshot("first", 250, 1)])).toEqual([]);
    expect(benchmarkMilestones("driver", [{ ...snapshot("empty", 0, 1), sampleSize: 0 }])).toEqual(
      [],
    );
  });
  it("does not award the same level twice after a dip or on recalculation", () => {
    const snapshots = [
      snapshot("a", 210, 1),
      snapshot("b", 220, 2),
      snapshot("c", 215, 3),
      snapshot("d", 225, 4),
      snapshot("e", 250, 5),
    ];
    expect(benchmarkMilestones("driver", snapshots).map((milestone) => milestone.to)).toEqual([
      "Average",
      "Good",
    ]);
    expect(benchmarkMilestones("driver", snapshots)).toEqual(
      benchmarkMilestones("driver", [...snapshots].reverse()),
    );
  });
  it("removes promotions no longer supported after a correction", () => {
    expect(benchmarkMilestones("driver", [snapshot("a", 210, 1), snapshot("b", 219, 2)])).toEqual(
      [],
    );
  });
  it("ranks progress within the current band and excludes missing or completed targets", () => {
    const rows = buildClubBenchmarkRows([
      {
        clubId: "driver",
        clubType: "driver",
        carryYd: 220,
        sampleSize: 30,
        confidenceScore: 90,
        brandModel: "",
      },
      {
        clubId: "sw",
        clubType: "sw",
        carryYd: 93.5,
        sampleSize: 30,
        confidenceScore: 90,
        brandModel: "",
      },
      {
        clubId: "empty",
        clubType: "7i",
        carryYd: null,
        sampleSize: 0,
        confidenceScore: 0,
        brandModel: "",
      },
      {
        clubId: "tour",
        clubType: "8i",
        carryYd: 200,
        sampleSize: 30,
        confidenceScore: 90,
        brandModel: "",
      },
    ]);
    expect(
      nearestBenchmarkUnlocks(rows).map((target) => [target.row.clubId, target.progress]),
    ).toEqual([
      ["sw", 90],
      ["driver", 0],
    ]);
  });
});
