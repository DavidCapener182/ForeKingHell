import type { InferredCourseShot } from "@/lib/course-scorecard";
import { describe, expect, it } from "vitest";

import {
  buildStrokesGainedEventsFromRoundAssignments,
  buildStrokesGainedEventsFromCourseShots,
  calculateShotStrokesGained,
  findBaselineBucket,
  summarizeStrokesGainedByCategory,
  summarizeStrokesGained,
} from "@/lib/strokes-gained";

describe("strokes gained", () => {
  it("calculates shot value from expected strokes before and after the strike", () => {
    expect(
      calculateShotStrokesGained({
        startExpectedStrokes: 3.2,
        endExpectedStrokes: 1.8,
      }),
    ).toBe(0.4);
  });

  it("applies penalty strokes to the shot value", () => {
    expect(
      calculateShotStrokesGained({
        startExpectedStrokes: 3.2,
        endExpectedStrokes: 1.8,
        penaltyStrokes: 1,
      }),
    ).toBe(-0.6);
  });

  it("finds a matching baseline bucket by category, lie, and distance", () => {
    const bucket = findBaselineBucket(
      [
        {
          category: "approach",
          lie: "fairway",
          distanceStartYd: 125,
          distanceEndYd: 150,
          expectedStrokes: 3.1,
        },
        {
          category: "approach",
          lie: "rough",
          distanceStartYd: 125,
          distanceEndYd: 150,
          expectedStrokes: 3.4,
        },
      ],
      { category: "approach", lie: "fairway", distanceYd: 141 },
    );

    expect(bucket?.expectedStrokes).toBe(3.1);
  });

  it("summarizes finite strokes-gained values", () => {
    expect(summarizeStrokesGained([0.2, null, -0.4, 1])).toEqual({
      total: 0.8,
      average: 0.3,
      sampleSize: 3,
    });
  });

  it("summarizes strokes gained by category with weakest category first", () => {
    expect(
      summarizeStrokesGainedByCategory([
        { category: "approach", strokesGained: -0.4 },
        { category: "tee", strokesGained: 0.3 },
        { category: "approach", strokesGained: -0.1 },
        { category: "putting", strokesGained: null },
      ]),
    ).toEqual([
      { category: "approach", total: -0.5, average: -0.2, sampleSize: 2 },
      { category: "tee", total: 0.3, average: 0.3, sampleSize: 1 },
      { category: "putting", total: null, average: null, sampleSize: 0 },
    ]);
  });

  it("builds cited shot-event rows from inferred course shots", () => {
    const events = buildStrokesGainedEventsFromCourseShots({
      userId: "user-1",
      sessionId: "session-1",
      shotIdByRowNumber: new Map([[2, "shot-2"]]),
      courseShots: [
        courseShot({
          rowNumber: 2,
          holeShotNumber: 1,
          holeYards: 410,
          progressBeforeYd: 0,
          distanceRemainingYd: 150,
          displaySideYd: 12,
          shotCategory: "tee",
        }),
        courseShot({
          rowNumber: 3,
          holeShotNumber: 3,
          holeYards: 410,
          progressBeforeYd: 370,
          distanceRemainingYd: 10,
          displaySideYd: 4,
          shotCategory: "chip",
        }),
      ],
    });

    expect(events).toMatchObject([
      {
        userId: "user-1",
        sessionId: "session-1",
        shotId: "shot-2",
        holeNumber: 1,
        strokeNumber: 1,
        category: "tee",
        startLie: "tee",
        endLie: "fairway",
        startDistanceYd: 410,
        endDistanceYd: 150,
        strokesGained: 0.1,
      },
      {
        shotId: null,
        category: "short_game",
        startLie: "fairway",
        endLie: "green",
        startDistanceYd: 40,
        endDistanceYd: 10,
        strokesGained: 0,
      },
    ]);
    expect(events[0].metadataJson).toMatchObject({
      source: "rapsodo-course-import",
      rawRowNumber: 2,
      clubType: "driver",
    });
  });

  it("keeps final simulator approaches on the green when the scorecard implies putts", () => {
    const events = buildStrokesGainedEventsFromCourseShots({
      userId: "user-1",
      sessionId: "session-1",
      holeScoring: [{ holeNumber: 1, csvShotCount: 2, score: 4, putts: null, penalties: 0 }],
      courseShots: [
        courseShot({
          rowNumber: 1,
          holeShotNumber: 1,
          holeYards: 400,
          progressBeforeYd: 0,
          distanceRemainingYd: 150,
          displaySideYd: 8,
          shotCategory: "tee",
        }),
        courseShot({
          rowNumber: 2,
          holeShotNumber: 2,
          holeYards: 400,
          progressBeforeYd: 250,
          distanceRemainingYd: 0,
          displaySideYd: 3,
          shotCategory: "approach",
        }),
      ],
    });

    expect(events[1]).toMatchObject({
      category: "approach",
      startLie: "fairway",
      endLie: "green",
      endDistanceYd: 12,
      strokesGained: 0.5,
      metadataJson: {
        inferredPuttsAfterShot: 2,
        scorecardScore: 4,
      },
    });
  });

  it("keeps zero-putt scorecard finishes as genuine holed shots", () => {
    const events = buildStrokesGainedEventsFromCourseShots({
      userId: "user-1",
      sessionId: "session-1",
      holeScoring: [{ holeNumber: 1, csvShotCount: 2, score: 2, putts: 0, penalties: 0 }],
      courseShots: [
        courseShot({
          rowNumber: 1,
          holeShotNumber: 1,
          holeYards: 150,
          progressBeforeYd: 0,
          distanceRemainingYd: 20,
          displaySideYd: 2,
          shotCategory: "tee",
        }),
        courseShot({
          rowNumber: 2,
          holeShotNumber: 2,
          holeYards: 150,
          progressBeforeYd: 130,
          distanceRemainingYd: 0,
          displaySideYd: 1,
          shotCategory: "chip",
        }),
      ],
    });

    expect(events[1]).toMatchObject({
      endLie: "holed",
      endDistanceYd: 0,
    });
  });

  it("rebuilds linked events from post-deletion round assignments", () => {
    const afterMiddleDeletion = buildStrokesGainedEventsFromRoundAssignments({
      userId: "user-1",
      sessionId: "session-1",
      holeScoring: [{ holeNumber: 1, csvShotCount: 2, score: 4, putts: 2, penalties: 0 }],
      shots: [
        roundAssignmentShot({
          id: "shot-a",
          clubType: "driver",
          holeShotNumber: 1,
          totalYd: 240,
          distanceRemainingYd: 160,
          shotCategory: "tee",
        }),
        roundAssignmentShot({
          id: "shot-c",
          clubType: "sw",
          holeShotNumber: 2,
          totalYd: 40,
          distanceRemainingYd: 120,
          shotCategory: "chip",
        }),
      ],
    });

    expect(afterMiddleDeletion.map((event) => event.shotId)).toEqual(["shot-a", "shot-c"]);
    expect(afterMiddleDeletion[1]).toMatchObject({
      shotId: "shot-c",
      strokeNumber: 2,
      startDistanceYd: 160,
      endDistanceYd: 12,
      strokesGained: null,
      metadataJson: { originalDistanceRemainingYd: 120 },
    });

    const afterEarlyDeletion = buildStrokesGainedEventsFromRoundAssignments({
      userId: "user-1",
      sessionId: "session-1",
      holeScoring: [{ holeNumber: 1, csvShotCount: 2, score: 4, putts: 2, penalties: 0 }],
      shots: [
        roundAssignmentShot({
          id: "shot-b",
          clubType: "7i",
          holeShotNumber: 1,
          totalYd: 120,
          distanceRemainingYd: 280,
          shotCategory: "tee",
        }),
        roundAssignmentShot({
          id: "shot-c",
          clubType: "sw",
          holeShotNumber: 2,
          totalYd: 40,
          distanceRemainingYd: 240,
          shotCategory: "chip",
        }),
      ],
    });

    expect(afterEarlyDeletion[0]).toMatchObject({
      shotId: "shot-b",
      strokeNumber: 1,
      category: "tee",
      startDistanceYd: 400,
      endDistanceYd: 280,
      strokesGained: -0.8,
    });
  });
});

