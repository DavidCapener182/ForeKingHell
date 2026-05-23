import { describe, expect, it } from "vitest";

import {
  YARDS_TO_METERS,
  destinationPoint,
  distanceMeters,
  forwardDistanceYd,
  geometryLengthMeters,
  pointAlongGeometry,
  type LatLngPoint,
} from "./yard-projection";

describe("yard projection helpers", () => {
  it("calculates forward distance when side distance is present", () => {
    expect(forwardDistanceYd(250, 30)).toBeCloseTo(248.19, 2);
    expect(forwardDistanceYd(250, null)).toBe(250);
    expect(forwardDistanceYd(250, Number.NaN)).toBe(250);
    expect(forwardDistanceYd(null, 30)).toBeNull();
  });

  it("projects a right miss forward and right of the hole line", () => {
    const holeGeometry: LatLngPoint[] = [
      [0, 0],
      [0.01, 0],
    ];
    const distanceYd = 250;
    const sideYd = 30;
    const forwardYd = forwardDistanceYd(distanceYd, sideYd);

    expect(forwardYd).not.toBeNull();

    const projected = pointAlongGeometry(holeGeometry, forwardYd! / 300);
    const end = destinationPoint(
      projected.point,
      projected.bearingDeg + 90,
      sideYd * YARDS_TO_METERS,
    );

    expect(end[0]).toBeGreaterThan(holeGeometry[0][0]);
    expect(end[1]).toBeGreaterThan(projected.point[1]);
  });

  it("uses positive side distance as right and negative side distance as left", () => {
    const holeGeometry: LatLngPoint[] = [
      [0, 0],
      [0.01, 0],
    ];
    const projected = pointAlongGeometry(holeGeometry, 0.5);
    const right = destinationPoint(
      projected.point,
      projected.bearingDeg + 90,
      25 * YARDS_TO_METERS,
    );
    const left = destinationPoint(projected.point, projected.bearingDeg - 90, 25 * YARDS_TO_METERS);

    expect(right[1]).toBeGreaterThan(projected.point[1]);
    expect(left[1]).toBeLessThan(projected.point[1]);
    expect(distanceMeters(projected.point, right)).toBeCloseTo(
      distanceMeters(projected.point, left),
      5,
    );
  });

  it("projects along multi-point hole geometry", () => {
    const doglegGeometry: LatLngPoint[] = [
      [0, 0],
      [0.005, 0],
      [0.005, 0.005],
    ];
    const projected = pointAlongGeometry(doglegGeometry, 0.75);

    expect(projected.point[0]).toBeCloseTo(0.005, 4);
    expect(projected.point[1]).toBeGreaterThan(0);
    expect(projected.bearingDeg).toBeGreaterThan(80);
    expect(projected.bearingDeg).toBeLessThan(100);
  });

  it("can project beyond the final point for over-green pattern landings", () => {
    const holeGeometry: LatLngPoint[] = [
      [0, 0],
      [0.01, 0],
    ];
    const projected = pointAlongGeometry(holeGeometry, 1.1);

    expect(projected.point[0]).toBeGreaterThan(0.01);
    expect(projected.point[1]).toBeCloseTo(0, 5);
  });

  it("does not blow up on zero-length or bad geometry", () => {
    const zeroLengthGeometry: LatLngPoint[] = [
      [51.5, -2.2],
      [51.5, -2.2],
    ];
    const badGeometry = [
      [Number.NaN, -2.2],
      [51.5, -2.2],
      [51.5, -2.2],
    ] as LatLngPoint[];

    expect(pointAlongGeometry([], 0.5)).toEqual({ point: [0, 0], bearingDeg: 0 });
    expect(geometryLengthMeters(zeroLengthGeometry)).toBe(0);
    expect(pointAlongGeometry(zeroLengthGeometry, 0.5)).toEqual({
      point: [51.5, -2.2],
      bearingDeg: 0,
    });
    expect(pointAlongGeometry(badGeometry, Number.NaN)).toEqual({
      point: [51.5, -2.2],
      bearingDeg: 0,
    });
  });
});
