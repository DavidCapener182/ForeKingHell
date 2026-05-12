import type { ParsedRapsodoShot } from "@/lib/rapsodo/parser";

export type RapsodoClubChoice = {
  clubKey: string;
  clubType: string;
  clubLabel: string;
  clubBrand: string | null;
  clubModel: string | null;
  stockCarryYd: number | null;
  stockTotalYd: number | null;
  averageBallSpeedMph: number | null;
  sampleSize: number;
  rapsodoClubId?: string | null;
};

export type RapsodoClubSuggestion = {
  choice: RapsodoClubChoice;
  confidenceScore: number;
  confidence: "trusted" | "high" | "medium" | "low";
  reason: string;
  alternatives: Array<{
    clubKey: string;
    clubLabel: string;
    score: number;
  }>;
};

const TRUSTED_DISTANCE_GAP_YD = 18;
const HIGH_CONFIDENCE_SCORE = 78;
const MEDIUM_CONFIDENCE_SCORE = 58;

export function suggestRapsodoClub(
  shot: ParsedRapsodoShot,
  candidates: RapsodoClubChoice[],
): RapsodoClubSuggestion {
  const reportedChoice = reportedRapsodoClubChoice(shot, candidates);
  const scoredCandidates = candidates
    .map((candidate) => ({
      candidate,
      score: clubDistanceScore(shot, candidate),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score);
  const best = scoredCandidates[0] ?? null;
  const reportedScore = clubDistanceScore(shot, reportedChoice);
  const reportedIsKnown = isTrackedClubType(shot.clubType);

  if (!best) {
    return {
      choice: reportedChoice,
      confidenceScore: reportedIsKnown ? 72 : 25,
      confidence: reportedIsKnown ? "trusted" : "low",
      reason: reportedIsKnown
        ? "Rapsodo reported this club and there is not enough stock-yardage data to challenge it."
        : "No stock-yardage match is available yet; choose the club before importing.",
      alternatives: [],
    };
  }

  if (
    reportedIsKnown &&
    (reportedChoice.clubKey === best.candidate.clubKey || best.score + TRUSTED_DISTANCE_GAP_YD >= reportedScore)
  ) {
    return {
      choice: reportedChoice,
      confidenceScore: Math.max(70, confidenceFromScore(reportedScore)),
      confidence: "trusted",
      reason:
        reportedChoice.clubKey === best.candidate.clubKey
          ? "Rapsodo's reported club matches the closest stock-yardage profile."
          : "Rapsodo reported a tracked club and the stock-yardage data is not different enough to override it.",
      alternatives: alternatives(scoredCandidates),
    };
  }

  const confidenceScore = confidenceFromScore(best.score);

  return {
    choice: best.candidate,
    confidenceScore,
    confidence: confidenceLabel(confidenceScore),
    reason: reportedIsKnown
      ? `${best.candidate.clubLabel} is materially closer to this shot than Rapsodo's reported ${reportedChoice.clubLabel}.`
      : `${best.candidate.clubLabel} is the closest match from your bag and stock-yardage history.`,
    alternatives: alternatives(scoredCandidates),
  };
}

export function uniqueClubChoices(choices: RapsodoClubChoice[]) {
  const byKey = new Map<string, RapsodoClubChoice>();

  for (const choice of choices) {
    if (!byKey.has(choice.clubKey)) {
      byKey.set(choice.clubKey, choice);
    }
  }

  return [...byKey.values()];
}

export function reportedRapsodoClubChoice(
  shot: ParsedRapsodoShot,
  candidates: RapsodoClubChoice[],
): RapsodoClubChoice {
  const exact = candidates.find((candidate) => candidate.clubKey === shot.clubKey);
  if (exact) {
    return exact;
  }

  const sameType = candidates.find((candidate) => candidate.clubType === shot.clubType);
  if (sameType && !shot.clubBrand && !shot.clubModel) {
    return sameType;
  }

  return {
    clubKey: shot.clubKey,
    clubType: shot.clubType,
    clubLabel: shot.clubLabel,
    clubBrand: shot.clubBrand,
    clubModel: shot.clubModel,
    stockCarryYd: null,
    stockTotalYd: null,
    averageBallSpeedMph: null,
    sampleSize: 0,
    rapsodoClubId: null,
  };
}

function clubDistanceScore(shot: ParsedRapsodoShot, candidate: RapsodoClubChoice) {
  const carryScore =
    shot.carryYd !== null && candidate.stockCarryYd !== null
      ? Math.abs(shot.carryYd - candidate.stockCarryYd)
      : null;
  const totalScore =
    shot.totalYd !== null && candidate.stockTotalYd !== null
      ? Math.abs(shot.totalYd - candidate.stockTotalYd) * 0.75
      : null;
  const speedScore =
    shot.ballSpeedMph !== null && candidate.averageBallSpeedMph !== null
      ? Math.abs(shot.ballSpeedMph - candidate.averageBallSpeedMph) * 1.6
      : null;
  const scores = [carryScore, totalScore, speedScore].filter(isNumber);

  if (scores.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const samplePenalty = candidate.sampleSize >= 10 ? 0 : candidate.sampleSize >= 4 ? 6 : 14;
  return scores.reduce((total, score) => total + score, 0) / scores.length + samplePenalty;
}

function confidenceFromScore(score: number) {
  return Math.max(20, Math.min(95, Math.round(100 - score * 2.2)));
}

function confidenceLabel(score: number): RapsodoClubSuggestion["confidence"] {
  if (score >= HIGH_CONFIDENCE_SCORE) {
    return "high";
  }

  if (score >= MEDIUM_CONFIDENCE_SCORE) {
    return "medium";
  }

  return "low";
}

function alternatives(scoredCandidates: Array<{ candidate: RapsodoClubChoice; score: number }>) {
  return scoredCandidates.slice(0, 3).map((entry) => ({
    clubKey: entry.candidate.clubKey,
    clubLabel: entry.candidate.clubLabel,
    score: Math.round(entry.score),
  }));
}

function isTrackedClubType(value: string) {
  return value !== "unknown" && value !== "other" && value !== "ot" && value !== "putter";
}

function isNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}
