import { describe, expect, it } from "vitest";

import {
  buildShotPatternTargetLine,
  nearestDistanceYdAlongGeometry,
  nearestTargetPlacementOnGeometry,
} from "@/lib/shot-pattern-target";

const straightHole: Array<[number, number]> = [
  [53.0, -2.0],
  [53.002, -2.0],
];

describe("shot pattern target line", () => {
  it("builds a left-to-right miss line across the selected target distance", () => {
    const target = buildShotPatternTargetLine({
      holeGeometry: straightHole,
      holeYards: 250,
      targetDistanceYd: 180,
      points: [
        { id: "left", sideYd: -24, included: true },
        { id: "center", sideYd: 0, included: true },
        { id: "right", sideYd: 31, included: true },
      ],
    });

    expect(target?.targetDistanceYd).toBe(180);
    expect(target?.leftMissYd).toBe(24);
    expect(target?.rightMissYd).toBe(31);
    expect(target?.points).toHaveLength(3);
    expect(target?.beyondCapability).toBe(false);
  });

  it("marks estimated fairway corridor points green and wide misses red", () => {
    const target = buildShotPatternTargetLine({
      holeGeometry: straightHole,
      holeYards: 250,
      targetDistanceYd: 180,
      points: [
        { id: "playable", sideYd: 10, included: true },
        { id: "trouble", sideYd: 45, included: true },
      ],
    });

    expect(target?.surfaceMode).toBe("estimated");
    expect(target?.points.find((point) => point.id === "playable")?.surface).toBe("playable");
    expect(target?.points.find((point) => point.id === "trouble")?.surface).toBe("trouble");
  });

  it("keeps estimated fairway playable while mapped water overrides it", () => {
    const target = buildShotPatternTargetLine({
      holeGeometry: straightHole,
      holeYards: 250,
      targetDistanceYd: 180,
      points: [
        { id: "center", sideYd: 0, included: true },
        { id: "water", sideYd: 35, included: true },
      ],
      features: [
        {
          id: "estimated-fairway",
          featureType: "fairway",
          source: "estimated_centerline",
          geometryJson: square(-2.001, 53.00125, -1.9988, 53.0017),
        },
        {
          id: "mapped-water",
          featureType: "water",
          source: "osm",
          geometryJson: square(-1.99975, 53.00125, -1.9988, 53.0017),
        },
      ],
    });

    expect(target?.surfaceMode).toBe("mapped");
    expect(target?.points.find((point) => point.id === "center")?.surface).toBe("playable");
    expect(target?.points.find((point) => point.id === "water")?.surface).toBe("trouble");
  });

  it("does not score the target line when the selected distance is beyond club capability", () => {
    const target = buildShotPatternTargetLine({
      holeGeometry: straightHole,
      holeYards: 320,
      targetDistanceYd: 280,
      points: [
        { id: "short-left", distanceYd: 245, sideYd: -18, included: true },
        { id: "long-right", distanceYd: 260, sideYd: 24, included: true },
      ],
    });

    expect(target?.beyondCapability).toBe(true);
    expect(target?.capabilityDistanceYd).toBe(260);
    expect(target?.playablePercent).toBeNull();
    expect(target?.segments.every((segment) => segment.surface === "unavailable")).toBe(true);
    expect(target?.points.every((point) => point.surface === "unavailable")).toBe(true);
  });

  it("moves the target line left and right while keeping miss width relative to the aim", () => {
    const centeredTarget = buildShotPatternTargetLine({
      holeGeometry: straightHole,
      holeYards: 250,
      targetDistanceYd: 180,
      points: [
        { id: "left", sideYd: -20, included: true },
        { id: "right", sideYd: 20, included: true },
      ],
    });
    const rightAimTarget = buildShotPatternTargetLine({
      holeGeometry: straightHole,
      holeYards: 250,
      targetDistanceYd: 180,
      aimOffsetYd: 35,
      points: [
        { id: "left", sideYd: -20, included: true },
        { id: "right", sideYd: 20, included: true },
      ],
    });

    expect(rightAimTarget?.aimOffsetYd).toBe(35);
    expect(rightAimTarget?.center[1]).toBeGreaterThan(centeredTarget?.center[1] ?? 0);
    expect(rightAimTarget?.points.find((point) => point.id === "left")?.surface).toBe("playable");
    expect(rightAimTarget?.points.find((point) => point.id === "right")?.surface).toBe("trouble");
  });

  it("finds the nearest target distance along a multi-point hole line", () => {
    const distance = nearestDistanceYdAlongGeometry(
      [
        [53.0, -2.0],
        [53.001, -2.0],
        [53.001, -1.999],
      ],
      [53.001, -1.9995],
    );

    expect(distance).toBeGreaterThan(120);
    expect(distance).toBeLessThan(190);
  });

  it("finds target distance and lateral aim from a dragged point", () => {
    const rightPlacement = nearestTargetPlacementOnGeometry(straightHole, [53.001, -1.9996]);
    const leftPlacement = nearestTargetPlacementOnGeometry(straightHole, [53.001, -2.0004]);

    expect(rightPlacement.distanceYd).toBeGreaterThan(100);
    expect(rightPlacement.aimOffsetYd).toBeGreaterThan(20);
    expect(leftPlacement.distanceYd).toBeGreaterThan(100);
    expect(leftPlacement.aimOffsetYd).toBeLessThan(-20);
  });

  it("scales dragged target distance to the selected playing length", () => {
    const placement = nearestTargetPlacementOnGeometry(straightHole, [53.001, -2.0], 500);

    expect(placement.distanceYd).toBeGreaterThan(240);
    expect(placement.distanceYd).toBeLessThan(260);
  });
});

function square(minLng: number, minLat: number, maxLng: number, maxLat: number) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}
