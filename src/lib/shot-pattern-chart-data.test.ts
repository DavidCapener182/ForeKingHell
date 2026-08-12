import { describe, expect, it } from "vitest";

import {
  buildShotPatternPoints,
  defaultShotPatternClub,
  deterministicShotSample,
  shotPatternClubs,
  shotPatternConfidence,
  summarizeShotPattern,
  type ShotPatternPoint,
} from "@/lib/shot-pattern-chart-data";

function point(index: number, clubType = "7i", sideCarryYd = 0): ShotPatternPoint {
  return {
    id: `${clubType}-${index}`,
    clubType,
    clubLabel: clubType,
    carryYd: 150 + index,
    sideCarryYd,
    apexFt: 80,
    launchAngleDeg: 18,
    shotNumber: index + 1,
    shotAt: null,
    trusted: true,
  };
}

describe("mobile shot pattern data", () => {
  it("excludes questionable quality rows from a trusted pattern summary", () => {
    const trusted = buildShotPatternPoints([
      {
        id: "clean",
        clubType: "7i",
        carryYd: 150,
        sideCarryYd: 4,
        apexFt: 80,
      },
      {
        id: "mishit",
        clubType: "7i",
        carryYd: 95,
        sideCarryYd: 45,
        apexFt: 20,
        qualityTag: "mishit",
      },
    ]).filter((shot) => shot.trusted);

    expect(summarizeShotPattern(trusted).sampleSize).toBe(1);
    expect(trusted.map((shot) => shot.id)).toEqual(["clean"]);
  });

  it("uses the requested focus club and selected-club confidence", () => {
    const points = [
      ...Array.from({ length: 18 }, (_, index) => point(index, "7i")),
      point(1, "driver"),
    ];
    const clubs = shotPatternClubs(points);
    expect(defaultShotPatternClub(clubs, "driver")).toBe("driver");
    expect(shotPatternConfidence(points.filter((item) => item.clubType === "driver")).label).toBe(
      "Low",
    );
    expect(shotPatternConfidence(points.filter((item) => item.clubType === "7i")).label).toBe(
      "High",
    );
  });

  it("derives typical miss from distribution rather than the wider bound", () => {
    const points = [
      ...Array.from({ length: 9 }, (_, index) => point(index, "7i", 8 + index)),
      point(10, "7i", -35),
      point(11, "7i", 0),
    ];
    const summary = summarizeShotPattern(points);
    expect(summary.typicalMiss).toBe("Right");
    expect(summary.widerSide).toBe("Left");
  });

  it("uses each club's playable corridor in a mixed-club view", () => {
    const points = [point(1, "driver", 28), point(2, "wedge", 28)];
    expect(summarizeShotPattern(points).insideCorridor).toBe(1);
  });

  it("downsamples deterministically without taking the first arbitrary rows", () => {
    const points = Array.from({ length: 240 }, (_, index) =>
      point(index, "7i", index === 239 ? 80 : index % 12),
    );
    const first = deterministicShotSample(points, 80);
    const second = deterministicShotSample(points, 80);
    expect(first.downsampled).toBe(true);
    expect(first.points).toHaveLength(80);
    expect(first.points.map((item) => item.id)).toEqual(second.points.map((item) => item.id));
    expect(first.points.some((item) => item.id === "7i-239")).toBe(true);
  });
});
