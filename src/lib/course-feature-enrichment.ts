import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { courseFeatures, courses, holes } from "@/db/schema";
import {
  buildEstimatedCourseFeatures,
  type EstimatedFeatureHole,
} from "@/lib/course-feature-estimates";
import type { LatLngPoint } from "@/lib/geo/yard-projection";
import { getOsmCourseFeatures, type OsmCourseFeature } from "@/lib/osm-course-features";

export type CourseFeatureEnrichmentResult = {
  changed: boolean;
  status: "ready" | "imported" | "estimated" | "mixed" | "no_course" | "no_geometry";
  featureCount: number;
};

const GENERATED_FEATURE_SOURCES = ["osm", "estimated_centerline"] as const;
const INTERACTIVE_OSM_TIMEOUT_MS = 1_200;

export async function ensureCourseFeatures({
  courseId,
  force = false,
  osmTimeoutMs,
}: {
  courseId: string;
  force?: boolean;
  osmTimeoutMs?: number;
}): Promise<CourseFeatureEnrichmentResult> {
  const db = getDb();
  const existingRows = await db
    .select({
      id: courseFeatures.id,
      source: courseFeatures.source,
    })
    .from(courseFeatures)
    .where(eq(courseFeatures.courseId, courseId));
  const hasEstimatedBackstop = existingRows.some(
    (row) => row.source === "estimated_centerline",
  );
  const hasOsmFeatures = existingRows.some((row) => row.source === "osm");

  if (existingRows.length > 0 && hasEstimatedBackstop && hasOsmFeatures && !force) {
    return {
      changed: false,
      status: "ready",
      featureCount: existingRows.length,
    };
  }

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return { changed: false, status: "no_course", featureCount: 0 };
  }

  const courseHoleRows = await db
    .select()
    .from(holes)
    .where(eq(holes.courseId, courseId))
    .orderBy(asc(holes.teeSetId), asc(holes.holeNumber));
  const primaryHoles = primaryHoleSet(courseHoleRows);
  const estimatedFeatures = primaryHoles.length > 0 ? buildEstimatedCourseFeatures(primaryHoles) : [];

  if (existingRows.length > 0 && !force) {
    let changed = false;
    let featureCount = existingRows.length;
    const knownSources = existingRows.map((row) => ({ source: row.source }));

    if (!hasEstimatedBackstop && estimatedFeatures.length > 0) {
      await db.insert(courseFeatures).values(
        estimatedFeatures.map((feature) => ({
          courseId,
          featureType: feature.featureType,
          geometryJson: feature.geometryJson,
          holeNumber: feature.holeNumber,
          source: feature.source,
          updatedAt: new Date(),
        })),
      );
      changed = true;
      featureCount += estimatedFeatures.length;
      knownSources.push(...estimatedFeatures.map((feature) => ({ source: feature.source })));
    }

    if (!hasOsmFeatures) {
      const coordinates = courseCoordinates(course, primaryHoles);
      const osmFeatures = coordinates
        ? await safelyGetOsmFeatures(coordinates, osmTimeoutMs ?? INTERACTIVE_OSM_TIMEOUT_MS)
        : [];

      if (osmFeatures.length > 0) {
        await db.insert(courseFeatures).values(
          osmFeatures.map((feature) => ({
            courseId,
            featureType: feature.featureType,
            geometryJson: feature.geometryJson,
            holeNumber: feature.holeNumber,
            source: feature.source,
            updatedAt: new Date(),
          })),
        );
        changed = true;
        featureCount += osmFeatures.length;
        knownSources.push(...osmFeatures.map((feature) => ({ source: feature.source })));
      }
    }

    return {
      changed,
      status: changed ? featureStatus(knownSources) : "ready",
      featureCount,
    };
  }

  const coordinates = courseCoordinates(course, primaryHoles);
  const osmFeatures = coordinates
    ? await safelyGetOsmFeatures(
        coordinates,
        osmTimeoutMs ?? (force ? 12_000 : INTERACTIVE_OSM_TIMEOUT_MS),
      )
    : [];
  const features = [...osmFeatures, ...estimatedFeatures];

  if (features.length === 0) {
    return { changed: false, status: "no_geometry", featureCount: 0 };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(courseFeatures)
      .where(
        and(
          eq(courseFeatures.courseId, courseId),
          inArray(courseFeatures.source, [...GENERATED_FEATURE_SOURCES]),
        ),
      );

    await tx.insert(courseFeatures).values(
      features.map((feature) => ({
        courseId,
        featureType: feature.featureType,
        geometryJson: feature.geometryJson,
        holeNumber: feature.holeNumber,
        source: feature.source,
        updatedAt: new Date(),
      })),
    );
  });

  return {
    changed: true,
    status: featureStatus(features),
    featureCount: features.length,
  };
}

