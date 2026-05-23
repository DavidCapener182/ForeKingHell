import {
  YARDS_TO_METERS,
  destinationPoint,
  distanceMeters,
  pointAlongGeometry,
  type LatLngPoint,
} from "@/lib/geo/yard-projection";
import {
  classifyLandingPoint,
  hasMappedCourseFeatures,
  type CourseFeature,
} from "@/lib/course-feature-classification";

export type TargetSurfaceStatus = "playable" | "trouble" | "unavailable";

export type ShotPatternTargetSegment = {
  start: LatLngPoint;
  end: LatLngPoint;
  midpoint: LatLngPoint;
  startSideYd: number;
  endSideYd: number;
  surface: TargetSurfaceStatus;
};

export type ShotPatternTargetPoint = {
  id: string;
  sideYd: number;
  latLng: LatLngPoint;
  included: boolean;
  surface: TargetSurfaceStatus;
};

export type ShotPatternTargetLine = {
  targetDistanceYd: number;
  aimOffsetYd: number;
  centerlinePoint: LatLngPoint;
  center: LatLngPoint;
  bearingDeg: number;
  leftMissYd: number;
  rightMissYd: number;
  leftEndpoint: LatLngPoint;
  rightEndpoint: LatLngPoint;
  segments: ShotPatternTargetSegment[];
  points: ShotPatternTargetPoint[];
  surfaceMode: "mapped" | "estimated";
  playablePercent: number | null;
  beyondCapability: boolean;
  capabilityDistanceYd: number | null;
};

type TargetPatternPoint = {
  id: string;
  distanceYd?: number;
  sideYd: number;
  included: boolean;
};

const DEFAULT_ESTIMATED_FAIRWAY_HALF_WIDTH_YD = 28;
const MAX_TARGET_AIM_OFFSET_YD = 140;

export function buildShotPatternTargetLine({
  holeGeometry,
  holeYards,
  targetDistanceYd,
  aimOffsetYd = 0,
  points,
  features = [],
}: {
  holeGeometry: LatLngPoint[];
  holeYards: number;
  targetDistanceYd: number;
  aimOffsetYd?: number;
  points: TargetPatternPoint[];
  features?: CourseFeature[];
}): ShotPatternTargetLine | null {
  if (holeGeometry.length < 2 || holeYards <= 0 || !Number.isFinite(holeYards)) {
    return null;
  }

  const safeTargetDistanceYd = clampTargetDistance(targetDistanceYd, holeYards);
  const safeAimOffsetYd = clampTargetAimOffset(aimOffsetYd);
  const targetProjection = pointAlongGeometry(holeGeometry, safeTargetDistanceYd / holeYards);
  const targetCenter = targetPointAtSide(
    targetProjection.point,
    targetProjection.bearingDeg,
    safeAimOffsetYd,
  );
  const includedPoints = points.filter((point) => point.included);

  if (includedPoints.length === 0) {
    return null;
  }

  const minSideYd = Math.min(0, ...includedPoints.map((point) => point.sideYd));
  const maxSideYd = Math.max(0, ...includedPoints.map((point) => point.sideYd));
  const capabilityDistanceYd = maxDistanceYd(points);
  const beyondCapability =
    capabilityDistanceYd !== null && safeTargetDistanceYd > capabilityDistanceYd;
  const leftMissYd = Math.ceil(Math.abs(minSideYd));
  const rightMissYd = Math.ceil(maxSideYd);
  const leftEndpoint = targetPointAtSide(targetCenter, targetProjection.bearingDeg, -leftMissYd);
  const rightEndpoint = targetPointAtSide(targetCenter, targetProjection.bearingDeg, rightMissYd);
  const hasMappedFeatures = hasMappedCourseFeatures(features);
  const surfaceMode = hasMappedFeatures ? "mapped" : "estimated";
  const segments = targetSegments({
    center: targetCenter,
    bearingDeg: targetProjection.bearingDeg,
    aimOffsetYd: safeAimOffsetYd,
    leftMissYd,
    rightMissYd,
    features,
    beyondCapability,
  });
  const targetPoints = points.map((point) => {
    const latLng = targetPointAtSide(targetCenter, targetProjection.bearingDeg, point.sideYd);

    return {
      id: point.id,
      sideYd: point.sideYd,
      latLng,
      included: point.included,
      surface: beyondCapability
        ? "unavailable"
        : targetSurfaceForPoint(latLng, safeAimOffsetYd + point.sideYd, features),
    };
  });
  const playableSegments = segments.filter((segment) => segment.surface === "playable").length;

  return {
    targetDistanceYd: safeTargetDistanceYd,
    aimOffsetYd: safeAimOffsetYd,
    centerlinePoint: targetProjection.point,
    center: targetCenter,
    bearingDeg: targetProjection.bearingDeg,
    leftMissYd,
    rightMissYd,
    leftEndpoint,
    rightEndpoint,
    segments,
    points: targetPoints,
    surfaceMode,
    playablePercent:
      beyondCapability || segments.length === 0
        ? null
        : Math.round((playableSegments / segments.length) * 100),
    beyondCapability,
    capabilityDistanceYd,
  };
}

export function nearestDistanceYdAlongGeometry(
  geometry: LatLngPoint[],
  point: LatLngPoint,
  holeYards?: number,
) {
  return nearestTargetPlacementOnGeometry(geometry, point, holeYards).distanceYd;
}

