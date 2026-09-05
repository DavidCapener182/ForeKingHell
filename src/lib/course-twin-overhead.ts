import type { CourseTwinHole, CourseTwinPoint, CourseTwinReplayShot } from "./course-twin-contract";

/** Keep metres isotropic, with the reference tee below the green. */
export function overheadProjection(
  hole: CourseTwinHole,
  shots: CourseTwinReplayShot[],
  extraPoints: CourseTwinPoint[] = [],
) {
  const dx = hole.green[0] - hole.tee[0];
  const dz = hole.green[2] - hole.tee[2];
  const length = Math.hypot(dx, dz) || 1;
  const rotate = ([x, , z]: CourseTwinPoint): [number, number] => [
    ((x - hole.tee[0]) * dz - (z - hole.tee[2]) * dx) / length,
    -((x - hole.tee[0]) * dx + (z - hole.tee[2]) * dz) / length,
  ];
  const points = [
    hole.tee,
    hole.green,
    ...hole.centerline,
    ...extraPoints,
    ...shots.flatMap((s) => [s.start, s.carryEnd, s.totalEnd, ...s.trajectory]),
  ].map(rotate);
  const minX = Math.min(...points.map((p) => p[0])) - 25;
  const maxX = Math.max(...points.map((p) => p[0])) + 25;
  const minY = Math.min(...points.map((p) => p[1])) - 20;
  const maxY = Math.max(...points.map((p) => p[1])) + 20;
  const scale = Math.min(280 / (maxX - minX), 320 / (maxY - minY));
  return (point: CourseTwinPoint): [number, number] => {
    const [x, y] = rotate(point);
    return [
      round(160 + (x - (minX + maxX) / 2) * scale),
      round(180 + (y - (minY + maxY) / 2) * scale),
    ];
  };
}

/** Animate the existing reconstruction; do not infer new landing or strike results. */
export function overheadReplayPosition(shot: CourseTwinReplayShot, progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const hasRoll = shot.rollProvenance === "reconstructed";
  const flightEnd = hasRoll ? 0.8 : 1;
  if (hasRoll && t >= flightEnd)
    return interpolate(shot.carryEnd, shot.totalEnd, (t - flightEnd) / (1 - flightEnd));
  const path = shot.trajectory.length >= 2 ? shot.trajectory : [shot.start, shot.carryEnd];
  const cursor = (t / flightEnd) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(cursor));
  return interpolate(path[index], path[index + 1], cursor - index);
}

function interpolate(a: CourseTwinPoint, b: CourseTwinPoint, t: number): CourseTwinPoint {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function round(value: number) {
  return Number(value.toFixed(4));
}
