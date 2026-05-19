"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";

import { courses, holes, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  ensureBootleGolfCourse,
  ensureMountainParkCourse,
  ensureTpcSawgrassStadiumCourse,
} from "@/lib/courses";
import { normalisedCourseName } from "@/lib/course-dedupe";
import { requireCurrentUserId } from "@/lib/current-user";
import { getGoogleCourseDetails, type GoogleCourseDetails } from "@/lib/google-course-enrichment";
import { getOsmHoleGeometry, type OsmHoleGeometry } from "@/lib/osm-course-search";

export async function seedKnownCoursesAction() {
  await requireCurrentUserId();
  await Promise.all([
    ensureTpcSawgrassStadiumCourse(),
    ensureBootleGolfCourse(),
    ensureMountainParkCourse(),
  ]);
  revalidateCourses();
}

export async function createCourseAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const name = requiredString(formData, "name");
  const country = nullableString(formData, "country");
  const teeName = requiredString(formData, "teeName");
  const par = numberFromForm(formData, "par") ?? 72;
  const courseRating = decimalFromForm(formData, "courseRating");
  const slopeRating = numberFromForm(formData, "slopeRating");
  const yards = numberFromForm(formData, "yards");
  const now = new Date();

  const [course] = await db
    .insert(courses)
    .values({
      name,
      country,
      provider: "manual",
      externalId: `manual-${randomUUID()}`,
      visibility: "private",
      createdByUserId: userId,
      updatedAt: now,
    })
    .returning({ id: courses.id });

  await db.insert(teeSets).values({
    courseId: course.id,
    name: teeName,
    par,
    courseRating,
    slopeRating,
    yards,
    meters: yards === null ? null : Math.round(yards * 0.9144),
    updatedAt: now,
  });

  revalidateCourses(course.id);
  redirect(`/courses/${course.id}/holes`);
}

export async function createGoogleCourseAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const placeId = requiredString(formData, "placeId");
  const details = await getGoogleCourseDetails(placeId);
  const now = new Date();

  if (!details) {
    throw new Error("Google could not return details for that course.");
  }

  const importedHoles =
    details.latitude === null || details.longitude === null
      ? []
      : await getOsmHoleGeometry(details.latitude, details.longitude);
  const teeSetName = "Google Places";
  const teeSetPar =
    importedHoles.length > 0 ? importedHoles.reduce((total, hole) => total + hole.par, 0) : 72;
  const teeSetYards =
    importedHoles.length > 0 ? importedHoles.reduce((total, hole) => total + hole.yards, 0) : null;
  const existingCourse = await findGoogleImportTargetCourse(details, importedHoles.length > 0);
  const courseValues = {
    address: details.address,
    country: details.country,
    googleAttributionsJson: details.attributions,
    googleEnrichedAt: now,
    googleMapsUrl: details.googleMapsUrl,
    googleMetadataJson: {
      source: "google-places",
      phoneNumber: details.phoneNumber,
      autoMappedHoleCount: importedHoles.length,
      geometrySource: importedHoles.length > 0 ? "osm-overpass" : null,
    },
    googleOpeningHoursJson: details.openingHours,
    googlePlaceId: details.placeId,
    googleRating: details.rating,
    googleTypesJson: details.types,
    googleUserRatingsTotal: details.userRatingsTotal,
    latitude: details.latitude,
    longitude: details.longitude,
    name: details.name,
    websiteUrl: details.website,
    updatedAt: now,
  };

  const [course] = existingCourse
    ? await db
        .update(courses)
        .set(courseValues)
        .where(eq(courses.id, existingCourse.id))
        .returning({ id: courses.id })
    : await db
        .insert(courses)
        .values({
          ...courseValues,
          externalId: details.placeId,
          provider: "google-places",
          visibility: "private",
          createdByUserId: userId,
        })
        .onConflictDoUpdate({
          target: [courses.provider, courses.externalId],
          set: courseValues,
        })
        .returning({ id: courses.id });

  const [teeSet] = await db
    .insert(teeSets)
    .values({
      courseId: course.id,
      name: teeSetName,
      par: teeSetPar,
      yards: teeSetYards,
      meters: teeSetYards === null ? null : Math.round(teeSetYards * 0.9144),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [teeSets.courseId, teeSets.name],
      set: {
        par: teeSetPar,
        yards: teeSetYards,
        meters: teeSetYards === null ? null : Math.round(teeSetYards * 0.9144),
        updatedAt: now,
      },
    })
    .returning({ id: teeSets.id });

  await upsertImportedHoleGeometry(course.id, teeSet.id, importedHoles, now);
  if (importedHoles.length > 0) {
    await deleteLegacyGoogleOsmTeeSet(course.id);
  }

  revalidateCourses(course.id);
  redirect(`/courses/${course.id}/holes`);
}

