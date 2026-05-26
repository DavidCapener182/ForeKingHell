import {
  YARDS_TO_METERS,
  bearingDegrees,
  destinationPoint,
  type LatLngPoint,
} from "@/lib/geo/yard-projection";

export type EstimatedFeatureHole = {
  holeNumber: number;
  par: number;
  yards: number;
  geometry: LatLngPoint[];
  green: LatLngPoint;
};

export type EstimatedCourseFeature = {
  holeNumber: number;
  featureType: "fairway" | "green" | "course_boundary";
  geometryJson: GeoJsonPolygon;
  source: "estimated_centerline";
};

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export function buildEstimatedCourseFeatures(
  holes: EstimatedFeatureHole[],
): EstimatedCourseFeature[] {
  return holes.flatMap((hole) => {
    if (hole.geometry.length < 2) {
      return [];
    }

    return [
      {
        holeNumber: hole.holeNumber,
        featureType: "course_boundary" as const,
        geometryJson: lineCorridorPolygon(
          hole.geometry,
          boundaryHalfWidthYd(hole) * YARDS_TO_METERS,
        ),
        source: "estimated_centerline" as const,
      },
      {
        holeNumber: hole.holeNumber,
        featureType: "fairway" as const,
        geometryJson: lineCorridorPolygon(
          hole.geometry,
          fairwayHalfWidthYd(hole) * YARDS_TO_METERS,
        ),
        source: "estimated_centerline" as const,
      },
      {
        holeNumber: hole.holeNumber,
        featureType: "green" as const,
        geometryJson: circlePolygon(hole.green, greenRadiusYd(hole) * YARDS_TO_METERS),
        source: "estimated_centerline" as const,
      },
    ];
  });
}

export function lineCorridorPolygon(
  geometry: LatLngPoint[],
  halfWidthMeters: number,
): GeoJsonPolygon {
  const cleanGeometry = geometry.filter(isLatLngPoint);

  if (cleanGeometry.length < 2) {
    return emptyPolygon();
  }

  const left: LatLngPoint[] = [];
  const right: LatLngPoint[] = [];

  for (let index = 0; index < cleanGeometry.length; index += 1) {
    const previous = cleanGeometry[Math.max(0, index - 1)];
    const next = cleanGeometry[Math.min(cleanGeometry.length - 1, index + 1)];
    const bearing = bearingDegrees(previous, next);

    left.push(destinationPoint(cleanGeometry[index], bearing - 90, halfWidthMeters));
    right.push(destinationPoint(cleanGeometry[index], bearing + 90, halfWidthMeters));
  }

  return polygonFromLatLngRing([...left, ...right.reverse()]);
}

export function circlePolygon(
  center: LatLngPoint,
  radiusMeters: number,
  vertices = 24,
): GeoJsonPolygon {
  if (!isLatLngPoint(center) || radiusMeters <= 0) {
    return emptyPolygon();
  }

  const ring = Array.from({ length: vertices }, (_, index) =>
    destinationPoint(center, (index / vertices) * 360, radiusMeters),
  );

  return polygonFromLatLngRing(ring);
}

export function polygonFromLatLngRing(points: LatLngPoint[]): GeoJsonPolygon {
  const coordinates = points.filter(isLatLngPoint).map(([lat, lng]) => [lng, lat]);

  if (coordinates.length === 0) {
    return emptyPolygon();
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([...first]);
  }

  return {
    type: "Polygon",
    coordinates: [coordinates],
  };
}

function fairwayHalfWidthYd(hole: EstimatedFeatureHole) {
  if (hole.par <= 3) {
    return 18;
  }

  return hole.yards >= 430 ? 34 : 29;
}

function boundaryHalfWidthYd(hole: EstimatedFeatureHole) {
  if (hole.par <= 3) {
    return 45;
  }

  return hole.yards >= 430 ? 85 : 70;
}

function greenRadiusYd(hole: EstimatedFeatureHole) {
  return hole.par <= 3 ? 18 : 21;
}

function emptyPolygon(): GeoJsonPolygon {
  return {
    type: "Polygon",
    coordinates: [[]],
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
