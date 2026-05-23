import { describe, expect, it } from "vitest";

import { distanceMeters } from "@/lib/geo/yard-projection";
import type { ShotPatternResult } from "@/lib/shot-patterns";
import { projectShotPatternOntoHole } from "./shot-pattern-projection";

describe("shot pattern projection", () => {
  it("projects pattern points around the hole centerline", () => {
    const projected = projectShotPatternOntoHole({
      holeGeometry: [
        [0, 0],
        [0.01, 0],
      ],
      holeYards: 300,
      pattern: pattern(),
    });

    expect(projected.points).toHaveLength(3);
    expect(projected.summary.medianLatLng).not.toBeNull();
    expect(projected.points[0].latLng[0]).toBeGreaterThan(0);
  });

  it("puts positive sideYd right of bearing and negative sideYd left", () => {
    const projected = projectShotPatternOntoHole({
      holeGeometry: [
        [0, 0],
        [0.01, 0],
      ],
      holeYards: 300,
      pattern: pattern(),
    });
    const straight = projected.points.find((point) => point.id === "straight");
    const right = projected.points.find((point) => point.id === "right");
    const left = projected.points.find((point) => point.id === "left");

    expect(straight).toBeDefined();
    expect(right?.latLng[1]).toBeGreaterThan(straight!.latLng[1]);
    expect(left?.latLng[1]).toBeLessThan(straight!.latLng[1]);
    expect(distanceMeters(straight!.latLng, right!.latLng)).toBeGreaterThan(20);
  });

  it("shifts projected dispersion when the aim target moves right or left", () => {
    const centered = projectShotPatternOntoHole({
      holeGeometry: [
        [0, 0],
        [0.01, 0],
      ],
      holeYards: 300,
      pattern: pattern(),
    });
    const rightAim = projectShotPatternOntoHole({
      holeGeometry: [
        [0, 0],
        [0.01, 0],
      ],
      holeYards: 300,
      pattern: pattern(),
      aimOffsetYd: 25,
    });
    const leftAim = projectShotPatternOntoHole({
      holeGeometry: [
        [0, 0],
        [0.01, 0],
      ],
      holeYards: 300,
      pattern: pattern(),
      aimOffsetYd: -25,
    });

    const centeredStraight = centered.points.find((point) => point.id === "straight");
    const rightStraight = rightAim.points.find((point) => point.id === "straight");
    const leftStraight = leftAim.points.find((point) => point.id === "straight");

    expect(rightStraight?.sideYd).toBe(0);
    expect(rightStraight?.latLng[1]).toBeGreaterThan(centeredStraight!.latLng[1]);
    expect(leftStraight?.latLng[1]).toBeLessThan(centeredStraight!.latLng[1]);
  });
});

function pattern(): ShotPatternResult {
  return {
    clubId: null,
    clubType: "driver",
    clubLabel: "Driver",
    mode: "total",
    outlierMode: "best90",
    points: [
      { id: "straight", distanceYd: 250, forwardYd: 250, sideYd: 0, included: true },
      { id: "right", distanceYd: 252, forwardYd: 250, sideYd: 30, included: true },
      { id: "left", distanceYd: 252, forwardYd: 250, sideYd: -30, included: true },
    ],
    summary: {
      sampleSize: 3,
      includedSampleSize: 3,
      maxDistanceYd: 252,
      carryMedianYd: 245,
      totalMedianYd: 252,
      sideMedianYd: 0,
      sideP10Yd: -30,
      sideP90Yd: 30,
      distanceP10Yd: 250,
      distanceP50Yd: 252,
      distanceP90Yd: 252,
      leftMissYd: 30,
      rightMissYd: 30,
      shortLongSpreadYd: 2,
      confidence: "not_enough",
      warning: null,
    },
  };
}
