import type { SessionFormSnapshot } from "@/lib/training/sessionForm";

export type SessionQualitySnapshot = {
  date: string;
  snapshot: SessionFormSnapshot;
};

type WeightedScore = {
  score: number;
  weight: number;
};

export function calculateSessionQualityScore(snapshot: SessionFormSnapshot): number | null {
  if (snapshot.kind === "shots") {
    return shotSessionQualityScore(snapshot);
  }

  if (snapshot.kind === "round") {
    return roundSessionQualityScore(snapshot);
  }

  return null;
}

export function buildSessionQualityByDate(
  snapshots: readonly SessionQualitySnapshot[],
): Map<string, number> {
  const totalsByDate = new Map<string, WeightedScore>();

  for (const { date, snapshot } of snapshots) {
    const score = calculateSessionQualityScore(snapshot);

    if (score === null) {
      continue;
    }

    const weight = sessionQualityWeight(snapshot);
    const existing = totalsByDate.get(date);

    totalsByDate.set(date, {
      score: (existing?.score ?? 0) + score * weight,
      weight: (existing?.weight ?? 0) + weight,
    });
  }

  return new Map(
    [...totalsByDate.entries()].map(([date, total]) => [
      date,
      Math.round(total.score / Math.max(1, total.weight)),
    ]),
  );
}

function shotSessionQualityScore(snapshot: SessionFormSnapshot) {
  if (snapshot.sampleSize < 5) {
    return null;
  }

  const playableScore = scorePercent(snapshot.playableRate, 55);
  const strikeScore = inferredStrikeScore(snapshot) * 10;
  const bigMissScore = clamp(100 - inferredBigMissRate(snapshot) * 2.4, 0, 100);
  const offlineScore = sessionOfflineScore(snapshot.averageOfflineYd);
  const carryScore = carryStabilityScore(snapshot.carryStdDevYd);
  const dataScore = shotDataQualityScore(snapshot);

  return Math.round(
    clamp(
      playableScore * 0.28 +
        strikeScore * 0.22 +
        bigMissScore * 0.16 +
        offlineScore * 0.12 +
        carryScore * 0.12 +
        dataScore * 0.06 +
        55 * 0.04,
      0,
      100,
    ),
  );
}

function roundSessionQualityScore(snapshot: SessionFormSnapshot) {
  if (typeof snapshot.scoreToParPer18 !== "number" || !Number.isFinite(snapshot.scoreToParPer18)) {
    return null;
  }

  const scoringScore = clamp(92 - snapshot.scoreToParPer18 * 3.25, 20, 100);
  const sampleScore = scoreVolume(snapshot.sampleSize, 18, 70);

  return Math.round(clamp(scoringScore * 0.85 + sampleScore * 0.15, 0, 100));
}

function sessionQualityWeight(snapshot: SessionFormSnapshot) {
  if (snapshot.kind === "round") {
    return clamp(snapshot.sampleSize, 9, 18);
  }

  if (snapshot.kind === "shots") {
    return clamp(snapshot.sampleSize, 10, 120);
  }

  return Math.max(1, snapshot.sampleSize);
}

function carryStabilityScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 65;
  }

  if (value > 35) {
    return 65;
  }

  return scoreLowerIsBetter(value, 5, 22, 65);
}

function inferredStrikeScore(snapshot: SessionFormSnapshot) {
  const playableBonus = ((snapshot.playableRate ?? 70) - 90) / 20;
  const offlinePenalty = (snapshot.averageOfflineYd ?? 14) / 80;

  return clamp(7 + playableBonus - offlinePenalty, 5.8, 8.2);
}

function inferredBigMissRate(snapshot: SessionFormSnapshot) {
  const playableMissRate =
    typeof snapshot.playableRate === "number" && Number.isFinite(snapshot.playableRate)
      ? 100 - snapshot.playableRate
      : 10;
  const offlineMissRate =
    typeof snapshot.averageOfflineYd === "number" && Number.isFinite(snapshot.averageOfflineYd)
      ? Math.max(0, snapshot.averageOfflineYd - 14) * 0.7
      : 0;

  return clamp(playableMissRate + offlineMissRate, 0, 25);
}

function sessionOfflineScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 60;
  }

  return clamp(100 - (value / 28) * 100, 0, 100);
}

function shotDataQualityScore(snapshot: SessionFormSnapshot) {
  const shotDepth =
    snapshot.sampleSize >= 80
      ? 100
      : snapshot.sampleSize >= 40
        ? 88
        : snapshot.sampleSize >= 20
          ? 74
          : snapshot.sampleSize >= 10
            ? 60
            : 42;
  const dataCoverage =
    snapshot.playableRate !== null || snapshot.averageOfflineYd !== null ? 100 : 45;

  return shotDepth * 0.7 + dataCoverage * 0.3;
}

function scorePercent(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(value, 0, 100);
}

function scoreLowerIsBetter(
  value: number | null | undefined,
  excellent: number,
  poor: number,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  if (value <= excellent) {
    return 100;
  }

  if (value >= poor) {
    return 0;
  }

  return ((poor - value) / (poor - excellent)) * 100;
}

function scoreVolume(sampleSize: number, target: number, floor: number) {
  return clamp((Math.max(0, sampleSize) / target) * 100, floor, 100);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
