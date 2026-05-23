import {
  YARDS_TO_METERS,
  destinationPoint,
  pointAlongGeometry,
  type LatLngPoint,
} from "@/lib/geo/yard-projection";
import type { ShotPatternPoint, ShotPatternResult } from "@/lib/shot-patterns";

export type ProjectShotPatternPointInput = {
  holeGeometry: LatLngPoint[];
  holeYards: number;
  point: ShotPatternPoint;
  aimStartRatio?: number;
  aimTargetRatio?: number;
  aimOffsetYd?: number;
};

export type ProjectedShotPatternPoint = ShotPatternPoint & {
  latLng: LatLngPoint;
};

export type ProjectedShotPatternSummary = {
  medianLatLng: LatLngPoint | null;
  includedBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
};

export type ProjectedShotPatternResult = {
  points: ProjectedShotPatternPoint[];
  summary: ProjectedShotPatternSummary;
};

export function projectShotPatternPoint({
  holeGeometry,
  holeYards,
  point,
  aimStartRatio = 0,
  aimOffsetYd = 0,
}: ProjectShotPatternPointInput): ProjectedShotPatternPoint | null {
  if (holeGeometry.length < 2 || holeYards <= 0 || !Number.isFinite(holeYards)) {
    return null;
  }

  const forwardRatio = aimStartRatio + point.forwardYd / holeYards;
  const projected = pointAlongGeometry(holeGeometry, Math.min(1.25, Math.max(0, forwardRatio)));
  const projectedSideYd = point.sideYd + aimOffsetYd;
  const sideBearing = projected.bearingDeg + (projectedSideYd >= 0 ? 90 : -90);
  const latLng = destinationPoint(
    projected.point,
    sideBearing,
    Math.abs(projectedSideYd) * YARDS_TO_METERS,
  );

  return {
    ...point,
    latLng,
  };
}

export function projectShotPatternOntoHole({
  holeGeometry,
  holeYards,
  pattern,
  aimOffsetYd = 0,
}: {
  holeGeometry: LatLngPoint[];
  holeYards: number;
  pattern: ShotPatternResult;
  aimOffsetYd?: number;
}): ProjectedShotPatternResult {
  const points = pattern.points
    .map((point) => projectShotPatternPoint({ holeGeometry, holeYards, point, aimOffsetYd }))
    .filter((point): point is ProjectedShotPatternPoint => point !== null);
  const includedPoints = points.filter((point) => point.included);

  return {
    points,
    summary: {
      medianLatLng: projectedMedianLatLng(includedPoints),
      includedBounds: projectedBounds(includedPoints),
    },
  };
}

function projectedMedianLatLng(points: ProjectedShotPatternPoint[]) {
  if (points.length === 0) {
    return null;
  }

  return [
    median(points.map((point) => point.latLng[0])),
    median(points.map((point) => point.latLng[1])),
  ] as LatLngPoint;
}

function projectedBounds(points: ProjectedShotPatternPoint[]) {
  if (points.length === 0) {
    return null;
  }

  const lats = points.map((point) => point.latLng[0]);
  const lngs = points.map((point) => point.latLng[1]);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}
