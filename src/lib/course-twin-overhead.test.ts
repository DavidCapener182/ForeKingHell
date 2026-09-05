import { describe, expect, it } from "vitest";
import type { CourseTwinHole, CourseTwinReplayShot } from "./course-twin-contract";
import { overheadProjection, overheadReplayPosition } from "./course-twin-overhead";

const hole: CourseTwinHole = {
  holeNumber: 2,
  par: 4,
  yards: 360,
  strokeIndex: null,
  tee: [0, 0, 0],
  green: [300, 0, 0],
  centerline: [
    [0, 0, 0],
    [150, 0, 25],
    [300, 0, 0],
  ],
};
const shot = {
  start: [0, 0, 0],
  carryEnd: [200, 0, 20],
  totalEnd: [220, 0, 20],
  trajectory: [
    [0, 0, 0],
    [100, 30, 10],
    [200, 0, 20],
  ],
  rollProvenance: "reconstructed",
} as CourseTwinReplayShot;

describe("mobile overhead replay", () => {
  it("keeps measured distances isotropic and places the tee below the green", () => {
    const project = overheadProjection(hole, [shot]);
    expect(project(hole.tee)[1]).toBeGreaterThan(project(hole.green)[1]);
    const base = project([100, 0, 0]);
    const forward = project([110, 0, 0]);
    const side = project([100, 0, 10]);
    expect(Math.hypot(forward[0] - base[0], forward[1] - base[1])).toBeCloseTo(
      Math.hypot(side[0] - base[0], side[1] - base[1]),
      3,
    );
  });
  it("keeps mapped hazards and candidate landing points in the plan viewport", () => {
    const extra: [number, number, number][] = [
      [100, 0, -150],
      [200, 0, 180],
    ];
    const project = overheadProjection(hole, [], extra);
    for (const point of extra) {
      const [x, y] = project(point);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(320);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(360);
    }
  });

  it("fits a wide actual miss inside the frame instead of cropping it", () => {
    const wide = { ...shot, totalEnd: [220, 0, 400] } as CourseTwinReplayShot;
    const project = overheadProjection(hole, [wide]);
    for (const point of [hole.tee, hole.green, wide.totalEnd]) {
      const [x, y] = project(point);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(320);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(360);
    }
  });
  it("uses the supplied flight and roll, bounded at each endpoint", () => {
    expect(overheadReplayPosition(shot, -1)).toEqual(shot.start);
    expect(overheadReplayPosition(shot, 0.4)).toEqual([100, 30, 10]);
    expect(overheadReplayPosition(shot, 0.8)).toEqual(shot.carryEnd);
    expect(overheadReplayPosition(shot, 0.9)[0]).toBeCloseTo(210);
    expect(overheadReplayPosition(shot, 2)).toEqual(shot.totalEnd);
  });
  it("never animates an unavailable roll or fabricates a flight arc", () => {
    const missing = {
      ...shot,
      rollProvenance: "unavailable",
      trajectory: [],
    } as CourseTwinReplayShot;
    expect(overheadReplayPosition(missing, 1)).toEqual(missing.carryEnd);
    expect(overheadReplayPosition(missing, 0.5)).toEqual([100, 0, 10]);
  });
});
