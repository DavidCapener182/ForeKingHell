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

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
