import { describe, expect, it } from "vitest";

import type { CourseTwinHole, CourseTwinPoint } from "@/lib/course-twin-contract";
import type { CourseTwinStrategyClub } from "@/lib/course-twin-strategy";
import {
  buildCourseTwinVirtualShot,
  courseTwinAimDirectionDegToPoint,
  courseTwinVirtualClubOptions,
  courseTwinVirtualShotKind,
  courseTwinVirtualShotKindOptions,
} from "@/lib/course-twin-virtual-round";

const hole: CourseTwinHole = {
  holeNumber: 5,
  par: 4,
  yards: 360,
  strokeIndex: 3,
  tee: [0, 0, 0],
  green: [329, 0, 0],
  centerline: [
    [0, 0, 0],
    [329, 0, 0],
  ],
};

const club: CourseTwinStrategyClub = {
  clubId: "driver",
  clubType: "driver",
  sampleSize: 32,
  confidenceScore: 84,
  carryMedianYd: 225,
  aimOffsetYd: 0,
  landingCloud: [],
  probabilities: {
    tee: 0,
    fairway: 0.7,
    green: 0,
    rough: 0.2,
    bunker: 0.05,
    water: 0.05,
    trees: 0,
    out_of_bounds: 0,
  },
  averageRemainingYd: 135,
  expectedRiskStrokes: 0.5,
  confidence: "measured",
  shotModel: {
    carryMedianYd: 225,
    carryStdDevYd: 8,
    totalMedianYd: 239,
    sideMeanYd: 1.5,
    sideStdDevYd: 11,
    ballSpeedMeanMph: 148,
    ballSpeedStdDevMph: 3,
    launchMeanDeg: 12.5,
    launchStdDevDeg: 1.2,
    spinMeanRpm: 2_450,
    spinStdDevRpm: 220,
    spinAxisMeanDeg: 5.5,
    spinAxisStdDevDeg: 3.2,
  },
};

const gapWedge: CourseTwinStrategyClub = {
  ...club,
  clubId: "gap-wedge",
  clubType: "gw",
  carryMedianYd: 94,
  shotModel: {
    ...club.shotModel,
    carryMedianYd: 94,
    carryStdDevYd: 5,
    totalMedianYd: 98,
    sideMeanYd: 0.5,
    sideStdDevYd: 5,
    ballSpeedMeanMph: 72,
    ballSpeedStdDevMph: 4,
    launchMeanDeg: 29,
    launchStdDevDeg: 2,
    spinMeanRpm: 7_100,
    spinStdDevRpm: 600,
  },
};

