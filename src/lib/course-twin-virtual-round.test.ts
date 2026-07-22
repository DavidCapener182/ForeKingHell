import { describe, expect, it } from "vitest";

import type { CourseTwinHole } from "@/lib/course-twin-contract";
import type { CourseTwinStrategyClub } from "@/lib/course-twin-strategy";
import { buildCourseTwinVirtualShot } from "@/lib/course-twin-virtual-round";

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
});
