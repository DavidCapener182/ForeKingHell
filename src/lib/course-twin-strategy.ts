import type {
  CourseTwinHole,
  CourseTwinManifest,
  CourseTwinPoint,
} from "@/lib/course-twin-contract";
import {
  createCourseTwinSurfaceClassifier,
  type CourseTwinSurface,
} from "@/lib/course-twin-surface";

type CourseTwinEvidenceWindow = {
  basis: "latest-reliable";
  latestShotAt: string | null;
  lateralSampleSize: number;
  lowCarryYd: number | null;
  highCarryYd: number | null;
};

export type CourseTwinBagProfile = {
  evidenceWindow?: CourseTwinEvidenceWindow;
  clubId: string;
  clubType: string;
  sampleSize: number;
  confidenceScore: number;
  carryMedianYd: number;
  carryStdDevYd: number;
  totalMedianYd: number | null;
  sideMeanYd: number;
  sideStdDevYd: number;
  ballSpeedMeanMph: number | null;
  ballSpeedStdDevMph: number | null;
  launchMeanDeg: number | null;
  launchStdDevDeg: number | null;
  spinMeanRpm: number | null;
  spinStdDevRpm: number | null;
  spinAxisMeanDeg: number | null;
  spinAxisStdDevDeg: number | null;
};

export type CourseTwinStrategyClub = {
  evidenceWindow?: CourseTwinEvidenceWindow;
  clubId: string;
  clubType: string;
  sampleSize: number;
  confidenceScore: number;
  carryMedianYd: number;
  aimOffsetYd: number;
  landingCloud: CourseTwinPoint[];
  probabilities: Record<CourseTwinSurface, number>;
  averageRemainingYd: number;
  expectedRiskStrokes: number;
  confidence: "measured" | "developing" | "low_sample";
  shotModel: Omit<
    CourseTwinBagProfile,
    "clubId" | "clubType" | "sampleSize" | "confidenceScore" | "evidenceWindow"
  >;
};

export type CourseTwinStrategyDocument = {
  modelVersion: "dispersion-monte-carlo-v1";
  holeNumber: number;
  generatedFrom: "measured_bag_distributions";
  sampleCountPerAim: number;
  recommended: CourseTwinStrategyClub | null;
  saferAlternative: CourseTwinStrategyClub | null;
  clubs: CourseTwinStrategyClub[];
  disclosure: string;
};

const SURFACES: CourseTwinSurface[] = [
  "tee",
  "fairway",
  "green",
  "rough",
  "bunker",
  "water",
  "trees",
  "out_of_bounds",
];
const DEFAULT_SAMPLE_COUNT = 320;

export function buildCourseTwinStrategy({
  manifest,
  holeNumber,
  bag,
  sampleCount = DEFAULT_SAMPLE_COUNT,
}: {
  manifest: CourseTwinManifest;
  holeNumber: number;
  bag: CourseTwinBagProfile[];
  sampleCount?: number;
}): CourseTwinStrategyDocument {
  const hole = manifest.holes.find((candidate) => candidate.holeNumber === holeNumber);
  if (!hole) throw new Error(`Hole ${holeNumber} is unavailable in this Course Twin.`);
  const boundedSampleCount = Math.max(80, Math.min(1_000, Math.round(sampleCount)));
  const classify = createCourseTwinSurfaceClassifier(manifest, holeNumber);
  const clubs = bag
    .filter((profile) => profile.carryMedianYd > 0 && profile.sampleSize > 0)
    .map((profile) =>
      bestClubStrategy(manifest.course.id, hole, profile, classify, boundedSampleCount),
    )
    .sort(strategyScore);
  const recommended = clubs[0] ?? null;
  const saferAlternative = recommended
    ? ([...clubs]
        .filter((club) => club.clubId !== recommended.clubId)
        .sort(
          (left, right) =>
            hazardProbability(left) - hazardProbability(right) || strategyScore(left, right),
        )[0] ?? null)
    : null;

  return {
    modelVersion: "dispersion-monte-carlo-v1",
    holeNumber,
    generatedFrom: "measured_bag_distributions",
    sampleCountPerAim: boundedSampleCount,
    recommended,
    saferAlternative,
    clubs,
    disclosure:
      bag.length > 0 && bag.every((profile) => profile.evidenceWindow?.basis === "latest-reliable")
        ? "Landing clouds use the same latest reliable full-swing window as Bag, with at least five measured carry and side readings per club. Distribution widths include model minimums. Hazard probabilities remain estimates, not guarantees."
        : "Landing clouds use measured carry and dispersion from up to 50 trusted full shots per club in the latest 30 days. Hazard probabilities are modelled against mapped polygons and remain estimates, not guarantees.",
  };
}

