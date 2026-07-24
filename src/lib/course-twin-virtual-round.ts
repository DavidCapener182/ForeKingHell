import type {
  CourseTwinEvidenceValue,
  CourseTwinHole,
  CourseTwinPoint,
  CourseTwinReplayShot,
} from "@/lib/course-twin-contract";
import type { CourseTwinSurface } from "@/lib/course-twin-surface";
import type { CourseTwinStrategyClub } from "@/lib/course-twin-strategy";

export type CourseTwinVirtualShotKind = "full" | "half" | "chip" | "pitch" | "bunker-splash";

export type CourseTwinVirtualShot = {
  shot: CourseTwinReplayShot;
  sampled: {
    carryYd: number;
    totalYd: number;
    sideYd: number;
    aimOffsetYd: number;
    aimDirectionDeg: number;
    ballSpeedMph: number | null;
    launchAngleDeg: number;
    spinRateRpm: number | null;
    spinAxisDeg: number;
    shapeBias: "straight-weighted";
    shapeSource: "measured-spin-axis" | "inferred-from-dispersion";
    shotKind: CourseTwinVirtualShotKind;
    lieSurface: CourseTwinSurface;
    landingSurface: CourseTwinSurface | null;
  };
  provenance: "sampled-from-measured-bag";
};

export function courseTwinVirtualShotKind(
  remainingYd: number,
  lieSurface: CourseTwinSurface,
): CourseTwinVirtualShotKind {
  if (
    remainingYd > 100 ||
    lieSurface === "green" ||
    lieSurface === "water" ||
    lieSurface === "out_of_bounds"
  ) {
    return "full";
  }
  if (lieSurface === "bunker" && remainingYd <= 60) return "bunker-splash";
  if (remainingYd <= 30) return "chip";
  if (remainingYd <= 60) return "pitch";
  return "half";
}

export function courseTwinVirtualShotKindOptions(
  remainingYd: number,
  lieSurface: CourseTwinSurface,
): CourseTwinVirtualShotKind[] {
  if (
    remainingYd > 100 ||
    lieSurface === "green" ||
    lieSurface === "water" ||
    lieSurface === "out_of_bounds"
  ) {
    return ["full"];
  }
  if (lieSurface === "bunker" && remainingYd <= 60) {
    return ["bunker-splash", "pitch", "half"];
  }
  if (remainingYd <= 30) return ["chip", "pitch", "half"];
  if (remainingYd <= 60) return ["pitch", "half", "full"];
  return ["half", "full"];
}

export function courseTwinVirtualClubOptions(clubs: CourseTwinStrategyClub[], remainingYd: number) {
  if (remainingYd > 100) return clubs;
  const scoringClubs = clubs
    .filter((club) => isScoringClub(club.clubType))
    .sort((left, right) => left.shotModel.carryMedianYd - right.shotModel.carryMedianYd);
  if (scoringClubs.length > 0) return scoringClubs;
  return [...clubs]
    .sort((left, right) => left.shotModel.carryMedianYd - right.shotModel.carryMedianYd)
    .slice(0, Math.min(2, clubs.length));
}

