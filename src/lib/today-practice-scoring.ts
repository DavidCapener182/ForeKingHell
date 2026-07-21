import { clubTypeCarryConsistencyScore } from "@/lib/today-club-scoring";

export type LatestPracticeTone = "green" | "sky" | "pink" | "amber" | "slate";

export type TodaySessionQualityClub = {
  clubType: string;
  shotCount: number;
  playableRate: number | null;
  bigMissRate: number | null;
  offlineAverageYd: number | null;
  straightRate: number | null;
  carryStdDevYd: number | null;
  carryRobustStdDevYd?: number | null;
};

export type TodaySessionQualityInput = {
  shotCount: number;
  selectedClubCount: number;
  playableRate: number | null;
  bigMissRate: number | null;
  offlineAverageYd: number | null;
  strikeScore: number;
  pbMomentCount: number;
  clubs: TodaySessionQualityClub[];
};

export type SessionQualityReadout = {
  score: number;
  label: "Good" | "Productive" | "Mixed" | "Poor";
  detail: string;
  tone: LatestPracticeTone;
};

export type ScoringControlReadout = {
  score: number;
  label: "Strong" | "Solid" | "Mixed" | "Needs work";
  detail: string;
  tone: LatestPracticeTone;
};

export type PlanResultReadout = {
  label: "Passed" | "Mixed" | "Incomplete";
  scoreLabel: string;
  detail: string;
  tone: LatestPracticeTone;
};

export type ClubSessionBadgeReadout = {
  label:
    | "Good"
    | "Playable - tighten start line"
    | "Playable - not scoring-tight"
    | "Low sample"
    | "Needs work"
    | "Mixed";
  tone: LatestPracticeTone;
};

export type TodayPracticePlanResultInput = {
  score: number | null;
  verdict: string;
  comparisonSummary?: string | null;
  totalBlocks?: number | null;
  passedBlocks?: number | null;
  mixedBlocks?: number | null;
  incompleteBlocks?: number | null;
};

export function buildSessionQualityReadout(input: TodaySessionQualityInput): SessionQualityReadout {
  if (input.shotCount <= 0) {
    return {
      score: 0,
      label: "Poor",
      detail: "Import a tracked practice session before judging session quality.",
      tone: "slate",
    };
  }

  const playableScore = clamp(input.playableRate ?? 55, 0, 100);
  const strikeScore = clamp(input.strikeScore * 10, 0, 100);
  const bigMissScore = clamp(100 - (input.bigMissRate ?? 12) * 2.4, 0, 100);
  const offlineScore = sessionOfflineScore(input.offlineAverageYd);
  const carryScore = sessionCarryStabilityScore(input.clubs);
  const dataScore = sessionDataQualityScore(input);
  const pbScore = input.pbMomentCount > 0 ? clamp(70 + input.pbMomentCount * 5, 70, 95) : 55;
  const weighted =
    playableScore * 0.28 +
    strikeScore * 0.22 +
    bigMissScore * 0.16 +
    offlineScore * 0.12 +
    carryScore * 0.12 +
    dataScore * 0.06 +
    pbScore * 0.04;
  const highlyPlayable =
    (input.playableRate ?? 0) >= 95 &&
    (input.bigMissRate ?? 100) <= 5 &&
    input.strikeScore >= 6.5 &&
    dataScore >= 70;
  const score = Math.round(highlyPlayable ? Math.max(weighted, 70) : weighted);

  if (score >= 82) {
    return {
      score,
      label: "Good",
      detail:
        "Useful practice session. Strike and playability made the evidence worth keeping; scoring control is judged separately.",
      tone: "green",
    };
  }

  if (score >= 70) {
    return {
      score,
      label: "Productive",
      detail:
        "Productive range session. The ball was playable, even if scoring control still needs work.",
      tone: "amber",
    };
  }

  if (score >= 55) {
    return {
      score,
      label: "Mixed",
      detail:
        "Useful evidence, but strike, playability or big misses kept the session from being clean.",
      tone: "sky",
    };
  }

  return {
    score,
    label: "Poor",
    detail: "Session quality needs a cleaner contact or data signal before trusting the read.",
    tone: "pink",
  };
}

export function buildScoringControlReadout(score: number): ScoringControlReadout {
  const roundedScore = roundOne(clamp(score, 0, 10));

  if (roundedScore >= 8) {
    return {
      score: roundedScore,
      label: "Strong",
      detail: "Strike transferred into scoring shots with controlled direction and carry.",
      tone: "green",
    };
  }

  if (roundedScore >= 6.5) {
    return {
      score: roundedScore,
      label: "Solid",
      detail: "Scoring control was playable, but start line or carry spread still leaked value.",
      tone: "amber",
    };
  }

  if (roundedScore >= 4.5) {
    return {
      score: roundedScore,
      label: "Mixed",
      detail:
        "Playable shots were present, but start line, cone size or carry windows were not scoring-tight.",
      tone: "sky",
    };
  }

  return {
    score: roundedScore,
    label: "Needs work",
    detail: "Direction, carry spread or big misses would not transfer cleanly to scoring.",
    tone: "pink",
  };
}

