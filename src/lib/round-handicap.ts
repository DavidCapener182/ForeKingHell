export type HandicapRoundInput = {
  totalScore: number | null;
  totalPar?: number | null;
  courseRating: number | null;
  slopeRating: number | null;
  holesPlayed?: number | null;
};

export type HandicapTrendDirection = "down" | "up" | "flat" | "none";

export type HandicapTrend = {
  direction: HandicapTrendDirection;
  delta: number | null;
  previous: number | null;
};

export type HandicapSummary = {
  value: number | null;
  sampleSize: number;
  usedDifferentialCount: number;
  adjustment: number;
  methodLabel: string;
  trend: HandicapTrend;
};

export type PlayingHandicapRoundInput = {
  handicapDifferential: number | null;
  type: string | null;
};

export type PlayingHandicapSummary = {
  value: number | null;
  sampleSize: number;
  usedDifferentialCount: number;
  realDifferentialCount: number;
  simulatorDifferentialCount: number;
  simulatorAdjustment: number;
  methodLabel: string;
  warning: string;
};

const handicapFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const MIN_PLAYING_HANDICAP_ROUNDS = 3;
const PLAYING_HANDICAP_RECENT_ROUNDS = 8;
const SIMULATOR_PLAYING_ADJUSTMENT = 4;
const PLAYING_HANDICAP_WARNING =
  "Data-limited: this reflects recent adjusted scoring, not an official Handicap Index.";

export function calculateRoundDifferential({
  totalScore,
  totalPar,
  courseRating,
  slopeRating,
  holesPlayed,
}: HandicapRoundInput) {
  const rating = typeof courseRating === "number" ? courseRating : totalPar;
  const slope = typeof slopeRating === "number" && slopeRating > 0 ? slopeRating : 113;

  if (typeof totalScore !== "number" || typeof rating !== "number") {
    return null;
  }

  return (((totalScore - rating) * 113) / slope) * differentialHolesFactor(holesPlayed);
}

export function averageRoundDifferential(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) / present.length : null;
}

export function calculateHandicapSummary(valuesNewestFirst: Array<number | null>): HandicapSummary {
  const values = valuesNewestFirst.filter((value): value is number => typeof value === "number");
  const estimate = calculateWhsStyleIndex(values);
  const previousEstimate = values.length > 1 ? calculateWhsStyleIndex(values.slice(1)) : null;
  const value = estimate.value;
  const previous = previousEstimate?.value ?? null;
  const delta = typeof value === "number" && typeof previous === "number" ? value - previous : null;

  return {
    value,
    sampleSize: values.length,
    usedDifferentialCount: estimate.usedDifferentialCount,
    adjustment: estimate.adjustment,
    methodLabel: estimate.methodLabel,
    trend: {
      previous,
      delta,
      direction: trendDirection(delta),
    },
  };
}

export function calculatePlayingHandicapSummary(
  roundsNewestFirst: PlayingHandicapRoundInput[],
): PlayingHandicapSummary {
  const adjustedRounds = roundsNewestFirst
    .map((round) => {
      if (typeof round.handicapDifferential !== "number" || !Number.isFinite(round.handicapDifferential)) {
        return null;
      }

      const isRealRound = round.type === "real_round";
      return {
        isRealRound,
        value: round.handicapDifferential + (isRealRound ? 0 : SIMULATOR_PLAYING_ADJUSTMENT),
      };
    })
    .filter((round): round is { isRealRound: boolean; value: number } => round !== null);
  const selectedRounds = adjustedRounds.slice(0, PLAYING_HANDICAP_RECENT_ROUNDS);
  const realDifferentialCount = selectedRounds.filter((round) => round.isRealRound).length;
  const simulatorDifferentialCount = selectedRounds.length - realDifferentialCount;

  if (selectedRounds.length < MIN_PLAYING_HANDICAP_ROUNDS) {
    return {
      value: null,
      sampleSize: adjustedRounds.length,
      usedDifferentialCount: selectedRounds.length,
      realDifferentialCount,
      simulatorDifferentialCount,
      simulatorAdjustment: SIMULATOR_PLAYING_ADJUSTMENT,
      methodLabel: `Needs ${MIN_PLAYING_HANDICAP_ROUNDS} eligible rounds; ${selectedRounds.length} available`,
      warning: PLAYING_HANDICAP_WARNING,
    };
  }

  return {
    value: averageRoundDifferential(selectedRounds.map((round) => round.value)),
    sampleSize: adjustedRounds.length,
    usedDifferentialCount: selectedRounds.length,
    realDifferentialCount,
    simulatorDifferentialCount,
    simulatorAdjustment: SIMULATOR_PLAYING_ADJUSTMENT,
    methodLabel: `Average latest ${selectedRounds.length} adjusted differentials; simulator ${formatHandicapDelta(SIMULATOR_PLAYING_ADJUSTMENT)}`,
    warning: PLAYING_HANDICAP_WARNING,
  };
}