export function buildCourseTwinVirtualShot({
  courseId,
  hole,
  start,
  club,
  aimOffsetYd,
  aimDirectionDeg = 0,
  shotNumber,
  lieSurface = "fairway",
  surfaceAt,
  requestedShotKind,
}: {
  courseId: string;
  hole: CourseTwinHole;
  start: CourseTwinPoint;
  club: CourseTwinStrategyClub;
  aimOffsetYd: number;
  aimDirectionDeg?: number;
  shotNumber: number;
  lieSurface?: CourseTwinSurface;
  surfaceAt?: (x: number, z: number) => CourseTwinSurface;
  requestedShotKind?: CourseTwinVirtualShotKind;
}): CourseTwinVirtualShot {
  const remainingYd = horizontalDistanceYd(start, hole.green);
  const shotKindOptions = courseTwinVirtualShotKindOptions(remainingYd, lieSurface);
  const shotKind =
    requestedShotKind && shotKindOptions.includes(requestedShotKind)
      ? requestedShotKind
      : courseTwinVirtualShotKind(remainingYd, lieSurface);
  const effectiveAimOffsetYd =
    shotKind === "full"
      ? aimOffsetYd
      : shotKind === "half"
        ? clamp(aimOffsetYd, -8, 8)
        : clamp(aimOffsetYd, -4, 4);
  const effectiveAimDirectionDeg = clamp(
    aimDirectionDeg,
    -courseTwinAimLimitDeg(shotKind),
    courseTwinAimLimitDeg(shotKind),
  );
  const random = seededRandom(
    hashString(
      shotKind === "full"
        ? `${courseId}:${hole.holeNumber}:${club.clubId}:${shotNumber}`
        : `${courseId}:${hole.holeNumber}:${club.clubId}:${shotNumber}:${lieSurface}`,
    ),
  );
  const direction = courseTwinAimDirection(start, hole.green, effectiveAimDirectionDeg);
  let shortGame: ReturnType<typeof sampleShortGameShot> | null = null;
  let sampledSpinAxis: ReturnType<typeof sampleSpinAxis>;
  let carryYd: number;
  let sideYd: number;
  let fullShotTotalYd = 0;
  let ballSpeedMph: number | null;
  let launchAngleDeg: number;
  let spinRateRpm: number | null;
  let spinAxisDeg: number;
  let apexFt: number;

  if (shotKind === "full") {
    carryYd = clamp(
      club.shotModel.carryMedianYd + gaussian(random) * club.shotModel.carryStdDevYd,
      2,
      360,
    );
    sideYd = clamp(
      club.shotModel.sideMeanYd +
        effectiveAimOffsetYd +
        gaussian(random) * club.shotModel.sideStdDevYd,
      -90,
      90,
    );
    const fullShotRollYd = Math.max(
      0,
      (club.shotModel.totalMedianYd ?? club.shotModel.carryMedianYd) - club.shotModel.carryMedianYd,
    );
    fullShotTotalYd = clamp(carryYd + fullShotRollYd, carryYd, 390);
    ballSpeedMph = sampleOptional(
      random,
      club.shotModel.ballSpeedMeanMph,
      club.shotModel.ballSpeedStdDevMph,
      8,
      240,
    );
    launchAngleDeg =
      sampleOptional(
        random,
        club.shotModel.launchMeanDeg ?? fallbackLaunchAngle(club.clubType),
        club.shotModel.launchStdDevDeg,
        1,
        55,
      ) ?? fallbackLaunchAngle(club.clubType);
    spinRateRpm = sampleOptional(
      random,
      club.shotModel.spinMeanRpm,
      club.shotModel.spinStdDevRpm,
      100,
      12_000,
    );
    sampledSpinAxis = sampleSpinAxis(random, club);
    spinAxisDeg = sampledSpinAxis.value;
    apexFt = clamp(carryYd * 0.45, 3, 120);
  } else {
    sampledSpinAxis = sampleSpinAxis(random, club);
    shortGame = sampleShortGameShot({
      remainingYd,
      lieSurface,
      shotKind,
      club,
      aimOffsetYd: effectiveAimOffsetYd,
      sampledSpinAxisDeg: sampledSpinAxis.value,
      random,
    });
    carryYd = shortGame.carryYd;
    sideYd = shortGame.sideYd;
    ballSpeedMph = shortGame.ballSpeedMph;
    launchAngleDeg = shortGame.launchAngleDeg;
    spinRateRpm = shortGame.spinRateRpm;
    spinAxisDeg = shortGame.spinAxisDeg;
    apexFt = shortGame.apexFt;
  }

  const carryEnd = shotEnd(start, direction, carryYd, sideYd);
  const carryDirection = directionToTarget(start, carryEnd);
  const launchDirectionDeg = signedDirectionAngleDeg(carryDirection, direction);
  const landingSurface = surfaceAt?.(carryEnd[0], carryEnd[2]) ?? null;
  const totalYd = shortGame
    ? shortGameTotalYd(shortGame, landingSurface ?? "green")
    : fullShotTotalYd;
  const totalEnd = shotEnd(start, direction, totalYd, sideYd);

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
        apexFt: derivedEvidence(apexFt),
        ballSpeedMph: derivedEvidence(ballSpeedMph),
        launchAngleDeg: derivedEvidence(launchAngleDeg),
        launchDirectionDeg: derivedEvidence(launchDirectionDeg),
        spinRate: derivedEvidence(spinRateRpm),
        spinAxis: derivedEvidence(spinAxisDeg),
      },
      placementProvenance: "derived",
      trajectoryProvenance: "reconstructed",
      rollProvenance: totalYd > carryYd ? "reconstructed" : "unavailable",
    },
    sampled: {
      carryYd,
      totalYd,
      sideYd,
      aimOffsetYd: effectiveAimOffsetYd,
      aimDirectionDeg: effectiveAimDirectionDeg,
      ballSpeedMph,
      launchAngleDeg,
      spinRateRpm,
      spinAxisDeg,
      shapeBias: "straight-weighted",
      shapeSource: sampledSpinAxis.source,
      shotKind,
      lieSurface,
      landingSurface,
    },
    provenance: "sampled-from-measured-bag",
  };
}

