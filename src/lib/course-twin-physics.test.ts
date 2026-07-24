import { describe, expect, it } from "vitest";

import {
  sampleCourseTwinSimulation,
  simulateCourseTwinReplayShot,
  simulateCourseTwinShot,
  type CourseTwinPhysicsEnvironment,
  type CourseTwinShotInput,
} from "@/lib/course-twin-physics";
import type { CourseTwinReplayShot } from "@/lib/course-twin-contract";

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

const replayShot: CourseTwinReplayShot = {
  id: "saved-shot-1",
  holeNumber: 5,
  holeShotNumber: 1,
  clubType: "driver",
  start: [0, 0, 0],
  carryEnd: [190, 0, 8],
  totalEnd: [207, 0, 9],
  trajectory: [],
  metrics: {
    carryYd: { value: 208, provenance: "measured" },
    totalYd: { value: 226, provenance: "measured" },
    sideCarryYd: { value: 8.7, provenance: "measured" },
    apexFt: { value: 82, provenance: "measured" },
    ballSpeedMph: { value: 147, provenance: "measured" },
    launchAngleDeg: { value: 12.4, provenance: "measured" },
    spinRate: { value: 2_480, provenance: "measured" },
    spinAxis: { value: 2.5, provenance: "measured" },
  },
  placementProvenance: "derived",
  trajectoryProvenance: "reconstructed",
  rollProvenance: "reconstructed",
};

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

  it("reconstructs a saved shot with deterministic phases and exact mapped endpoints", () => {
    const first = simulateCourseTwinReplayShot(
      replayShot,
      environment(() => "fairway"),
    );
    const second = simulateCourseTwinReplayShot(
      replayShot,
      environment(() => "fairway"),
    );

    expect(first).toEqual(second);
    expect(first.carryPosition.x).toBeCloseTo(replayShot.carryEnd[0]);
    expect(first.carryPosition.z).toBeCloseTo(replayShot.carryEnd[2]);
    expect(first.finalPosition.x).toBeCloseTo(replayShot.totalEnd[0]);
    expect(first.finalPosition.z).toBeCloseTo(replayShot.totalEnd[2]);
    expect(first.frames.some((frame) => frame.phase === "flight")).toBe(true);
    expect(first.frames.some((frame) => frame.phase === "bounce" || frame.phase === "roll")).toBe(
      true,
    );
    expect(first.landingSurface).toBe("fairway");
    expect(first.finalSurface).toBe("fairway");
    expect(first.provenance).toBe("physics-reconstructed");

    const finish = sampleCourseTwinSimulation(first, 1);
    expect(finish?.phase).toBe("stopped");
    expect(finish?.position).toEqual(first.finalPosition);
  });

  it("keeps a strongly shaped tracer smooth and progressing toward carry", () => {
    const shaped = simulateCourseTwinReplayShot(
      {
        ...replayShot,
        metrics: {
          ...replayShot.metrics,
          spinAxis: { value: 18, provenance: "derived" },
          launchDirectionDeg: { value: -7, provenance: "derived" },
        },
      },
      environment(() => "fairway"),
    );
    const flight = shaped.frames.filter(
      (frame) => frame.timeS <= shaped.flightTimeS + Number.EPSILON,
    );
    const chord = {
      x: shaped.carryPosition.x - flight[0].position.x,
      z: shaped.carryPosition.z - flight[0].position.z,
    };
    const chordLength = Math.hypot(chord.x, chord.z);
    let previousProgress = -Infinity;

    for (const frame of flight) {
      const relative = {
        x: frame.position.x - flight[0].position.x,
        z: frame.position.z - flight[0].position.z,
      };
      const progress = (relative.x * chord.x + relative.z * chord.z) / chordLength;
      expect(progress).toBeGreaterThanOrEqual(previousProgress - 0.05);
      previousProgress = progress;
    }
    expect(shaped.input.launchAzimuthDeg).toBe(-7);
    expect(shaped.carryPosition.x).toBeCloseTo(replayShot.carryEnd[0]);
    expect(shaped.carryPosition.z).toBeCloseTo(replayShot.carryEnd[2]);
  });

  it("stops the reconstructed replay when its mapped ground path reaches water", () => {
    const result = simulateCourseTwinReplayShot(
      replayShot,
      environment((x) => (x >= 195 ? "water" : "fairway")),
    );

    expect(result.penalty).toBe("water");
    expect(result.finalSurface).toBe("water");
    expect(result.finalPosition.x).toBeGreaterThanOrEqual(195);
    expect(result.finalPosition.x).toBeLessThan(replayShot.totalEnd[0]);
    expect(result.frames.at(-1)?.phase).toBe("stopped");
  });
});
