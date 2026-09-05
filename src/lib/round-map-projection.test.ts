import { describe, expect, it } from "vitest";
import { destinationPoint, distanceMeters, YARDS_TO_METERS } from "@/lib/geo/yard-projection";
import {
  groupShotsByHole,
  projectHoleShots,
  roundMapDistanceReading,
  roundMapViewport,
  type RoundMapHole,
  type RoundMapShot,
} from "./round-map-projection";
const tee: [number, number] = [53, -3];
const hole: RoundMapHole = {
  holeNumber: 1,
  par: 4,
  yards: 400,
  score: 5,
  putts: 2,
  geometry: [tee, destinationPoint(tee, 0, 400 * YARDS_TO_METERS)],
};
const shot: RoundMapShot = {
  id: "shot",
  holeNumber: 1,
  holeShotNumber: 1,
  shotNumber: 1,
  clubType: "7i",
  carryYd: 100,
  totalYd: 120,
  sideCarryYd: 60,
  distanceRemainingYd: null,
  courseHoleYards: 400,
};
describe("shared saved-round projection", () => {
  it("retains radial carry projection and joins each shot to the preceding endpoint", () => {
    const result = projectHoleShots(
      hole,
      [shot, { ...shot, id: "next", carryYd: 50, sideCarryYd: 0 }],
      "carry",
    );
    expect(distanceMeters(tee, result[0].end) / YARDS_TO_METERS).toBeCloseTo(100, 2);
    expect(result[1].start).toEqual(result[0].end);
    expect(result[0].shot).toBe(shot);
  });
  it("uses saved remaining distance for total placement and the existing fallback for carry", () => {
    const result = projectHoleShots(
      hole,
      [{ ...shot, sideCarryYd: 0, distanceRemainingYd: 100 }],
      "total",
    );
    expect(distanceMeters(tee, result[0].end) / YARDS_TO_METERS).toBeCloseTo(300, 2);
    expect(roundMapDistanceReading({ ...shot, carryYd: null }, "carry")).toEqual({
      value: 120,
      label: "total",
      fallback: true,
    });
    expect(
      roundMapDistanceReading({ ...shot, carryYd: null, totalYd: null }, "carry").value,
    ).toBeNull();
  });
  it("keeps hole assignment and recorded shot order without modifying raw input", () => {
    const input = [
      { ...shot, id: "second", holeShotNumber: 2 },
      shot,
      { ...shot, id: "unassigned", holeNumber: null },
    ];
    expect(
      groupShotsByHole(input)
        .get(1)
        ?.map((s) => s.id),
    ).toEqual(["shot", "second"]);
    expect(input[0].id).toBe("second");
  });
  it("keeps metre scale equal and fits wide misses into the mobile view", () => {
    const origin: [number, number] = [60, 2];
    const localHole = { ...hole, geometry: [origin, destinationPoint(origin, 0, 350)] };
    const wide = { shot, start: origin, end: destinationPoint(origin, 90, 500) };
    const project = roundMapViewport(localHole, [wide]);
    const start = project(origin),
      east = project(destinationPoint(origin, 90, 100)),
      north = project(destinationPoint(origin, 0, 100));
    expect(Math.hypot(east[0] - start[0], east[1] - start[1])).toBeCloseTo(
      Math.hypot(north[0] - start[0], north[1] - start[1]),
      2,
    );
    for (const point of [...localHole.geometry, wide.end]) {
      const [x, y] = project(point);
      expect(x).toBeGreaterThanOrEqual(20);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(320);
    }
  });
});
