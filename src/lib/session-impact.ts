import {
  convexHullArea,
  finiteNumbers,
  mean,
  median,
  medianAbsoluteDeviation,
  sampleStandardDeviation,
} from "@/lib/analysis-statistics";
import { calculateRepeatabilityScore } from "@/lib/repeatability-score";
import { recordEligibility } from "@/lib/shot-records";

export type SessionImpactShot = {
  id: string;
  carryYd: number | null;
  totalYd: number | null;
  sideYd: number | null;
  qualityTag?: string | null;
  shotCategory?: string | null;
  sessionSource?: string | null;
  confidenceScore?: number | null;
};

export type SessionImpactFilter =
  | { kind: "none" }
  | { kind: "selected"; shotId: string }
  | { kind: "topped" }
  | { kind: "likely-misreads" }
  | { kind: "trusted" }
  | { kind: "best-percentile"; keep: 0.8 | 0.9 }
  | { kind: "confidence"; minimum: number };

export type SessionImpactMetric = "carry" | "total";

export function calculateSessionImpact<T extends SessionImpactShot>(
  shots: T[],
  filter: SessionImpactFilter,
  metric: SessionImpactMetric = "carry",
) {
  const excludedIds = excludedShotIds(shots, filter, metric);
  const included = shots.filter((shot) => !excludedIds.has(shot.id));

  return {
    originalShots: shots,
    includedShots: included,
    excludedShotIds: [...excludedIds],
    before: summarizeSession(shots, metric),
    after: summarizeSession(included, metric),
  };
}

function excludedShotIds(
  shots: SessionImpactShot[],
  filter: SessionImpactFilter,
  metric: SessionImpactMetric,
) {
  if (filter.kind === "none") return new Set<string>();
  if (filter.kind === "selected") return new Set(filter.shotId ? [filter.shotId] : []);
  if (filter.kind === "topped") {
    return new Set(
      shots
        .filter(
          (shot) =>
            /top|topped/.test(normalize(shot.qualityTag)) ||
            /top|topped/.test(normalize(shot.shotCategory)),
        )
        .map((shot) => shot.id),
    );
  }
  if (filter.kind === "likely-misreads") {
    return new Set(
      shots
        .filter((shot) => {
          const distance = distanceFor(shot, metric);
          return (
            /misread|bad.?data|invalid/.test(normalize(shot.qualityTag)) ||
            distance === null ||
            distance <= 0 ||
            distance > 500
          );
        })
        .map((shot) => shot.id),
    );
  }
  if (filter.kind === "trusted") {
    return new Set(
      shots.filter((shot) => !recordEligibility(shot).trustedEligible).map((shot) => shot.id),
    );
  }
  if (filter.kind === "confidence") {
    return new Set(
      shots
        .filter((shot) => (shot.confidenceScore ?? -Infinity) < filter.minimum)
        .map((shot) => shot.id),
    );
  }

  const ranked = robustOutlierRanking(shots, metric);
  const keepCount = Math.max(1, Math.ceil(ranked.length * filter.keep));
  return new Set(ranked.slice(keepCount).map((row) => row.id));
}

function robustOutlierRanking(shots: SessionImpactShot[], metric: SessionImpactMetric) {
  const distanceRows = shots
    .map((shot) => ({ ...shot, distance: distanceFor(shot, metric) }))
    .filter((shot): shot is typeof shot & { distance: number } => shot.distance !== null);
  const distances = distanceRows.map((shot) => shot.distance);
  const sides = finiteNumbers(distanceRows.map((shot) => shot.sideYd));
  const distanceMedian = median(distances) ?? 0;
  const sideMedian = median(sides) ?? 0;
  const distanceMad = Math.max(1, medianAbsoluteDeviation(distances) ?? 1);
  const sideMad = Math.max(1, medianAbsoluteDeviation(sides) ?? 1);

  return distanceRows
    .map((shot) => ({
      id: shot.id,
      score:
        Math.abs(shot.distance - distanceMedian) / distanceMad +
        Math.abs((shot.sideYd ?? sideMedian) - sideMedian) / sideMad,
    }))
    .sort((left, right) => left.score - right.score);
}