export function calculateWhsStyleIndex(valuesNewestFirst: number[]) {
  const recent = valuesNewestFirst.filter(Number.isFinite).slice(0, 20);

  if (recent.length === 0) {
    return {
      value: null,
      usedDifferentialCount: 0,
      adjustment: 0,
      methodLabel: "No eligible score differentials",
    };
  }

  const rule = reducedScoreCountRule(recent.length);
  const selected = [...recent].sort((left, right) => left - right).slice(0, rule.count);
  const average = averageRoundDifferential(selected);
  const adjusted = average === null ? null : average + rule.adjustment;

  return {
    value: adjusted,
    usedDifferentialCount: selected.length,
    adjustment: rule.adjustment,
    methodLabel:
      recent.length >= 20
        ? "Lowest 8 of latest 20 differentials"
        : `${recent.length} eligible ${recent.length === 1 ? "score" : "scores"}: lowest ${rule.count}${rule.adjustment ? ` with ${formatHandicapDelta(rule.adjustment)} adjustment` : ""}`,
  };
}

function differentialHolesFactor(holesPlayed: number | null | undefined) {
  if (typeof holesPlayed !== "number" || !Number.isFinite(holesPlayed) || holesPlayed <= 0 || holesPlayed >= 18) {
    return 1;
  }

  return 18 / holesPlayed;
}

export function formatHandicapValue(value: number | null) {
  return typeof value === "number" ? handicapFormatter.format(value) : "--";
}

export function formatHandicapDelta(value: number | null) {
  if (typeof value !== "number") {
    return "--";
  }

  const absolute = Math.abs(value);
  const formatted = handicapFormatter.format(absolute);

  if (absolute < 0.05) {
    return formatted;
  }

  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function trendDirection(delta: number | null): HandicapTrendDirection {
  if (typeof delta !== "number") {
    return "none";
  }

  if (Math.abs(delta) < 0.05) {
    return "flat";
  }

  return delta < 0 ? "down" : "up";
}

function reducedScoreCountRule(scoreCount: number) {
  if (scoreCount >= 20) {
    return { count: 8, adjustment: 0 };
  }

  if (scoreCount === 19) {
    return { count: 7, adjustment: 0 };
  }

  if (scoreCount >= 17) {
    return { count: 6, adjustment: 0 };
  }

  if (scoreCount >= 15) {
    return { count: 5, adjustment: 0 };
  }

  if (scoreCount >= 12) {
    return { count: 4, adjustment: 0 };
  }

  if (scoreCount >= 9) {
    return { count: 3, adjustment: 0 };
  }

  if (scoreCount >= 7) {
    return { count: 2, adjustment: 0 };
  }

  if (scoreCount === 6) {
    return { count: 2, adjustment: -1 };
  }

  if (scoreCount === 5) {
    return { count: 1, adjustment: 0 };
  }

  if (scoreCount === 4) {
    return { count: 1, adjustment: -1 };
  }

  if (scoreCount === 3) {
    return { count: 1, adjustment: -2 };
  }

  if (scoreCount === 2) {
    return { count: 1, adjustment: -1 };
  }

  return { count: 1, adjustment: 0 };
}
