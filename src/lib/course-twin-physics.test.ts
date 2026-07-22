import { describe, expect, it } from "vitest";

import {
  simulateCourseTwinShot,
  type CourseTwinPhysicsEnvironment,
  type CourseTwinShotInput,
} from "@/lib/course-twin-physics";

const driver: CourseTwinShotInput = {
  position: { x: 0, y: 0.02135, z: 0 },
  direction: { x: 1, z: 0 },
  ballSpeedMps: 67,
  launchAngleDeg: 12.5,
  backSpinRpm: 2_450,
  sideSpinRpm: 0,
};

const environment = (
  surface: CourseTwinPhysicsEnvironment["surfaceAt"],
): CourseTwinPhysicsEnvironment => ({
  groundHeight: () => 0,
  surfaceAt: surface,
});

describe("Course Twin deterministic golf physics", () => {
  it("produces deterministic, plausible driver flight with bounce and roll", () => {
    const first = simulateCourseTwinShot(
      driver,
      environment(() => "fairway"),
    );
    const second = simulateCourseTwinShot(
      driver,
      environment(() => "fairway"),
    );

    expect(first).toEqual(second);
    expect(first.carryDistanceM).toBeGreaterThan(165);
    expect(first.carryDistanceM).toBeLessThan(275);
    expect(first.totalDistanceM).toBeGreaterThan(first.carryDistanceM);
    expect(first.apexM).toBeGreaterThan(15);
    expect(first.bounceCount).toBeGreaterThan(0);
    expect(first.penalty).toBeNull();
  });

  it("rolls materially farther on a green than in rough", () => {
    const lowShot = { ...driver, ballSpeedMps: 34, launchAngleDeg: 8, backSpinRpm: 1_200 };
    const green = simulateCourseTwinShot(
      lowShot,
      environment(() => "green"),
    );
    const rough = simulateCourseTwinShot(
      lowShot,
      environment(() => "rough"),
    );
    const greenRoll = green.totalDistanceM - green.carryDistanceM;
    const roughRoll = rough.totalDistanceM - rough.carryDistanceM;
    expect(greenRoll).toBeGreaterThan(roughRoll + 3);
  });

  it("stops and records a water penalty at first contact", () => {
    const result = simulateCourseTwinShot(
      { ...driver, ballSpeedMps: 46 },
      environment((x) => (x > 80 ? "water" : "fairway")),
    );
    expect(result.penalty).toBe("water");
    expect(result.landingSurface).toBe("water");
    expect(result.finalSurface).toBe("water");
  });

  it("rejects impossible launch data at the simulation boundary", () => {
    expect(() =>
      simulateCourseTwinShot(
        { ...driver, ballSpeedMps: 999 },
        environment(() => "fairway"),
      ),
    ).toThrow(/Ball speed/);
  });
});
