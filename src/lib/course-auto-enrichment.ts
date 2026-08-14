import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { courses, holes, teeSets } from "@/db/schema";
import { ensureCourseFeatures } from "@/lib/course-feature-enrichment";
import {
  getGoogleCourseDetails,
  searchGoogleCourses,
  type GoogleCourseDetails,
} from "@/lib/google-course-enrichment";
import { getOsmHoleGeometry, type OsmHoleGeometry } from "@/lib/osm-course-search";

const GEOMETRY_RETRY_INTERVAL_MS = 12 * 60 * 60 * 1000;
const AUTO_GOOGLE_PROVIDERS = new Set([
  "espn-pga",
  "google-places",
  "osm",
  "schedule",
  "seed",
  "tour-seed",
]);

type CourseRow = typeof courses.$inferSelect;
type TeeSetRow = typeof teeSets.$inferSelect;

export type CourseAutoImportResult = {
  changed: boolean;
  status: "ready" | "imported" | "no_coordinates" | "no_geometry_found" | "recently_attempted";
};

export async function ensureCourseAutoImport(
  course: CourseRow,
  currentHoleCount: number,
  options: { forceGeometry?: boolean; skipGoogle?: boolean } = {},
) {
  if (currentHoleCount > 0) {
    return { changed: false, status: "ready" } satisfies CourseAutoImportResult;
  }

  const now = new Date();
  const metadata = metadataRecord(course.googleMetadataJson);

  if (!options.forceGeometry && recentAutoImportAttempt(metadata, now)) {
    return { changed: false, status: "recently_attempted" } satisfies CourseAutoImportResult;
  }

  const details = options.skipGoogle ? null : await resolveGoogleDetails(course);
  const enrichedMetadata = details
    ? {
        ...metadata,
        phoneNumber: details.phoneNumber,
        source: "google-places",
      }
    : metadata;
  const latitude = details?.latitude ?? course.latitude;
  const longitude = details?.longitude ?? course.longitude;

  await safelyUpdateGoogleDetails(course, details, now, enrichedMetadata);

  if (latitude === null || longitude === null) {
    await updateAutoImportMetadata(course.id, enrichedMetadata, now, 0);
    return { changed: Boolean(details), status: "no_coordinates" } satisfies CourseAutoImportResult;
  }

  const importedHoles = selectPrimaryHoleSet(
    await safelyGetOsmHoleGeometry(latitude, longitude),
    latitude,
    longitude,
  );
  await updateAutoImportMetadata(course.id, enrichedMetadata, now, importedHoles.length);

  if (importedHoles.length === 0) {
    return {
      changed: Boolean(details),
      status: "no_geometry_found",
    } satisfies CourseAutoImportResult;
  }

  await saveImportedHoleGeometry(course.id, importedHoles, now);
  await ensureCourseFeatures({ courseId: course.id, force: true });

  return { changed: true, status: "imported" } satisfies CourseAutoImportResult;
}

async function resolveGoogleDetails(course: CourseRow) {
  if (course.googlePlaceId) {
    return getGoogleCourseDetails(course.googlePlaceId);
  }

  if (!AUTO_GOOGLE_PROVIDERS.has(course.provider)) {
    return null;
  }

  const query = [course.name, course.country ?? course.address].filter(Boolean).join(" ");
  const [match] = await searchGoogleCourses(query, { limit: 1 });

  return match ? getGoogleCourseDetails(match.placeId) : null;
}

async function updateGoogleDetails(
  course: CourseRow,
  details: GoogleCourseDetails | null,
  now: Date,
  metadata: Record<string, unknown>,
) {
  if (!details) {
    return;
  }

  const db = getDb();

  await db
    .update(courses)
    .set({
      address: details.address,
      country: details.country ?? course.country,
      googleAttributionsJson: details.attributions,
      googleEnrichedAt: now,
      googleMapsUrl: details.googleMapsUrl,
      googleMetadataJson: metadata,
      googleOpeningHoursJson: details.openingHours,
      googlePlaceId: details.placeId,
      googleRating: details.rating,
      googleTypesJson: details.types,
      googleUserRatingsTotal: details.userRatingsTotal,
      latitude: details.latitude ?? course.latitude,
      longitude: details.longitude ?? course.longitude,
      websiteUrl: details.website,
      updatedAt: now,
    })
    .where(eq(courses.id, course.id));
}

async function safelyUpdateGoogleDetails(
  course: CourseRow,
  details: GoogleCourseDetails | null,
  now: Date,
  metadata: Record<string, unknown>,
) {
  try {
    await updateGoogleDetails(course, details, now, metadata);
  } catch {
    // A duplicate Google place can already belong to a seeded course; enrichment should not break page loads.
  }
}

async function safelyGetOsmHoleGeometry(latitude: number, longitude: number) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const geometry = await getOsmHoleGeometry(latitude, longitude);
      if (geometry.length > 0) {
        return geometry;
      }
    } catch {
      // A later attempt can use another healthy Overpass mirror.
    }
  }

  return [];
}