function summarizeSession(shots: SessionImpactShot[], metric: SessionImpactMetric) {
  const distances = finiteNumbers(shots.map((shot) => distanceFor(shot, metric))).filter(
    (value) => value > 0,
  );
  const sides = finiteNumbers(shots.map((shot) => shot.sideYd));
  const paired = shots
    .map((shot) => ({ x: shot.sideYd, y: distanceFor(shot, metric) }))
    .filter(
      (point): point is { x: number; y: number } =>
        point.x !== null && point.y !== null && point.y > 0,
    );
  const distanceAverage = mean(distances);
  const distanceMedian = median(distances);
  const distanceSd = sampleStandardDeviation(distances);
  const offlineBias = mean(sides);
  const range = distances.length ? Math.max(...distances) - Math.min(...distances) : null;
  const dispersionArea = convexHullArea(paired);
  const repeatability = calculateRepeatabilityScore(
    shots.map((shot) => ({ carryYd: distanceFor(shot, metric), sideYd: shot.sideYd })),
  );
  const sessionScore = scoreSession({
    sampleSize: distances.length,
    median: distanceMedian,
    standardDeviation: distanceSd,
    sideStandardDeviation: sampleStandardDeviation(sides),
    offlineBias,
  });

  return {
    shotCount: shots.length,
    averageYd: round(distanceAverage),
    medianYd: round(distanceMedian),
    standardDeviationYd: round(distanceSd),
    dispersionAreaSqYd: round(dispersionArea),
    distanceRangeYd: round(range),
    offlineBiasYd: round(offlineBias),
    sessionScore,
    repeatability,
    recommendation: sessionRecommendation({
      sampleSize: distances.length,
      sideStandardDeviation: sampleStandardDeviation(sides),
      offlineBias,
      distanceStandardDeviation: distanceSd,
    }),
  };
}

function scoreSession(input: {
  sampleSize: number;
  median: number | null;
  standardDeviation: number | null;
  sideStandardDeviation: number | null;
  offlineBias: number | null;
}) {
  if (input.sampleSize === 0) return null;
  const sample = Math.min(20, input.sampleSize);
  const distance =
    input.median && input.standardDeviation !== null
      ? 40 * (1 - Math.min(1, input.standardDeviation / Math.max(1, input.median * 0.15)))
      : 0;
  const direction =
    input.sideStandardDeviation === null
      ? 0
      : 30 * (1 - Math.min(1, input.sideStandardDeviation / 30));
  const bias = 10 * (1 - Math.min(1, Math.abs(input.offlineBias ?? 0) / 25));
  return Math.round(Math.max(0, Math.min(100, sample + distance + direction + bias)));
}

function sessionRecommendation(input: {
  sampleSize: number;
  sideStandardDeviation: number | null;
  offlineBias: number | null;
  distanceStandardDeviation: number | null;
}) {
  if (input.sampleSize < 5)
    return "Add at least five comparable shots before changing the practice plan.";
  if (Math.abs(input.offlineBias ?? 0) >= 15)
    return `Practise a target-line start window; the measured pattern is biased ${input.offlineBias! < 0 ? "left" : "right"}.`;
  if ((input.sideStandardDeviation ?? 0) >= 18)
    return "Prioritise directional repeatability with one target and a fixed pre-shot reset.";
  if ((input.distanceStandardDeviation ?? 0) >= 15)
    return "Prioritise strike and carry-window control before chasing more distance.";
  return "Protect the repeatable stock pattern with a short random-target validation block.";
}

function distanceFor(shot: SessionImpactShot, metric: SessionImpactMetric) {
  return metric === "carry" ? shot.carryYd : (shot.totalYd ?? shot.carryYd);
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function round(value: number | null) {
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10;
}
