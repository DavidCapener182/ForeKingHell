import type {
  CourseTwinEvidenceValue,
  CourseTwinHole,
  CourseTwinPoint,
  CourseTwinReplayShot,
} from "@/lib/course-twin-contract";
import type { CourseTwinStrategyClub } from "@/lib/course-twin-strategy";

export type CourseTwinVirtualShot = {
  shot: CourseTwinReplayShot;
  sampled: {
    carryYd: number;
    totalYd: number;
    sideYd: number;
    aimOffsetYd: number;
    ballSpeedMph: number | null;
    launchAngleDeg: number;
    spinRateRpm: number | null;
    spinAxisDeg: number;
    shapeBias: "straight-weighted";
    shapeSource: "measured-spin-axis" | "inferred-from-dispersion";
  };
  provenance: "sampled-from-measured-bag";
};

export function buildCourseTwinVirtualShot({
  courseId,
  hole,
  start,
  club,
  aimOffsetYd,
  shotNumber,
}: {
  courseId: string;
  hole: CourseTwinHole;
  start: CourseTwinPoint;
  club: CourseTwinStrategyClub;
  aimOffsetYd: number;
  shotNumber: number;
}): CourseTwinVirtualShot {
  const random = seededRandom(
    hashString(`${courseId}:${hole.holeNumber}:${club.clubId}:${shotNumber}:${aimOffsetYd}`),
  );
  const carryYd = clamp(
    club.shotModel.carryMedianYd + gaussian(random) * club.shotModel.carryStdDevYd,
    2,
    360,
  );
  const sideYd = clamp(
    club.shotModel.sideMeanYd + aimOffsetYd + gaussian(random) * club.shotModel.sideStdDevYd,
    -90,
    90,
  );
  const medianRollYd = Math.max(
    0,
    (club.shotModel.totalMedianYd ?? club.shotModel.carryMedianYd) - club.shotModel.carryMedianYd,
  );
  const totalYd = clamp(carryYd + medianRollYd, carryYd, 390);
  const direction = directionToTarget(start, hole.green);
  const carryEnd = shotEnd(start, direction, carryYd, sideYd);
  const totalEnd = shotEnd(start, direction, totalYd, sideYd);
  const ballSpeedMph = sampleOptional(
    random,
    club.shotModel.ballSpeedMeanMph,
    club.shotModel.ballSpeedStdDevMph,
    8,
    240,
  );
  const launchAngleDeg =
    sampleOptional(
      random,
      club.shotModel.launchMeanDeg ?? fallbackLaunchAngle(club.clubType),
      club.shotModel.launchStdDevDeg,
      1,
      55,
    ) ?? fallbackLaunchAngle(club.clubType);
  const spinRateRpm = sampleOptional(
    random,
    club.shotModel.spinMeanRpm,
    club.shotModel.spinStdDevRpm,
    100,
    12_000,
  );
  const sampledSpinAxis = sampleSpinAxis(random, club);
  const spinAxisDeg = sampledSpinAxis.value;

  return {
    shot: {
      id: `virtual-${hole.holeNumber}-${shotNumber}-${club.clubId}`,
      holeNumber: hole.holeNumber,
      holeShotNumber: shotNumber,
      clubType: club.clubType,
      start,
      carryEnd,
      totalEnd,
      trajectory: [],
      metrics: {
        carryYd: derivedEvidence(carryYd),
        totalYd: derivedEvidence(totalYd),
        sideCarryYd: derivedEvidence(sideYd),
        apexFt: derivedEvidence(clamp(carryYd * 0.45, 3, 120)),
        ballSpeedMph: derivedEvidence(ballSpeedMph),
        launchAngleDeg: derivedEvidence(launchAngleDeg),
        spinRate: derivedEvidence(spinRateRpm),
        spinAxis: derivedEvidence(spinAxisDeg),
      },
      placementProvenance: "derived",
      trajectoryProvenance: "reconstructed",
      rollProvenance: medianRollYd > 0 ? "reconstructed" : "unavailable",
    },
    sampled: {
      carryYd,
      totalYd,
      sideYd,
      aimOffsetYd,
      ballSpeedMph,
      launchAngleDeg,
      spinRateRpm,
      spinAxisDeg,
      shapeBias: "straight-weighted",
      shapeSource: sampledSpinAxis.source,
    },
    provenance: "sampled-from-measured-bag",
  };
}

function sampleSpinAxis(random: () => number, club: CourseTwinStrategyClub) {
  const source =
    club.shotModel.spinAxisMeanDeg !== null
      ? ("measured-spin-axis" as const)
      : ("inferred-from-dispersion" as const);
  if (club.clubType.toLowerCase().includes("putter")) return { value: 0, source };
  const carry = Math.max(40, club.shotModel.carryMedianYd);
  const inferredMean = clamp((-club.shotModel.sideMeanYd / carry) * 60, -10, 10);
  const inferredSpread = clamp((club.shotModel.sideStdDevYd / carry) * 70, 1.5, 8);
  const mean = club.shotModel.spinAxisMeanDeg ?? inferredMean;
  const spread = Math.max(0.5, club.shotModel.spinAxisStdDevDeg ?? inferredSpread);
  const centralShape = random() < 0.8;
  const historicalSample = gaussian(random);
  const sampled = centralShape
    ? mean * 0.65 + historicalSample * spread * 0.45
    : mean + historicalSample * spread * 0.9;
  const bounded = clamp(sampled, -18, 18);
  if (Math.abs(bounded) >= 1.25) return { value: bounded, source };
  const direction = Math.sign(bounded || mean || inferredMean || (random() < 0.5 ? -1 : 1));
  return { value: direction * 1.25, source };
}

function directionToTarget(start: CourseTwinPoint, target: CourseTwinPoint) {
  const x = target[0] - start[0];
  const z = target[2] - start[2];
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function shotEnd(
  start: CourseTwinPoint,
  direction: { x: number; z: number },
  distanceYd: number,
  sideYd: number,
): CourseTwinPoint {
  const distanceM = distanceYd * 0.9144;
  const sideM = sideYd * 0.9144;
  return [
    start[0] + direction.x * distanceM - direction.z * sideM,
    0,
    start[2] + direction.z * distanceM + direction.x * sideM,
  ];
}

function sampleOptional(
  random: () => number,
  mean: number | null,
  standardDeviation: number | null,
  minimum: number,
  maximum: number,
) {
  if (mean === null) return null;
  return clamp(mean + gaussian(random) * (standardDeviation ?? 0), minimum, maximum);
}

function derivedEvidence(value: number | null): CourseTwinEvidenceValue {
  return { value, provenance: value === null ? "unavailable" : "derived" };
}

function fallbackLaunchAngle(clubType: string) {
  const club = clubType.toLowerCase();
  if (club.includes("driver")) return 12;
  if (club.includes("wood") || club.includes("hybrid")) return 14;
  if (club.includes("wedge") || club.includes("sw") || club.includes("pw")) return 28;
  if (club.includes("putter")) return 2;
  return 18;
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
