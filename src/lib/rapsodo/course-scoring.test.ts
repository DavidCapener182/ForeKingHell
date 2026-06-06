import { describe, expect, it } from "vitest";

import {
  buildCourseHoleScoringRows,
  summarizeCourseHoleScoring,
} from "@/lib/rapsodo/course-scoring";

describe("Rapsodo course scoring", () => {
  it("keeps entered scores and putts and derives missing penalty strokes", () => {
    const rows = buildCourseHoleScoringRows(
      [
        { holeNumber: 1, shotCount: 4 },
        { holeNumber: 2, shotCount: 2 },
      ],
      {
        1: { score: 6, putts: 2, penalties: null },
        2: { score: 4, putts: 2, penalties: 0 },
      },
    );

    expect(rows).toEqual([
      { holeNumber: 1, csvShotCount: 4, score: 6, putts: 2, penalties: 0 },
      { holeNumber: 2, csvShotCount: 2, score: 4, putts: 2, penalties: 0 },
    ]);
    expect(summarizeCourseHoleScoring(rows)).toMatchObject({
      holeCount: 2,
      scoreCount: 2,
      puttCount: 2,
      totalScore: 10,
      totalPutts: 4,
      isComplete: true,
    });
  });

  it("derives putts from score and assigned Rapsodo shots", () => {
    const rows = buildCourseHoleScoringRows(
      [
        { holeNumber: 1, shotCount: 4 },
        { holeNumber: 2, shotCount: 2 },
      ],
      {
        1: { score: 6 },
        2: { score: 4, penalties: 1 },
      },
    );

    expect(rows).toEqual([
      { holeNumber: 1, csvShotCount: 4, score: 6, putts: 2, penalties: 0 },
      { holeNumber: 2, csvShotCount: 2, score: 4, putts: 1, penalties: 1 },
    ]);
    expect(summarizeCourseHoleScoring(rows)).toMatchObject({
      scoreCount: 2,
      puttCount: 2,
      totalScore: 10,
      totalPutts: 3,
      isComplete: true,
    });
  });

  it("treats score-only rows as complete when every hole has a score", () => {
    const rows = buildCourseHoleScoringRows(
      [
        { holeNumber: 1, shotCount: 4 },
        { holeNumber: 2, shotCount: 2 },
      ],
      {
        1: { score: 6 },
        2: { score: 4 },
      },
    );

    expect(rows[0]).toMatchObject({ score: 6, putts: 2, penalties: 0 });
    expect(summarizeCourseHoleScoring(rows)).toMatchObject({
      scoreCount: 2,
      puttCount: 2,
      totalScore: 10,
      totalPutts: 4,
      isComplete: true,
    });
  });

  it("keeps scored rounds incomplete until every hole has a score", () => {
    const rows = buildCourseHoleScoringRows(
      [
        { holeNumber: 1, shotCount: 4 },
        { holeNumber: 2, shotCount: 2 },
      ],
      {
        1: { score: 6 },
      },
    );

    expect(rows[1]).toMatchObject({ score: null, putts: null, penalties: null });
    expect(summarizeCourseHoleScoring(rows)).toMatchObject({
      scoreCount: 1,
      puttCount: 1,
      totalScore: 6,
      totalPutts: 2,
      isComplete: false,
    });
  });
});