function roundAssignmentShot({
  id,
  clubType,
  holeShotNumber,
  totalYd,
  distanceRemainingYd,
  shotCategory,
}: {
  id: string;
  clubType: string;
  holeShotNumber: number;
  totalYd: number;
  distanceRemainingYd: number;
  shotCategory: string;
}) {
  return {
    id,
    shotNumber: holeShotNumber,
    clubType,
    carryYd: totalYd,
    totalYd,
    sideCarryYd: 0,
    courseHoleNumber: 1,
    courseHoleShotNumber: holeShotNumber,
    courseHolePar: 4,
    courseHoleYards: 400,
    distanceRemainingYd,
    shotCategory,
  };
}

function courseShot({
  rowNumber,
  holeShotNumber,
  holeYards,
  progressBeforeYd,
  distanceRemainingYd,
  displaySideYd,
  shotCategory,
}: {
  rowNumber: number;
  holeShotNumber: number;
  holeYards: number;
  progressBeforeYd: number;
  distanceRemainingYd: number;
  displaySideYd: number;
  shotCategory: InferredCourseShot["shotCategory"];
}): InferredCourseShot {
  return {
    sourceShot: {
      rowNumber,
      clubType: holeShotNumber === 1 ? "driver" : "wedge",
      carryYd: null,
      totalYd: null,
    },
    absoluteShotNumber: rowNumber - 1,
    holeNumber: 1,
    holeShotNumber,
    holePar: 4,
    holeYards,
    holeName: null,
    shotDistanceYd: null,
    forwardDistanceYd: null,
    progressBeforeYd,
    progressAfterYd: holeYards - distanceRemainingYd,
    distanceRemainingYd,
    displaySideYd,
    shotCategory,
  } as InferredCourseShot;
}
