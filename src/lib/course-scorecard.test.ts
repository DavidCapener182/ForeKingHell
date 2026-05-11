import { describe, expect, it } from "vitest";

import {
  inferCourseShots,
  inferCourseShotsFromHoleShotCounts,
  parseScorecardText,
} from "@/lib/course-scorecard";
import type { ParsedRapsodoShot } from "@/lib/rapsodo/parser";

describe("parseScorecardText", () => {
  it("parses comma-separated hole, par, yardage rows", () => {
    const result = parseScorecardText(["Hole,Par,Yards,Name", "1,4,423,Opening", "2,5,532"].join("\n"));

    expect(result.holes).toEqual([
      { holeNumber: 1, par: 4, yards: 423, name: "Opening" },
      { holeNumber: 2, par: 5, yards: 532, name: null },
    ]);
    expect(result.warnings).toEqual(["Scorecard has 2 holes; 9 or 18 holes is expected."]);
  });

  it("can infer hole numbers from par and yardage rows", () => {
    const result = parseScorecardText(["4 423", "5 532"].join("\n"));

    expect(result.holes.map((hole) => hole.holeNumber)).toEqual([1, 2]);
    expect(result.holes.map((hole) => hole.par)).toEqual([4, 5]);
  });

  it("accepts escaped newline row breaks", () => {
    const result = parseScorecardText("1,4,423\\n2,5,532");

    expect(result.holes.map((hole) => hole.holeNumber)).toEqual([1, 2]);
  });
});

describe("inferCourseShots", () => {
  it("assigns contiguous shots to scorecard holes", () => {
    const scorecard = parseScorecardText(["1,4,420", "2,3,170", "3,5,520"].join("\n")).holes;
    const result = inferCourseShots(
      [
        shot("driver", 230),
        shot("8i", 150),
        shot("sw", 36),
        shot("7i", 168),
        shot("driver", 240),
        shot("5w", 190),
        shot("sw", 92),
      ],
      scorecard,
    );

    expect(result.assignedShotCount).toBe(7);
    expect(result.holes.map((hole) => hole.shots.length)).toEqual([3, 1, 3]);
    expect(result.shots.map((courseShot) => courseShot.holeNumber)).toEqual([1, 1, 1, 2, 3, 3, 3]);
    expect(result.shots.map((courseShot) => courseShot.shotCategory)).toEqual([
      "tee",
      "approach",
      "pitch",
      "tee",
      "tee",
      "approach",
      "pitch",
    ]);
  });

  it("respects reviewed hole shot counts", () => {
    const scorecard = parseScorecardText(["1,4,420", "2,3,170", "3,5,520"].join("\n")).holes;
    const result = inferCourseShotsFromHoleShotCounts(
      [
        shot("driver", 230),
        shot("8i", 150),
        shot("sw", 36),
        shot("7i", 168),
        shot("driver", 240),
        shot("5w", 190),
        shot("sw", 92),
      ],
      scorecard,
      [
        { holeNumber: 1, shotCount: 2 },
        { holeNumber: 2, shotCount: 2 },
        { holeNumber: 3, shotCount: 3 },
      ],
    );

    expect(result.assignedShotCount).toBe(7);
    expect(result.unassignedShotCount).toBe(0);
    expect(result.holes.map((hole) => hole.shots.length)).toEqual([2, 2, 3]);
    expect(result.shots.map((courseShot) => courseShot.holeNumber)).toEqual([1, 1, 2, 2, 3, 3, 3]);
  });
});

function shot(clubType: string, totalYd: number): ParsedRapsodoShot {
  return {
    rowNumber: 1,
    shotNumber: null,
    clubTypeRaw: clubType,
    clubType,
    clubLabel: clubType,
    clubBrand: null,
    clubModel: null,
    clubKey: clubType,
    carryYd: totalYd,
    totalYd,
    ballSpeedMph: null,
    clubSpeedMph: null,
    launchAngleDeg: null,
    launchDirectionDeg: null,
    apexFt: null,
    sideCarryYd: 0,
    attackAngleDeg: null,
    clubPathDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    spinRate: null,
    spinAxis: null,
    shotShape: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: null,
    sourceRawJson: {},
    warnings: [],
  };
}
