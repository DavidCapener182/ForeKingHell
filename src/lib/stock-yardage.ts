import { isShortGameTouchClubType } from "@/lib/club-format";

export type StockShot = {
  clubType?: string | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph?: number | null;
  launchAngleDeg?: number | null;
  courseHoleNumber?: number | null;
  sessionType?: string | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
  shotAt?: Date | string | null;
};

export type StockYardage = {
  sampleSize: number;
  rawSampleSize: number;
  excludedCount: number;
  carryMedianYd: number | null;
  carryMeanYd: number | null;
  carryP75Yd: number | null;
  carryP25Yd: number | null;
  totalMedianYd: number | null;
  dispersionLeftYd: number | null;
  dispersionRightYd: number | null;
  averageBallSpeedMph: number | null;
  averageLaunchAngleDeg: number | null;
  confidenceScore: number;
  recommendedPlayNumberYd: number | null;
  label: "Reliable" | "Developing" | "Unstable" | "Do not trust yet";
};

export type StockYardageSample<T extends StockShot> = {
  cleanShots: T[];
  filteredShots: T[];
};

export type StockYardageOptions = {
  clubType?: string | null;
};

const EXCLUDED_CATEGORIES = new Set(["chip", "pitch", "recovery", "bunker"]);
const EXCLUDED_QUALITY_TAGS = new Set(["mishit", "top", "thin", "fat", "bad_data"]);

export function calculateStockYardage(
  shots: StockShot[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockYardage {
  const { cleanShots, filteredShots } = selectStockYardageShots(shots, maxShots, options);
  const filteredCarry = filteredShots.map((shot) => shot.carryYd).filter(isNumber);

  if (filteredCarry.length === 0) {
    return emptyStockYardage(shots.length);
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

  return {
    sampleSize: filteredCarry.length,
    rawSampleSize: shots.length,
    excludedCount: cleanShots.length - filteredCarry.length,
    carryMedianYd: roundOne(carryMedianYd),
    carryMeanYd: roundOne(mean(filteredCarry)),
    carryP75Yd: roundOne(percentile(filteredCarry, 0.75)),
    carryP25Yd: roundOne(percentile(filteredCarry, 0.25)),
    totalMedianYd: filteredTotal.length > 0 ? roundOne(median(filteredTotal)) : null,
    dispersionLeftYd: filteredSide.length > 0 ? roundOne(Math.abs(Math.min(0, ...filteredSide))) : null,
    dispersionRightYd: filteredSide.length > 0 ? roundOne(Math.max(0, ...filteredSide)) : null,
    averageBallSpeedMph: filteredBallSpeed.length > 0 ? roundOne(mean(filteredBallSpeed)) : null,
    averageLaunchAngleDeg: filteredLaunch.length > 0 ? roundOne(mean(filteredLaunch)) : null,
    confidenceScore,
    recommendedPlayNumberYd: roundToNearest(carryMedianYd, 5),
    label: stockLabel(filteredCarry.length, distanceStdDev, carryMedianYd, confidenceScore),
  };
}

export function selectStockYardageShots<T extends StockShot>(
  shots: T[],
  maxShots = 50,
  options: StockYardageOptions = {},
): StockYardageSample<T> {
  const cleanShots = shots
    .filter((shot) => isUsableFullShot(shot, options))
    .sort((left, right) => dateValue(right.shotAt) - dateValue(left.shotAt))
    .slice(0, maxShots);
  const carryValues = cleanShots.map((shot) => shot.carryYd).filter(isNumber);

  if (carryValues.length === 0) {
    return { cleanShots, filteredShots: [] };
  }

  const rawMedian = median(carryValues);
  const mad = median(carryValues.map((value) => Math.abs(value - rawMedian)));
  const maxDeviation = mad === 0 ? Number.POSITIVE_INFINITY : mad * 2.5;
  const filteredShots = cleanShots.filter((shot) => {
    if (shot.carryYd === null) {
      return false;
    }

    return Math.abs(shot.carryYd - rawMedian) <= maxDeviation;
  });

  return { cleanShots, filteredShots };
}

function isUsableFullShot(shot: StockShot, options: StockYardageOptions) {
  if (!isNumber(shot.carryYd)) {
    return false;
  }

  const clubType = options.clubType ?? shot.clubType;
  if (isShortGameTouchClubType(clubType)) {
    return false;
  }

  if (shot.shotCategory && EXCLUDED_CATEGORIES.has(shot.shotCategory.toLowerCase())) {
    return false;
  }

  if (shot.qualityTag && EXCLUDED_QUALITY_TAGS.has(shot.qualityTag.toLowerCase())) {
    return false;
  }

  return true;
}

function calculateConfidence(input: {
  sampleSize: number;
  carryMedianYd: number;
  distanceStdDev: number;
  sideAbsP75: number | null;
  mostRecentShotAt: number | null;
}) {
  const sampleSizeScore = clamp(input.sampleSize / 30, 0, 1);
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

  if (sampleSize >= 30 && spread <= 0.1 && confidenceScore >= 75) {
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

function emptyStockYardage(rawSampleSize: number): StockYardage {
  return {
    sampleSize: 0,
    rawSampleSize,
    excludedCount: 0,
    carryMedianYd: null,
    carryMeanYd: null,
    carryP75Yd: null,
    carryP25Yd: null,
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

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
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

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
