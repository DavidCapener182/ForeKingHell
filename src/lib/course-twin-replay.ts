import {
  COURSE_TWIN_REPLAY_MODEL_VERSION,
  type CourseTwinEvidenceValue,
  type CourseTwinHole,
  type CourseTwinManifest,
  type CourseTwinPoint,
  type CourseTwinReplayDocument,
  type CourseTwinReplayShot,
} from "@/lib/course-twin-contract";

export type CourseTwinReplaySourceShot = {
  id: string;
  courseHoleNumber: number | null;
  courseHoleShotNumber: number | null;
  shotNumber: number | null;
  clubType: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  apexFt: number | null;
  ballSpeedMph: number | null;
  launchAngleDeg: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  distanceRemainingYd: number | null;
  courseHoleYards: number | null;
};

export function buildCourseTwinReplay({
  manifest,
  session,
  shots,
}: {
  manifest: CourseTwinManifest;
  session: { id: string; title: string; date: Date; source: string };
  shots: CourseTwinReplaySourceShot[];
}): CourseTwinReplayDocument {
  const holesByNumber = new Map(manifest.holes.map((hole) => [hole.holeNumber, hole]));
  const progressByHole = new Map<number, number>();
  const endByHole = new Map<number, CourseTwinPoint>();
  const replayShots: CourseTwinReplayShot[] = [];

  for (const source of shots) {
    if (!source.courseHoleNumber) continue;
    const hole = holesByNumber.get(source.courseHoleNumber);
    if (!hole) continue;

    const carryYd = finiteOrNull(source.carryYd);
    const totalYd = finiteOrNull(source.totalYd) ?? carryYd;
    if (carryYd === null && totalYd === null) continue;

    const holeYards = positiveOr(source.courseHoleYards, hole.yards);
    const previousProgress = progressByHole.get(hole.holeNumber) ?? 0;
    const measuredProgress =
      source.distanceRemainingYd !== null && Number.isFinite(source.distanceRemainingYd)
        ? Math.max(previousProgress, holeYards - source.distanceRemainingYd)
        : null;
    const totalProgress = clamp(
      measuredProgress ?? previousProgress + (totalYd ?? carryYd ?? 0),
      0,
      holeYards,
    );
    const carryProgress = clamp(previousProgress + (carryYd ?? totalYd ?? 0), 0, totalProgress);
    const previousBase = pointAlongCenterline(hole, previousProgress);
    const start = endByHole.get(hole.holeNumber) ?? previousBase;
    const carryBase = pointAlongCenterline(hole, carryProgress);
    const totalBase = pointAlongCenterline(hole, totalProgress);
    const sideYd = finiteOrNull(source.sideCarryYd) ?? 0;
    const carryLane = translateWithCenterline(start, previousBase, carryBase);
    const totalLane = translateWithCenterline(start, previousBase, totalBase);
    const carryEnd = offsetPerpendicular(hole, carryLane, carryProgress, sideYd * 0.9144);
    const totalEnd = offsetPerpendicular(hole, totalLane, totalProgress, sideYd * 0.9144);
    const apexFt = finiteOrNull(source.apexFt);
    const reconstructedApexM =
      apexFt !== null
        ? apexFt * 0.3048
        : Math.max(8, Math.min(42, (carryYd ?? totalYd ?? 100) * 0.075));

    replayShots.push({
      id: source.id,
      holeNumber: hole.holeNumber,
      holeShotNumber: source.courseHoleShotNumber ?? source.shotNumber,
      clubType: source.clubType,
      start,
      carryEnd,
      totalEnd,
      trajectory: reconstructedTrajectory(start, carryEnd, reconstructedApexM),
      metrics: {
        carryYd: evidence(carryYd),
        totalYd: evidence(finiteOrNull(source.totalYd)),
        sideCarryYd: evidence(finiteOrNull(source.sideCarryYd)),
        apexFt: evidence(apexFt),
        ballSpeedMph: evidence(finiteOrNull(source.ballSpeedMph)),
        launchAngleDeg: evidence(finiteOrNull(source.launchAngleDeg)),
        spinRate: evidence(finiteOrNull(source.spinRate)),
        spinAxis: evidence(finiteOrNull(source.spinAxis)),
      },
      placementProvenance: "derived",
      trajectoryProvenance: "reconstructed",
      rollProvenance:
        source.totalYd !== null && carryYd !== null && source.totalYd > carryYd
          ? "reconstructed"
          : "unavailable",
    });

    progressByHole.set(hole.holeNumber, totalProgress);
    endByHole.set(hole.holeNumber, totalEnd);
  }

  return {
    modelVersion: COURSE_TWIN_REPLAY_MODEL_VERSION,
    session: {
      id: session.id,
      title: session.title,
      date: session.date.toISOString(),
      source: session.source,
    },
    disclosure:
      "Distances and launch-monitor metrics are measured where available. Course placement is derived from mapped hole geometry; the animated flight and roll are reconstructed estimates.",
    shots: replayShots,
  };
}

