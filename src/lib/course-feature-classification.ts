import type { LatLngPoint } from "@/lib/geo/yard-projection";
import type { ProjectedShotPatternPoint } from "@/lib/shot-pattern-projection";

export type CourseFeatureType =
  | "fairway"
  | "green"
  | "bunker"
  | "water"
  | "rough"
  | "trees"
  | "out_of_bounds"
  | "course_boundary"
  | "unknown";

export type CourseFeatureGeometry =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

export type CourseFeature = {
  id: string;
  featureType: string;
  geometryJson: unknown;
  holeNumber?: number | null;
  source?: string | null;
};

type ParsedCourseFeature = {
  id: string;
  featureType: CourseFeatureType;
  geometry: CourseFeatureGeometry;
  source?: string | null;
  bounds: FeatureBounds;
};

type FeatureBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type LandingClassification = {
  pointId: string;
  lie: CourseFeatureType;
};

export type LandingClassificationSummary = {
  sampleSize: number;
  counts: Record<CourseFeatureType, number>;
  percentages: Record<CourseFeatureType, number>;
  knownSampleSize: number;
  expectedPenalty: number | null;
};

const FEATURE_PRIORITY: CourseFeatureType[] = [
  "out_of_bounds",
  "water",
  "bunker",
  "green",
  "fairway",
  "trees",
  "rough",
];

const EXPECTED_PENALTY_BY_LIE: Partial<Record<CourseFeatureType, number>> = {
  fairway: 0,
  green: -0.05,
  rough: 0.18,
  trees: 0.45,
  bunker: 0.55,
  water: 1,
  out_of_bounds: 2,
};

const TROUBLE_BUFFER_METERS: Partial<Record<CourseFeatureType, number>> = {
  water: 9.144,
  bunker: 3.6576,
  trees: 5.4864,
  out_of_bounds: 5.4864,
};

export function hasMappedCourseFeatures(features: CourseFeature[]) {
  return mappedCourseFeatures(features).length > 0;
}

export function classifyLandingPoint(
  point: LatLngPoint,
  features: CourseFeature[],
): CourseFeatureType {
  return classifyLandingPointFromParsed(point, parseCourseFeatures(features));
}

function classifyLandingPointFromParsed(
  point: LatLngPoint,
  parsed: ParsedCourseFeature[],
): CourseFeatureType {
  const matching = parsed.filter((feature) => pointInParsedFeature(point, feature));

  if (matching.length === 0) {
    return "unknown";
  }

  const mappedFeatures = parsed.filter((feature) => feature.source !== "estimated_centerline");
  const mappedMatching = matching.filter((feature) => feature.source !== "estimated_centerline");
  const mappedTrouble = FEATURE_PRIORITY.find(
    (featureType) =>
      isTroubleFeatureType(featureType) &&
      mappedMatching.some((feature) => feature.featureType === featureType),
  );

  if (mappedTrouble) {
    return mappedTrouble;
  }

  const bufferedMappedTrouble = FEATURE_PRIORITY.find(
    (featureType) =>
      isTroubleFeatureType(featureType) &&
      mappedFeatures.some(
        (feature) =>
          feature.featureType === featureType &&
          pointWithinBounds(point, feature.bounds, TROUBLE_BUFFER_METERS[featureType] ?? 0) &&
          distanceMetersToFeature(point, feature.geometry) <=
            (TROUBLE_BUFFER_METERS[featureType] ?? 0),
      ),
  );

  if (bufferedMappedTrouble) {
    return bufferedMappedTrouble;
  }

  const mappedPlayable = FEATURE_PRIORITY.find(
    (featureType) =>
      isPlayableFeatureType(featureType) &&
      mappedMatching.some((feature) => feature.featureType === featureType),
  );

  if (mappedPlayable) {
    return mappedPlayable;
  }

  const fallbackPlayable = FEATURE_PRIORITY.find(
    (featureType) =>
      isPlayableFeatureType(featureType) &&
      matching.some((feature) => feature.featureType === featureType),
  );

  if (fallbackPlayable) {
    return fallbackPlayable;
  }

  const mappedRough = mappedMatching.some((feature) => feature.featureType === "rough");

  if (mappedRough) {
    return "rough";
  }

  if (matching.some((feature) => feature.featureType === "course_boundary")) {
    return "rough";
  }

  return "unknown";
}

