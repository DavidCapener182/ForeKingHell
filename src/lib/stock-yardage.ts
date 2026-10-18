import { percentile } from "@/lib/analysis-statistics";
import { isShotEvidenceEligible, type ShotReviewStatus } from "@/lib/shot-review";

export type StockShot = {
  clubType?: string | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph?: number | null;
  launchAngleDeg?: number | null;
  courseHoleNumber?: number | null;
  playContext?: string | null;
  sessionType?: string | null;
  reviewStatus?: ShotReviewStatus | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
  shotAt?: Date | string | null;
};

export type StockShotRole = "full" | "pitch" | "chip-touch";

export type StockExclusionReasonKey =
  | "missing-carry"
  | "review-status"
  | "quality-tag"
  | "shot-category"
  | "shot-role"
  | "short-game-cluster"
  | "recent-window"
  | "best-stock-rank"
  | "outlier";

export type StockExclusionReason = {
  key: StockExclusionReasonKey;
  label: string;
  count: number;
};

export type StockShotRoleSummary = {
  role: StockShotRole;
  sampleSize: number;
  carryMedianYd: number | null;
  carryP25Yd: number | null;
  carryP75Yd: number | null;
  longestCarryYd: number | null;
};

export type StockYardage = {
  sampleSize: number;
  rawSampleSize: number;
  excludedCount: number;
  stockExclusionCount: number;
  stockExclusionReasons: StockExclusionReason[];
  shotRoleSummaries: StockShotRoleSummary[];
  bestStockCarryYd: number | null;
  personalBestCarryYd: number | null;
  carryMedianYd: number | null;
  carryMeanYd: number | null;
  carryP75Yd: number | null;
  carryP25Yd: number | null;
  latestReliableSampleSize: number;
  latestReliableCarryYd: number | null;
  latestReliableCarryP25Yd: number | null;
  latestReliableCarryP75Yd: number | null;
  coursePlayCarryYd: number | null;
  bestSampleFloorYd: number | null;
  totalMedianYd: number | null;
  dispersionLeftYd: number | null;
  dispersionRightYd: number | null;
  averageBallSpeedMph: number | null;
  averageLaunchAngleDeg: number | null;
  confidenceScore: number;
  recommendedPlayNumberYd: number | null;
  label: "Reliable" | "Developing" | "Unstable" | "Do not trust yet";
};

export type StockCarryTrend = {
  status: "better" | "worse" | "steady" | "building";
  latestSampleSize: number;
  previousSampleSize: number;
  latestCarryMedianYd: number | null;
  previousCarryMedianYd: number | null;
  deltaYd: number | null;
};

export type StockYardageSample<T extends StockShot> = {
  cleanShots: T[];
  filteredShots: T[];
};

export type StockYardageOptions = {
  clubType?: string | null;
  /** Optional chronological sample cap; never a longest-shot selection. */
  averageSampleSize?: number;
};

/** Legacy exported reference only; carry distance no longer determines shot intent. */
export const SAND_WEDGE_STOCK_MIN_CARRY_YD = 75;
const STOCK_AVERAGE_SAMPLE_SIZE = 20;
const LATEST_RELIABLE_SAMPLE_SIZE = 10;
const LATEST_RELIABLE_SHOT_LIMIT = 20;
const MIN_TREND_WINDOW_SHOTS = 3;
const MAX_LATEST_TREND_SHOTS = 5;
const MAX_PREVIOUS_TREND_SHOTS = 15;
const STOCK_TREND_THRESHOLD_YD = 2;
const STOCK_EXCLUSION_LABELS: Record<StockExclusionReasonKey, string> = {
  "missing-carry": "Missing carry",
  "review-status": "Review status",
  "quality-tag": "Quality tag",
  "shot-category": "Chip/pitch/recovery",
  "shot-role": "Intent not identified as full",
  "short-game-cluster": "Below full wedge cluster",
  "recent-window": "Outside recent window",
  "best-stock-rank": "Outside top-20 sample",
  outlier: "Outlier filter",
};

