import { polygonFromLatLngRing, type GeoJsonPolygon } from "@/lib/course-feature-estimates";
import type { LatLngPoint } from "@/lib/geo/yard-projection";

export type OsmCourseFeatureType =
  | "fairway"
  | "green"
  | "bunker"
  | "water"
  | "rough"
  | "trees"
  | "course_boundary";

export type OsmCourseFeature = {
  osmType: string;
  osmId: number;
  featureType: OsmCourseFeatureType;
  holeNumber: number | null;
  geometryJson: GeoJsonPolygon;
  source: "osm";
};

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

const OSM_USER_AGENT = "LM World Tour golf analytics course importer";

export async function getOsmCourseFeatures(
  lat: number,
  lon: number,
  options: { timeoutMs?: number } = {},
) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return [];
  }

  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 8_000);
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": OSM_USER_AGENT,
    },
    body: new URLSearchParams({ data: buildOverpassGolfFeatureQuery(lat, lon) }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    return [];
  }

  return scopeOsmFeaturesToCourse(parseOverpassGolfFeatures(await response.json()), lat, lon);
}

export function scopeOsmFeaturesToCourse(
  features: OsmCourseFeature[],
  latitude: number,
  longitude: number,
) {
  const boundaries = features.filter((feature) => feature.featureType === "course_boundary");
  if (boundaries.length === 0) return features;
  const queryPoint: [number, number] = [longitude, latitude];
  const containing = boundaries.filter((feature) =>
    pointInRing(queryPoint, feature.geometryJson.coordinates[0] ?? []),
  );
  const selectedBoundary = (containing.length > 0 ? containing : boundaries)
    .map((feature) => ({ feature, distance: polygonDistanceSquared(feature, queryPoint) }))
    .sort((left, right) => left.distance - right.distance)[0]?.feature;
  if (!selectedBoundary) return features;
  const courseRing = selectedBoundary.geometryJson.coordinates[0] ?? [];
  return features.filter((feature) => {
    if (feature.featureType === "course_boundary") return feature === selectedBoundary;
    const featureRing = feature.geometryJson.coordinates[0] ?? [];
    const center = ringCenter(featureRing);
    return (
      pointInRing(center, courseRing) ||
      featureRing.some((point) => pointInRing([point[0], point[1]], courseRing))
    );
  });
}

export function buildOverpassGolfFeatureQuery(lat: number, lon: number) {
  return `
[out:json][timeout:25];
(
  way(around:2200,${lat},${lon})["golf"~"^(fairway|green|bunker|rough|water|water_hazard)$"];
  relation(around:2200,${lat},${lon})["golf"~"^(fairway|green|bunker|rough|water|water_hazard)$"];
  way(around:2200,${lat},${lon})["natural"="water"];
  relation(around:2200,${lat},${lon})["natural"="water"];
  way(around:2200,${lat},${lon})["water"];
  relation(around:2200,${lat},${lon})["water"];
  way(around:2200,${lat},${lon})["landuse"="forest"];
  relation(around:2200,${lat},${lon})["landuse"="forest"];
  way(around:2200,${lat},${lon})["natural"="wood"];
  relation(around:2200,${lat},${lon})["natural"="wood"];
  way(around:2200,${lat},${lon})["leisure"="golf_course"];
  relation(around:2200,${lat},${lon})["leisure"="golf_course"];
);
out tags geom;
`;
}

export function parseOverpassGolfFeatures(payload: unknown): OsmCourseFeature[] {
  if (!isRecord(payload) || !Array.isArray(payload.elements)) {
    return [];
  }

  return payload.elements
    .map((element): OsmCourseFeature | null => parseOverpassFeature(element as OverpassElement))
    .filter((feature): feature is OsmCourseFeature => feature !== null);
}

function parseOverpassFeature(element: OverpassElement): OsmCourseFeature | null {
  const tags = element.tags ?? {};
  const featureType = featureTypeFromTags(tags);
  const ring = closedLatLngRing(element.geometry ?? []);

  if (!featureType || ring.length < 4) {
    return null;
  }

  return {
    osmType: element.type,
    osmId: element.id,
    featureType,
    holeNumber: parseHoleNumber(tags.ref ?? tags.hole ?? tags.name),
    geometryJson: polygonFromLatLngRing(ring),
    source: "osm",
  };
}

function featureTypeFromTags(tags: Record<string, string>): OsmCourseFeatureType | null {
  if (tags.golf === "fairway") return "fairway";
  if (tags.golf === "green") return "green";
  if (tags.golf === "bunker") return "bunker";
  if (tags.golf === "rough") return "rough";
  if (tags.golf === "water") return "water";
  if (tags.golf === "water_hazard") return "water";
  if (tags.natural === "water" || tags.water) return "water";
  if (tags.landuse === "forest" || tags.natural === "wood") return "trees";
  if (tags.leisure === "golf_course") return "course_boundary";

  return null;
}

function closedLatLngRing(geometry: Array<{ lat: number; lon: number }>): LatLngPoint[] {
  const points = geometry
    .map((point): LatLngPoint | null => {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
        return null;
      }

      return [point.lat, point.lon];
    })
    .filter((point): point is LatLngPoint => point !== null);

  if (points.length < 3) {
    return [];
  }

  const first = points[0];
  const last = points[points.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [];
  }

  return points;
}

function parseHoleNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{1,2}/);
  const holeNumber = match ? Number(match[0]) : null;

  return holeNumber !== null && Number.isInteger(holeNumber) && holeNumber >= 1 && holeNumber <= 27
    ? holeNumber
    : null;
}

function polygonDistanceSquared(feature: OsmCourseFeature, point: [number, number]) {
  const center = ringCenter(feature.geometryJson.coordinates[0] ?? []);
  return (center[0] - point[0]) ** 2 + (center[1] - point[1]) ** 2;
}

function ringCenter(ring: number[][]): [number, number] {
  const points = ring.slice(0, -1).filter((point) => point.length >= 2);
  if (points.length === 0) return [0, 0];
  return [
    points.reduce((total, point) => total + point[0], 0) / points.length,
    points.reduce((total, point) => total + point[1], 0) / points.length,
  ];
}

function pointInRing(point: [number, number], ring: number[][]) {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    const intersects =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
