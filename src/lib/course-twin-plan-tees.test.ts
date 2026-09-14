import { describe, it, expect } from "vitest";
import { parsePlanTees, planHoleFromTee, planTeeStorageKey } from "./course-twin-plan-tees";
import type { CourseTwinManifest, CourseTwinHole } from "./course-twin-contract";
const hole: CourseTwinHole = {
  holeNumber: 1,
  par: 4,
  yards: 400,
  strokeIndex: 1,
  tee: [0, 0, 0],
  green: [100, 0, 200],
  centerline: [
    [0, 0, 0],
    [100, 0, 0],
    [100, 0, 200],
  ],
};
const manifest = {
  course: { id: "one" },
  packageVersion: 2,
  origin: { latitude: 53, longitude: -3 },
  bounds: { minX: -10, maxX: 300, minZ: -10, maxZ: 300 },
  holes: [hole],
} as CourseTwinManifest;
describe("saved Plan tees", () => {
  it("round-trips choices and isolates course and package versions", () => {
    const tees = { 1: { id: "custom", point: [25, 0, 0] } };
    expect(parsePlanTees(JSON.stringify(tees), manifest)).toEqual(tees);
    expect(planTeeStorageKey(manifest)).not.toEqual(
      planTeeStorageKey({ ...manifest, packageVersion: 3 }),
    );
    expect(planTeeStorageKey(manifest)).not.toEqual(
      planTeeStorageKey({ ...manifest, course: { ...manifest.course, id: "two" } }),
    );
  });
  it("rejects bad JSON, nonfinite, unknown holes and out of bounds positions", () => {
    expect(parsePlanTees("bad", manifest)).toEqual({});
    expect(
      parsePlanTees(
        JSON.stringify({ 1: { id: "bad", point: [999, 0, 0] }, 2: { id: "x", point: [1, 0, 1] } }),
        manifest,
      ),
    ).toEqual({});
    expect(parsePlanTees('{"1":{"id":"x","point":[1e999,0,0]}}', manifest)).toEqual({});
  });
  it("joins a forward tee beyond a dogleg without turning back", () => {
    const result = planHoleFromTee(hole, [100, 0, 50]);
    expect(result.centerline).toEqual([
      [100, 0, 50],
      [100, 0, 200],
    ]);
    expect(result.tee).toEqual([100, 0, 50]);
    expect(hole.tee).toEqual([0, 0, 0]);
    expect(result.yards).toBe(400); // Official scorecard yardage is not an invented tee measurement.
  });
});
