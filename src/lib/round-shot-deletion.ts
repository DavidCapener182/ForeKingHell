import { isPermanentShotDeletionRestricted } from "@/lib/shot-deletion";

export type RoundShotDeleteActionInput = {
  sessionId: string;
  shotId: string;
};

export type RoundShotDeletionScorecardHole = {
  holeNumber: number;
  csvShotCount?: number;
  score?: number | null;
  netScore?: number | null;
  putts?: number | null;
  penalties?: number | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRoundShotDeleteActionInput(input: unknown): RoundShotDeleteActionInput {
  if (!input || typeof input !== "object") {
    throw new Error("Round shot selection is required.");
  }

  const record = input as Record<string, unknown>;
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const shotId = typeof record.shotId === "string" ? record.shotId.trim() : "";

  if (!uuidPattern.test(sessionId) || !uuidPattern.test(shotId)) {
    throw new Error("The round or shot reference is invalid.");
  }

  return { sessionId, shotId };
}

export function isRoundCorrectionDeletionAllowed(input: {
  scorecardJson: unknown;
  sessionType: string | null | undefined;
  sessionPlayContext: string | null | undefined;
  sessionCourseId: string | null | undefined;
  courseHoleNumber: number | null | undefined;
  providerKind?: string | null;
  providerSessionMode?: string | null;
}) {
  return (
    Array.isArray(input.scorecardJson) &&
    typeof input.courseHoleNumber === "number" &&
    Number.isInteger(input.courseHoleNumber) &&
    input.courseHoleNumber > 0 &&
    scorecardContainsHole(input.scorecardJson, input.courseHoleNumber) &&
    isPermanentShotDeletionRestricted({
      sessionType: input.sessionType,
      sessionPlayContext: input.sessionPlayContext,
      sessionCourseId: input.sessionCourseId,
      courseHoleNumber: input.courseHoleNumber,
      providerKind: input.providerKind,
      providerSessionMode: input.providerSessionMode,
    })
  );
}

export function applyRoundShotDeletionToScorecard<T extends RoundShotDeletionScorecardHole>(
  scorecard: readonly T[],
  courseHoleNumber: number | null | undefined,
) {
  if (courseHoleNumber === null || courseHoleNumber === undefined) {
    throw new Error("Assign the shot to a scorecard hole before permanently deleting it.");
  }

  let scoreChanged = false;
  let matchedHole = false;
  const nextScorecard = scorecard.map((hole) => {
    if (hole.holeNumber !== courseHoleNumber) {
      return hole;
    }

    matchedHole = true;
    const currentCsvShotCount = finiteNonNegativeInteger(hole.csvShotCount);
    const currentScore = finiteNonNegativeInteger(hole.score);
    const putts = finiteNonNegativeInteger(hole.putts) ?? 0;
    const penalties = finiteNonNegativeInteger(hole.penalties) ?? 0;
    const minimumAccountedScore = Math.max(1, putts + penalties);
    const nextScore =
      currentScore !== null && currentScore > minimumAccountedScore
        ? currentScore - 1
        : currentScore;
    const scoreDelta = currentScore !== null && nextScore !== null ? nextScore - currentScore : 0;

    scoreChanged ||= scoreDelta !== 0;

    return {
      ...hole,
      csvShotCount:
        currentCsvShotCount === null ? hole.csvShotCount : Math.max(0, currentCsvShotCount - 1),
      score: currentScore === null ? hole.score : nextScore,
      netScore:
        scoreDelta !== 0 && typeof hole.netScore === "number" && Number.isFinite(hole.netScore)
          ? Math.max(0, hole.netScore + scoreDelta)
          : hole.netScore,
    };
  });

  if (!matchedHole) {
    throw new Error("The shot's mapped hole is not present in this round's saved scorecard.");
  }

  return {
    scorecard: nextScorecard,
    scoreChanged,
    affectedHoleNumber: matchedHole ? courseHoleNumber : null,
  };
}

function scorecardContainsHole(scorecard: unknown[], holeNumber: number) {
  return scorecard.some((hole) => {
    if (!hole || typeof hole !== "object" || !("holeNumber" in hole)) {
      return false;
    }

    return (hole as { holeNumber?: unknown }).holeNumber === holeNumber;
  });
}

export function physicalRoundShotsForAccounting<T>(shots: readonly T[]) {
  return [...shots];
}

function finiteNonNegativeInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}