export function buildPlanResultReadout(
  plan: TodayPracticePlanResultInput | null,
): PlanResultReadout | null {
  if (!plan) {
    return null;
  }

  const score = plan.score;
  const scoreLabel = typeof score === "number" ? `${Math.round(score)}/100` : "No score";
  const blockDetail =
    typeof plan.totalBlocks === "number" && plan.totalBlocks > 0
      ? `${plan.passedBlocks ?? 0}/${plan.totalBlocks} blocks passed`
      : plan.comparisonSummary;

  if (typeof score !== "number") {
    return {
      label: "Incomplete",
      scoreLabel,
      detail: blockDetail ?? "The plan is linked, but block scoring is not complete yet.",
      tone: "amber",
    };
  }

  if (score >= 78 && (plan.incompleteBlocks ?? 0) === 0) {
    return {
      label: "Passed",
      scoreLabel,
      detail: blockDetail ?? plan.verdict,
      tone: "green",
    };
  }

  if (score >= 55) {
    return {
      label: "Mixed",
      scoreLabel,
      detail: blockDetail ?? plan.verdict,
      tone: "amber",
    };
  }

  return {
    label: "Incomplete",
    scoreLabel,
    detail: "The session was useful. The planned drill was not fully proven.",
    tone: "amber",
  };
}

export function latestPracticeHeadline(
  sessionQuality: SessionQualityReadout,
  scoringControl: ScoringControlReadout,
) {
  if (sessionQuality.score <= 0) {
    return "No practice shots selected";
  }

  if (sessionQuality.score >= 70 && scoringControl.label === "Mixed") {
    return "Productive session - scoring control mixed";
  }

  if (sessionQuality.score >= 70 && scoringControl.label === "Needs work") {
    return "Productive session, scoring control needs work";
  }

  return `${sessionQuality.label} session`;
}

export function clubControlLabel(snapshot: {
  playableRate: number | null;
  straightRate: number | null;
}) {
  if ((snapshot.playableRate ?? 0) >= 90 && (snapshot.straightRate ?? 100) < 35) {
    return "Playable but not scoring-tight";
  }

  if ((snapshot.playableRate ?? 0) >= 90) {
    return "Playable";
  }

  if ((snapshot.playableRate ?? 100) < 65) {
    return "Playable rate needs work";
  }

  return "Building control";
}

export function clubSessionBadgeReadout(
  clubType: string,
  snapshot: {
    shotCount: number;
    playableRate: number | null;
    straightRate: number | null;
    offlineAverageYd: number | null;
  },
): ClubSessionBadgeReadout {
  if (snapshot.shotCount < 5) {
    return {
      label: "Low sample",
      tone: "slate",
    };
  }

  if ((snapshot.playableRate ?? 100) < 65) {
    return {
      label: "Needs work",
      tone: "pink",
    };
  }

  if (isDriverClubType(clubType) && (snapshot.playableRate ?? 0) >= 90) {
    return {
      label: "Playable - tighten start line",
      tone: "amber",
    };
  }

  if (clubControlLabel(snapshot) === "Playable but not scoring-tight") {
    return {
      label: "Playable - not scoring-tight",
      tone: "amber",
    };
  }

  if (
    (snapshot.playableRate ?? 0) >= 90 &&
    (snapshot.straightRate ?? 0) >= 35 &&
    (snapshot.offlineAverageYd ?? 99) <= 10
  ) {
    return {
      label: "Good",
      tone: "green",
    };
  }

  return {
    label: "Mixed",
    tone: "amber",
  };
}

function sessionCarryStabilityScore(clubs: TodaySessionQualityClub[]) {
  const scored = clubs
    .filter((club) => club.shotCount > 0)
    .map((club) => ({
      value: clubTypeCarryConsistencyScore(
        club.clubType,
        club.carryRobustStdDevYd ?? club.carryStdDevYd,
      ),
      weight: club.shotCount,
    }));

  if (scored.length === 0) {
    return 65;
  }

  return weightedAverage(scored) ?? 65;
}

function sessionOfflineScore(value: number | null) {
  if (value === null) {
    return 60;
  }

  return clamp(100 - (value / 28) * 100, 0, 100);
}

function sessionDataQualityScore(input: TodaySessionQualityInput) {
  const hasDirectionalData = input.playableRate !== null || input.offlineAverageYd !== null;
  const shotDepth =
    input.shotCount >= 80
      ? 100
      : input.shotCount >= 40
        ? 88
        : input.shotCount >= 20
          ? 74
          : input.shotCount >= 10
            ? 60
            : 42;
  const clubMix = input.selectedClubCount >= 4 ? 100 : input.selectedClubCount >= 2 ? 82 : 68;
  const dataCoverage = hasDirectionalData ? 100 : 45;

  return shotDepth * 0.45 + clubMix * 0.25 + dataCoverage * 0.3;
}

function weightedAverage(items: Array<{ value: number | null; weight: number }>) {
  const weighted = items.filter((item) => typeof item.value === "number" && item.weight > 0);
  const weightTotal = weighted.reduce((total, item) => total + item.weight, 0);

  if (weightTotal <= 0) {
    return null;
  }

  return (
    weighted.reduce((total, item) => total + Number(item.value) * item.weight, 0) / weightTotal
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function isDriverClubType(clubType: string) {
  return clubType.trim().toLowerCase() === "driver";
}