describe("Course Twin virtual round", () => {
  it("samples the golfer's measured bag deterministically", () => {
    const input = {
      courseId: "bootle",
      hole,
      start: hole.tee,
      club,
      aimOffsetYd: 0,
      shotNumber: 1,
    };
    const first = buildCourseTwinVirtualShot(input);
    const second = buildCourseTwinVirtualShot(input);

    expect(first).toEqual(second);
    expect(first.provenance).toBe("sampled-from-measured-bag");
    expect(first.shot.metrics.carryYd.provenance).toBe("derived");
    expect(first.sampled.carryYd).toBeGreaterThan(190);
    expect(first.sampled.carryYd).toBeLessThan(260);
    expect(first.sampled.totalYd).toBeGreaterThanOrEqual(first.sampled.carryYd);
    expect(first.sampled.spinAxisDeg).not.toBe(0);
    expect(Math.abs(first.sampled.spinAxisDeg)).toBeLessThanOrEqual(18);
    expect(first.sampled.shapeBias).toBe("straight-weighted");
    expect(first.sampled.shapeSource).toBe("measured-spin-axis");
    expect(first.shot.metrics.spinAxis).toEqual({
      value: first.sampled.spinAxisDeg,
      provenance: "derived",
    });
  });

  it("moves the same deterministic sample when the golfer changes aim", () => {
    const left = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: hole.tee,
      club,
      aimOffsetYd: -12,
      shotNumber: 2,
    });
    const right = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: hole.tee,
      club,
      aimOffsetYd: 12,
      shotNumber: 2,
    });

    expect(left.shot.carryEnd[2]).toBeLessThan(right.shot.carryEnd[2]);
    expect(left.sampled.aimOffsetYd).toBe(-12);
    expect(right.sampled.aimOffsetYd).toBe(12);
  });

  it("rotates the start line without changing the sampled strike", () => {
    const left = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: hole.tee,
      club,
      aimOffsetYd: 0,
      aimDirectionDeg: -12,
      shotNumber: 7,
    });
    const right = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: hole.tee,
      club,
      aimOffsetYd: 0,
      aimDirectionDeg: 12,
      shotNumber: 7,
    });

    expect(left.sampled.carryYd).toBe(right.sampled.carryYd);
    expect(left.sampled.sideYd).toBe(right.sampled.sideYd);
    expect(left.sampled.spinAxisDeg).toBe(right.sampled.spinAxisDeg);
    expect(left.sampled.aimDirectionDeg).toBe(-12);
    expect(right.sampled.aimDirectionDeg).toBe(12);
    expect(left.shot.carryEnd[2]).toBeLessThan(right.shot.carryEnd[2]);
    expect(left.shot.metrics.launchDirectionDeg?.value).not.toBeNull();
  });

  it("turns a clicked terrain point into a bounded start direction", () => {
    expect(
      courseTwinAimDirectionDegToPoint(hole.tee, hole.green, [100, 0, -20], "full"),
    ).toBeLessThan(0);
    expect(
      courseTwinAimDirectionDegToPoint(hole.tee, hole.green, [100, 0, 20], "full"),
    ).toBeGreaterThan(0);
    expect(courseTwinAimDirectionDegToPoint(hole.tee, hole.green, [1, 0, 100], "chip")).toBe(20);
  });

  it("keeps visible curve while weighting a sequence toward straighter shapes", () => {
    const shapedClub: CourseTwinStrategyClub = {
      ...club,
      shotModel: {
        ...club.shotModel,
        spinAxisMeanDeg: 10,
        spinAxisStdDevDeg: 6,
      },
    };
    const axes = Array.from({ length: 40 }, (_, index) =>
      buildCourseTwinVirtualShot({
        courseId: "bootle",
        hole,
        start: hole.tee,
        club: shapedClub,
        aimOffsetYd: 0,
        shotNumber: index + 1,
      }),
    ).map((result) => result.sampled.spinAxisDeg);

    expect(axes.every((axis) => Math.abs(axis) >= 0.75)).toBe(true);
    expect(axes.some((axis) => Math.abs(axis) >= 6)).toBe(true);
    expect(axes.reduce((total, axis) => total + Math.abs(axis), 0) / axes.length).toBeLessThan(10);
  });

  it("infers a visible curve from measured lateral dispersion when spin axis is unavailable", () => {
    const inferred = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: hole.tee,
      club: {
        ...club,
        shotModel: {
          ...club.shotModel,
          spinAxisMeanDeg: null,
          spinAxisStdDevDeg: null,
        },
      },
      aimOffsetYd: 0,
      shotNumber: 4,
    });

    expect(inferred.sampled.shapeSource).toBe("inferred-from-dispersion");
    expect(Math.abs(inferred.sampled.spinAxisDeg)).toBeGreaterThanOrEqual(0.75);
  });

  it("turns a twenty-yard rough leave into a scaled chip rather than a full wedge", () => {
    const chip = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: [311, 0, 0],
      club: gapWedge,
      aimOffsetYd: 0,
      shotNumber: 3,
      lieSurface: "rough",
      surfaceAt: (x) => (x >= 316 ? "green" : "rough"),
    });

    expect(chip.sampled.shotKind).toBe("chip");
    expect(chip.sampled.lieSurface).toBe("rough");
    expect(chip.sampled.landingSurface).toBe("green");
    expect(chip.sampled.carryYd).toBeGreaterThan(7);
    expect(chip.sampled.carryYd).toBeLessThan(16);
    expect(chip.sampled.totalYd).toBeGreaterThan(chip.sampled.carryYd);
    expect(chip.sampled.totalYd).toBeLessThan(24);
    expect(chip.sampled.launchAngleDeg).toBeGreaterThanOrEqual(15);
    expect(chip.sampled.launchAngleDeg).toBeLessThanOrEqual(28);
    expect(chip.shot.metrics.apexFt.value).toBeLessThanOrEqual(11);
  });

  it("reduces rollout when the same chip lands in rough instead of on the green", () => {
    const input = {
      courseId: "bootle",
      hole,
      start: [311, 0, 0] as CourseTwinPoint,
      club: gapWedge,
      aimOffsetYd: 0,
      shotNumber: 4,
      lieSurface: "rough" as const,
    };
    const greenLanding = buildCourseTwinVirtualShot({
      ...input,
      surfaceAt: () => "green",
    });
    const roughLanding = buildCourseTwinVirtualShot({
      ...input,
      surfaceAt: () => "rough",
    });

    expect(greenLanding.sampled.carryYd).toBe(roughLanding.sampled.carryYd);
    expect(greenLanding.sampled.totalYd - greenLanding.sampled.carryYd).toBeGreaterThan(
      roughLanding.sampled.totalYd - roughLanding.sampled.carryYd,
    );
  });

  it("uses a high soft splash from a short bunker lie", () => {
    const splash = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: [311, 0, 0],
      club: gapWedge,
      aimOffsetYd: 0,
      shotNumber: 5,
      lieSurface: "bunker",
      surfaceAt: () => "green",
    });

    expect(splash.sampled.shotKind).toBe("bunker-splash");
    expect(splash.sampled.launchAngleDeg).toBeGreaterThanOrEqual(40);
    expect(splash.sampled.carryYd / splash.sampled.totalYd).toBeGreaterThan(0.78);
  });

  it("offers scoring clubs only for short-game leaves", () => {
    const pitchingWedge = {
      ...gapWedge,
      clubId: "pitching-wedge",
      clubType: "pw",
      shotModel: { ...gapWedge.shotModel, carryMedianYd: 112 },
    };
    const options = courseTwinVirtualClubOptions([club, pitchingWedge, gapWedge], 20);

    expect(options.map((option) => option.clubType)).toEqual(["gw", "pw"]);
    expect(courseTwinVirtualClubOptions([club, pitchingWedge, gapWedge], 120)).toHaveLength(3);
  });

  it("uses a controlled half wedge by default inside one hundred yards", () => {
    const halfWedge = buildCourseTwinVirtualShot({
      courseId: "bootle",
      hole,
      start: [251, 0, 0],
      club: gapWedge,
      aimOffsetYd: 0,
      shotNumber: 6,
      lieSurface: "fairway",
      surfaceAt: () => "green",
    });

    expect(courseTwinVirtualShotKind(85, "fairway")).toBe("half");
    expect(halfWedge.sampled.shotKind).toBe("half");
    expect(halfWedge.sampled.carryYd).toBeGreaterThan(70);
    expect(halfWedge.sampled.carryYd).toBeLessThan(90);
    expect(halfWedge.sampled.totalYd).toBeLessThan(100);
    expect(halfWedge.sampled.launchAngleDeg).toBeGreaterThanOrEqual(23);
    expect(halfWedge.sampled.launchAngleDeg).toBeLessThanOrEqual(38);
  });

  it("offers explicit shot choices appropriate to the remaining distance", () => {
    expect(courseTwinVirtualShotKindOptions(20, "rough")).toEqual(["chip", "pitch", "half"]);
    expect(courseTwinVirtualShotKindOptions(48, "fairway")).toEqual(["pitch", "half", "full"]);
    expect(courseTwinVirtualShotKindOptions(85, "fairway")).toEqual(["half", "full"]);
    expect(courseTwinVirtualShotKindOptions(45, "bunker")).toEqual([
      "bunker-splash",
      "pitch",
      "half",
    ]);
    expect(courseTwinVirtualShotKindOptions(120, "fairway")).toEqual(["full"]);
  });

  it("honours the selected short-shot button without accepting an invalid choice", () => {
    const input = {
      courseId: "bootle",
      hole,
      start: [251, 0, 0] as CourseTwinPoint,
      club: gapWedge,
      aimOffsetYd: 0,
      shotNumber: 7,
      lieSurface: "fairway" as const,
      surfaceAt: () => "green" as const,
    };
    const selectedFull = buildCourseTwinVirtualShot({
      ...input,
      requestedShotKind: "full",
    });
    const invalidChip = buildCourseTwinVirtualShot({
      ...input,
      requestedShotKind: "chip",
    });

    expect(selectedFull.sampled.shotKind).toBe("full");
    expect(invalidChip.sampled.shotKind).toBe("half");
  });
});
