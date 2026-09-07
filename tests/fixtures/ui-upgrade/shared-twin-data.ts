import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import { buildCourseTwinReplay, type CourseTwinReplaySourceShot } from "@/lib/course-twin-replay";
export const manifest: CourseTwinManifest = {
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

export const measuredShot: CourseTwinReplaySourceShot = {
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

export const replay = buildCourseTwinReplay({
  manifest,
  session: {
    id: "synthetic-shared-session",
    title: "Synthetic shared replay",
    date: new Date("2026-07-20T12:00:00Z"),
    source: "rapsodo",
  },
  shots: [measuredShot],
});
