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

export async function seedKnownCoursesAction() {
  await Promise.all([
    ensureTpcSawgrassStadiumCourse(),
    ensureBootleGolfCourse(),
    ensureMountainParkCourse(),
  ]);
  revalidateCourses();
}

export async function createCourseAction(formData: FormData) {
  const db = getDb();
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

export async function updateTeeSetAction(formData: FormData) {
  const db = getDb();
  const courseId = requiredString(formData, "courseId");
  const teeSetId = requiredString(formData, "teeSetId");
  const name = requiredString(formData, "name");
  const yards = numberFromForm(formData, "yards");

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

function revalidateCourses(courseId?: string) {
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/rounds");

  if (courseId) {
    revalidatePath(`/courses/${courseId}/holes`);
  }
}
