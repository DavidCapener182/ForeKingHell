export type GappingTargetTone = "green" | "sky" | "amber" | "pink" | "slate";

export type PersonalGappingInput = {
  clubType: string;
  carryYd: number | null;
  gappingCarryYd?: number | null;
  sampleSize: number;
  confidenceScore: number;
  decisionLabel?: string | null;
  averageLaunchAngleDeg?: number | null;
};

export type PersonalGappingTarget = {
  targetCarryYd: number | null;
  targetPlayNumberYd: number | null;
  workOnYd: number | null;
  targetGapYd: number | null;
  targetMessage: string;
  targetTone: GappingTargetTone;
  targetPriorityYd: number;
};

export type PersonalGappingTargetOptions = {
  handicapBand?: string | null;
};

const PERSONAL_GAP_MIN_YD = 10;
const PERSONAL_GAP_MAX_YD = 14;
const HEALTHY_GAP_MIN_YD = 8;
const GAP_TOLERANCE_YD = 2;
const MIN_TARGET_INCREASE_YD = 2;

type CarryEntry<T extends PersonalGappingInput> = {
  row: T;
  index: number;
  carryYd: number;
};

export function buildPersonalGappingTargets<T extends PersonalGappingInput>(
  rows: T[],
  options: PersonalGappingTargetOptions = {},
): Array<T & PersonalGappingTarget> {
  const rowsWithCarry = rows
    .map((row, index) => ({ row, index, carryYd: gappingCarryYd(row) }))
    .filter((entry): entry is CarryEntry<T> => isFiniteNumber(entry.carryYd));
  const targetGapYd = personalTargetGap(rowsWithCarry);
  const firstCarry = rowsWithCarry[0] ?? null;
  let previousTargetCarryYd: number | null = null;

  return rows.map((row, index) => {
    const rowGappingCarryYd = gappingCarryYd(row);

    if (!isFiniteNumber(rowGappingCarryYd) || targetGapYd === null) {
      return {
        ...row,
        targetCarryYd: null,
        targetPlayNumberYd: null,
        workOnYd: null,
        targetGapYd,
        targetMessage: isFiniteNumber(rowGappingCarryYd)
          ? "Need another club for gapping"
          : "Need carry samples",
        targetTone: "slate",
        targetPriorityYd: 0,
      };
    }

    const next = findNextCarry(rowsWithCarry, index);
    const previousGapYd =
      previousTargetCarryYd === null ? null : roundOne(previousTargetCarryYd - rowGappingCarryYd);
    const nextGapYd = next ? roundOne(rowGappingCarryYd - next.carryYd) : null;
    const ladderOpportunityYd =
      firstCarry && index > firstCarry.index
        ? Math.max(
            0,
            firstCarry.carryYd - targetGapYd * (index - firstCarry.index) - rowGappingCarryYd,
          )
        : 0;
    const gapOpportunityYd = Math.max(
      ladderOpportunityYd,
      previousGapYd !== null && previousGapYd > targetGapYd + GAP_TOLERANCE_YD
        ? previousGapYd - targetGapYd
        : 0,
      nextGapYd !== null && nextGapYd < targetGapYd - GAP_TOLERANCE_YD
        ? targetGapYd - nextGapYd
        : 0,
    );
    const progressionCapYd = progressionCap(row, options.handicapBand ?? null);
    const previousGapRoomYd =
      previousGapYd === null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, previousGapYd - HEALTHY_GAP_MIN_YD);
    const rawIncreaseYd = Math.min(gapOpportunityYd, progressionCapYd, previousGapRoomYd);
    const targetIncreaseYd = rawIncreaseYd >= MIN_TARGET_INCREASE_YD ? roundOne(rawIncreaseYd) : 0;
    const targetCarryYd = roundOne(rowGappingCarryYd + targetIncreaseYd);
    const recommendation = targetRecommendation(row, {
      targetIncreaseYd,
      previousGapYd,
      nextGapYd,
    });
    previousTargetCarryYd = targetCarryYd;

    return {
      ...row,
      targetCarryYd,
      targetPlayNumberYd: roundToNearestFive(targetCarryYd),
      workOnYd: targetIncreaseYd,
      targetGapYd,
      targetMessage: recommendation.message,
      targetTone: recommendation.tone,
      targetPriorityYd: targetIncreaseYd,
    };
  });
}

function gappingCarryYd(row: PersonalGappingInput) {
  return isFiniteNumber(row.gappingCarryYd) ? row.gappingCarryYd : row.carryYd;
}

function targetRecommendation(
  row: PersonalGappingInput,
  input: {
    targetIncreaseYd: number;
    previousGapYd: number | null;
    nextGapYd: number | null;
  },
): { message: string; tone: GappingTargetTone } {
  if (row.sampleSize < 5 || row.confidenceScore < 30 || row.decisionLabel === "Do not trust yet") {
    return { message: "Build reliable sample first", tone: "pink" };
  }

  if (input.targetIncreaseYd > 0) {
    return {
      message: `Potential +${formatYards(input.targetIncreaseYd)} yd available`,
      tone: "amber",
    };
  }

  if (
    (input.previousGapYd !== null && input.previousGapYd < HEALTHY_GAP_MIN_YD) ||
    (input.nextGapYd !== null && input.nextGapYd < HEALTHY_GAP_MIN_YD)
  ) {
    return { message: "Watch compressed gap", tone: "amber" };
  }

  if (hasLaunchWindowOpportunity(row)) {
    return { message: "Launch window opportunity", tone: "sky" };
  }

  if (row.confidenceScore < 75 || row.decisionLabel !== "Trust") {
    return { message: "Optimise strike consistency", tone: "sky" };
  }

  return { message: "Distance healthy - focus consistency", tone: "green" };
}

