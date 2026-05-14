import type { ParsedRapsodoShot } from "@/lib/rapsodo/parser";

export type RapsodoClubChoice = {
  clubKey: string;
  clubType: string;
  clubLabel: string;
  clubBrand: string | null;
  clubModel: string | null;
  active?: boolean;
  firstShotAt?: string | null;
  lastShotAt?: string | null;
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

type RapsodoClubSuggestionOptions = {
  preferredClubKey?: string | null;
};

const TRUSTED_DISTANCE_GAP_YD = 18;
const HIGH_CONFIDENCE_SCORE = 78;
const MEDIUM_CONFIDENCE_SCORE = 58;

export function suggestRapsodoClub(
  shot: ParsedRapsodoShot,
  candidates: RapsodoClubChoice[],
  options: RapsodoClubSuggestionOptions = {},
): RapsodoClubSuggestion {
  const activeCandidates = candidates.filter(isActiveChoice);
  const preferredChoice = preferredRapsodoClubChoice(shot, activeCandidates, options.preferredClubKey);
  const reportedChoice = reportedRapsodoClubChoice(shot, candidates, options);
  const activeReportedChoice = activeRapsodoClubChoice(shot, activeCandidates, {
    preferredClubKey: preferredChoice?.clubKey ?? options.preferredClubKey,
  });
  const reportedChoiceIsRetired = reportedChoice.active === false;
  const isEquipmentHistoryMatch = Boolean(
    preferredChoice && activeReportedChoice?.clubKey === preferredChoice.clubKey,
  );
  const scoredCandidates = activeCandidates
    .map((candidate) => ({
      candidate,
      score: clubDistanceScore(shot, candidate),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score);
  const best = scoredCandidates[0] ?? null;
  const reportedScore = activeReportedChoice
    ? clubDistanceScore(shot, activeReportedChoice)
    : Number.POSITIVE_INFINITY;
  const reportedIsKnown = isTrackedClubType(shot.clubType);

  if (!best) {
    const fallbackChoice =
      activeReportedChoice ??
      sameTypeActiveChoice(shot, activeCandidates) ??
      (isActiveChoice(reportedChoice) ? reportedChoice : fallbackShotChoice(shot));

    return {
      choice: fallbackChoice,
      confidenceScore: reportedIsKnown && isTrackedClubType(fallbackChoice.clubType) ? 72 : 25,
      confidence: reportedIsKnown && isTrackedClubType(fallbackChoice.clubType) ? "trusted" : "low",
      reason: noStockDataReason({
        reportedIsKnown,
        reportedChoiceIsRetired,
        fallbackChoice,
      }),
      alternatives: [],
    };
  }

  if (
    reportedIsKnown &&
    activeReportedChoice &&
    (activeReportedChoice.clubKey === best.candidate.clubKey ||
      best.score + TRUSTED_DISTANCE_GAP_YD >= reportedScore)
  ) {
    return {
      choice: activeReportedChoice,
      confidenceScore: Math.max(70, confidenceFromScore(reportedScore)),
      confidence: "trusted",
      reason: reportedChoiceIsRetired
        ? `${activeReportedChoice.clubLabel} is the closest active match. Retired clubs are ignored for recommendations.`
        : isEquipmentHistoryMatch
          ? "This club matches the session date in your equipment history."
          : activeReportedChoice.clubKey === best.candidate.clubKey
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
    reason: reportedChoiceIsRetired
      ? `${best.candidate.clubLabel} is the closest active match. Retired clubs are ignored for recommendations.`
      : reportedIsKnown
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
  options: RapsodoClubSuggestionOptions = {},
): RapsodoClubChoice {
  const preferred = preferredRapsodoClubChoice(shot, candidates, options.preferredClubKey);
  if (preferred) {
    return preferred;
  }

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

function preferredRapsodoClubChoice(
  shot: ParsedRapsodoShot,
  candidates: RapsodoClubChoice[],
  preferredClubKey: string | null | undefined,
) {
  if (!preferredClubKey || shot.clubBrand || shot.clubModel) {
    return null;
  }

  return candidates.find(
    (candidate) => candidate.clubKey === preferredClubKey && candidate.clubType === shot.clubType,
  ) ?? null;
}

function activeRapsodoClubChoice(
  shot: ParsedRapsodoShot,
  activeCandidates: RapsodoClubChoice[],
  options: RapsodoClubSuggestionOptions,
) {
  const preferred = preferredRapsodoClubChoice(shot, activeCandidates, options.preferredClubKey);
  if (preferred) {
    return preferred;
  }

  const exact = activeCandidates.find((candidate) => candidate.clubKey === shot.clubKey);
  if (exact) {
    return exact;
  }

  if (!shot.clubBrand && !shot.clubModel) {
    return sameTypeActiveChoice(shot, activeCandidates);
  }

  return null;
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

function noStockDataReason({
  reportedIsKnown,
  reportedChoiceIsRetired,
  fallbackChoice,
}: {
  reportedIsKnown: boolean;
  reportedChoiceIsRetired: boolean;
  fallbackChoice: RapsodoClubChoice;
}) {
  if (reportedChoiceIsRetired && isTrackedClubType(fallbackChoice.clubType)) {
    return `${fallbackChoice.clubLabel} is the closest active match available. Retired clubs are ignored for recommendations.`;
  }

  return reportedIsKnown
    ? "Rapsodo reported this club and there is not enough stock-yardage data to challenge it."
    : "No stock-yardage match is available yet; choose the club before importing.";
}

function sameTypeActiveChoice(shot: ParsedRapsodoShot, activeCandidates: RapsodoClubChoice[]) {
  const [choice] = activeCandidates
    .filter((candidate) => candidate.clubType === shot.clubType)
    .sort((left, right) => right.sampleSize - left.sampleSize || left.clubLabel.localeCompare(right.clubLabel));

  return choice ?? null;
}

function fallbackShotChoice(shot: ParsedRapsodoShot): RapsodoClubChoice {
  return {
    clubKey: `${shot.clubType}:generic:generic`,
    clubType: shot.clubType,
    clubLabel: shot.clubLabel,
    clubBrand: null,
    clubModel: null,
    stockCarryYd: null,
    stockTotalYd: null,
    averageBallSpeedMph: null,
    sampleSize: 0,
    rapsodoClubId: null,
  };
}

function isActiveChoice(choice: RapsodoClubChoice) {
  return choice.active !== false;
}

function isTrackedClubType(value: string) {
  return value !== "unknown" && value !== "other" && value !== "ot" && value !== "putter";
}

function isNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}
