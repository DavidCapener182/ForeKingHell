import { clubSortValue, formatClubType } from "@/lib/club-format";

export type ClubBenchmarkLevelKey = "beginner" | "average" | "good" | "advanced" | "tour";

export type ClubBenchmarkLevel = {
  key: ClubBenchmarkLevelKey;
  label: string;
  shortLabel: string;
  yards: number;
};

export type ClubDistanceBenchmark = {
  clubType: string;
  label: string;
  levels: ClubBenchmarkLevel[];
};

export type ClubDistanceComparison = {
  benchmark: ClubDistanceBenchmark;
  carryYd: number | null;
  levelLabel: string;
  levelKey: ClubBenchmarkLevelKey | "building" | "tour-plus" | "no-data";
  levelIndex: number | null;
  nextLevel: ClubBenchmarkLevel | null;
  yardsToNextLevel: number | null;
  progressPercent: number;
};

export type ClubBenchmarkMetricKey =
  | "carryYd"
  | "clubSpeedMph"
  | "attackAngleDeg"
  | "ballSpeedMph"
  | "smashFactor"
  | "launchAngleDeg"
  | "spinRate"
  | "maxHeightYd"
  | "landAngleDeg";

export type ClubBenchmarkMetricValues = Partial<Record<ClubBenchmarkMetricKey, number | null>>;

export type ClubBenchmarkTourMetricValues = Partial<Record<ClubBenchmarkMetricKey, number>>;

export type ClubBenchmarkTourReference = {
  pga?: ClubBenchmarkTourMetricValues;
  lpga?: ClubBenchmarkTourMetricValues;
  pgaLabel?: string;
  lpgaLabel?: string;
};

export type InferredClubBenchmarkMetricLevel = {
  key: ClubBenchmarkLevelKey;
  label: string;
  shortLabel: string;
  value: number;
};

export type ClubSpeedBenchmarkTarget = {
  targetSpeedMph: number;
  targetLevelKey: ClubBenchmarkLevelKey;
  targetLevelLabel: string;
  currentLevelKey: ClubBenchmarkLevelKey | "building" | "tour-plus" | "no-data";
  currentLevelLabel: string;
  gapMph: number | null;
};

export type ClubBenchmarkPeerComparison = {
  clubType: string;
  metricKey: ClubBenchmarkMetricKey;
  peerCount: number;
  sampleSize: number;
  peerMedian: number | null;
  topQuartile: number | null;
  percentile: number | null;
};

export type ClubBenchmarkPeerSummary = {
  cohortLabel: string;
  peerUserCount: number;
  peerShotCount: number;
  comparisons: ClubBenchmarkPeerComparison[];
};

type BenchmarkRowInput = {
  clubId: string;
  clubType: string;
  brandModel: string;
  carryYd: number | null;
  bestSampleFloorYd?: number | null;
  sampleSize: number;
  confidenceScore: number;
  metrics?: ClubBenchmarkMetricValues;
};

export type ClubBenchmarkRow = BenchmarkRowInput & {
  comparison: ClubDistanceComparison;
};

const LEVEL_LABELS: Record<ClubBenchmarkLevelKey, { label: string; shortLabel: string }> = {
  beginner: { label: "Beginner", shortLabel: "Beg" },
  average: { label: "Average", shortLabel: "Avg" },
  good: { label: "Good", shortLabel: "Good" },
  advanced: { label: "Advanced", shortLabel: "Adv" },
  tour: { label: "Tour", shortLabel: "Tour" },
};