export function courseTwinAimLimitDeg(shotKind: CourseTwinVirtualShotKind) {
  if (shotKind === "full") return 35;
  if (shotKind === "half") return 28;
  return 20;
}

export function courseTwinAimDirection(
  start: CourseTwinPoint,
  target: CourseTwinPoint,
  aimDirectionDeg: number,
) {
  const direction = directionToTarget(start, target);
  const radians = (aimDirectionDeg * Math.PI) / 180;
  return {
    x: direction.x * Math.cos(radians) - direction.z * Math.sin(radians),
    z: direction.x * Math.sin(radians) + direction.z * Math.cos(radians),
  };
}

export function courseTwinAimDirectionDegToPoint(
  start: CourseTwinPoint,
  target: CourseTwinPoint,
  aimPoint: CourseTwinPoint,
  shotKind: CourseTwinVirtualShotKind,
) {
  const targetDirection = directionToTarget(start, target);
  const aimDirection = directionToTarget(start, aimPoint);
  return clamp(
    signedDirectionAngleDeg(targetDirection, aimDirection),
    -courseTwinAimLimitDeg(shotKind),
    courseTwinAimLimitDeg(shotKind),
  );
}

function sampleShortGameShot({
  remainingYd,
  lieSurface,
  shotKind,
  club,
  aimOffsetYd,
  sampledSpinAxisDeg,
  random,
}: {
  remainingYd: number;
  lieSurface: CourseTwinSurface;
  shotKind: Exclude<CourseTwinVirtualShotKind, "full">;
  club: CourseTwinStrategyClub;
  aimOffsetYd: number;
  sampledSpinAxisDeg: number;
  random: () => number;
}) {
  const strikeVariation =
    lieSurface === "bunker"
      ? 0.09
      : lieSurface === "rough" || lieSurface === "trees"
        ? 0.07
        : 0.045;
  const idealTotalYd = clamp(
    remainingYd * (1 + gaussian(random) * strikeVariation),
    remainingYd * 0.72,
    remainingYd * 1.18,
  );
  const carryRatio =
    shotKind === "bunker-splash"
      ? 0.86
      : shotKind === "half"
        ? lieSurface === "rough" || lieSurface === "trees"
          ? 0.88
          : 0.92
        : shotKind === "pitch"
          ? lieSurface === "rough" || lieSurface === "trees"
            ? 0.8
            : 0.74
          : lieSurface === "rough" || lieSurface === "trees"
            ? 0.6
            : 0.48;
  const carryYd = clamp(idealTotalYd * carryRatio, 2, idealTotalYd);
  const dispersionScale = clamp(
    remainingYd / Math.max(1, club.shotModel.carryMedianYd),
    0.05,
    0.55,
  );
  const sideSpreadYd = Math.max(0.55, club.shotModel.sideStdDevYd * dispersionScale * 0.55);
  const sideLimitYd = Math.max(2, Math.min(10, remainingYd * 0.32));
  const sideYd = clamp(
    club.shotModel.sideMeanYd * dispersionScale + aimOffsetYd + gaussian(random) * sideSpreadYd,
    -sideLimitYd,
    sideLimitYd,
  );
  const launchAngleDeg =
    shotKind === "bunker-splash"
      ? clamp(48 + gaussian(random) * 3, 40, 56)
      : shotKind === "half"
        ? clamp(30 + gaussian(random) * 2.5, 23, 38)
        : shotKind === "pitch"
          ? clamp(34 + gaussian(random) * 2.5, 27, 42)
          : clamp(21 + gaussian(random) * 2, 15, 28);
  const ballSpeedMph = clamp(
    8 +
      carryYd *
        (shotKind === "half"
          ? 0.82
          : shotKind === "chip"
            ? 1.15
            : shotKind === "pitch"
              ? 1.42
              : 1.55),
    10,
    shotKind === "half" ? 92 : 68,
  );
  const spinRateRpm =
    shotKind === "bunker-splash"
      ? clamp(7_200 + gaussian(random) * 550, 5_500, 9_000)
      : shotKind === "half"
        ? clamp(6_300 + gaussian(random) * 550, 4_500, 8_500)
        : shotKind === "pitch"
          ? clamp(5_600 + gaussian(random) * 500, 4_000, 7_500)
          : clamp(3_200 + gaussian(random) * 420, 2_000, 5_000);
  const apexFt =
    shotKind === "bunker-splash"
      ? clamp(carryYd * 0.9, 7, 32)
      : shotKind === "half"
        ? clamp(carryYd * 0.55, 14, 48)
        : shotKind === "pitch"
          ? clamp(carryYd * 0.65, 6, 28)
          : clamp(carryYd * 0.34, 2.5, 11);

  return {
    carryYd,
    idealTotalYd,
    sideYd,
    ballSpeedMph,
    launchAngleDeg,
    spinRateRpm,
    spinAxisDeg: clamp(sampledSpinAxisDeg * (shotKind === "half" ? 0.48 : 0.32), -8, 8),
    apexFt,
  };
}