export function calculateStockYardage(
  shots: StockShot[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockYardage {
  const { filteredShots } = selectStockYardageShots(shots, maxShots, options);
  const filteredCarry = filteredShots.map((shot) => shot.carryYd).filter(isNumber);
  const personalBestCarryYd = calculatePersonalBestCarryYd(shots, maxShots, options);
  const stockExclusionReasons = explainStockExclusions(shots, maxShots, options);
  const stockExclusionCount = stockExclusionReasons.reduce(
    (total, reason) => total + reason.count,
    0,
  );
  const shotRoleSummaries = summarizeStockShotRoles(shots, maxShots, options);
  const latestReliableSample = selectLatestReliableStockShots(shots, maxShots, options);
  const latestReliableCarryValues = latestReliableSample.filteredShots
    .map((shot) => shot.carryYd)
    .filter(isNumber);
  const latestReliableCarryYd =
    latestReliableCarryValues.length >= LATEST_RELIABLE_SAMPLE_SIZE
      ? roundOne(median(latestReliableCarryValues))
      : null;
  const latestReliableCarryP25Yd =
    latestReliableCarryValues.length >= LATEST_RELIABLE_SAMPLE_SIZE
      ? roundOne(percentile(latestReliableCarryValues, 0.25))
      : null;
  const latestReliableCarryP75Yd =
    latestReliableCarryValues.length >= LATEST_RELIABLE_SAMPLE_SIZE
      ? roundOne(percentile(latestReliableCarryValues, 0.75))
      : null;

  if (filteredCarry.length === 0) {
    return emptyStockYardage({
      rawSampleSize: shots.length,
      latestReliableSampleSize: latestReliableCarryValues.length,
      personalBestCarryYd,
      stockExclusionReasons,
      stockExclusionCount,
      shotRoleSummaries,
    });
  }

  const filteredTotal = filteredShots.map((shot) => shot.totalYd).filter(isNumber);
  const filteredSide = filteredShots.map((shot) => shot.sideCarryYd).filter(isNumber);
  const filteredBallSpeed = filteredShots.map((shot) => shot.ballSpeedMph ?? null).filter(isNumber);
  const filteredLaunch = filteredShots.map((shot) => shot.launchAngleDeg ?? null).filter(isNumber);

  const carryMedianYd = median(filteredCarry);
  const distanceStdDev = standardDeviation(filteredCarry);
  const sideAbsP75 = percentile(
    filteredSide.map((value) => Math.abs(value)),
    0.75,
  );
  const mostRecentShotAt = filteredShots.reduce<number | null>((latest, shot) => {
    const value = dateValue(shot.shotAt);
    return latest === null || value > latest ? value : latest;
  }, null);
  const confidenceScore = calculateConfidence({
    sampleSize: filteredCarry.length,
    carryMedianYd,
    distanceStdDev,
    sideAbsP75,
    mostRecentShotAt,
  });
  const bestStockCarryYd = roundOne(carryMedianYd);
  const coursePlayCarryYd = calculateCoursePlayCarryYd(bestStockCarryYd, latestReliableCarryYd);

  return {
    sampleSize: filteredCarry.length,
    rawSampleSize: shots.length,
    excludedCount: stockExclusionCount,
    stockExclusionCount,
    stockExclusionReasons,
    shotRoleSummaries,
    bestStockCarryYd,
    personalBestCarryYd,
    carryMedianYd: bestStockCarryYd,
    carryMeanYd: roundOne(mean(filteredCarry)),
    carryP75Yd: roundOne(percentile(filteredCarry, 0.75)),
    carryP25Yd: roundOne(percentile(filteredCarry, 0.25)),
    latestReliableSampleSize: latestReliableCarryValues.length,
    latestReliableCarryYd,
    latestReliableCarryP25Yd,
    latestReliableCarryP75Yd,
    coursePlayCarryYd,
    bestSampleFloorYd: roundOne(Math.min(...filteredCarry)),
    totalMedianYd: filteredTotal.length > 0 ? roundOne(median(filteredTotal)) : null,
    dispersionLeftYd:
      filteredSide.length > 0 ? roundOne(Math.abs(Math.min(0, ...filteredSide))) : null,
    dispersionRightYd: filteredSide.length > 0 ? roundOne(Math.max(0, ...filteredSide)) : null,
    averageBallSpeedMph: filteredBallSpeed.length > 0 ? roundOne(mean(filteredBallSpeed)) : null,
    averageLaunchAngleDeg: filteredLaunch.length > 0 ? roundOne(mean(filteredLaunch)) : null,
    confidenceScore,
    recommendedPlayNumberYd: coursePlayCarryYd,
    label: stockLabel(filteredCarry.length, distanceStdDev, carryMedianYd, confidenceScore),
  };
}

export function selectStockYardageShots<T extends StockShot>(
  shots: T[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockYardageSample<T> {
  // Stock is typical recent performance, never the longest subset or distance-trimmed.
  const cleanShots = shots
    .filter((shot) => isUsableFullShot(shot, options))
    .sort((left, right) => dateValue(right.shotAt) - dateValue(left.shotAt))
    .slice(0, Math.max(0, Math.floor(Math.min(maxShots, options.averageSampleSize ?? maxShots))));
  return { cleanShots, filteredShots: cleanShots };
}

export function selectLatestReliableStockShots<T extends StockShot>(
  shots: T[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockYardageSample<T> {
  const cleanShots = shots
    .filter((shot) => isUsableFullShot(shot, options))
    .sort((left, right) => dateValue(right.shotAt) - dateValue(left.shotAt))
    .slice(0, Math.min(maxShots, LATEST_RELIABLE_SHOT_LIMIT));

  return {
    cleanShots,
    filteredShots: cleanShots,
  };
}

export function selectPersonalBestCarryShot<T extends StockShot>(
  shots: T[],
  maxShots = 50,
  options: StockYardageOptions = {},
) {
  void maxShots;

  return (
    [...shots]
      .filter((shot): shot is T & { carryYd: number } =>
        isPersonalBestEligibleFullShot(shot, options),
      )
      .sort(
        (left, right) =>
          right.carryYd - left.carryYd || dateValue(right.shotAt) - dateValue(left.shotAt),
      )[0] ?? null
  );
}

export function calculatePersonalBestCarryYd(
  shots: StockShot[],
  maxShots = 50,
  options: StockYardageOptions = {},
) {
  const personalBestShot = selectPersonalBestCarryShot(shots, maxShots, options);

  return personalBestShot ? roundOne(personalBestShot.carryYd) : null;
}

export function selectPersonalBestTotalShot<T extends StockShot>(
  shots: T[],
  maxShots = 50,
  options: StockYardageOptions = {},
) {
  void maxShots;

  return (
    [...shots]
      .filter(
        (shot): shot is T & { totalYd: number } =>
          isPersonalBestEligibleFullShot(shot, options) && isNumber(shot.totalYd),
      )
      .sort(
        (left, right) =>
          right.totalYd - left.totalYd || dateValue(right.shotAt) - dateValue(left.shotAt),
      )[0] ?? null
  );
}

export function calculatePersonalBestTotalYd(
  shots: StockShot[],
  maxShots = 50,
  options: StockYardageOptions = {},
) {
  const personalBestShot = selectPersonalBestTotalShot(shots, maxShots, options);

  return personalBestShot ? roundOne(personalBestShot.totalYd) : null;
}

export function explainStockExclusions<T extends StockShot>(
  shots: T[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockExclusionReason[] {
  const reasonCounts = new Map<StockExclusionReasonKey, number>();
  for (const shot of shots) {
    const reason = directStockExclusionReason(shot, options);
    if (reason) incrementReason(reasonCounts, reason);
  }
  const usableCount = shots.filter((shot) => isUsableFullShot(shot, options)).length;
  const selectedCount = selectStockYardageShots(shots, maxShots, options).filteredShots.length;
  if (usableCount > selectedCount)
    incrementReason(reasonCounts, "recent-window", usableCount - selectedCount);

  return [...reasonCounts.entries()]
    .map(([key, count]) => ({ key, label: STOCK_EXCLUSION_LABELS[key], count }))
    .filter((reason) => reason.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function summarizeStockShotRoles<T extends StockShot>(
  shots: T[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockShotRoleSummary[] {
  const grouped = new Map<StockShotRole, number[]>();
  const roleShots = shots
    .flatMap((shot) => {
      const carryYd = shot.carryYd;

      if (!isNumber(carryYd) || carryYd <= 0 || stockObservationExclusion(shot)) {
        return [];
      }

      const category = shot.shotCategory?.toLowerCase();
      if (category === "recovery" || category === "bunker") {
        return [];
      }

      const role = classifyStockShotRole(shot, options);
      return role ? [{ shot, role, carryYd }] : [];
    })
    .sort((left, right) => dateValue(right.shot.shotAt) - dateValue(left.shot.shotAt))
    .slice(0, maxShots);

  for (const { role, carryYd } of roleShots) {
    grouped.set(role, [...(grouped.get(role) ?? []), carryYd]);
  }

  return (["full", "pitch", "chip-touch"] as const)
    .map((role) => {
      const values = grouped.get(role) ?? [];

      return {
        role,
        sampleSize: values.length,
        carryMedianYd: values.length > 0 ? roundOne(median(values)) : null,
        carryP25Yd: values.length > 0 ? roundOne(percentile(values, 0.25)) : null,
        carryP75Yd: values.length > 0 ? roundOne(percentile(values, 0.75)) : null,
        longestCarryYd: values.length > 0 ? roundOne(Math.max(...values)) : null,
      };
    })
    .filter((summary) => summary.sampleSize > 0);
}

export function calculateStockCarryTrend(
  shots: StockShot[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockCarryTrend {
  const { cleanShots } = selectStockYardageShots(shots, maxShots, options);
  const trendShots = cleanShots
    .filter((shot): shot is StockShot & { carryYd: number } => isNumber(shot.carryYd))
    .sort((left, right) => dateValue(right.shotAt) - dateValue(left.shotAt));
  const latestSampleSize = Math.min(MAX_LATEST_TREND_SHOTS, Math.floor(trendShots.length / 2));
  const previousSampleSize = Math.min(
    MAX_PREVIOUS_TREND_SHOTS,
    trendShots.length - latestSampleSize,
  );

  if (latestSampleSize < MIN_TREND_WINDOW_SHOTS || previousSampleSize < MIN_TREND_WINDOW_SHOTS) {
    return {
      status: "building",
      latestSampleSize: Math.max(0, latestSampleSize),
      previousSampleSize: Math.max(0, previousSampleSize),
      latestCarryMedianYd: null,
      previousCarryMedianYd: null,
      deltaYd: null,
    };
  }

  const latestShots = trendShots.slice(0, latestSampleSize);
  const previousShots = trendShots.slice(latestSampleSize, latestSampleSize + previousSampleSize);
  const latestCarryMedianYd = roundOne(median(latestShots.map((shot) => shot.carryYd)));
  const previousCarryMedianYd = roundOne(median(previousShots.map((shot) => shot.carryYd)));
  const deltaYd =
    latestCarryMedianYd === null || previousCarryMedianYd === null
      ? null
      : roundOne(latestCarryMedianYd - previousCarryMedianYd);

  if (deltaYd === null) {
    return {
      status: "building",
      latestSampleSize,
      previousSampleSize,
      latestCarryMedianYd,
      previousCarryMedianYd,
      deltaYd,
    };
  }

  const status =
    deltaYd >= STOCK_TREND_THRESHOLD_YD
      ? "better"
      : deltaYd <= -STOCK_TREND_THRESHOLD_YD
        ? "worse"
        : "steady";

  return {
    status,
    latestSampleSize,
    previousSampleSize,
    latestCarryMedianYd,
    previousCarryMedianYd,
    deltaYd,
  };
}

export function classifyStockShotRole(
  shot: Pick<StockShot, "clubType" | "carryYd" | "shotCategory">,
  options: Pick<StockYardageOptions, "clubType"> = {},
): StockShotRole | null {
  void options;
  if (!isNumber(shot.carryYd) || shot.carryYd <= 0) return null;
  const category = shot.shotCategory?.trim().toLowerCase();
  if (category === "chip") return "chip-touch";
  if (category === "pitch") return "pitch";
  return category === "full" ? "full" : null;
}

function isUsableFullShot(shot: StockShot, options: StockYardageOptions) {
  return directStockExclusionReason(shot, options) === null;
}

function isPersonalBestEligibleFullShot(shot: StockShot, options: StockYardageOptions) {
  return directStockExclusionReason(shot, options) === null && isShotEvidenceEligible(shot);
}

function stockObservationExclusion(shot: StockShot): StockExclusionReasonKey | null {
  const quality = shot.qualityTag?.trim().toLowerCase() ?? "";
  const ordinaryContactSuggestion =
    shot.reviewStatus === "suggested_exclusion" &&
    ["mishit", "top", "thin", "fat"].includes(quality);
  if (
    shot.reviewStatus &&
    !["included", "restored"].includes(shot.reviewStatus) &&
    !ordinaryContactSuggestion
  )
    return "review-status";
  if (quality === "severe-mishit" || quality === "severe_mishit") return "quality-tag";
  if (
    shot.reviewStatus !== "restored" &&
    new Set([
      "bad-data",
      "bad_data",
      "invalid",
      "misread",
      "launch-monitor-error",
      "launch_monitor_error",
      "excluded",
      "exclude",
      "delete",
      "deleted",
      "calibration",
      "warm-up",
      "warmup",
      "warm_up",
      "severe-mishit",
      "severe_mishit",
    ]).has(quality)
  )
    return "quality-tag";
  if (/speed|dry|no.ball/.test(shot.sessionType?.toLowerCase() ?? "")) return "shot-category";
  return null;
}

function directStockExclusionReason(
  shot: StockShot,
  options: Pick<StockYardageOptions, "clubType">,
): StockExclusionReasonKey | null {
  if (!isNumber(shot.carryYd) || shot.carryYd <= 0) return "missing-carry";
  const observationReason = stockObservationExclusion(shot);
  if (observationReason) return observationReason;
  const category = shot.shotCategory?.trim().toLowerCase();
  if (shot.reviewStatus === "restored" && category && isLegacyWarmUpCategory(category)) return null;
  if (
    category &&
    ["chip", "pitch", "recovery", "bunker", "putt", "warm-up", "warmup", "warm_up"].includes(
      category,
    )
  )
    return "shot-category";
  return classifyStockShotRole(shot, options) === "full" ? null : "shot-role";
}

function isLegacyWarmUpCategory(category: string) {
  return category === "warm-up" || category === "warmup" || category === "warm_up";
}

function incrementReason(
  reasonCounts: Map<StockExclusionReasonKey, number>,
  reason: StockExclusionReasonKey,
  amount = 1,
) {
  reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + amount);
}

function calculateCoursePlayCarryYd(
  stockCarryYd: number | null,
  latestReliableCarryYd: number | null,
) {
  // Use the observed recent median; no optimistic hybrid or upward five-yard rounding.
  return stockCarryYd === null ? null : latestReliableCarryYd;
}

function calculateConfidence(input: {
  sampleSize: number;
  carryMedianYd: number;
  distanceStdDev: number;
  sideAbsP75: number | null;
  mostRecentShotAt: number | null;
}) {
  const sampleSizeScore = clamp(input.sampleSize / STOCK_AVERAGE_SAMPLE_SIZE, 0, 1);
  const distanceSpread = input.carryMedianYd === 0 ? 1 : input.distanceStdDev / input.carryMedianYd;
  const distanceConsistencyScore = clamp(1 - distanceSpread / 0.18, 0, 1);
  const dispersionScore = input.sideAbsP75 === null ? 0.5 : clamp(1 - input.sideAbsP75 / 55, 0, 1);
  const recencyScore =
    input.mostRecentShotAt === null
      ? 0.5
      : clamp(1 - daysSince(input.mostRecentShotAt) / 120, 0, 1);

  return Math.round(
    (sampleSizeScore * 0.35 +
      distanceConsistencyScore * 0.35 +
      dispersionScore * 0.2 +
      recencyScore * 0.1) *
      100,
  );
}

function stockLabel(
  sampleSize: number,
  distanceStdDev: number,
  carryMedianYd: number,
  confidenceScore: number,
): StockYardage["label"] {
  const spread = carryMedianYd === 0 ? 1 : distanceStdDev / carryMedianYd;

  if (sampleSize >= STOCK_AVERAGE_SAMPLE_SIZE && spread <= 0.1 && confidenceScore >= 75) {
    return "Reliable";
  }

  if (sampleSize >= 10 && confidenceScore >= 50) {
    return "Developing";
  }

  if (sampleSize < 5 || confidenceScore < 30) {
    return "Do not trust yet";
  }

  return "Unstable";
}

function emptyStockYardage({
  rawSampleSize,
  latestReliableSampleSize = 0,
  personalBestCarryYd = null,
  stockExclusionReasons = [],
  stockExclusionCount = 0,
  shotRoleSummaries = [],
}: {
  rawSampleSize: number;
  latestReliableSampleSize?: number;
  personalBestCarryYd?: number | null;
  stockExclusionReasons?: StockExclusionReason[];
  stockExclusionCount?: number;
  shotRoleSummaries?: StockShotRoleSummary[];
}): StockYardage {
  return {
    sampleSize: 0,
    rawSampleSize,
    excludedCount: stockExclusionCount,
    stockExclusionCount,
    stockExclusionReasons,
    shotRoleSummaries,
    bestStockCarryYd: null,
    personalBestCarryYd,
    carryMedianYd: null,
    carryMeanYd: null,
    carryP75Yd: null,
    carryP25Yd: null,
    latestReliableSampleSize,
    latestReliableCarryYd: null,
    latestReliableCarryP25Yd: null,
    latestReliableCarryP75Yd: null,
    coursePlayCarryYd: null,
    bestSampleFloorYd: null,
    totalMedianYd: null,
    dispersionLeftYd: null,
    dispersionRightYd: null,
    averageBallSpeedMph: null,
    averageLaunchAngleDeg: null,
    confidenceScore: 0,
    recommendedPlayNumberYd: null,
    label: "Do not trust yet",
  };
}

function median(values: number[]) {
  return percentile(values, 0.5) ?? 0;
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

function isNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) {
    return 0;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function daysSince(timestamp: number) {
  return Math.max(0, (Date.now() - timestamp) / 86_400_000);
}

function roundOne(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
