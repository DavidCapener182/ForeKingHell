import { isShortGameTouchClubType } from "@/lib/club-format";
import { classifyStockShotRole } from "@/lib/stock-yardage";

export type ShortGameTouchShot = {
  clubType?: string | null;
  carryYd: number | null;
  totalYd?: number | null;
  courseHoleNumber?: number | null;
  sessionType?: string | null;
  shotCategory?: string | null;
};

export type ShortGameTouchSummary = {
  sampleSize: number;
  carryMedianYd: number | null;
  carryP75Yd: number | null;
  carryP25Yd: number | null;
  longestCarryYd: number | null;
  under30YdCount: number;
};

const TOUCH_CATEGORIES = new Set(["chip", "pitch", "approach"]);
const TOUCH_CARRY_LIMIT_YD = 110;

export function calculateShortGameTouchSummary(
  shots: ShortGameTouchShot[],
  maxShots = 80,
  options: { clubType?: string | null } = {},
): ShortGameTouchSummary {
  const carryValues = shots
    .filter((shot) => isLikelyShortGameTouch(shot, options))
    .slice(0, maxShots)
    .map((shot) => shot.carryYd)
    .filter(isNumber);

  if (carryValues.length === 0) {
    return {
      sampleSize: 0,
      carryMedianYd: null,
      carryP75Yd: null,
      carryP25Yd: null,
      longestCarryYd: null,
      under30YdCount: 0,
    };
  }

  return {
    sampleSize: carryValues.length,
    carryMedianYd: roundOne(percentile(carryValues, 0.5)),
    carryP75Yd: roundOne(percentile(carryValues, 0.75)),
    carryP25Yd: roundOne(percentile(carryValues, 0.25)),
    longestCarryYd: roundOne(Math.max(...carryValues)),
    under30YdCount: carryValues.filter((value) => value <= 30).length,
  };
}

function isLikelyShortGameTouch(shot: ShortGameTouchShot, options: { clubType?: string | null }) {
  if (!isNumber(shot.carryYd)) {
    return false;
  }

  const clubType = options.clubType ?? shot.clubType;
  if (isShortGameTouchClubType(clubType)) {
    const role = classifyStockShotRole(shot, { clubType });
    return role === "chip-touch" || role === "pitch";
  }

  const category = shot.shotCategory?.toLowerCase();
  const isRoundShot = shot.courseHoleNumber !== null && shot.courseHoleNumber !== undefined;
  const isPlayingSession =
    shot.sessionType !== undefined && shot.sessionType !== null && shot.sessionType !== "range";
  const isTouchCategory = category ? TOUCH_CATEGORIES.has(category) : false;

  return (
    shot.carryYd <= TOUCH_CARRY_LIMIT_YD && (isPlayingSession || isRoundShot || isTouchCategory)
  );
}

function percentile(values: number[], percentileValue: number) {
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

function isNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