function personalTargetGap<T extends PersonalGappingInput>(rowsWithCarry: Array<CarryEntry<T>>) {
  if (rowsWithCarry.length < 2) {
    return null;
  }

  const positiveGaps = rowsWithCarry
    .slice(1)
    .map((entry, index) => rowsWithCarry[index].carryYd - entry.carryYd)
    .filter((gap) => gap > 0);

  if (positiveGaps.length === 0) {
    return null;
  }

  return roundOne(clamp(median(positiveGaps), PERSONAL_GAP_MIN_YD, PERSONAL_GAP_MAX_YD));
}

function findNextCarry<T extends PersonalGappingInput>(
  entries: Array<CarryEntry<T>>,
  rowIndex: number,
) {
  return entries.find((entry) => entry.index > rowIndex) ?? null;
}

function progressionCap(row: PersonalGappingInput, handicapBand: string | null) {
  const profile = clubProgressionProfile(row.clubType);

  if (profile.baseMaxYd === 0) {
    return 0;
  }

  let capYd = profile.baseMaxYd * handicapProgressionFactor(handicapBand);

  if (row.confidenceScore > 80 || row.decisionLabel === "Trust") {
    capYd = Math.min(capYd, profile.trustedMaxYd);
  } else if (row.confidenceScore < 75 || row.decisionLabel !== "Trust") {
    capYd = Math.min(capYd, profile.developingMaxYd);
  }

  if (row.sampleSize < 5 || row.confidenceScore < 30 || row.decisionLabel === "Do not trust yet") {
    return 0;
  }

  return roundOne(Math.max(0, capYd));
}

function clubProgressionProfile(clubType: string) {
  if (clubType === "driver") {
    return { baseMaxYd: 10, trustedMaxYd: 5, developingMaxYd: 7 };
  }

  if (/^[1-9][wh]$/.test(clubType)) {
    return { baseMaxYd: 8, trustedMaxYd: 4, developingMaxYd: 6 };
  }

  const iron = clubType.match(/^([1-9])i$/);
  if (iron) {
    const ironNumber = Number(iron[1]);

    if (ironNumber <= 6) {
      return { baseMaxYd: 7, trustedMaxYd: 3, developingMaxYd: 5 };
    }

    if (ironNumber <= 8) {
      return { baseMaxYd: 5, trustedMaxYd: 2, developingMaxYd: 4 };
    }

    return { baseMaxYd: 3, trustedMaxYd: 1, developingMaxYd: 1 };
  }

  if (clubType === "pw" || clubType === "gw" || clubType === "aw") {
    return { baseMaxYd: 3, trustedMaxYd: 1, developingMaxYd: 1 };
  }

  return { baseMaxYd: 0, trustedMaxYd: 0, developingMaxYd: 0 };
}

function handicapProgressionFactor(handicapBand: string | null) {
  const normalized = handicapBand?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return 0.8;
  }

  if (
    normalized.includes("beginner") ||
    normalized.includes("new") ||
    normalized.includes("high")
  ) {
    return 0.6;
  }

  if (normalized.includes("scratch") || normalized.includes("plus")) {
    return 1;
  }

  const values =
    normalized
      .match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number)
      .filter(Number.isFinite) ?? [];

  if (values.length === 0) {
    return 0.8;
  }

  const handicap = values.reduce((total, value) => total + value, 0) / values.length;

  if (handicap <= 5) {
    return 1;
  }

  if (handicap <= 10) {
    return 0.9;
  }

  if (handicap <= 18) {
    return 0.8;
  }

  if (handicap <= 28) {
    return 0.65;
  }

  return 0.55;
}

function hasLaunchWindowOpportunity(row: PersonalGappingInput) {
  if (!isFiniteNumber(row.averageLaunchAngleDeg)) {
    return false;
  }

  const window = launchWindowFor(row.clubType);

  return (
    window !== null &&
    (row.averageLaunchAngleDeg < window.low || row.averageLaunchAngleDeg > window.high)
  );
}

function launchWindowFor(clubType: string) {
  if (clubType === "driver") {
    return { low: 8, high: 18 };
  }

  if (/^[1-9][wh]$/.test(clubType)) {
    return { low: 8, high: 19 };
  }

  const iron = clubType.match(/^([1-9])i$/);
  if (iron) {
    const ironNumber = Number(iron[1]);

    if (ironNumber <= 6) {
      return { low: 10, high: 22 };
    }

    if (ironNumber <= 8) {
      return { low: 14, high: 28 };
    }

    return { low: 18, high: 34 };
  }

  if (clubType === "pw" || clubType === "gw" || clubType === "aw") {
    return { low: 20, high: 36 };
  }

  return null;
}

function median(values: number[]) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle];
  }

  return (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function formatYards(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToNearestFive(value: number) {
  return Math.round(value / 5) * 5;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
