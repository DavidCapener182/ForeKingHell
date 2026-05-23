export type LatLngPoint = [number, number];

export type GeometryProjection = {
  point: LatLngPoint;
  bearingDeg: number;
};

export const YARDS_TO_METERS = 0.9144;
export const EARTH_RADIUS_METERS = 6371008.8;

const FALLBACK_POINT: LatLngPoint = [0, 0];

export function pointAlongGeometry(geometry: LatLngPoint[], ratio: number): GeometryProjection {
  const cleanGeometry = geometry.filter(isLatLngPoint);

  if (cleanGeometry.length === 0) {
    return { point: FALLBACK_POINT, bearingDeg: 0 };
  }

  if (cleanGeometry.length === 1) {
    return { point: cleanGeometry[0], bearingDeg: 0 };
  }

  const totalLength = geometryLengthMeters(cleanGeometry);

  if (totalLength <= 0) {
    return {
      point: cleanGeometry[0],
      bearingDeg: bearingDegrees(cleanGeometry[0], cleanGeometry[1]),
    };
  }

  const targetDistance = totalLength * Math.max(0, Number.isFinite(ratio) ? ratio : 0);
  let travelled = 0;

  for (let index = 1; index < cleanGeometry.length; index += 1) {
    const start = cleanGeometry[index - 1];
    const end = cleanGeometry[index];
    const segmentLength = distanceMeters(start, end);

    if (travelled + segmentLength >= targetDistance) {
      const segmentRatio = segmentLength === 0 ? 0 : (targetDistance - travelled) / segmentLength;
      return {
        point: interpolatePoint(start, end, segmentRatio),
        bearingDeg: bearingDegrees(start, end),
      };
    }

    travelled += segmentLength;
  }

  const lastStart = cleanGeometry[cleanGeometry.length - 2];
  const lastEnd = cleanGeometry[cleanGeometry.length - 1];
  const lastSegmentLength = distanceMeters(lastStart, lastEnd);
  const overshootRatio =
    lastSegmentLength === 0 ? 0 : (targetDistance - totalLength) / lastSegmentLength;

  return {
    point: interpolatePoint(lastStart, lastEnd, 1 + Math.max(0, overshootRatio)),
    bearingDeg: bearingDegrees(lastStart, lastEnd),
  };
}

export function geometryLengthMeters(geometry: LatLngPoint[]) {
  let total = 0;

  for (let index = 1; index < geometry.length; index += 1) {
    total += distanceMeters(geometry[index - 1], geometry[index]);
  }

  return total;
}

export function distanceMeters(start: LatLngPoint, end: LatLngPoint) {
  if (!isLatLngPoint(start) || !isLatLngPoint(end)) {
    return 0;
  }

  const startLat = toRadians(start[0]);
  const endLat = toRadians(end[0]);
  const deltaLat = toRadians(end[0] - start[0]);
  const deltaLng = toRadians(end[1] - start[1]);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegrees(start: LatLngPoint, end: LatLngPoint) {
  if (!isLatLngPoint(start) || !isLatLngPoint(end)) {
    return 0;
  }

  const startLat = toRadians(start[0]);
  const endLat = toRadians(end[0]);
  const deltaLng = toRadians(end[1] - start[1]);
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint(
  start: LatLngPoint,
  bearingDeg: number,
  distanceM: number,
): LatLngPoint {
  if (!isLatLngPoint(start) || !Number.isFinite(bearingDeg) || !Number.isFinite(distanceM)) {
    return isLatLngPoint(start) ? start : FALLBACK_POINT;
  }

  const angularDistance = distanceM / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDeg);
  const startLat = toRadians(start[0]);
  const startLng = toRadians(start[1]);
  const endLat = Math.asin(
    Math.sin(startLat) * Math.cos(angularDistance) +
      Math.cos(startLat) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const endLng =
    startLng +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(startLat),
      Math.cos(angularDistance) - Math.sin(startLat) * Math.sin(endLat),
    );

  return [toDegrees(endLat), toDegrees(endLng)];
}

export function forwardDistanceYd(distanceYd: number | null, sideYd: number | null) {
  if (distanceYd === null || !Number.isFinite(distanceYd)) {
    return null;
  }

  const sideDistance = sideYd === null || !Number.isFinite(sideYd) ? 0 : sideYd;
  const forwardSquared = distanceYd ** 2 - sideDistance ** 2;

  if (forwardSquared <= 0) {
    return Math.max(0, distanceYd);
  }

  return Math.sqrt(forwardSquared);
}

export function interpolatePoint(start: LatLngPoint, end: LatLngPoint, ratio: number): LatLngPoint {
  const safeRatio = Number.isFinite(ratio) ? ratio : 0;

  if (!isLatLngPoint(start) || !isLatLngPoint(end)) {
    return isLatLngPoint(start) ? start : FALLBACK_POINT;
  }

  return [start[0] + (end[0] - start[0]) * safeRatio, start[1] + (end[1] - start[1]) * safeRatio];
}

function isLatLngPoint(point: LatLngPoint | undefined): point is LatLngPoint {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}
