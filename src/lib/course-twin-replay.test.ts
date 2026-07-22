import { describe, expect, it } from "vitest";

import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import { buildCourseTwinReplay, type CourseTwinReplaySourceShot } from "@/lib/course-twin-replay";

const manifest: CourseTwinManifest = {
  schemaVersion: 1,
  packageVersion: 1,
  minimumRuntimeVersion: "1.0.0",
  course: { id: "course-1", name: "Test Links", country: "England" },
  origin: {
    latitude: 53,
    longitude: -2.9,
    elevationM: 0,
    coordinateSystem: "LOCAL_ENU_METRES",
  },
  bounds: { minX: -20, maxX: 320, minZ: -20, maxZ: 20 },
  terrain: {
    kind: "prototype_semantic",
    resolutionM: null,
    verticalDatum: null,
    warning: "Prototype terrain",
    heightmap: null,
    imagery: null,
  },
  quality: {
    grade: "D",
    mappedHoles: 1,
    expectedHoles: 18,
    mappedFeatures: 0,
    verified: false,
    warnings: ["Prototype terrain"],
  },
  supportedModes: ["flyover", "replay"],
  holes: [
    {
      holeNumber: 1,
      par: 4,
      yards: 328,
      strokeIndex: 1,
      tee: [0, 0, 0],
      green: [300, 0, 0],
      centerline: [
        [0, 0, 0],
        [150, 0, 0],
        [300, 0, 0],
      ],
    },
  ],
  features: [],
  attribution: [],
};

const measuredShot: CourseTwinReplaySourceShot = {
  id: "shot-1",
  courseHoleNumber: 1,
  courseHoleShotNumber: 1,
  shotNumber: 1,
  clubType: "Driver",
  carryYd: 220,
  totalYd: 238,
  sideCarryYd: 12,
  apexFt: 91,
  ballSpeedMph: 148,
  launchAngleDeg: 13.2,
  spinRate: 2450,
  spinAxis: 3.5,
  distanceRemainingYd: 90,
  courseHoleYards: 328,
};

describe("Course Twin replay reconstruction", () => {
  it("preserves measured evidence while labelling placement and animation honestly", () => {
    const replay = buildCourseTwinReplay({
      manifest,
      session: {
        id: "session-1",
        title: "Test round",
        date: new Date("2026-07-20T12:00:00.000Z"),
        source: "rapsodo",
      },
      shots: [measuredShot],
    });

    expect(replay.modelVersion).toBe("reconstruction-v1");
    expect(replay.session.date).toBe("2026-07-20T12:00:00.000Z");
    expect(replay.disclosure).toContain("reconstructed estimates");
    expect(replay.shots).toHaveLength(1);
    expect(replay.shots[0]).toMatchObject({
      placementProvenance: "derived",
      trajectoryProvenance: "reconstructed",
      rollProvenance: "reconstructed",
      metrics: {
        carryYd: { value: 220, provenance: "measured" },
        apexFt: { value: 91, provenance: "measured" },
      },
    });
    expect(replay.shots[0].trajectory).toHaveLength(25);
    expect(replay.shots[0].trajectory[0]).toEqual(replay.shots[0].start);
    expect(replay.shots[0].trajectory.at(-1)).toEqual(replay.shots[0].carryEnd);
    expect(replay.shots[0].carryEnd[2]).not.toBe(0);
  });

  it("marks absent telemetry unavailable and reconstructs a bounded visual apex", () => {
    const replay = buildCourseTwinReplay({
      manifest,
      session: {
        id: "session-2",
        title: "Sparse import",
        date: new Date("2026-07-21T12:00:00.000Z"),
        source: "csv",
      },
      shots: [
        {
          ...measuredShot,
          id: "shot-sparse",
          totalYd: null,
          sideCarryYd: null,
          apexFt: null,
          ballSpeedMph: null,
          launchAngleDeg: null,
          spinRate: null,
          spinAxis: null,
          distanceRemainingYd: null,
        },
      ],
    });
    const shot = replay.shots[0];
    const visualPeak = Math.max(...shot.trajectory.map((point) => point[1]));

    expect(shot.metrics.totalYd).toEqual({ value: null, provenance: "unavailable" });
    expect(shot.metrics.apexFt).toEqual({ value: null, provenance: "unavailable" });
    expect(shot.rollProvenance).toBe("unavailable");
    expect(visualPeak).toBeGreaterThanOrEqual(8);
    expect(visualPeak).toBeLessThanOrEqual(42);
  });

  it("ignores shots that cannot be tied to mapped hole evidence", () => {
    const replay = buildCourseTwinReplay({
      manifest,
      session: {
        id: "session-3",
        title: "Range session",
        date: new Date("2026-07-22T12:00:00.000Z"),
        source: "rapsodo",
      },
      shots: [
        { ...measuredShot, id: "unassigned", courseHoleNumber: null },
        { ...measuredShot, id: "unmapped", courseHoleNumber: 18 },
      ],
    });

    expect(replay.shots).toEqual([]);
  });
});