const BENCHMARK_VALUES: Record<string, Record<ClubBenchmarkLevelKey, number>> = {
  driver: { beginner: 180, average: 220, good: 250, advanced: 280, tour: 296 },
  "3w": { beginner: 170, average: 210, good: 225, advanced: 235, tour: 262 },
  "5w": { beginner: 150, average: 195, good: 205, advanced: 220, tour: 248 },
  hybrid: { beginner: 145, average: 180, good: 190, advanced: 210, tour: 242 },
  "2i": { beginner: 100, average: 180, good: 190, advanced: 215, tour: 236 },
  "3i": { beginner: 100, average: 170, good: 180, advanced: 205, tour: 228 },
  "4i": { beginner: 100, average: 160, good: 170, advanced: 195, tour: 219 },
  "5i": { beginner: 125, average: 155, good: 165, advanced: 185, tour: 209 },
  "6i": { beginner: 120, average: 145, good: 160, advanced: 175, tour: 197 },
  "7i": { beginner: 110, average: 140, good: 150, advanced: 165, tour: 185 },
  "8i": { beginner: 100, average: 130, good: 140, advanced: 155, tour: 172 },
  "9i": { beginner: 90, average: 115, good: 125, advanced: 145, tour: 159 },
  pw: { beginner: 80, average: 100, good: 110, advanced: 135, tour: 146 },
  gw: { beginner: 60, average: 90, good: 100, advanced: 125, tour: 135 },
  sw: { beginner: 55, average: 80, good: 95, advanced: 115, tour: 124 },
  lw: { beginner: 40, average: 60, good: 80, advanced: 105, tour: 113 },
};

const LEVEL_ORDER: ClubBenchmarkLevelKey[] = ["beginner", "average", "good", "advanced", "tour"];

const TOUR_REFERENCES: Record<string, ClubBenchmarkTourReference> = {
  driver: {
    pgaLabel: "Driver",
    lpgaLabel: "Driver",
    pga: tourValues(113, 167, 1.48, 2686, 32, 38, 275),
    lpga: tourValues(94, 140, 1.48, 2611, 25, 37, 218),
  },
  "3w": {
    pgaLabel: "3-wood",
    lpgaLabel: "3-wood",
    pga: tourValues(107, 158, 1.48, 3655, 30, 43, 243),
    lpga: tourValues(90, 132, 1.48, 2704, 23, 39, 195),
  },
  "5w": {
    pgaLabel: "5-wood",
    lpgaLabel: "5-wood",
    pga: tourValues(103, 152, 1.47, 4350, 31, 47, 230),
    lpga: tourValues(88, 128, 1.47, 4501, 26, 43, 185),
  },
  hybrid: {
    pgaLabel: "Hybrid 15-18",
    lpgaLabel: "7-wood",
    pga: tourValues(100, 146, 1.46, 4437, 29, 47, 225),
    lpga: tourValues(85, 123, 1.46, 4693, 25, 46, 174),
  },
  "3i": {
    pgaLabel: "3 iron",
    pga: tourValues(98, 142, 1.45, 4630, 27, 46, 212),
  },
  "4i": {
    pgaLabel: "4 iron",
    lpgaLabel: "4 iron",
    pga: tourValues(96, 137, 1.43, 4836, 28, 48, 203),
    lpga: tourValues(80, 116, 1.45, 4801, 24, 43, 169),
  },
  "5i": {
    pgaLabel: "5 iron",
    lpgaLabel: "5 iron",
    pga: tourValues(94, 132, 1.41, 5361, 31, 49, 194),
    lpga: tourValues(79, 112, 1.43, 5081, 23, 45, 161),
  },
  "6i": {
    pgaLabel: "6 iron",
    lpgaLabel: "6 iron",
    pga: tourValues(92, 127, 1.38, 6231, 30, 50, 183),
    lpga: tourValues(78, 109, 1.41, 5943, 25, 46, 152),
  },
  "7i": {
    pgaLabel: "7 iron",
    lpgaLabel: "7 iron",
    pga: tourValues(90, 120, 1.33, 7097, 32, 50, 172),
    lpga: tourValues(76, 104, 1.38, 6699, 26, 47, 141),
  },
  "8i": {
    pgaLabel: "8 iron",
    lpgaLabel: "8 iron",
    pga: tourValues(87, 115, 1.32, 7998, 31, 50, 160),
    lpga: tourValues(74, 100, 1.33, 7494, 25, 47, 130),
  },
  "9i": {
    pgaLabel: "9 iron",
    lpgaLabel: "9 iron",
    pga: tourValues(85, 109, 1.28, 8647, 30, 51, 148),
    lpga: tourValues(72, 93, 1.32, 7589, 26, 47, 119),
  },
  pw: {
    pgaLabel: "PW",
    lpgaLabel: "PW",
    pga: tourValues(83, 102, 1.23, 9304, 29, 52, 136),
    lpga: tourValues(70, 86, 1.28, 8403, 23, 48, 107),
  },
};

