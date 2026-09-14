import { describe, expect, it } from "vitest";
import { createCourseTwinSurfaceClassifier } from "./course-twin-surface";

import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import {
  previewCourseTwinAim,
  buildCourseTwinStrategy,
  type CourseTwinBagProfile,
} from "@/lib/course-twin-strategy";

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

describe("interactive Plan aiming", () => {
  it("rotates the same dispersion samples without changing club carry and recomputes surfaces", () => {
    const club = buildCourseTwinStrategy({ manifest, holeNumber: 1, bag }).clubs[0];
    const straight = previewCourseTwinAim(manifest, manifest.holes[0], club, [240, 0, 0]);
    const sideways = previewCourseTwinAim(manifest, manifest.holes[0], club, [0, 0, 240]);
    expect(sideways.carryMedianYd).toBe(straight.carryMedianYd);
    straight.landingCloud.forEach((point, i) => {
      expect(sideways.landingCloud[i][0]).toBeCloseTo(-point[2]);
      expect(sideways.landingCloud[i][2]).toBeCloseTo(point[0]);
    });
    expect(sideways.probabilities.out_of_bounds).toBeGreaterThan(
      straight.probabilities.out_of_bounds,
    );
    expect(Object.values(sideways.probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
    expect(previewCourseTwinAim(manifest, manifest.holes[0], club, [240, 0, 0])).toEqual(straight);
  });

  it("uses a shorter club to move the landing area closer and never follows a dogleg", () => {
    const clubs = buildCourseTwinStrategy({ manifest, holeNumber: 1, bag }).clubs;
    const dogleg = {
      ...manifest.holes[0],
      centerline: [
        [0, 0, 0],
        [50, 0, 0],
        [50, 0, 200],
      ] as [number, number, number][],
    };
    const previews = clubs.map((club) => previewCourseTwinAim(manifest, dogleg, club, [240, 0, 0]));
    const long = previews.find((c) => c.clubId === "driver")!;
    const short = previews.find((c) => c.clubId === "5i")!;
    const mean = (c: typeof long) =>
      c.landingCloud.reduce((sum, p) => sum + p[0], 0) / c.landingCloud.length;
    expect(mean(long)).toBeGreaterThan(mean(short) + 30);
    expect(mean(long)).toBeGreaterThan(170);
  });
});

it("counts exactly the visible Plan cloud against updated display boundaries", () => {
  const club = buildCourseTwinStrategy({ manifest, holeNumber: 1, bag }).clubs[0];
  const displayed = { ...manifest, features: [rectangle("fairway", 0, 270, -4, 4)] };
  const result = previewCourseTwinAim(displayed, manifest.holes[0], club, [240, 0, 0]);
  const classify = createCourseTwinSurfaceClassifier(displayed, 1);
  expect(result.landingCloud).toHaveLength(320);
  for (const [surface, probability] of Object.entries(result.probabilities)) {
    const count = result.landingCloud.filter((p) => classify(p[0], p[2]) === surface).length;
    expect(probability).toBeCloseTo(count / result.landingCloud.length, 3);
  }
  expect(result.probabilities.rough).toBeGreaterThan(0.3);
  expect(result.probabilities.fairway).toBeLessThan(0.7);
});

it("moves the shot origin with the selected tee and recalculates landing surfaces and leave", () => {
  const club = buildCourseTwinStrategy({ manifest, holeNumber: 1, bag }).clubs[0];
  const first = previewCourseTwinAim(manifest, manifest.holes[0], club, [240, 0, 0]);
  const alternate = { ...manifest.holes[0], tee: [40, 0, 60] as [number, number, number] };
  const moved = previewCourseTwinAim(manifest, alternate, club, [280, 0, 60]);
  first.landingCloud.forEach((point, i) => {
    expect(moved.landingCloud[i][0]).toBeCloseTo(point[0] + 40);
    expect(moved.landingCloud[i][2]).toBeCloseTo(point[2] + 60);
  });
  expect(moved.carryMedianYd).toBe(first.carryMedianYd);
  expect(moved.probabilities).not.toEqual(first.probabilities);
  expect(moved.averageRemainingYd).not.toBe(first.averageRemainingYd);
  expect(manifest.holes[0].tee).toEqual([0, 0, 0]);
});