async function findGoogleImportTargetCourse(
  details: GoogleCourseDetails,
  canReplaceDuplicateGeometry: boolean,
) {
  const db = getDb();
  const rows = await db
    .select({
      country: courses.country,
      googlePlaceId: courses.googlePlaceId,
      id: courses.id,
      name: courses.name,
    })
    .from(courses);
  const exactGoogleMatch = rows.find((course) => course.googlePlaceId === details.placeId);
  const detailsName = normalisedCourseName(details.name);
  const detailsCountry = normalisedCountry(details.country);
  const seededMatch =
    rows.find(
      (course) =>
        !course.googlePlaceId &&
        normalisedCourseName(course.name) === detailsName &&
        normalisedCountry(course.country) === detailsCountry,
    ) ?? null;

  if (seededMatch && exactGoogleMatch && seededMatch.id !== exactGoogleMatch.id) {
    const removedDuplicate =
      canReplaceDuplicateGeometry &&
      (await deleteUnreferencedGoogleDuplicateCourse(exactGoogleMatch.id));

    return removedDuplicate ? seededMatch : exactGoogleMatch;
  }

  return seededMatch ?? exactGoogleMatch ?? null;
}

async function upsertImportedHoleGeometry(
  courseId: string,
  teeSetId: string,
  importedHoles: OsmHoleGeometry[],
  now: Date,
) {
  if (importedHoles.length === 0) {
    return;
  }

  const db = getDb();

  for (const hole of importedHoles) {
    await db
      .insert(holes)
      .values({
        courseId,
        teeSetId,
        holeNumber: hole.holeNumber,
        par: hole.par,
        strokeIndex: null,
        yards: hole.yards,
        teeLat: hole.teeLat,
        teeLng: hole.teeLng,
        greenLat: hole.greenLat,
        greenLng: hole.greenLng,
        centerlineGeojson: {
          type: "LineString" as const,
          coordinates: [
            [hole.teeLng, hole.teeLat],
            [hole.greenLng, hole.greenLat],
          ] as Array<[number, number]>,
        },
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [holes.teeSetId, holes.holeNumber],
        set: {
          par: hole.par,
          strokeIndex: null,
          yards: hole.yards,
          teeLat: hole.teeLat,
          teeLng: hole.teeLng,
          greenLat: hole.greenLat,
          greenLng: hole.greenLng,
          centerlineGeojson: {
            type: "LineString" as const,
            coordinates: [
              [hole.teeLng, hole.teeLat],
              [hole.greenLng, hole.greenLat],
            ] as Array<[number, number]>,
          },
          updatedAt: now,
        },
      });
  }
}

async function deleteLegacyGoogleOsmTeeSet(courseId: string) {
  const db = getDb();

  await db
    .delete(teeSets)
    .where(and(eq(teeSets.courseId, courseId), eq(teeSets.name, "Google Places + OSM")));
}

async function deleteUnreferencedGoogleDuplicateCourse(courseId: string) {
  const db = getDb();
  const [usage] = await db
    .select({
      courseFollows: sql<number>`(select count(*)::int from fkh_course_follows where course_id = ${courseId})`,
      recordAttempts: sql<number>`(select count(*)::int from fkh_course_record_attempts where course_id = ${courseId})`,
      records: sql<number>`(select count(*)::int from fkh_course_records where course_id = ${courseId})`,
      rounds: sql<number>`(select count(*)::int from fkh_sessions where course_id = ${courseId})`,
      tournaments: sql<number>`(select count(*)::int from fkh_tournaments where course_id = ${courseId})`,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (
    !usage ||
    usage.courseFollows > 0 ||
    usage.recordAttempts > 0 ||
    usage.records > 0 ||
    usage.rounds > 0 ||
    usage.tournaments > 0
  ) {
    return false;
  }

  await db.delete(courses).where(eq(courses.id, courseId));

  return true;
}

function normalisedCountry(country: string | null) {
  const value = country?.trim().toLowerCase();

  if (!value) {
    return "";
  }

  if (value === "united states" || value === "us") {
    return "usa";
  }

  if (value === "united kingdom" || value === "great britain" || value === "gb") {
    return "uk";
  }

  return value;
}

export async function createOsmCourseAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const name = requiredString(formData, "name");
  const country = nullableString(formData, "country");
  const osmType = requiredString(formData, "osmType");
  const osmId = requiredString(formData, "osmId");
  const teeName = nullableString(formData, "teeName") ?? "OpenStreetMap";
  const importedHoles = parseOsmHoles(formData);
  const now = new Date();
  const par =
    importedHoles.length > 0 ? importedHoles.reduce((total, hole) => total + hole.par, 0) : 72;
  const yards =
    importedHoles.length > 0 ? importedHoles.reduce((total, hole) => total + hole.yards, 0) : null;

  const [course] = await db
    .insert(courses)
    .values({
      name,
      country,
      provider: "osm",
      externalId: `osm-${osmType}-${osmId}-${userId}`,
      visibility: "private",
      createdByUserId: userId,
      updatedAt: now,
    })
    .returning({ id: courses.id });

  const [teeSet] = await db
    .insert(teeSets)
    .values({
      courseId: course.id,
      name: teeName,
      par,
      yards,
      meters: yards === null ? null : Math.round(yards * 0.9144),
      updatedAt: now,
    })
    .returning({ id: teeSets.id });

  await upsertImportedHoleGeometry(course.id, teeSet.id, importedHoles, now);

  revalidateCourses(course.id);
  redirect(`/courses/${course.id}/holes`);
}

export async function updateTeeSetAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const courseId = requiredString(formData, "courseId");
  const teeSetId = requiredString(formData, "teeSetId");
  const name = requiredString(formData, "name");
  const yards = numberFromForm(formData, "yards");

  await requireEditableCourse(courseId, userId);

  await db
    .update(teeSets)
    .set({
      name,
      par: numberFromForm(formData, "par") ?? 72,
      courseRating: decimalFromForm(formData, "courseRating"),
      slopeRating: numberFromForm(formData, "slopeRating"),
      yards,
      meters: yards === null ? null : Math.round(yards * 0.9144),
      updatedAt: new Date(),
    })
    .where(and(eq(teeSets.id, teeSetId), eq(teeSets.courseId, courseId)));

  revalidateCourses(courseId);
}

