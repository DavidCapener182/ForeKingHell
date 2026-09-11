import { describe, expect, it } from "vitest";
import {
  benchmarkMilestones,
  benchmarkSessionHistory,
  nearestBenchmarkUnlocks,
} from "./benchmark-milestones";
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

it("keeps same-noon imports separate and credits the later import", () => {
  const shots = [
    {
      sessionId: "a-later",
      shotAt: "2026-09-08T12:00:00Z",
      sessionCreatedAt: "2026-09-08T19:00:00Z",
      carry: 230,
    },
    {
      sessionId: "z-earlier",
      shotAt: "2026-09-08T12:00:00Z",
      sessionCreatedAt: "2026-09-08T18:00:00Z",
      carry: 210,
    },
  ];
  const history = benchmarkSessionHistory(shots);
  expect(history.map((row) => row.shots.map((shot) => shot.sessionId))).toEqual([
    ["z-earlier"],
    ["z-earlier", "a-later"],
  ]);
  const milestones = benchmarkMilestones(
    "driver",
    history.map((row) => ({
      ...row,
      carryYd: row.shots.reduce((sum, shot) => sum + shot.carry, 0) / row.shots.length,
      sampleSize: row.shots.length,
    })),
  );
  expect(milestones).toHaveLength(1);
  expect(milestones[0].sessionId).toBe("a-later");
});
