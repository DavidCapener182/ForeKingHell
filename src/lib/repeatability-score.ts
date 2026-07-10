import { analysisConfidence } from "@/lib/analysis-confidence";
import {
  finiteNumbers,
  interquartileRange,
  median,
  sampleStandardDeviation,
} from "@/lib/analysis-statistics";

export type RepeatabilityShot = {
  carryYd: number | null;
  sideYd: number | null;
  sessionId?: string | null;
  shotAt?: Date | null;
};

export function calculateRepeatabilityScore(shots: RepeatabilityShot[]) {
  const carries = finiteNumbers(shots.map((shot) => shot.carryYd));
  const sides = finiteNumbers(shots.map((shot) => shot.sideYd));
  const carryMedian = median(carries);
  const carryIqr = interquartileRange(carries);
  const sideMedian = median(sides);
  const sideIqr = interquartileRange(sides);
  const distance = componentScore(
    carryMedian && carryIqr !== null ? carryIqr / Math.max(1, carryMedian) : null,
    0.04,
    0.16,
  );
  const directional = componentScore(sideIqr, 8, 40);
  const twoWayMiss = isTwoWayMiss(sides);
  const twoWayPenalty = twoWayMiss ? 12 : 0;
  const biasPenalty = Math.min(18, Math.abs(sideMedian ?? 0) * 0.6);
  const sampleFactor = 0.55 + 0.45 * Math.min(1, shots.length / 20);
  const rawScore = distance * 0.52 + directional * 0.48 - twoWayPenalty - biasPenalty;
  const score = Math.round(Math.max(0, Math.min(100, rawScore * sampleFactor)));
  const sessionIds = new Set(shots.map((shot) => shot.sessionId).filter(Boolean));
  const dates = shots
    .map((shot) => shot.shotAt?.getTime())
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const mostRecent = dates.length ? Math.max(...dates) : null;
  const coefficient =
    carryMedian && carries.length > 1
      ? (sampleStandardDeviation(carries) ?? 0) / Math.max(1, Math.abs(carryMedian))
      : null;
  const confidence = analysisConfidence({
    sampleSize: Math.min(carries.length, sides.length),
    sessionCount: Math.max(1, sessionIds.size),
    recencyDays: mostRecent === null ? null : Math.max(0, (Date.now() - mostRecent) / 86_400_000),
    outlierRate: 0,
    metricCompleteness: shots.length ? Math.min(carries.length, sides.length) / shots.length : 0,
    coefficientOfVariation: coefficient,
    crossSessionConsistency: sessionIds.size >= 2 ? 0.65 : null,
  });

  return {
    score,
    distanceScore: Math.round(distance),
    directionalScore: Math.round(directional),
    sampleSize: shots.length,
    carryIqrYd: carryIqr,
    sideIqrYd: sideIqr,
    offlineBiasYd: sideMedian,
    twoWayMiss,
    twoWayPenalty,
    biasPenalty: Math.round(biasPenalty),
    confidence,
    explanation:
      Math.abs(sideMedian ?? 0) >= 15
        ? "The pattern is repeatable but materially biased, so the score does not present it as a good outcome."
        : twoWayMiss
          ? "Both sides of the target are in the core pattern, so the score applies a two-way-miss penalty."
          : shots.length < 10
            ? "The grouping is provisional because the sample is still small."
            : "Distance and direction are assessed separately using median and interquartile ranges.",
  };
}

function componentScore(value: number | null, strong: number, weak: number) {
  if (value === null) return 0;
  if (value <= strong) return 100;
  if (value >= weak) return 0;
  return 100 * (1 - (value - strong) / (weak - strong));
}

function isTwoWayMiss(sides: number[]) {
  if (sides.length < 6) return false;
  const meaningful = sides.filter((value) => Math.abs(value) >= 8);
  return (
    meaningful.filter((value) => value < 0).length >= 2 &&
    meaningful.filter((value) => value > 0).length >= 2
  );
}