function mappedCourseFeatures(features: CourseFeature[]) {
  return features.filter((feature) => feature.source !== "estimated_centerline");
}

function isTroubleFeatureType(featureType: CourseFeatureType) {
  return (
    featureType === "out_of_bounds" ||
    featureType === "water" ||
    featureType === "bunker" ||
    featureType === "trees"
  );
}

function isPlayableFeatureType(featureType: CourseFeatureType) {
  return featureType === "fairway" || featureType === "green";
}

export function classifyProjectedPatternPoints(
  points: ProjectedShotPatternPoint[],
  features: CourseFeature[],
): {
  classifications: LandingClassification[];
  summary: LandingClassificationSummary;
} {
  const parsed = parseCourseFeatures(features);
  const classifications = points
    .filter((point) => point.included)
    .map((point) => ({
      pointId: point.id,
      lie: classifyLandingPointFromParsed(point.latLng, parsed),
    }));
  const counts = emptyCounts();

  for (const classification of classifications) {
    counts[classification.lie] += 1;
  }

  const sampleSize = classifications.length;
  const percentages = emptyCounts();

  for (const key of Object.keys(counts) as CourseFeatureType[]) {
    percentages[key] = sampleSize === 0 ? 0 : Math.round((counts[key] / sampleSize) * 1000) / 10;
  }

  const knownSampleSize = sampleSize - counts.unknown;

  return {
    classifications,
    summary: {
      sampleSize,
      counts,
      percentages,
      knownSampleSize,
      expectedPenalty: knownSampleSize === 0 ? null : expectedPenalty(classifications),
    },
  };
}

function parseCourseFeatures(features: CourseFeature[]): ParsedCourseFeature[] {
  return features
    .map((feature): ParsedCourseFeature | null => {
      const geometry = parseFeatureGeometry(feature.geometryJson);
      const bounds = geometry ? featureGeometryBounds(geometry) : null;

      if (!geometry || !bounds) {
        return null;
      }

      return {
        id: feature.id,
        featureType: normalizeFeatureType(feature.featureType),
        geometry,
        source: feature.source,
        bounds,
      };
    })
    .filter((feature): feature is ParsedCourseFeature => feature !== null);
}

function pointInParsedFeature(point: LatLngPoint, feature: ParsedCourseFeature) {
  return pointWithinBounds(point, feature.bounds, 0) && pointInFeature(point, feature.geometry);
}

function pointInFeature(point: LatLngPoint, geometry: CourseFeatureGeometry | null) {
  if (!geometry) {
    return false;
  }

  if (geometry.type === "Polygon") {
    return pointInPolygonGeometry(point, geometry.coordinates);
  }

  return geometry.coordinates.some((polygon) => pointInPolygonGeometry(point, polygon));
}

function featureGeometryBounds(geometry: CourseFeatureGeometry): FeatureBounds | null {
  const bounds: FeatureBounds = {
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
  };
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const coordinate of ring) {
        if (!isLngLat(coordinate)) {
          continue;
        }

        bounds.minLng = Math.min(bounds.minLng, coordinate[0]);
        bounds.maxLng = Math.max(bounds.maxLng, coordinate[0]);
        bounds.minLat = Math.min(bounds.minLat, coordinate[1]);
        bounds.maxLat = Math.max(bounds.maxLat, coordinate[1]);
      }
    }
  }

  return Number.isFinite(bounds.minLat) ? bounds : null;
}

function pointWithinBounds(point: LatLngPoint, bounds: FeatureBounds, bufferMeters: number) {
  const [lat, lng] = point;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((lat * Math.PI) / 180);
  const latBuffer = bufferMeters / metersPerDegreeLat;
  const lngBuffer = metersPerDegreeLng > 0 ? bufferMeters / metersPerDegreeLng : 0;

  return (
    lat >= bounds.minLat - latBuffer &&
    lat <= bounds.maxLat + latBuffer &&
    lng >= bounds.minLng - lngBuffer &&
    lng <= bounds.maxLng + lngBuffer
  );
}

function distanceMetersToFeature(point: LatLngPoint, geometry: CourseFeatureGeometry | null) {
  if (!geometry) {
    return Number.POSITIVE_INFINITY;
  }

  if (pointInFeature(point, geometry)) {
    return 0;
  }

  if (geometry.type === "Polygon") {
    return distanceMetersToPolygon(point, geometry.coordinates);
  }

  return Math.min(
    ...geometry.coordinates.map((polygon) => distanceMetersToPolygon(point, polygon)),
  );
}