function shortGameTotalYd(
  sample: ReturnType<typeof sampleShortGameShot>,
  landingSurface: CourseTwinSurface,
) {
  const rolloutRetention: Record<CourseTwinSurface, number> = {
    green: 1,
    fairway: 0.86,
    tee: 0.8,
    rough: 0.36,
    trees: 0.24,
    bunker: 0.08,
    water: 0,
    out_of_bounds: 0,
  };
  return sample.carryYd + (sample.idealTotalYd - sample.carryYd) * rolloutRetention[landingSurface];
}

function horizontalDistanceYd(start: CourseTwinPoint, target: CourseTwinPoint) {
  return Math.hypot(target[0] - start[0], target[2] - start[2]) / 0.9144;
}

function isScoringClub(clubType: string) {
  const club = clubType.toLowerCase().replaceAll(/[\s_-]/g, "");
  return (
    club.includes("wedge") ||
    club.includes("pitching") ||
    club.includes("gap") ||
    club.includes("sand") ||
    club.includes("lob") ||
    ["pw", "gw", "aw", "sw", "lw"].includes(club)
  );
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

function signedDirectionAngleDeg(from: { x: number; z: number }, to: { x: number; z: number }) {
  return (Math.atan2(from.x * to.z - from.z * to.x, from.x * to.x + from.z * to.z) * 180) / Math.PI;
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
