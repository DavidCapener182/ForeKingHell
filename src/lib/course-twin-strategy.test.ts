import { describe, expect, it } from "vitest";

import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import { buildCourseTwinStrategy, type CourseTwinBagProfile } from "@/lib/course-twin-strategy";

const manifest: CourseTwinManifest = {
  schemaVersion: 1,
  packageVersion: 1,
  minimumRuntimeVersion: "1.0.0",
  course: { id: "course", name: "Test", country: "England" },
  origin: { latitude: 53, longitude: -3, elevationM: 0, coordinateSystem: "LOCAL_ENU_METRES" },
  bounds: { minX: -80, maxX: 280, minZ: -80, maxZ: 80 },
  terrain: {
    kind: "prototype_semantic",
    resolutionM: null,
    verticalDatum: null,
    warning: null,
    heightmap: null,
    imagery: null,
  },
  quality: {
    grade: "C",
    mappedHoles: 1,
    expectedHoles: 1,
    mappedFeatures: 3,
    verified: false,
    warnings: [],
  },
  supportedModes: ["strategy"],
  holes: [
    {
      holeNumber: 1,
      par: 4,
      yards: 260,
      strokeIndex: 1,
      tee: [0, 0, 0],
      green: [238, 0, 0],
      centerline: [
        [0, 0, 0],
        [238, 0, 0],
      ],
    },
  ],
  features: [
    rectangle("course_boundary", -20, 270, -55, 55),
    rectangle("fairway", -10, 250, -28, 28),
    rectangle("water", 175, 225, 8, 55),
  ],
  attribution: [],
};

const bag: CourseTwinBagProfile[] = [profile("driver", 225, 11, 17), profile("5i", 175, 7, 9)];

describe("Course Twin player-specific strategy", () => {
  it("is deterministic and reports mapped hazard probabilities", () => {
    const first = buildCourseTwinStrategy({ manifest, holeNumber: 1, bag, sampleCount: 240 });
    const second = buildCourseTwinStrategy({ manifest, holeNumber: 1, bag, sampleCount: 240 });
    expect(first).toEqual(second);
    expect(first.clubs).toHaveLength(2);
    expect(first.clubs.some((club) => club.probabilities.water > 0)).toBe(true);
    expect(first.recommended?.landingCloud).toHaveLength(120);
    expect(first.disclosure).toMatch(/measured carry/i);
  });

  it("carries the mobile evidence window without changing simulation maths", () => {
    const original = buildCourseTwinStrategy({ manifest, holeNumber: 1, bag });
    const evidenceWindow = {
      basis: "latest-reliable" as const,
      latestShotAt: "2026-09-01T12:00:00.000Z",
      lateralSampleSize: 20,
      lowCarryYd: 190,
      highCarryYd: 200,
    };
    const mobile = buildCourseTwinStrategy({
      manifest,
      holeNumber: 1,
      bag: bag.map((club) => ({ ...club, evidenceWindow })),
    });
    expect(mobile.disclosure).toContain("same latest reliable");
    expect(original.disclosure).toContain("latest 30 days");
    expect(
      mobile.clubs.map(({ evidenceWindow: window, ...club }) => {
        expect(window).toEqual(evidenceWindow);
        return club;
      }),
    ).toEqual(original.clubs);
  });

  it("fails honestly when the requested hole is absent", () => {
    expect(() => buildCourseTwinStrategy({ manifest, holeNumber: 18, bag })).toThrow(/unavailable/);
  });
});

function profile(
  clubType: string,
  carryMedianYd: number,
  carryStdDevYd: number,
  sideStdDevYd: number,
): CourseTwinBagProfile {
  return {
    clubId: clubType,
    clubType,
    sampleSize: 20,
    confidenceScore: 80,
    carryMedianYd,
    carryStdDevYd,
    totalMedianYd: carryMedianYd + 10,
    sideMeanYd: 0,
    sideStdDevYd,
    ballSpeedMeanMph: null,
    ballSpeedStdDevMph: null,
    launchMeanDeg: null,
    launchStdDevDeg: null,
    spinMeanRpm: null,
    spinStdDevRpm: null,
    spinAxisMeanDeg: null,
    spinAxisStdDevDeg: null,
  };
}

function rectangle(
  type: CourseTwinManifest["features"][number]["type"],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): CourseTwinManifest["features"][number] {
  return {
    id: `${type}-${minX}`,
    holeNumber: 1,
    type,
    source: "test",
    rings: [
      [
        [minX, 0, minZ],
        [maxX, 0, minZ],
        [maxX, 0, maxZ],
        [minX, 0, maxZ],
        [minX, 0, minZ],
      ],
    ],
  };
}
