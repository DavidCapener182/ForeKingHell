"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { courses, holes, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  ensureBootleGolfCourse,
  ensureMountainParkCourse,
  ensureTpcSawgrassStadiumCourse,
} from "@/lib/courses";
import { requireCurrentUserId } from "@/lib/current-user";
import type { OsmHoleGeometry } from "@/lib/osm-course-search";

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

  await db
    .insert(teeSets)
    .values({
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
  const par = importedHoles.length > 0 ? importedHoles.reduce((total, hole) => total + hole.par, 0) : 72;
  const yards = importedHoles.length > 0 ? importedHoles.reduce((total, hole) => total + hole.yards, 0) : null;

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

  if (importedHoles.length > 0) {
    await db.insert(holes).values(
      importedHoles.map((hole) => ({
        courseId: course.id,
        teeSetId: teeSet.id,
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
      })),
    );
  }

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