function evidence(value: number | null): CourseTwinEvidenceValue {
  return { value, provenance: value === null ? "unavailable" : "measured" };
}

function pointAlongCenterline(hole: CourseTwinHole, progressYd: number): CourseTwinPoint {
  if (hole.centerline.length < 2) return hole.tee;
  const targetM = clamp(progressYd / Math.max(1, hole.yards), 0, 1) * lineLength(hole.centerline);
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

  return hole.green;
}

function offsetPerpendicular(
  hole: CourseTwinHole,
  point: CourseTwinPoint,
  progressYd: number,
  sideM: number,
): CourseTwinPoint {
  if (sideM === 0 || hole.centerline.length < 2) return point;
  const ratio = clamp(progressYd / Math.max(1, hole.yards), 0, 0.999);
  const near = pointAlongCenterline(hole, ratio * hole.yards);
  const ahead = pointAlongCenterline(hole, Math.min(hole.yards, ratio * hole.yards + 2));
  const dx = ahead[0] - near[0];
  const dz = ahead[2] - near[2];
  const length = Math.hypot(dx, dz) || 1;
  return [point[0] + (-dz / length) * sideM, point[1], point[2] + (dx / length) * sideM];
}

function translateWithCenterline(
  shotStart: CourseTwinPoint,
  previousBase: CourseTwinPoint,
  targetBase: CourseTwinPoint,
): CourseTwinPoint {
  return [
    shotStart[0] + targetBase[0] - previousBase[0],
    shotStart[1] + targetBase[1] - previousBase[1],
    shotStart[2] + targetBase[2] - previousBase[2],
  ];
}

function reconstructedTrajectory(
  start: CourseTwinPoint,
  end: CourseTwinPoint,
  apexM: number,
): CourseTwinPoint[] {
  return Array.from({ length: 25 }, (_, index) => {
    const ratio = index / 24;
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio + 4 * apexM * ratio * (1 - ratio),
      start[2] + (end[2] - start[2]) * ratio,
    ];
  });
}

function lineLength(points: CourseTwinPoint[]) {
  return points
    .slice(1)
    .reduce((total, point, index) => total + distance2d(points[index], point), 0);
}

function distance2d(left: CourseTwinPoint, right: CourseTwinPoint) {
  return Math.hypot(right[0] - left[0], right[2] - left[2]);
}

function interpolate(
  left: CourseTwinPoint,
  right: CourseTwinPoint,
  ratio: number,
): CourseTwinPoint {
  return [
    left[0] + (right[0] - left[0]) * ratio,
    left[1] + (right[1] - left[1]) * ratio,
    left[2] + (right[2] - left[2]) * ratio,
  ];
}

function finiteOrNull(value: number | null) {
  return value !== null && Number.isFinite(value) ? value : null;
}

function positiveOr(value: number | null, fallback: number) {
  return value !== null && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
