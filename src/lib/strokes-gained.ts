import type { NewStrokesGainedShotEvent } from "@/db/schema";
import type { InferredCourseShot } from "@/lib/course-scorecard";
import type { ParsedRapsodoShot, ShotCategory } from "@/lib/rapsodo/parser";

export type StrokesGainedBaselineBucket = {
  category: string;
  lie: string;
  distanceStartYd: number;
  distanceEndYd: number;
  expectedStrokes: number;
};

export const DEFAULT_STROKES_GAINED_BASELINE_BUCKETS: StrokesGainedBaselineBucket[] = [
  { category: "tee", lie: "tee", distanceStartYd: 0, distanceEndYd: 180, expectedStrokes: 3.1 },
  { category: "tee", lie: "tee", distanceStartYd: 181, distanceEndYd: 240, expectedStrokes: 3.5 },
  { category: "tee", lie: "tee", distanceStartYd: 241, distanceEndYd: 320, expectedStrokes: 4.0 },
  { category: "tee", lie: "tee", distanceStartYd: 321, distanceEndYd: 450, expectedStrokes: 4.6 },
  { category: "tee", lie: "tee", distanceStartYd: 451, distanceEndYd: 620, expectedStrokes: 5.4 },
  {
    category: "approach",
    lie: "fairway",
    distanceStartYd: 0,
    distanceEndYd: 60,
    expectedStrokes: 2.6,
  },
  {
    category: "approach",
    lie: "fairway",
    distanceStartYd: 61,
    distanceEndYd: 100,
    expectedStrokes: 2.9,
  },
  {
    category: "approach",
    lie: "fairway",
    distanceStartYd: 101,
    distanceEndYd: 140,
    expectedStrokes: 3.2,
  },
  {
    category: "approach",
    lie: "fairway",
    distanceStartYd: 141,
    distanceEndYd: 180,
    expectedStrokes: 3.5,
  },
  {
    category: "approach",
    lie: "fairway",
    distanceStartYd: 181,
    distanceEndYd: 230,
    expectedStrokes: 3.9,
  },
  {
    category: "approach",
    lie: "fairway",
    distanceStartYd: 231,
    distanceEndYd: 320,
    expectedStrokes: 4.4,
  },
  {
    category: "approach",
    lie: "rough",
    distanceStartYd: 0,
    distanceEndYd: 60,
    expectedStrokes: 2.8,
  },
  {
    category: "approach",
    lie: "rough",
    distanceStartYd: 61,
    distanceEndYd: 100,
    expectedStrokes: 3.1,
  },
  {
    category: "approach",
    lie: "rough",
    distanceStartYd: 101,
    distanceEndYd: 140,
    expectedStrokes: 3.4,
  },
  {
    category: "approach",
    lie: "rough",
    distanceStartYd: 141,
    distanceEndYd: 180,
    expectedStrokes: 3.7,
  },
  {
    category: "approach",
    lie: "rough",
    distanceStartYd: 181,
    distanceEndYd: 230,
    expectedStrokes: 4.1,
  },
  {
    category: "approach",
    lie: "rough",
    distanceStartYd: 231,
    distanceEndYd: 320,
    expectedStrokes: 4.7,
  },
  {
    category: "short_game",
    lie: "fairway",
    distanceStartYd: 0,
    distanceEndYd: 30,
    expectedStrokes: 2.3,
  },
  {
    category: "short_game",
    lie: "fairway",
    distanceStartYd: 31,
    distanceEndYd: 60,
    expectedStrokes: 2.6,
  },
  {
    category: "short_game",
    lie: "fairway",
    distanceStartYd: 61,
    distanceEndYd: 100,
    expectedStrokes: 2.9,
  },
  {
    category: "short_game",
    lie: "rough",
    distanceStartYd: 0,
    distanceEndYd: 30,
    expectedStrokes: 2.5,
  },
  {
    category: "short_game",
    lie: "rough",
    distanceStartYd: 31,
    distanceEndYd: 60,
    expectedStrokes: 2.8,
  },
  {
    category: "short_game",
    lie: "rough",
    distanceStartYd: 61,
    distanceEndYd: 100,
    expectedStrokes: 3.1,
  },
  { category: "putting", lie: "green", distanceStartYd: 0, distanceEndYd: 3, expectedStrokes: 1.1 },
  {
    category: "putting",
    lie: "green",
    distanceStartYd: 4,
    distanceEndYd: 10,
    expectedStrokes: 1.6,
  },
  {
    category: "putting",
    lie: "green",
    distanceStartYd: 11,
    distanceEndYd: 30,
    expectedStrokes: 2.0,
  },
  {
    category: "putting",
    lie: "green",
    distanceStartYd: 31,
    distanceEndYd: 80,
    expectedStrokes: 2.5,
  },
  { category: "putting", lie: "holed", distanceStartYd: 0, distanceEndYd: 0, expectedStrokes: 0 },
];