function bestClubStrategy(
  courseId: string,
  hole: CourseTwinHole,
  profile: CourseTwinBagProfile,
  classify: (x: number, z: number) => CourseTwinSurface,
  sampleCount: number,
) {
  const aimRangeYd = Math.max(4, Math.min(30, profile.sideStdDevYd * 1.4));
  const aimOffsets = [-aimRangeYd, -aimRangeYd / 2, 0, aimRangeYd / 2, aimRangeYd];
  return aimOffsets
    .map((aimOffsetYd) =>
      simulateClubAim(courseId, hole, profile, classify, sampleCount, aimOffsetYd),
    )
    .sort(strategyScore)[0];
}

function simulateClubAim(
  courseId: string,
  hole: CourseTwinHole,
  profile: CourseTwinBagProfile,
  classify: (x: number, z: number) => CourseTwinSurface,
  sampleCount: number,
  aimOffsetYd: number,
): CourseTwinStrategyClub {
  const random = seededRandom(
    hashString(`${courseId}:${hole.holeNumber}:${profile.clubId}:${aimOffsetYd}`),
  );
  const counts = Object.fromEntries(SURFACES.map((surface) => [surface, 0])) as Record<
    CourseTwinSurface,
    number
  >;
  const landingCloud: CourseTwinPoint[] = [];
  let remainingTotalYd = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const carryYd = Math.max(2, profile.carryMedianYd + gaussian(random) * profile.carryStdDevYd);
    const sideYd = profile.sideMeanYd + aimOffsetYd + gaussian(random) * profile.sideStdDevYd;
    const base = pointAlongHole(hole, carryYd);
    const landing = offsetPerpendicular(hole, base, carryYd, sideYd * 0.9144);
    const surface = classify(landing[0], landing[2]);
    counts[surface] += 1;
    remainingTotalYd += distance2d(landing, hole.green) / 0.9144;
    if (landingCloud.length < 120) landingCloud.push(landing);
  }

  const probabilities = Object.fromEntries(
    SURFACES.map((surface) => [surface, round(counts[surface] / sampleCount, 4)]),
  ) as Record<CourseTwinSurface, number>;
  const averageRemainingYd = remainingTotalYd / sampleCount;
  const expectedRiskStrokes =
    probabilities.water * 2.25 +
    probabilities.out_of_bounds * 2.8 +
    probabilities.trees * 1.15 +
    probabilities.bunker * 0.62 +
    probabilities.rough * 0.12 +
    averageRemainingYd / 620 +
    Math.abs(profile.carryMedianYd - hole.yards) / 240;

  return {
    clubId: profile.clubId,
    clubType: profile.clubType,
    sampleSize: profile.sampleSize,
    confidenceScore: profile.confidenceScore,
    ...(profile.evidenceWindow ? { evidenceWindow: profile.evidenceWindow } : {}),
    carryMedianYd: profile.carryMedianYd,
    aimOffsetYd: round(aimOffsetYd, 1),
    landingCloud,
    probabilities,
    averageRemainingYd: round(averageRemainingYd, 1),
    expectedRiskStrokes: round(expectedRiskStrokes, 3),
    confidence:
      profile.sampleSize >= 15 && profile.confidenceScore >= 65
        ? "measured"
        : profile.sampleSize >= 6
          ? "developing"
          : "low_sample",
    shotModel: {
      carryMedianYd: profile.carryMedianYd,
      carryStdDevYd: profile.carryStdDevYd,
      totalMedianYd: profile.totalMedianYd,
      sideMeanYd: profile.sideMeanYd,
      sideStdDevYd: profile.sideStdDevYd,
      ballSpeedMeanMph: profile.ballSpeedMeanMph,
      ballSpeedStdDevMph: profile.ballSpeedStdDevMph,
      launchMeanDeg: profile.launchMeanDeg,
      launchStdDevDeg: profile.launchStdDevDeg,
      spinMeanRpm: profile.spinMeanRpm,
      spinStdDevRpm: profile.spinStdDevRpm,
      spinAxisMeanDeg: profile.spinAxisMeanDeg,
      spinAxisStdDevDeg: profile.spinAxisStdDevDeg,
    },
  };
}

