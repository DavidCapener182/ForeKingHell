export type CourseScoringReview = Record<
  number,
  {
    score?: number | null;
    putts?: number | null;
    penalties?: number | null;
  }
>;

export type CourseScoringHole = {
  holeNumber: number;
  shotCount: number;
};

export type CourseHoleScoringRow = {
  holeNumber: number;
  csvShotCount: number;
  putts: number | null;
  penalties: number | null;
  score: number | null;
};

export function buildCourseHoleScoringRows(
  holes: CourseScoringHole[],
  reviewByHole: CourseScoringReview,
): CourseHoleScoringRow[] {
  return holes.map((hole) => {
    const review = reviewByHole[hole.holeNumber];
    const score = positiveIntegerOrNull(review?.score);
    const explicitPenalties = nonNegativeIntegerOrNull(review?.penalties);
    const explicitPutts = nonNegativeIntegerOrNull(review?.putts);
    const penalties =
      explicitPenalties ??
      (score !== null && explicitPutts !== null
        ? Math.max(0, score - hole.shotCount - explicitPutts)
        : score !== null
          ? 0
          : null);
    const putts =
      explicitPutts ??
      (score !== null && penalties !== null
        ? Math.max(0, score - hole.shotCount - penalties)
        : null);

    return {
      holeNumber: hole.holeNumber,
      csvShotCount: Math.max(0, Math.floor(hole.shotCount)),
      putts,
      penalties,
      score,
    };
  });
}

export function summarizeCourseHoleScoring(rows: CourseHoleScoringRow[]) {
  const scoreCount = rows.filter((row) => row.score !== null).length;
  const puttCount = rows.filter((row) => row.putts !== null).length;
  const totalScore =
    scoreCount > 0 ? rows.reduce((total, row) => total + (row.score ?? 0), 0) : null;
  const totalPutts =
    puttCount > 0 ? rows.reduce((total, row) => total + (row.putts ?? 0), 0) : null;

  return {
    holeCount: rows.length,
    scoreCount,
    puttCount,
    totalScore,
    totalPutts,
    isComplete: rows.length > 0 && scoreCount === rows.length && puttCount === rows.length,
  };
}

function positiveIntegerOrNull(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return null;
  }

  return Math.floor(value);
}

function nonNegativeIntegerOrNull(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}