export function getClubDistanceBenchmark(clubType: string): ClubDistanceBenchmark | null {
  const benchmarkClubType = benchmarkClubTypeFor(clubType);
  const values = BENCHMARK_VALUES[benchmarkClubType];

  if (!values) {
    return null;
  }

  return {
    clubType: benchmarkClubType,
    label: benchmarkClubType === "hybrid" ? "Hybrid" : formatClubType(benchmarkClubType),
    levels: LEVEL_ORDER.map((key) => ({
      key,
      label: LEVEL_LABELS[key].label,
      shortLabel: LEVEL_LABELS[key].shortLabel,
      yards: values[key],
    })),
  };
}

export function getClubBenchmarkTourReference(clubType: string): ClubBenchmarkTourReference | null {
  return TOUR_REFERENCES[benchmarkClubTypeFor(clubType)] ?? null;
}

export function getClubBenchmarkMetricLevels(
  clubType: string,
  metricKey: ClubBenchmarkMetricKey,
  precision = 1,
): InferredClubBenchmarkMetricLevel[] | null {
  const benchmark = getClubDistanceBenchmark(clubType);
  const reference = getClubBenchmarkTourReference(clubType);
  const tourValue = reference?.pga?.[metricKey] ?? reference?.lpga?.[metricKey] ?? null;
  const tourCarry = benchmark?.levels.at(-1)?.yards ?? null;

  if (
    !benchmark ||
    typeof tourValue !== "number" ||
    typeof tourCarry !== "number" ||
    !Number.isFinite(tourValue) ||
    !Number.isFinite(tourCarry) ||
    tourCarry <= 0
  ) {
    return null;
  }

  return benchmark.levels.map((level) => ({
    key: level.key,
    label: level.label,
    shortLabel: level.shortLabel,
    value: inferredBenchmarkMetricLevelValue(
      metricKey,
      tourValue,
      level.yards / tourCarry,
      precision,
    ),
  }));
}

export function getClubSpeedBenchmarkTarget(
  clubType: string,
  currentSpeedMph: number | null,
): ClubSpeedBenchmarkTarget | null {
  const levels = getClubBenchmarkMetricLevels(clubType, "clubSpeedMph", 1);

  if (!levels || levels.length === 0) {
    return null;
  }

  if (currentSpeedMph === null || !Number.isFinite(currentSpeedMph)) {
    const averageLevel = levels.find((level) => level.key === "average") ?? levels[0];

    return {
      targetSpeedMph: averageLevel.value,
      targetLevelKey: averageLevel.key,
      targetLevelLabel: averageLevel.label,
      currentLevelKey: "no-data",
      currentLevelLabel: "Needs data",
      gapMph: null,
    };
  }

  const tolerance = 0.05;
  const nextLevel = levels.find((level) => currentSpeedMph < level.value - tolerance) ?? null;
  const achievedLevel =
    [...levels].reverse().find((level) => currentSpeedMph >= level.value - tolerance) ?? null;
  const topLevel = levels[levels.length - 1];
  const targetLevel = nextLevel ?? topLevel;

  return {
    targetSpeedMph: targetLevel.value,
    targetLevelKey: targetLevel.key,
    targetLevelLabel: targetLevel.label,
    currentLevelKey: nextLevel
      ? (achievedLevel?.key ?? "building")
      : currentSpeedMph > topLevel.value + tolerance
        ? "tour-plus"
        : topLevel.key,
    currentLevelLabel: nextLevel
      ? (achievedLevel?.label ?? "Building")
      : currentSpeedMph > topLevel.value + tolerance
        ? "Tour+"
        : topLevel.label,
    gapMph: nextLevel ? roundTo(nextLevel.value - currentSpeedMph, 1) : 0,
  };
}