export type StrokesGainedShotInput = {
  startExpectedStrokes: number | null;
  endExpectedStrokes: number | null;
  penaltyStrokes?: number | null;
};

export type StrokesGainedHoleScoringInput = {
  holeNumber: number;
  csvShotCount?: number | null;
  score?: number | null;
  putts?: number | null;
  penalties?: number | null;
};

export function calculateShotStrokesGained(input: StrokesGainedShotInput) {
  if (!isFiniteNumber(input.startExpectedStrokes) || !isFiniteNumber(input.endExpectedStrokes)) {
    return null;
  }

  const penaltyStrokes = isFiniteNumber(input.penaltyStrokes) ? input.penaltyStrokes : 0;
  return roundOne(input.startExpectedStrokes - 1 - penaltyStrokes - input.endExpectedStrokes);
}

export function findBaselineBucket(
  buckets: StrokesGainedBaselineBucket[],
  input: { category: string; lie: string; distanceYd: number | null },
) {
  if (!isFiniteNumber(input.distanceYd)) {
    return null;
  }

  const distanceYd = input.distanceYd;

  return (
    buckets.find(
      (bucket) =>
        bucket.category === input.category &&
        bucket.lie === input.lie &&
        distanceYd >= bucket.distanceStartYd &&
        distanceYd <= bucket.distanceEndYd,
    ) ?? null
  );
}

export function summarizeStrokesGained(values: Array<number | null>) {
  const finiteValues = values.filter(isFiniteNumber);

  if (finiteValues.length === 0) {
    return {
      total: null,
      average: null,
      sampleSize: 0,
    };
  }

  const total = finiteValues.reduce((sum, value) => sum + value, 0);

  return {
    total: roundOne(total),
    average: roundOne(total / finiteValues.length),
    sampleSize: finiteValues.length,
  };
}

export function summarizeStrokesGainedByCategory<
  T extends { category: string; strokesGained: number | null },
>(events: T[]) {
  const grouped = new Map<string, Array<number | null>>();

  for (const event of events) {
    grouped.set(event.category, [...(grouped.get(event.category) ?? []), event.strokesGained]);
  }

  return [...grouped.entries()]
    .map(([category, values]) => ({
      category,
      ...summarizeStrokesGained(values),
    }))
    .sort((a, b) => {
      if (a.total === null && b.total === null) {
        return a.category.localeCompare(b.category);
      }

      if (a.total === null) {
        return 1;
      }

      if (b.total === null) {
        return -1;
      }

      return a.total - b.total;
    });
}