function selectPrimaryHoleSet(
  importedHoles: OsmHoleGeometry[],
  latitude: number,
  longitude: number,
) {
  const standardCourseHoles = importedHoles.filter(
    (hole) => hole.holeNumber >= 1 && hole.holeNumber <= 18,
  );
  const candidates = standardCourseHoles.length > 0 ? standardCourseHoles : importedHoles;
  const nearestByHoleNumber = new Map<number, OsmHoleGeometry>();

  for (const hole of candidates) {
    const existingHole = nearestByHoleNumber.get(hole.holeNumber);

    if (
      !existingHole ||
      holeDistanceFromCenter(hole, latitude, longitude) <
        holeDistanceFromCenter(existingHole, latitude, longitude)
    ) {
      nearestByHoleNumber.set(hole.holeNumber, hole);
    }
  }

  return Array.from(nearestByHoleNumber.values()).sort((a, b) => a.holeNumber - b.holeNumber);
}

function holeDistanceFromCenter(hole: OsmHoleGeometry, latitude: number, longitude: number) {
  const midpointLat = (hole.teeLat + hole.greenLat) / 2;
  const midpointLng = (hole.teeLng + hole.greenLng) / 2;

  return (midpointLat - latitude) ** 2 + (midpointLng - longitude) ** 2;
}

async function updateAutoImportMetadata(
  courseId: string,
  metadata: Record<string, unknown>,
  now: Date,
  importedHoleCount: number,
) {
  const db = getDb();

  await db
    .update(courses)
    .set({
      googleMetadataJson: {
        ...metadata,
        autoMappedHoleCount: importedHoleCount,
        geometryAutoImportAttemptedAt: now.toISOString(),
        geometrySource: importedHoleCount > 0 ? "osm-overpass" : null,
      },
      updatedAt: now,
    })
    .where(eq(courses.id, courseId));
}

async function saveImportedHoleGeometry(
  courseId: string,
  importedHoles: OsmHoleGeometry[],
  now: Date,
) {
  const db = getDb();
  const teeSet = await primaryTeeSet(courseId, importedHoles, now);

  for (const hole of importedHoles) {
    await db
      .insert(holes)
      .values({
        centerlineGeojson: {
          type: "LineString" as const,
          coordinates: [
            [hole.teeLng, hole.teeLat],
            [hole.greenLng, hole.greenLat],
          ] as Array<[number, number]>,
        },
        courseId,
        greenLat: hole.greenLat,
        greenLng: hole.greenLng,
        holeNumber: hole.holeNumber,
        par: hole.par,
        strokeIndex: null,
        teeLat: hole.teeLat,
        teeLng: hole.teeLng,
        teeSetId: teeSet.id,
        updatedAt: now,
        yards: hole.yards,
      })
      .onConflictDoUpdate({
        target: [holes.teeSetId, holes.holeNumber],
        set: {
          centerlineGeojson: {
            type: "LineString" as const,
            coordinates: [
              [hole.teeLng, hole.teeLat],
              [hole.greenLng, hole.greenLat],
            ] as Array<[number, number]>,
          },
          greenLat: hole.greenLat,
          greenLng: hole.greenLng,
          par: hole.par,
          strokeIndex: null,
          teeLat: hole.teeLat,
          teeLng: hole.teeLng,
          updatedAt: now,
          yards: hole.yards,
        },
      });
  }
}

async function primaryTeeSet(courseId: string, importedHoles: OsmHoleGeometry[], now: Date) {
  const db = getDb();
  const par = importedHoles.reduce((total, hole) => total + hole.par, 0);
  const yards = importedHoles.reduce((total, hole) => total + hole.yards, 0);
  const [existingTeeSet] = await db
    .select()
    .from(teeSets)
    .where(eq(teeSets.courseId, courseId))
    .orderBy(asc(teeSets.name))
    .limit(1);

  if (existingTeeSet) {
    const [updatedTeeSet] = await db
      .update(teeSets)
      .set({
        meters: Math.round(yards * 0.9144),
        par,
        updatedAt: now,
        yards,
      })
      .where(eq(teeSets.id, existingTeeSet.id))
      .returning();

    return updatedTeeSet ?? existingTeeSet;
  }

  const [createdTeeSet] = await db
    .insert(teeSets)
    .values({
      courseId,
      meters: Math.round(yards * 0.9144),
      name: "Imported tees",
      par,
      updatedAt: now,
      yards,
    })
    .returning();

  return createdTeeSet as TeeSetRow;
}

function recentAutoImportAttempt(metadata: Record<string, unknown>, now: Date) {
  const attemptedAt =
    typeof metadata.geometryAutoImportAttemptedAt === "string"
      ? Date.parse(metadata.geometryAutoImportAttemptedAt)
      : Number.NaN;

  return Number.isFinite(attemptedAt) && now.getTime() - attemptedAt < GEOMETRY_RETRY_INTERVAL_MS;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
