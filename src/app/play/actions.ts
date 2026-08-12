"use server";

import { cookies } from "next/headers";
import { and, eq, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { courses, teeSets } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { SELECTED_COURSE_COOKIE, SELECTED_TEE_COOKIE } from "@/lib/selected-course";

export async function selectCompanionPlayContextAction(courseId: string, teeSetId?: string | null) {
  const userId = await requireCurrentUserId();
  const [selectedCourse] = await getDb()
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
      ),
    )
    .limit(1);
  if (!selectedCourse) throw new Error("Course not available.");

  const [selectedTee] = teeSetId
    ? await getDb()
        .select({ id: teeSets.id })
        .from(teeSets)
        .where(and(eq(teeSets.id, teeSetId), eq(teeSets.courseId, selectedCourse.id)))
        .limit(1)
    : [];
  if (teeSetId && !selectedTee) throw new Error("Tee not available for this course.");

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  cookieStore.set(SELECTED_COURSE_COOKIE, selectedCourse.id, cookieOptions);
  if (selectedTee) cookieStore.set(SELECTED_TEE_COOKIE, selectedTee.id, cookieOptions);
  else cookieStore.delete(SELECTED_TEE_COOKIE);

  return { courseId: selectedCourse.id, teeSetId: selectedTee?.id ?? null };
}