export function buildStrokesGainedEventsFromCourseShots({
  userId,
  sessionId,
  courseShots,
  holeScoring = [],
  shotIdByRowNumber = new Map(),
  baselineBuckets = DEFAULT_STROKES_GAINED_BASELINE_BUCKETS,
}: {
  userId: string;
  sessionId: string;
  courseShots: InferredCourseShot[];
  holeScoring?: StrokesGainedHoleScoringInput[];
  shotIdByRowNumber?: Map<number, string>;
  baselineBuckets?: StrokesGainedBaselineBucket[];
}): NewStrokesGainedShotEvent[] {
  const scoringByHole = new Map(holeScoring.map((hole) => [hole.holeNumber, hole]));
  const shotsByHole = groupCourseShotsByHole(courseShots);

  return courseShots.map((courseShot) => {
    const startDistanceYd = roundOne(
      Math.max(0, courseShot.holeYards - courseShot.progressBeforeYd),
    );
    const endDistanceYd = roundOne(Math.max(0, courseShot.distanceRemainingYd));
    const holeShots = shotsByHole.get(courseShot.holeNumber) ?? [];
    const isFinalTrackedShot = holeShots.at(-1) === courseShot;
    const holeScoringRow = isFinalTrackedShot
      ? (scoringByHole.get(courseShot.holeNumber) ?? null)
      : null;
    const inferredPutts = inferPuttsAfterTrackedShots(holeScoringRow, holeShots.length);
    const endPosition = endPositionForCourseShot(courseShot, endDistanceYd, inferredPutts);
    const category = strokesGainedCategory(courseShot, startDistanceYd);
    const startLie = startLieForCourseShot(courseShot, startDistanceYd);
    const endCategory = categoryForLieAndDistance(endPosition.lie, endPosition.distanceYd);
    const startBucket = findBaselineBucket(baselineBuckets, {
      category,
      lie: startLie,
      distanceYd: startDistanceYd,
    });
    const endBucket = findBaselineBucket(baselineBuckets, {
      category: endCategory,
      lie: endPosition.lie,
      distanceYd: endPosition.distanceYd,
    });
    const strokesGained = calculateShotStrokesGained({
      startExpectedStrokes: startBucket?.expectedStrokes ?? null,
      endExpectedStrokes: endPosition.expectedStrokes ?? endBucket?.expectedStrokes ?? null,
    });

    return {
      userId,
      sessionId,
      shotId: shotIdByRowNumber.get(courseShot.sourceShot.rowNumber) ?? null,
      holeNumber: courseShot.holeNumber,
      strokeNumber: courseShot.holeShotNumber,
      category,
      startLie,
      endLie: endPosition.lie,
      startDistanceYd,
      endDistanceYd: endPosition.distanceYd,
      penaltyStrokes: 0,
      strokesGained,
      metadataJson: {
        source: "rapsodo-course-import",
        rawRowNumber: courseShot.sourceShot.rowNumber,
        absoluteShotNumber: courseShot.absoluteShotNumber,
        clubType: courseShot.sourceShot.clubType,
        carryYd: courseShot.sourceShot.carryYd,
        totalYd: courseShot.sourceShot.totalYd,
        forwardDistanceYd: courseShot.forwardDistanceYd,
        shotCategory: courseShot.shotCategory,
        ...(inferredPutts !== null
          ? {
              inferredPuttsAfterShot: inferredPutts,
              scorecardScore: holeScoringRow?.score ?? null,
              scorecardPenaltyStrokes: holeScoringRow?.penalties ?? null,
              originalDistanceRemainingYd: endDistanceYd,
            }
          : {}),
      },
    };
  });
}

export type RoundAssignmentStrokesGainedShot = {
  id: string;
  shotNumber: number | null;
  clubType: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  courseHoleNumber: number | null;
  courseHoleShotNumber: number | null;
  courseHolePar: number | null;
  courseHoleYards: number | null;
  distanceRemainingYd: number | null;
  shotCategory: string | null;
};

