import {
  YARDS_TO_METERS,
  destinationPoint,
  forwardDistanceYd,
  pointAlongGeometry,
  EARTH_RADIUS_METERS,
} from "@/lib/geo/yard-projection";

export type RoundMapHole = {
  holeNumber: number;
  par: number;
  yards: number;
  score: number | null;
  putts: number | null;
  geometry: Array<[number, number]>;
};

export type RoundMapShot = {
  id: string;
  holeNumber: number | null;
  holeShotNumber: number | null;
  shotNumber: number | null;
  clubType: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  distanceRemainingYd: number | null;
  courseHoleYards: number | null;
};

export type ProjectedShot = {
  shot: RoundMapShot;
  start: [number, number];
  end: [number, number];
};

export type DistanceMode = "total" | "carry";

export function groupShotsByHole(shots: RoundMapShot[]) {
  const shotsByHole = new Map<number, RoundMapShot[]>();

  for (const shot of shots) {
    if (shot.holeNumber === null) {
      continue;
    }

    const holeShots = shotsByHole.get(shot.holeNumber) ?? [];
    holeShots.push(shot);
    shotsByHole.set(shot.holeNumber, holeShots);
  }

  for (const holeShots of shotsByHole.values()) {
    holeShots.sort(
      (left, right) =>
        (left.holeShotNumber ?? left.shotNumber ?? 0) -
        (right.holeShotNumber ?? right.shotNumber ?? 0),
    );
  }

  return shotsByHole;
}

export function projectHoleShots(
  hole: RoundMapHole,
  shots: RoundMapShot[],
  distanceMode: DistanceMode = "total",
) {
  const projectedShots: ProjectedShot[] = [];
  let previousEnd = hole.geometry[0];
  let fallbackProgressYd = 0;

  for (const shot of shots) {
    const holeYards = shot.courseHoleYards ?? hole.yards;
    const distanceYd = shotDistanceForMode(shot, distanceMode);
    const shotForwardYd = forwardDistanceYd(distanceYd, shot.sideCarryYd);
    fallbackProgressYd += shotForwardYd ?? 0;
    const progressYd =
      distanceMode === "carry" || shot.distanceRemainingYd === null
        ? fallbackProgressYd
        : Math.max(0, holeYards - shot.distanceRemainingYd);
    const projected = pointAlongGeometry(hole.geometry, Math.min(1, progressYd / holeYards));
    const sideYd = shot.sideCarryYd ?? 0;
    const sideBearing = projected.bearingDeg + (sideYd >= 0 ? 90 : -90);
    const end = destinationPoint(projected.point, sideBearing, Math.abs(sideYd) * YARDS_TO_METERS);

    projectedShots.push({
      shot,
      start: previousEnd,
      end,
    });
    previousEnd = end;
  }

  return projectedShots;
}

export function shotDistanceForMode(shot: RoundMapShot, distanceMode: DistanceMode) {
  return distanceMode === "carry" ? (shot.carryYd ?? shot.totalYd) : (shot.totalYd ?? shot.carryYd);
}

/** The map can fall back to the other recorded distance; label the value actually used. */
export function roundMapDistanceReading(shot: RoundMapShot, mode: DistanceMode) {
  const preferred = mode === "carry" ? shot.carryYd : shot.totalYd;
  const fallback = mode === "carry" ? shot.totalYd : shot.carryYd;
  return preferred != null && Number.isFinite(preferred)
    ? { value: preferred, label: mode, fallback: false }
    : {
        value: fallback != null && Number.isFinite(fallback) ? fallback : null,
        label: mode === "carry" ? "total" : "carry",
        fallback: true,
      };
}

/** A metre-preserving view of supplied centre-line geometry, not invented fairway boundaries. */
export function roundMapViewport(hole: RoundMapHole, projected: ProjectedShot[]) {
  const origin = hole.geometry[0] ?? [0, 0];
  const radians = Math.PI / 180;
  const local = ([lat, lng]: [number, number]): [number, number] => [
    (lng - origin[1]) * radians * EARTH_RADIUS_METERS * Math.cos(origin[0] * radians),
    (lat - origin[0]) * radians * EARTH_RADIUS_METERS,
  ];
  const green = local(hole.geometry.at(-1) ?? origin);
  const length = Math.hypot(...green) || 1;
  const rotate = (point: [number, number]): [number, number] => {
    const [east, north] = local(point);
    return [
      (east * green[1] - north * green[0]) / length,
      -(east * green[0] + north * green[1]) / length,
    ];
  };
  const points = [...hole.geometry, ...projected.flatMap((p) => [p.start, p.end])].map(rotate);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(0, ...xs) - 20;
  const maxX = Math.max(0, ...xs) + 20;
  const minY = Math.min(0, ...ys) - 20;
  const maxY = Math.max(0, ...ys) + 20;
  const scale = Math.min(280 / (maxX - minX), 300 / (maxY - minY));
  return (point: [number, number]): [number, number] => {
    const [x, y] = rotate(point);
    // SVG pixels only: normalize engine-level trig rounding for identical SSR/WebKit markup.
    return [
      Number((160 + (x - (minX + maxX) / 2) * scale).toFixed(3)),
      Number((170 + (y - (minY + maxY) / 2) * scale).toFixed(3)),
    ];
  };
}