function strategyScore(left: CourseTwinStrategyClub, right: CourseTwinStrategyClub) {
  return (
    left.expectedRiskStrokes - right.expectedRiskStrokes ||
    right.confidenceScore - left.confidenceScore ||
    left.averageRemainingYd - right.averageRemainingYd
  );
}

function hazardProbability(club: CourseTwinStrategyClub) {
  return (
    club.probabilities.water +
    club.probabilities.out_of_bounds +
    club.probabilities.trees +
    club.probabilities.bunker * 0.5
  );
}

function pointAlongHole(hole: CourseTwinHole, progressYd: number): CourseTwinPoint {
  const targetM = Math.max(0, progressYd) * 0.9144;
  let travelled = 0;
  for (let index = 1; index < hole.centerline.length; index += 1) {
    const start = hole.centerline[index - 1];
    const end = hole.centerline[index];
    const segment = distance2d(start, end);
    if (travelled + segment >= targetM) {
      const ratio = segment === 0 ? 0 : (targetM - travelled) / segment;
      return interpolate(start, end, ratio);
    }
    travelled += segment;
  }
  const previous = hole.centerline.at(-2) ?? hole.tee;
  const end = hole.centerline.at(-1) ?? hole.green;
  const direction = normalize2d(end[0] - previous[0], end[2] - previous[2]);
  const overshootM = Math.max(0, targetM - travelled);
  return [end[0] + direction.x * overshootM, end[1], end[2] + direction.z * overshootM];
}

function offsetPerpendicular(
  hole: CourseTwinHole,
  point: CourseTwinPoint,
  progressYd: number,
  sideM: number,
) {
  const near = pointAlongHole(hole, Math.max(0, progressYd - 1));
  const ahead = pointAlongHole(hole, progressYd + 1);
  const direction = normalize2d(ahead[0] - near[0], ahead[2] - near[2]);
  return [
    point[0] - direction.z * sideM,
    point[1],
    point[2] + direction.x * sideM,
  ] as CourseTwinPoint;
}

function interpolate(
  left: CourseTwinPoint,
  right: CourseTwinPoint,
  amount: number,
): CourseTwinPoint {
  return [
    left[0] + (right[0] - left[0]) * amount,
    left[1] + (right[1] - left[1]) * amount,
    left[2] + (right[2] - left[2]) * amount,
  ];
}

function distance2d(left: CourseTwinPoint, right: CourseTwinPoint) {
  return Math.hypot(right[0] - left[0], right[2] - left[2]);
}

function normalize2d(x: number, z: number) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function gaussian(random: () => number) {
  const first = Math.max(Number.EPSILON, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function round(value: number, decimalPlaces: number) {
  const scale = 10 ** decimalPlaces;
  return Math.round(value * scale) / scale;
}