export function buildStrokesGainedEventsFromRoundAssignments({
  userId,
  sessionId,
  shots,
  holeScoring = [],
  baselineBuckets = DEFAULT_STROKES_GAINED_BASELINE_BUCKETS,
}: {
  userId: string;
  sessionId: string;
  shots: RoundAssignmentStrokesGainedShot[];
  holeScoring?: StrokesGainedHoleScoringInput[];
  baselineBuckets?: StrokesGainedBaselineBucket[];
}) {
  const orderedShots = shots
    .filter(isMappedRoundAssignmentShot)
    .sort(
      (left, right) =>
        left.courseHoleNumber - right.courseHoleNumber ||
        left.courseHoleShotNumber - right.courseHoleShotNumber ||
        (left.shotNumber ?? Number.MAX_SAFE_INTEGER) -
          (right.shotNumber ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );
  const previousRemainingByHole = new Map<number, number>();
  const shotIdByRowNumber = new Map<number, string>();
  const courseShots = orderedShots.map<InferredCourseShot>((shot, index) => {
    const rowNumber = index + 1;
    const holeNumber = shot.courseHoleNumber;
    const holeShotNumber = shot.courseHoleShotNumber;
    const holeYards = shot.courseHoleYards;
    const distanceRemainingYd = roundOne(Math.max(0, shot.distanceRemainingYd));
    const progressBeforeYd = roundOne(
      Math.max(0, holeYards - (previousRemainingByHole.get(holeNumber) ?? holeYards)),
    );
    const progressAfterYd = roundOne(Math.max(0, holeYards - distanceRemainingYd));
    const sourceShot = roundAssignmentSourceShot(shot, rowNumber);

    previousRemainingByHole.set(holeNumber, distanceRemainingYd);
    shotIdByRowNumber.set(rowNumber, shot.id);

    return {
      sourceShot,
      absoluteShotNumber: index + 1,
      holeNumber,
      holeShotNumber,
      holePar: shot.courseHolePar ?? 4,
      holeYards,
      holeName: null,
      shotDistanceYd: shot.totalYd ?? shot.carryYd,
      forwardDistanceYd: roundOne(Math.max(0, progressAfterYd - progressBeforeYd)),
      progressBeforeYd,
      progressAfterYd,
      distanceRemainingYd,
      displaySideYd: shot.sideCarryYd ?? 0,
      shotCategory: roundAssignmentShotCategory(shot),
    };
  });

  return buildStrokesGainedEventsFromCourseShots({
    userId,
    sessionId,
    courseShots,
    holeScoring,
    shotIdByRowNumber,
    baselineBuckets,
  });
}

function isMappedRoundAssignmentShot(
  shot: RoundAssignmentStrokesGainedShot,
): shot is RoundAssignmentStrokesGainedShot & {
  courseHoleNumber: number;
  courseHoleShotNumber: number;
  courseHoleYards: number;
  distanceRemainingYd: number;
} {
  return (
    Number.isInteger(shot.courseHoleNumber) &&
    (shot.courseHoleNumber ?? 0) > 0 &&
    Number.isInteger(shot.courseHoleShotNumber) &&
    (shot.courseHoleShotNumber ?? 0) > 0 &&
    isFiniteNumber(shot.courseHoleYards) &&
    shot.courseHoleYards > 0 &&
    isFiniteNumber(shot.distanceRemainingYd) &&
    shot.distanceRemainingYd >= 0
  );
}

function roundAssignmentSourceShot(
  shot: RoundAssignmentStrokesGainedShot,
  rowNumber: number,
): ParsedRapsodoShot {
  return {
    rowNumber,
    shotNumber: shot.shotNumber,
    clubTypeRaw: shot.clubType,
    clubType: shot.clubType,
    clubLabel: shot.clubType,
    clubBrand: null,
    clubModel: null,
    clubKey: shot.clubType,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    ballSpeedMph: null,
    clubSpeedMph: null,
    launchAngleDeg: null,
    launchDirectionDeg: null,
    apexFt: null,
    sideCarryYd: shot.sideCarryYd,
    attackAngleDeg: null,
    clubPathDeg: null,
    faceAngleDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    spinRate: null,
    spinAxis: null,
    shotShape: null,
    shotCategory: roundAssignmentShotCategory(shot),
    qualityTag: null,
    clubDataEstType: null,
    sourceRawJson: {},
    warnings: [],
  };
}

function roundAssignmentShotCategory(shot: RoundAssignmentStrokesGainedShot): ShotCategory {
  if (isShotCategory(shot.shotCategory)) {
    return shot.shotCategory;
  }

  if (shot.courseHoleShotNumber === 1) return "tee";
  const distance = shot.totalYd ?? shot.carryYd ?? 0;
  if (distance <= 35) return "chip";
  if (distance <= 95 && ["pw", "gw", "aw", "sw", "lw", "wedge"].includes(shot.clubType)) {
    return "pitch";
  }
  return "approach";
}

function isShotCategory(value: string | null): value is ShotCategory {
  return Boolean(value && ["full", "pitch", "chip", "recovery", "tee", "approach"].includes(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function strokesGainedCategory(courseShot: InferredCourseShot, startDistanceYd: number) {
  if (courseShot.holeShotNumber === 1) {
    return "tee";
  }

  if (
    courseShot.shotCategory === "chip" ||
    courseShot.shotCategory === "pitch" ||
    startDistanceYd <= 100
  ) {
    return "short_game";
  }

  return "approach";
}

function categoryForLieAndDistance(lie: string, distanceYd: number) {
  if (lie === "green" || lie === "holed") {
    return "putting";
  }

  if (distanceYd <= 100) {
    return "short_game";
  }

  return "approach";
}

function startLieForCourseShot(courseShot: InferredCourseShot, startDistanceYd: number) {
  if (courseShot.holeShotNumber === 1) {
    return "tee";
  }

  if (startDistanceYd <= 30) {
    return "green";
  }

  return Math.abs(courseShot.displaySideYd) > 25 ? "rough" : "fairway";
}

function endLieForCourseShot(courseShot: InferredCourseShot, endDistanceYd: number) {
  if (endDistanceYd <= 0) {
    return "holed";
  }

  if (endDistanceYd <= 30) {
    return "green";
  }

  return Math.abs(courseShot.displaySideYd) > 25 ? "rough" : "fairway";
}

function endPositionForCourseShot(
  courseShot: InferredCourseShot,
  endDistanceYd: number,
  inferredPutts: number | null,
) {
  if (isFiniteNumber(inferredPutts) && inferredPutts > 0) {
    return {
      lie: "green",
      distanceYd: estimatedFirstPuttDistanceYd(inferredPutts),
      expectedStrokes: inferredPutts,
    };
  }

  const lie = endLieForCourseShot(courseShot, endDistanceYd);

  return {
    lie,
    distanceYd: endDistanceYd,
    expectedStrokes: null,
  };
}

export function estimatedFirstPuttDistanceYd(putts: number) {
  if (putts <= 1) {
    return 3;
  }

  if (putts === 2) {
    return 12;
  }

  return 31;
}

function inferPuttsAfterTrackedShots(
  scoring: StrokesGainedHoleScoringInput | null,
  trackedShotCount: number,
) {
  if (!scoring) {
    return null;
  }

  if (isFiniteNumber(scoring.putts)) {
    return Math.max(0, Math.round(scoring.putts));
  }

  if (!isFiniteNumber(scoring.score)) {
    return null;
  }

  const penalties = isFiniteNumber(scoring.penalties) ? Math.max(0, scoring.penalties) : 0;
  return Math.max(0, Math.round(scoring.score - trackedShotCount - penalties));
}

function groupCourseShotsByHole(courseShots: InferredCourseShot[]) {
  const grouped = new Map<number, InferredCourseShot[]>();

  for (const courseShot of courseShots) {
    grouped.set(courseShot.holeNumber, [...(grouped.get(courseShot.holeNumber) ?? []), courseShot]);
  }

  return grouped;
}
