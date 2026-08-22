import { describe, expect, it } from "vitest";

import {
  applyRoundShotDeletionToScorecard,
  isRoundCorrectionDeletionAllowed,
  parseRoundShotDeleteActionInput,
  physicalRoundShotsForAccounting,
} from "@/lib/round-shot-deletion";

const sessionId = "11111111-1111-4111-8111-111111111111";
const shotId = "22222222-2222-4222-8222-222222222222";

describe("round shot deletion boundary", () => {
  it("accepts only exact UUID round and shot references", () => {
    expect(parseRoundShotDeleteActionInput({ sessionId, shotId })).toEqual({ sessionId, shotId });
    expect(() => parseRoundShotDeleteActionInput({ sessionId, shotId: "shot-2" })).toThrow(
      "The round or shot reference is invalid.",
    );
  });

  it("allows the exception only for a course-managed session with a scorecard", () => {
    expect(
      isRoundCorrectionDeletionAllowed({
        scorecardJson: [{ holeNumber: 1 }],
        sessionType: "real_round",
        sessionPlayContext: "on_course",
        sessionCourseId: sessionId,
        courseHoleNumber: 1,
      }),
    ).toBe(true);
    expect(
      isRoundCorrectionDeletionAllowed({
        scorecardJson: null,
        sessionType: "range",
        sessionPlayContext: "practice",
        sessionCourseId: null,
        courseHoleNumber: null,
      }),
    ).toBe(false);
    expect(
      isRoundCorrectionDeletionAllowed({
        scorecardJson: [{ holeNumber: 1 }],
        sessionType: "real_round",
        sessionPlayContext: "on_course",
        sessionCourseId: sessionId,
        courseHoleNumber: null,
      }),
    ).toBe(false);
    expect(
      isRoundCorrectionDeletionAllowed({
        scorecardJson: [{ holeNumber: 1 }],
        sessionType: "real_round",
        sessionPlayContext: "on_course",
        sessionCourseId: sessionId,
        courseHoleNumber: 18,
      }),
    ).toBe(false);
  });
});

describe("round scorecard deletion impact", () => {
  it("removes one mapped stroke while preserving valid putts and penalties", () => {
    const result = applyRoundShotDeletionToScorecard(
      [
        {
          holeNumber: 1,
          csvShotCount: 4,
          score: 7,
          netScore: 6,
          putts: 2,
          penalties: 1,
        },
        { holeNumber: 2, csvShotCount: 3, score: 5, putts: 2, penalties: 0 },
      ],
      1,
    );

    expect(result).toMatchObject({ scoreChanged: true, affectedHoleNumber: 1 });
    expect(result.scorecard).toEqual([
      {
        holeNumber: 1,
        csvShotCount: 3,
        score: 6,
        netScore: 5,
        putts: 2,
        penalties: 1,
      },
      { holeNumber: 2, csvShotCount: 3, score: 5, putts: 2, penalties: 0 },
    ]);
  });

  it("does not force a saved score below its putt and penalty accounting", () => {
    const result = applyRoundShotDeletionToScorecard(
      [{ holeNumber: 1, csvShotCount: 1, score: 3, putts: 2, penalties: 1 }],
      1,
    );

    expect(result.scoreChanged).toBe(false);
    expect(result.scorecard[0]).toMatchObject({
      csvShotCount: 0,
      score: 3,
      putts: 2,
      penalties: 1,
    });
  });

  it("rejects an unmapped shot because its scorecard impact is unprovable", () => {
    const scorecard = [{ holeNumber: 1, csvShotCount: 3, score: 5, putts: 2 }];

    expect(() => applyRoundShotDeletionToScorecard(scorecard, null)).toThrow(
      "Assign the shot to a scorecard hole before permanently deleting it.",
    );
  });

  it("rejects a shot whose mapped hole is absent from the saved scorecard", () => {
    const scorecard = [{ holeNumber: 1, csvShotCount: 3, score: 5, putts: 2 }];

    expect(() => applyRoundShotDeletionToScorecard(scorecard, 18)).toThrow(
      "The shot's mapped hole is not present in this round's saved scorecard.",
    );
  });
});

describe("physical round accounting", () => {
  it("keeps an excluded course shot in the scoring ledger", () => {
    const shots = [
      { id: "included", reviewStatus: "included" },
      { id: "excluded", reviewStatus: "user_excluded" },
      { id: "restored", reviewStatus: "restored" },
    ];

    expect(physicalRoundShotsForAccounting(shots)).toEqual(shots);
  });
});