async function safelyGetOsmFeatures({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
}, timeoutMs: number): Promise<OsmCourseFeature[]> {
  try {
    return await getOsmCourseFeatures(lat, lon, { timeoutMs });
  } catch {
    return [];
  }
}

function primaryHoleSet(holeRows: Array<typeof holes.$inferSelect>): EstimatedFeatureHole[] {
  const grouped = new Map<string, Array<typeof holes.$inferSelect>>();

  for (const hole of holeRows) {
    grouped.set(hole.teeSetId, [...(grouped.get(hole.teeSetId) ?? []), hole]);
  }

  const primaryRows =
    Array.from(grouped.values()).sort(
      (left, right) => right.length - left.length || left[0].teeSetId.localeCompare(right[0].teeSetId),
    )[0] ?? [];

  return primaryRows
    .map((hole): EstimatedFeatureHole | null => {
      const geometry = centerlineGeometry(hole.centerlineGeojson);

      if (geometry.length < 2) {
        return null;
      }

      return {
        holeNumber: hole.holeNumber,
        par: hole.par,
        yards: hole.yards,
        geometry,
        green: [hole.greenLat, hole.greenLng],
      };
    })
    .filter((hole): hole is EstimatedFeatureHole => hole !== null);
}

function courseCoordinates(
  course: typeof courses.$inferSelect,
  primaryHoles: EstimatedFeatureHole[],
) {
  if (Number.isFinite(course.latitude) && Number.isFinite(course.longitude)) {
    return {
      lat: course.latitude as number,
      lon: course.longitude as number,
    };
  }

  const points = primaryHoles.flatMap((hole) => hole.geometry);

  if (points.length === 0) {
    return null;
  }

  return {
    lat: average(points.map((point) => point[0])),
    lon: average(points.map((point) => point[1])),
  };
}

function featureStatus(
  features: Array<{ source: string | null }>,
): CourseFeatureEnrichmentResult["status"] {
  const hasOsm = features.some((feature) => feature.source === "osm");
  const hasEstimated = features.some((feature) => feature.source === "estimated_centerline");

  if (hasOsm && hasEstimated) return "mixed";
  if (hasOsm) return "imported";
  return "estimated";
}

function centerlineGeometry(value: unknown) {
  const geojson = parseCenterlineGeojson(value);

  if (
    !geojson ||
    typeof geojson !== "object" ||
    Array.isArray(geojson) ||
    geojson.type !== "LineString" ||
    !Array.isArray(geojson.coordinates)
  ) {
    return [];
  }

  return geojson.coordinates
    .filter(
      (coordinate): coordinate is [number, number] =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        typeof coordinate[0] === "number" &&
        typeof coordinate[1] === "number",
    )
    .map(([lng, lat]) => [lat, lng] as LatLngPoint);
}

function parseCenterlineGeojson(value: unknown): {
  type?: unknown;
  coordinates?: unknown[];
} | null {
  if (typeof value !== "string") {
    return value as { type?: unknown; coordinates?: unknown[] };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string"
      ? parseCenterlineGeojson(parsed)
      : (parsed as { type?: unknown; coordinates?: unknown[] });
  } catch {
    return null;
  }
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
