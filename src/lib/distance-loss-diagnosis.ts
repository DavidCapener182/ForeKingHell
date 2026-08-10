import { excludedRecordQualityTags, excludedRecordShotCategories } from "@/lib/shot-records";

export type DistanceLossShot = {
  sessionId: string;
  shotAt: Date | string;
  source: string;
  carryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  shotCategory: string | null;
  qualityTag: string | null;
  clubDataEstType: string | null;
};

export type DistanceLossExposure = {
  id: string;
  occurredAt: Date | string;
};

export type DistanceLossMonth = {
  key: string;
  label: string;
  shotCount: number;
  measuredClubDataCount: number;
  spinCount: number;
  carryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  smashFactor: number | null;
};

export type DistanceLossFactor = {
  key: "speed" | "exposure" | "launch" | "efficiency" | "spin";
  label: string;
  status: string;
  detail: string;
  tone: "green" | "amber" | "sky" | "slate";
};

export type DistanceLossDiagnosis = {
  status: "ready" | "insufficient";
  headline: string;
  summary: string;
  confidenceLabel: string;
  monthly: DistanceLossMonth[];
  baseline: DistanceLossMonth | null;
  current: DistanceLossMonth | null;
  carryChangeYd: number | null;
  ballSpeedChangeMph: number | null;
  clubSpeedChangeMph: number | null;
  launchChangeDeg: number | null;
  smashChange: number | null;
  exposure: {
    recentActiveDays: number;
    previousActiveDays: number;
    recentSessions: number;
    previousSessions: number;
    activeDayChangePercent: number | null;
  };
  factors: DistanceLossFactor[];
  nextSteps: string[];
  caveats: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_COUNT = 4;
const MIN_MONTH_SHOTS = 8;
const LONDON_TIME_ZONE = "Europe/London";
const excludedCategories = new Set<string>(excludedRecordShotCategories);
const excludedQualityTags = new Set<string>(excludedRecordQualityTags);
const monthLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

export function buildDistanceLossDiagnosis({
  shots,
  exposure,
  now = new Date(),
}: {
  shots: DistanceLossShot[];
  exposure: DistanceLossExposure[];
  now?: Date;
}): DistanceLossDiagnosis {
  const monthKeys = recentMonthKeys(now, MONTH_COUNT);
  const eligibleShots = shots.filter(isEligibleDriverShot);
  const monthly = monthKeys.map((month) => summarizeMonth(month, eligibleShots));
  const currentIndex = findCurrentUsableMonthIndex(monthly);
  const baselineIndex = findBaselineMonthIndex(monthly, currentIndex);
  const current = currentIndex === -1 ? null : monthly[currentIndex];
  const baseline = baselineIndex === -1 ? null : monthly[baselineIndex];
  const exposureSummary = summarizeExposure(exposure, now);

  if (!current || !baseline) {
    return {
      status: "insufficient",
      headline: "Build a comparable driver baseline first",
      summary:
        "The app needs at least two usable driver months before it can separate speed, strike efficiency, launch and recent golf exposure.",
      confidenceLabel: "Needs more evidence",
      monthly,
      baseline,
      current,
      carryChangeYd: null,
      ballSpeedChangeMph: null,
      clubSpeedChangeMph: null,
      launchChangeDeg: null,
      smashChange: null,
      exposure: exposureSummary,
      factors: [],
      nextSteps: [
        "Add a comparable driver session with measured club speed, ball speed and launch.",
        "Use the same balls, tee height and warm-up so the next comparison is useful.",
      ],
      caveats: ["No distance-loss conclusion is shown until two months clear the evidence floor."],
    };
  }

  const carryChangeYd = difference(current.carryYd, baseline.carryYd);
  const ballSpeedChangeMph = difference(current.ballSpeedMph, baseline.ballSpeedMph);
  const clubSpeedChangeMph = difference(current.clubSpeedMph, baseline.clubSpeedMph);
  const launchChangeDeg = difference(current.launchAngleDeg, baseline.launchAngleDeg);
  const smashChange = difference(current.smashFactor, baseline.smashFactor, 2);
  const speedLed = (clubSpeedChangeMph ?? 0) <= -2 || (ballSpeedChangeMph ?? 0) <= -3;
  const distanceDown = (carryChangeYd ?? 0) <= -5;
  const exposureDown = (exposureSummary.activeDayChangePercent ?? 0) <= -20;
  const launchDown = (launchChangeDeg ?? 0) <= -1.5;

  const headline = distanceDown
    ? speedLed && exposureDown
      ? "Distance loss is multifactorial, with a strong speed component"
      : speedLed
        ? "Distance loss has a strong speed component; other causes remain unresolved"
        : launchDown
          ? "Lower launch is the clearest measured drag"
          : "Distance is down, but the cause is not isolated yet"
    : "No sustained driver distance loss is established";
  const summary = buildSummary({
    baseline,
    current,
    carryChangeYd,
    speedLed,
    exposureDown,
    exposureSummary,
  });
  const factors = buildFactors({
    baseline,
    current,
    ballSpeedChangeMph,
    clubSpeedChangeMph,
    launchChangeDeg,
    smashChange,
    exposureSummary,
  });
  const lowMeasuredSample = current.measuredClubDataCount < 10;

  return {
    status: "ready",
    headline,
    summary,
    confidenceLabel: lowMeasuredSample ? "Moderate confidence" : "Strong evidence",
    monthly,
    baseline,
    current,
    carryChangeYd,
    ballSpeedChangeMph,
    clubSpeedChangeMph,
    launchChangeDeg,
    smashChange,
    exposure: exposureSummary,
    factors,
    nextSteps: [
      "Run a controlled 20-driver retest with the same balls, tee height and full warm-up.",
      "Capture club speed, ball speed, centred strike and launch before changing swing direction.",
      exposureDown
        ? "Rebuild regular golf exposure with short, repeatable sessions before treating the speed loss as a swing fault."
        : "Keep session frequency steady while the next two comparable driver sessions are collected.",
    ],
    caveats: [
      isCurrentCalendarMonth(current.key, now)
        ? `${current.label} is a partial month.`
        : "The latest comparison month is complete.",
      lowMeasuredSample
        ? `Only ${current.measuredClubDataCount} current-month rows contain non-estimated club speed and smash.`
        : "Club-speed and smash evidence clears the measured-data floor.",
      current.spinCount === 0 || baseline.spinCount === 0
        ? "Spin is unresolved because the comparison does not contain usable spin rows."
        : "Spin is available for this comparison.",
      "Recent golf exposure is contextual evidence, not proof that reduced practice caused the speed change.",
    ],
  };
}

function summarizeMonth(
  month: { key: string; label: string },
  shots: DistanceLossShot[],
): DistanceLossMonth {
  const monthShots = shots.filter((shot) => londonMonthKey(shot.shotAt) === month.key);
  const measuredRows = monthShots.filter((shot) => isMeasuredClubData(shot.clubDataEstType));

  return {
    ...month,
    shotCount: monthShots.length,
    measuredClubDataCount: measuredRows.filter(
      (shot) => isNumber(shot.clubSpeedMph) || isNumber(shot.smashFactor),
    ).length,
    spinCount: monthShots.filter((shot) => isNumber(shot.spinRate)).length,
    carryYd: median(monthShots.map((shot) => shot.carryYd)),
    ballSpeedMph: median(monthShots.map((shot) => shot.ballSpeedMph)),
    clubSpeedMph: median(measuredRows.map((shot) => shot.clubSpeedMph)),
    launchAngleDeg: median(monthShots.map((shot) => shot.launchAngleDeg)),
    smashFactor: median(
      measuredRows.map((shot) => shot.smashFactor),
      2,
    ),
  };
}

function summarizeExposure(exposure: DistanceLossExposure[], now: Date) {
  const todayOrdinal = dateOrdinal(londonDateKey(now));
  const recentDays = new Set<string>();
  const previousDays = new Set<string>();
  const recentSessions = new Set<string>();
  const previousSessions = new Set<string>();

  for (const item of exposure) {
    const dayKey = londonDateKey(item.occurredAt);
    const daysAgo = todayOrdinal - dateOrdinal(dayKey);

    if (daysAgo >= 0 && daysAgo < 56) {
      recentDays.add(dayKey);
      recentSessions.add(item.id);
    } else if (daysAgo >= 56 && daysAgo < 112) {
      previousDays.add(dayKey);
      previousSessions.add(item.id);
    }
  }

  return {
    recentActiveDays: recentDays.size,
    previousActiveDays: previousDays.size,
    recentSessions: recentSessions.size,
    previousSessions: previousSessions.size,
    activeDayChangePercent:
      previousDays.size === 0
        ? null
        : roundOne(((recentDays.size - previousDays.size) / previousDays.size) * 100),
  };
}

function buildFactors({
  baseline,
  current,
  ballSpeedChangeMph,
  clubSpeedChangeMph,
  launchChangeDeg,
  smashChange,
  exposureSummary,
}: {
  baseline: DistanceLossMonth;
  current: DistanceLossMonth;
  ballSpeedChangeMph: number | null;
  clubSpeedChangeMph: number | null;
  launchChangeDeg: number | null;
  smashChange: number | null;
  exposureSummary: ReturnType<typeof summarizeExposure>;
}): DistanceLossFactor[] {
  const speedDown = (clubSpeedChangeMph ?? 0) <= -2 || (ballSpeedChangeMph ?? 0) <= -3;
  const exposureDown = (exposureSummary.activeDayChangePercent ?? 0) <= -20;
  const launchDown = (launchChangeDeg ?? 0) <= -1.5;
  const efficiencyStable = smashChange !== null && Math.abs(smashChange) <= 0.03;
  const spinAvailable = baseline.spinCount > 0 && current.spinCount > 0;

  return [
    {
      key: "speed",
      label: "Delivered speed",
      status: speedDown ? "Likely contributor" : "Not clearly down",
      detail:
        clubSpeedChangeMph === null || ballSpeedChangeMph === null
          ? "Need comparable measured club-speed and ball-speed rows."
          : `${formatSigned(clubSpeedChangeMph)} mph club speed and ${formatSigned(ballSpeedChangeMph)} mph ball speed from ${baseline.label} to ${current.label}.`,
      tone: speedDown ? "amber" : "green",
    },
    {
      key: "exposure",
      label: "Recent golf exposure",
      status: exposureDown ? "Plausible contributor" : "Holding broadly steady",
      detail:
        exposureSummary.activeDayChangePercent === null
          ? "Need a prior 56-day exposure window for comparison."
          : `${exposureSummary.recentActiveDays} active golf days in the latest 56 days versus ${exposureSummary.previousActiveDays} previously (${formatSigned(exposureSummary.activeDayChangePercent)}%).`,
      tone: exposureDown ? "amber" : "green",
    },
    {
      key: "launch",
      label: "Launch conditions",
      status: launchDown ? "Adds to the loss" : "Not a clear drag",
      detail:
        launchChangeDeg === null
          ? "Need comparable launch rows."
          : `${formatSigned(launchChangeDeg)} degrees from ${baseline.label} to ${current.label}.`,
      tone: launchDown ? "amber" : "green",
    },
    {
      key: "efficiency",
      label: "Strike efficiency",
      status: efficiencyStable ? "Not the main failure" : "Review strike",
      detail:
        smashChange === null
          ? "Need comparable non-estimated smash rows."
          : `Measured smash moved ${formatSigned(smashChange, 2)} from ${baseline.smashFactor?.toFixed(2) ?? "--"} to ${current.smashFactor?.toFixed(2) ?? "--"}.`,
      tone: efficiencyStable ? "green" : "amber",
    },
    {
      key: "spin",
      label: "Spin",
      status: spinAvailable ? "Available" : "Unresolved",
      detail: spinAvailable
        ? "Usable spin rows exist in both comparison months."
        : "No comparable spin evidence is stored, so spin is not used to explain the change.",
      tone: spinAvailable ? "sky" : "slate",
    },
  ];
}

function buildSummary({
  baseline,
  current,
  carryChangeYd,
  speedLed,
  exposureDown,
  exposureSummary,
}: {
  baseline: DistanceLossMonth;
  current: DistanceLossMonth;
  carryChangeYd: number | null;
  speedLed: boolean;
  exposureDown: boolean;
  exposureSummary: ReturnType<typeof summarizeExposure>;
}) {
  const carrySentence = `Median driver carry moved ${formatSigned(carryChangeYd)} yd from ${baseline.label} to ${current.label}.`;
  const speedSentence = speedLed
    ? "Lower measured club speed and ball speed are the strongest verified signals, but the evidence does not justify treating speed as the only cause."
    : "The measured speed fields do not yet explain most of the movement.";
  const exposureSentence = exposureDown
    ? `Golf exposure also fell from ${exposureSummary.previousActiveDays} to ${exposureSummary.recentActiveDays} active days across matched 56-day windows, making reduced repetition a plausible contributor rather than a proven cause.`
    : "Recent golf exposure is broadly stable across the matched 56-day windows.";

  return `${carrySentence} ${speedSentence} ${exposureSentence}`;
}

function isEligibleDriverShot(shot: DistanceLossShot) {
  const source = shot.source.trim().toLowerCase();
  const category = shot.shotCategory?.trim().toLowerCase() ?? null;
  const qualityTag = shot.qualityTag?.trim().toLowerCase() ?? null;

  return (
    source === "rapsodo" &&
    isNumber(shot.carryYd) &&
    shot.carryYd > 0 &&
    (!category || !excludedCategories.has(category)) &&
    (!qualityTag || !excludedQualityTags.has(qualityTag))
  );
}

function isMeasuredClubData(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized !== "1" && normalized !== "true" && !normalized.includes("est");
}

function findCurrentUsableMonthIndex(monthly: DistanceLossMonth[]) {
  for (let index = monthly.length - 1; index >= 0; index -= 1) {
    if (monthly[index].shotCount >= MIN_MONTH_SHOTS && monthly[index].carryYd !== null) {
      return index;
    }
  }

  return -1;
}

function findBaselineMonthIndex(monthly: DistanceLossMonth[], currentIndex: number) {
  if (currentIndex <= 0) {
    return -1;
  }

  const preferredIndex = Math.max(0, currentIndex - 2);

  for (let index = preferredIndex; index >= 0; index -= 1) {
    if (monthly[index].shotCount >= MIN_MONTH_SHOTS && monthly[index].carryYd !== null) {
      return index;
    }
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (monthly[index].shotCount >= MIN_MONTH_SHOTS && monthly[index].carryYd !== null) {
      return index;
    }
  }

  return -1;
}

function recentMonthKeys(now: Date, count: number) {
  const [year, month] = londonMonthKey(now).split("-").map(Number);

  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - count + offset, 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: monthLabelFormatter.format(date),
    };
  });
}

function londonMonthKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    timeZone: LONDON_TIME_ZONE,
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

function londonDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: LONDON_TIME_ZONE,
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function dateOrdinal(value: string) {
  return Date.parse(`${value}T00:00:00Z`) / DAY_MS;
}

function isCurrentCalendarMonth(monthKey: string, now: Date) {
  return monthKey === londonMonthKey(now);
}

function median(values: Array<number | null>, precision = 1) {
  const numbers = values.filter(isNumber).sort((left, right) => left - right);

  if (numbers.length === 0) {
    return null;
  }

  const middle = Math.floor(numbers.length / 2);
  const value =
    numbers.length % 2 === 0 ? (numbers[middle - 1] + numbers[middle]) / 2 : numbers[middle];
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function difference(left: number | null, right: number | null, precision = 1) {
  if (left === null || right === null) {
    return null;
  }

  const factor = 10 ** precision;
  return Math.round((left - right) * factor) / factor;
}

function formatSigned(value: number | null, precision = 1) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(precision)}`;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