export function nearestTargetPlacementOnGeometry(
  geometry: LatLngPoint[],
  point: LatLngPoint,
  holeYards?: number,
) {
  const cleanGeometry = geometry.filter(isLatLngPoint);

  if (cleanGeometry.length < 2 || !isLatLngPoint(point)) {
    return { distanceYd: 0, aimOffsetYd: 0 };
  }

  const origin = cleanGeometry[0];
  const target = toLocalMeters(point, origin);
  let travelledMeters = 0;
  let bestDistanceMeters = 0;
  let bestSideMeters = 0;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let totalLengthMeters = 0;

  for (let index = 1; index < cleanGeometry.length; index += 1) {
    const start = cleanGeometry[index - 1];
    const end = cleanGeometry[index];
    const startLocal = toLocalMeters(start, origin);
    const endLocal = toLocalMeters(end, origin);
    const segmentX = endLocal.x - startLocal.x;
    const segmentY = endLocal.y - startLocal.y;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const segmentLengthMeters = distanceMeters(start, end);

    if (segmentLengthSquared === 0) {
      continue;
    }

    const targetX = target.x - startLocal.x;
    const targetY = target.y - startLocal.y;
    const ratio = Math.max(
      0,
      Math.min(1, (targetX * segmentX + targetY * segmentY) / segmentLengthSquared),
    );
    const projectedX = startLocal.x + segmentX * ratio;
    const projectedY = startLocal.y + segmentY * ratio;
    const offsetX = target.x - projectedX;
    const offsetY = target.y - projectedY;
    const distanceSquared = offsetX ** 2 + offsetY ** 2;

    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestDistanceMeters = travelledMeters + segmentLengthMeters * ratio;
      bestSideMeters = -((segmentX * offsetY - segmentY * offsetX) / segmentLengthMeters);
    }

    travelledMeters += segmentLengthMeters;
    totalLengthMeters += segmentLengthMeters;
  }

  const useScaledDistance = typeof holeYards === "number" && Number.isFinite(holeYards);
  const distanceRatio = totalLengthMeters > 0 ? bestDistanceMeters / totalLengthMeters : 0;

  return {
    distanceYd: Math.round(
      useScaledDistance ? distanceRatio * holeYards : bestDistanceMeters / YARDS_TO_METERS,
    ),
    aimOffsetYd: clampTargetAimOffset(bestSideMeters / YARDS_TO_METERS),
  };
}

export function clampTargetDistance(targetDistanceYd: number, holeYards: number) {
  const maxTargetYd = Math.max(80, holeYards * 1.15);
  const safeDistance = Number.isFinite(targetDistanceYd) ? targetDistanceYd : 0;

  return Math.round(Math.max(20, Math.min(maxTargetYd, safeDistance)));
}

export function clampTargetAimOffset(aimOffsetYd: number) {
  const safeOffset = Number.isFinite(aimOffsetYd) ? aimOffsetYd : 0;

  return Math.round(
    Math.max(-MAX_TARGET_AIM_OFFSET_YD, Math.min(MAX_TARGET_AIM_OFFSET_YD, safeOffset)),
  );
}

function targetSegments({
  center,
  bearingDeg,
  aimOffsetYd,
  leftMissYd,
  rightMissYd,
  features,
  beyondCapability,
}: {
  center: LatLngPoint;
  bearingDeg: number;
  aimOffsetYd: number;
  leftMissYd: number;
  rightMissYd: number;
  features: CourseFeature[];
  beyondCapability: boolean;
}) {
  const totalWidthYd = leftMissYd + rightMissYd;
  const stepYd = Math.max(3, Math.ceil(totalWidthYd / 28));
  const segments: ShotPatternTargetSegment[] = [];

  for (let startSideYd = -leftMissYd; startSideYd < rightMissYd; startSideYd += stepYd) {
    const endSideYd = Math.min(rightMissYd, startSideYd + stepYd);
    const midpointSideYd = (startSideYd + endSideYd) / 2;
    const midpoint = targetPointAtSide(center, bearingDeg, midpointSideYd);

    segments.push({
      start: targetPointAtSide(center, bearingDeg, startSideYd),
      end: targetPointAtSide(center, bearingDeg, endSideYd),
      midpoint,
      startSideYd,
      endSideYd,
      surface: beyondCapability
        ? "unavailable"
        : targetSurfaceForPoint(midpoint, aimOffsetYd + midpointSideYd, features),
    });
  }

  return segments;
}

function maxDistanceYd(points: TargetPatternPoint[]) {
  const distances = points
    .map((point) => point.distanceYd)
    .filter(
      (distance): distance is number => typeof distance === "number" && Number.isFinite(distance),
    );

  if (distances.length === 0) {
    return null;
  }

  return Math.round(Math.max(...distances));
}

function targetSurfaceForPoint(
  point: LatLngPoint,
  sideYd: number,
  features: CourseFeature[],
): TargetSurfaceStatus {
  if (features.length === 0) {
    return Math.abs(sideYd) <= DEFAULT_ESTIMATED_FAIRWAY_HALF_WIDTH_YD ? "playable" : "trouble";
  }

  const lie = classifyLandingPoint(point, features);
  return lie === "fairway" || lie === "green" ? "playable" : "trouble";
}

function targetPointAtSide(center: LatLngPoint, bearingDeg: number, sideYd: number): LatLngPoint {
  if (sideYd === 0) {
    return center;
  }

  const sideBearing = bearingDeg + (sideYd > 0 ? 90 : -90);
  return destinationPoint(center, sideBearing, Math.abs(sideYd) * YARDS_TO_METERS);
}

function toLocalMeters(point: LatLngPoint, origin: LatLngPoint) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((origin[0] * Math.PI) / 180);

  return {
    x: (point[1] - origin[1]) * metersPerDegreeLng,
    y: (point[0] - origin[0]) * metersPerDegreeLat,
  };
}

function isLatLngPoint(point: LatLngPoint | undefined): point is LatLngPoint {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  );
}