export function compareClubCarryToBenchmark(
  clubType: string,
  carryYd: number | null,
): ClubDistanceComparison | null {
  const benchmark = getClubDistanceBenchmark(clubType);

  if (!benchmark) {
    return null;
  }

  if (carryYd === null || !Number.isFinite(carryYd)) {
    return {
      benchmark,
      carryYd: null,
      levelLabel: "Needs data",
      levelKey: "no-data",
      levelIndex: null,
      nextLevel: benchmark.levels[0],
      yardsToNextLevel: null,
      progressPercent: 0,
    };
  }

  const achievedLevel =
    [...benchmark.levels].reverse().find((level) => carryYd >= level.yards) ?? null;
  const nextLevel = benchmark.levels.find((level) => carryYd < level.yards) ?? null;
  const finalLevel = benchmark.levels[benchmark.levels.length - 1];
  const progressPercent = benchmarkLevelProgressPercent(benchmark, carryYd);

  if (!nextLevel) {
    return {
      benchmark,
      carryYd,
      levelLabel: carryYd > finalLevel.yards ? "Tour+" : finalLevel.label,
      levelKey: carryYd > finalLevel.yards ? "tour-plus" : finalLevel.key,
      levelIndex: benchmark.levels.length - 1,
      nextLevel: null,
      yardsToNextLevel: null,
      progressPercent,
    };
  }

  if (!achievedLevel) {
    return {
      benchmark,
      carryYd,
      levelLabel: "Building",
      levelKey: "building",
      levelIndex: null,
      nextLevel,
      yardsToNextLevel: roundOne(nextLevel.yards - carryYd),
      progressPercent,
    };
  }

  return {
    benchmark,
    carryYd,
    levelLabel: achievedLevel.label,
    levelKey: achievedLevel.key,
    levelIndex: benchmark.levels.findIndex((level) => level.key === achievedLevel.key),
    nextLevel,
    yardsToNextLevel: roundOne(nextLevel.yards - carryYd),
    progressPercent,
  };
}

export function buildClubBenchmarkRows(clubs: BenchmarkRowInput[]): ClubBenchmarkRow[] {
  return clubs
    .map((club) => {
      const comparison = compareClubCarryToBenchmark(club.clubType, club.carryYd);

      return comparison ? { ...club, comparison } : null;
    })
    .filter((row): row is ClubBenchmarkRow => row !== null)
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));
}

export function benchmarkLevelProgressPercent(benchmark: ClubDistanceBenchmark, carryYd: number) {
  const firstLevel = benchmark.levels[0];
  const finalLevel = benchmark.levels[benchmark.levels.length - 1];

  return clamp(
    ((carryYd - firstLevel.yards) / (finalLevel.yards - firstLevel.yards)) * 100,
    0,
    100,
  );
}

export function benchmarkDisplayProgressPercent(benchmark: ClubDistanceBenchmark, carryYd: number) {
  const levels = benchmark.levels;
  const segmentSize = 100 / (levels.length - 1);
  const nextLevelIndex = levels.findIndex((level) => carryYd < level.yards);

  if (nextLevelIndex === -1) {
    return 100;
  }

  if (nextLevelIndex === 0) {
    return 0;
  }

  const previousLevel = levels[nextLevelIndex - 1];
  const nextLevel = levels[nextLevelIndex];
  const segmentProgress = (carryYd - previousLevel.yards) / (nextLevel.yards - previousLevel.yards);

  return clamp((nextLevelIndex - 1 + segmentProgress) * segmentSize, 0, 100);
}

function benchmarkClubTypeFor(clubType: string) {
  if (/^[1-9]h$/.test(clubType)) {
    return "hybrid";
  }

  return clubType;
}

function inferredBenchmarkMetricLevelValue(
  metricKey: ClubBenchmarkMetricKey,
  tourValue: number,
  carryRatio: number,
  precision: number,
) {
  const ratio = clamp(carryRatio, 0.35, 1);

  switch (metricKey) {
    case "clubSpeedMph":
    case "ballSpeedMph":
      return roundTo(tourValue * Math.sqrt(ratio), precision);
    case "smashFactor":
      return roundTo(1 + (tourValue - 1) * (0.55 + 0.45 * ratio), precision);
    case "spinRate":
      return roundTo(tourValue * Math.pow(ratio, 0.5), precision);
    case "maxHeightYd":
    case "landAngleDeg":
      return roundTo(tourValue * Math.pow(ratio, 0.35), precision);
    default:
      return roundTo(tourValue, precision);
  }
}

function tourValues(
  clubSpeedMph: number,
  ballSpeedMph: number,
  smashFactor: number,
  spinRate: number,
  maxHeightYd: number,
  landAngleDeg: number,
  carryYd: number,
): ClubBenchmarkTourMetricValues {
  return {
    carryYd,
    clubSpeedMph,
    ballSpeedMph,
    smashFactor,
    spinRate,
    maxHeightYd,
    landAngleDeg,
  };
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