function distanceMetersToPolygon(point: LatLngPoint, polygon: number[][][]) {
  const distances = polygon.map((ring) => distanceMetersToRing(point, ring));

  return Math.min(...distances);
}

function distanceMetersToRing(point: LatLngPoint, ring: number[][]) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < ring.length; index += 1) {
    const start = ring[index - 1];
    const end = ring[index];

    if (!isLngLat(start) || !isLngLat(end)) {
      continue;
    }

    minDistance = Math.min(minDistance, distanceMetersToSegment(point, start, end));
  }

  return minDistance;
}

function distanceMetersToSegment(point: LatLngPoint, start: number[], end: number[]) {
  const startLocal = toLocalMeters(point, start);
  const endLocal = toLocalMeters(point, end);
  const segmentX = endLocal.x - startLocal.x;
  const segmentY = endLocal.y - startLocal.y;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

  if (segmentLengthSquared === 0) {
    return Math.hypot(startLocal.x, startLocal.y);
  }

  const ratio = Math.max(
    0,
    Math.min(1, -(startLocal.x * segmentX + startLocal.y * segmentY) / segmentLengthSquared),
  );
  const closestX = startLocal.x + segmentX * ratio;
  const closestY = startLocal.y + segmentY * ratio;

  return Math.hypot(closestX, closestY);
}

function toLocalMeters([lat, lng]: LatLngPoint, lngLat: number[]) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((lat * Math.PI) / 180);

  return {
    x: (lngLat[0] - lng) * metersPerDegreeLng,
    y: (lngLat[1] - lat) * metersPerDegreeLat,
  };
}

function pointInPolygonGeometry(point: LatLngPoint, polygon: number[][][]) {
  const [outerRing, ...holes] = polygon;

  if (!outerRing || !pointInRing(point, outerRing)) {
    return false;
  }

  return !holes.some((ring) => pointInRing(point, ring));
}

function pointInRing([lat, lng]: LatLngPoint, ring: number[][]) {
  let inside = false;

  for (
    let index = 0, previousIndex = ring.length - 1;
    index < ring.length;
    previousIndex = index++
  ) {
    const current = ring[index];
    const previous = ring[previousIndex];

    if (!isLngLat(current) || !isLngLat(previous)) {
      continue;
    }

    const currentLng = current[0];
    const currentLat = current[1];
    const previousLng = previous[0];
    const previousLat = previous[1];
    const intersects =
      currentLat > lat !== previousLat > lat &&
      lng <
        ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function parseFeatureGeometry(value: unknown): CourseFeatureGeometry | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const geometry = "geometry" in parsed ? (parsed as { geometry?: unknown }).geometry : parsed;

  if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) {
    return null;
  }

  if (
    "type" in geometry &&
    geometry.type === "Polygon" &&
    "coordinates" in geometry &&
    Array.isArray(geometry.coordinates)
  ) {
    return geometry as CourseFeatureGeometry;
  }

  if (
    "type" in geometry &&
    geometry.type === "MultiPolygon" &&
    "coordinates" in geometry &&
    Array.isArray(geometry.coordinates)
  ) {
    return geometry as CourseFeatureGeometry;
  }

  return null;
}

function normalizeFeatureType(value: string): CourseFeatureType {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");

  if (
    normalized === "fairway" ||
    normalized === "green" ||
    normalized === "bunker" ||
    normalized === "water" ||
    normalized === "rough" ||
    normalized === "trees" ||
    normalized === "out_of_bounds" ||
    normalized === "course_boundary"
  ) {
    return normalized;
  }

  return "unknown";
}

function expectedPenalty(classifications: LandingClassification[]) {
  let total = 0;
  let count = 0;

  for (const classification of classifications) {
    const value = EXPECTED_PENALTY_BY_LIE[classification.lie];

    if (typeof value === "number") {
      total += value;
      count += 1;
    }
  }

  return count === 0 ? null : Math.round((total / count) * 100) / 100;
}

function emptyCounts() {
  return {
    fairway: 0,
    green: 0,
    bunker: 0,
    water: 0,
    rough: 0,
    trees: 0,
    out_of_bounds: 0,
    course_boundary: 0,
    unknown: 0,
  };
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isLngLat(value: number[]) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}