export async function upsertHoleAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const courseId = requiredString(formData, "courseId");
  const teeSetId = requiredString(formData, "teeSetId");
  const holeNumber = numberFromForm(formData, "holeNumber");
  const par = numberFromForm(formData, "par");
  const yards = numberFromForm(formData, "yards");
  const teeLat = decimalFromForm(formData, "teeLat");
  const teeLng = decimalFromForm(formData, "teeLng");
  const greenLat = decimalFromForm(formData, "greenLat");
  const greenLng = decimalFromForm(formData, "greenLng");

  if (
    holeNumber === null ||
    par === null ||
    yards === null ||
    teeLat === null ||
    teeLng === null ||
    greenLat === null ||
    greenLng === null
  ) {
    throw new Error("Hole number, par, yards, tee coordinates and green coordinates are required.");
  }

  await requireEditableCourse(courseId, userId);

  const centerlineGeojson = {
    type: "LineString" as const,
    coordinates: [
      [teeLng, teeLat],
      [greenLng, greenLat],
    ] as Array<[number, number]>,
  };
  const now = new Date();

  await db
    .insert(holes)
    .values({
      courseId,
      teeSetId,
      holeNumber,
      par,
      strokeIndex: numberFromForm(formData, "strokeIndex"),
      yards,
      teeLat,
      teeLng,
      greenLat,
      greenLng,
      centerlineGeojson,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [holes.teeSetId, holes.holeNumber],
      set: {
        par,
        strokeIndex: numberFromForm(formData, "strokeIndex"),
        yards,
        teeLat,
        teeLng,
        greenLat,
        greenLng,
        centerlineGeojson,
        updatedAt: now,
      },
    });

  revalidateCourses(courseId);
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function nullableString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberFromForm(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function decimalFromForm(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOsmHoles(formData: FormData): OsmHoleGeometry[] {
  const value = formData.get("holesJson");

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((hole): OsmHoleGeometry | null => {
      if (!hole || typeof hole !== "object") {
        return null;
      }

      const candidate = hole as Record<string, unknown>;
      const holeNumber = safeInteger(candidate.holeNumber, 1, 27);
      const par = safeInteger(candidate.par, 3, 6);
      const yards = safeInteger(candidate.yards, 1, 800);
      const teeLat = safeDecimal(candidate.teeLat);
      const teeLng = safeDecimal(candidate.teeLng);
      const greenLat = safeDecimal(candidate.greenLat);
      const greenLng = safeDecimal(candidate.greenLng);

      if (
        holeNumber === null ||
        par === null ||
        yards === null ||
        teeLat === null ||
        teeLng === null ||
        greenLat === null ||
        greenLng === null
      ) {
        return null;
      }

      return {
        holeNumber,
        name: typeof candidate.name === "string" ? candidate.name : null,
        par,
        yards,
        teeLat,
        teeLng,
        greenLat,
        greenLng,
      };
    })
    .filter((hole): hole is OsmHoleGeometry => hole !== null);
}

function safeInteger(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

function safeDecimal(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function requireEditableCourse(courseId: string, userId: string) {
  const db = getDb();
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.createdByUserId, userId)))
    .limit(1);

  if (!course) {
    throw new Error("You can only edit courses you created.");
  }
}

function revalidateCourses(courseId?: string) {
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/rounds");

  if (courseId) {
    revalidatePath(`/courses/${courseId}/holes`);
  }
}
