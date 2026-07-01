export type TodayClubMetricSnapshot = {
  shotCount: number;
  playableRate: number | null;
  bigMissRate: number | null;
  offlineAverageYd: number | null;
  straightRate: number | null;
  carryStdDevYd: number | null;
};

export type TodayClubMetricDeltas = {
  carryDeltaYd: number | null;
  offlineDeltaYd: number | null;
  straightRateDelta: number | null;
  playableRateDelta: number | null;
  bigMissRateDelta: number | null;
  consistencyDeltaYd: number | null;
};

type ClubScoringProfile = "driver" | "wedge" | "iron" | "longGame";
type ScoreComponent = "playable" | "bigMiss" | "offline" | "carry" | "straight" | "consistency";
type ScoreWeights = Partial<Record<ScoreComponent, number>>;

const SCORE_WEIGHTS: Record<ClubScoringProfile, ScoreWeights> = {
  driver: {
    playable: 0.4,
    bigMiss: 0.25,
    offline: 0.2,
    consistency: 0.1,
    straight: 0.05,
  },
  wedge: {
    offline: 0.4,
    straight: 0.3,
    carry: 0.2,
    playable: 0.1,
  },
  iron: {
    offline: 0.3,
    playable: 0.25,
    carry: 0.2,
    straight: 0.15,
    consistency: 0.1,
  },
  longGame: {
    playable: 0.32,
    bigMiss: 0.2,
    offline: 0.24,
    carry: 0.14,
    straight: 0.1,
  },
};

export function todayClubScoringProfile(clubType: string): ClubScoringProfile {
  const normalized = clubType.trim().toLowerCase();

  if (normalized === "driver") return "driver";
  if (["pw", "gw", "aw", "sw", "lw", "wedge"].includes(normalized)) return "wedge";
  if (/^[1-9]i$/.test(normalized)) return "iron";

  return "longGame";
}

export function bigMissOfflineLimitYd(clubType: string) {
  const profile = todayClubScoringProfile(clubType);

  if (profile === "driver") return 55;
  if (profile === "longGame") return 45;
  if (profile === "iron") return 35;
  return 25;
}

export function clubTypeCurrentPerformanceScore(
  clubType: string,
  snapshot: TodayClubMetricSnapshot,
) {
  if (snapshot.shotCount <= 0) {
    return 0;
  }

  const profile = todayClubScoringProfile(clubType);
  const components: Record<ScoreComponent, number> = {
    playable: rateScore(snapshot.playableRate),
    bigMiss: inverseRateScore(snapshot.bigMissRate),
    offline: offlineControlScore(clubType, snapshot.offlineAverageYd),
    carry: carryConsistencyScore(clubType, snapshot.carryStdDevYd),
    straight: rateScore(snapshot.straightRate),
    consistency: carryConsistencyScore(clubType, snapshot.carryStdDevYd),
  };

  return roundOne(weightedScore(SCORE_WEIGHTS[profile], components));
}

export function clubTypeImprovementScore(clubType: string, deltas: TodayClubMetricDeltas) {
  const profile = todayClubScoringProfile(clubType);
  const components: Record<ScoreComponent, number> = {
    playable: deltaRateScore(deltas.playableRateDelta, 30),
    bigMiss: deltaLowerIsBetterScore(deltas.bigMissRateDelta, 30),
    offline: deltaLowerIsBetterScore(deltas.offlineDeltaYd, offlineDeltaBandYd(clubType)),
    carry: deltaHigherIsBetterScore(deltas.carryDeltaYd, carryDeltaBandYd(clubType)),
    straight: deltaRateScore(deltas.straightRateDelta, 40),
    consistency: deltaLowerIsBetterScore(
      deltas.consistencyDeltaYd,
      consistencyDeltaBandYd(clubType),
    ),
  };

  return roundOne(clamp(weightedScore(SCORE_WEIGHTS[profile], components) / 20, -5, 5));
}

export function clubTypeEstimatedStrokeEffect(clubType: string, deltas: TodayClubMetricDeltas) {
  return roundOne(clamp(clubTypeImprovementScore(clubType, deltas) * 0.16, -0.8, 0.8));
}

function weightedScore(weights: ScoreWeights, components: Record<ScoreComponent, number>) {
  let total = 0;
  let weightTotal = 0;

  for (const [component, weight] of Object.entries(weights) as Array<[ScoreComponent, number]>) {
    total += components[component] * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? total / weightTotal : 0;
}

function rateScore(value: number | null) {
  return clamp(value ?? 55, 0, 100);
}

function inverseRateScore(value: number | null) {
  return clamp(100 - (value ?? 45), 0, 100);
}

function offlineControlScore(clubType: string, value: number | null) {
  if (value === null) return 55;
  return clamp(100 - (value / offlineControlBandYd(clubType)) * 100, 0, 100);
}

function carryConsistencyScore(clubType: string, value: number | null) {
  if (value === null) return 55;
  return clamp(100 - (value / consistencyControlBandYd(clubType)) * 100, 0, 100);
}

function deltaRateScore(value: number | null, fullMove: number) {
  return deltaHigherIsBetterScore(value, fullMove);
}

function deltaHigherIsBetterScore(value: number | null, fullMove: number) {
  if (value === null) return 0;
  return clamp((value / fullMove) * 100, -100, 100);
}

function deltaLowerIsBetterScore(value: number | null, fullMove: number) {
  if (value === null) return 0;
  return clamp((-value / fullMove) * 100, -100, 100);
}

function offlineControlBandYd(clubType: string) {
  const profile = todayClubScoringProfile(clubType);

  if (profile === "driver") return 38;
  if (profile === "longGame") return 30;
  if (profile === "iron") return 22;
  return 14;
}

function consistencyControlBandYd(clubType: string) {
  const profile = todayClubScoringProfile(clubType);

  if (profile === "driver") return 28;
  if (profile === "longGame") return 24;
  if (profile === "iron") return 18;
  return 12;
}

function offlineDeltaBandYd(clubType: string) {
  const profile = todayClubScoringProfile(clubType);

  if (profile === "driver") return 18;
  if (profile === "longGame") return 14;
  if (profile === "iron") return 10;
  return 7;
}

function carryDeltaBandYd(clubType: string) {
  const profile = todayClubScoringProfile(clubType);

  if (profile === "wedge") return 8;
  if (profile === "iron") return 12;
  return 16;
}

function consistencyDeltaBandYd(clubType: string) {
  const profile = todayClubScoringProfile(clubType);

  if (profile === "driver") return 16;
  if (profile === "longGame") return 14;
  if (profile === "iron") return 10;
  return 7;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
