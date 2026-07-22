import "server-only";

import { and, eq } from "drizzle-orm";

import { courseTwinPuttingSurveys, courses } from "@/db/schema";
import { getDb } from "@/db/client";

export type CourseTwinPuttingSurveyInput = {
  holeNumber: number;
  sourceName: string;
  sourceUrl: string | null;
  capturedAt: string;
  coordinateSystem: "EPSG:4326";
  gridSpacingM: number;
  verticalAccuracyMm: number;
  grid: {
    bounds: {
      minLatitude: number;
      maxLatitude: number;
      minLongitude: number;
      maxLongitude: number;
    };
    width: number;
    height: number;
    elevationsM: number[];
  };
};

export async function importCourseTwinPuttingSurvey(
  courseId: string,
  rawInput: CourseTwinPuttingSurveyInput,
) {
  const input = validatePuttingSurvey(rawInput);
  const [course] = await getDb()
    .select({ id: courses.id, latitude: courses.latitude, longitude: courses.longitude })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (
    course?.latitude === null ||
    course?.latitude === undefined ||
    course.longitude === null ||
    course.longitude === undefined
  ) {
    throw new Error("Course coordinates are required.");
  }
  if (!gridIsNearCourse(input.grid.bounds, course.latitude, course.longitude)) {
    throw new Error("Putting survey does not overlap the selected course.");
  }
  const now = new Date();
  const [survey] = await getDb()
    .insert(courseTwinPuttingSurveys)
    .values({
      courseId,
      holeNumber: input.holeNumber,
      status: "pending",
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      capturedAt: new Date(input.capturedAt),
      coordinateSystem: input.coordinateSystem,
      gridSpacingM: input.gridSpacingM,
      verticalAccuracyMm: input.verticalAccuracyMm,
      gridJson: input.grid,
      reviewedByUserId: null,
      reviewedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [courseTwinPuttingSurveys.courseId, courseTwinPuttingSurveys.holeNumber],
      set: {
        status: "pending",
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        capturedAt: new Date(input.capturedAt),
        coordinateSystem: input.coordinateSystem,
        gridSpacingM: input.gridSpacingM,
        verticalAccuracyMm: input.verticalAccuracyMm,
        gridJson: input.grid,
        reviewedByUserId: null,
        reviewedAt: null,
        updatedAt: now,
      },
    })
    .returning();
  return survey;
}

export async function reviewCourseTwinPuttingSurvey({
  courseId,
  surveyId,
  reviewerUserId,
  status,
  scorecardVerified,
}: {
  courseId: string;
  surveyId: string;
  reviewerUserId: string;
  status: "verified" | "rejected";
  scorecardVerified: boolean;
}) {
  const [survey] = await getDb()
    .select()
    .from(courseTwinPuttingSurveys)
    .where(
      and(
        eq(courseTwinPuttingSurveys.id, surveyId),
        eq(courseTwinPuttingSurveys.courseId, courseId),
      ),
    )
    .limit(1);
  if (!survey) return null;
  if (status === "verified" && (survey.gridSpacingM > 0.25 || survey.verticalAccuracyMm > 10)) {
    throw new Error(
      "Grade A surveys require 0.25 m spacing and 10 mm vertical accuracy or better.",
    );
  }
  const now = new Date();
  const [updated] = await getDb()
    .update(courseTwinPuttingSurveys)
    .set({ status, reviewedByUserId: reviewerUserId, reviewedAt: now, updatedAt: now })
    .where(eq(courseTwinPuttingSurveys.id, survey.id))
    .returning();
  if (scorecardVerified) {
    const [course] = await getDb()
      .select({ metadata: courses.googleMetadataJson })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    await getDb()
      .update(courses)
      .set({
        googleMetadataJson: {
          ...(course?.metadata ?? {}),
          scorecardVerifiedAt: now.toISOString(),
          scorecardVerifiedBy: reviewerUserId,
        },
        updatedAt: now,
      })
      .where(eq(courses.id, courseId));
  }
  return updated;
}

export function validatePuttingSurvey(input: CourseTwinPuttingSurveyInput) {
  if (
    !input ||
    !Number.isInteger(input.holeNumber) ||
    input.holeNumber < 1 ||
    input.holeNumber > 54 ||
    typeof input.sourceName !== "string" ||
    input.sourceName.trim().length < 3 ||
    input.sourceName.length > 180 ||
    input.coordinateSystem !== "EPSG:4326" ||
    !Number.isFinite(input.gridSpacingM) ||
    input.gridSpacingM < 0.02 ||
    input.gridSpacingM > 1 ||
    !Number.isFinite(input.verticalAccuracyMm) ||
    input.verticalAccuracyMm <= 0 ||
    input.verticalAccuracyMm > 100
  ) {
    throw new Error("Putting survey metadata is invalid.");
  }
  const capturedAt = new Date(input.capturedAt);
  if (!Number.isFinite(capturedAt.getTime()) || capturedAt > new Date()) {
    throw new Error("Putting survey capture date is invalid.");
  }
  if (input.sourceUrl !== null) {
    const source = new URL(input.sourceUrl);
    if (source.protocol !== "https:") throw new Error("Putting survey source must use HTTPS.");
  }
  const { grid } = input;
  if (
    !grid ||
    !Number.isInteger(grid.width) ||
    !Number.isInteger(grid.height) ||
    grid.width < 2 ||
    grid.height < 2 ||
    grid.width > 257 ||
    grid.height > 257 ||
    !Array.isArray(grid.elevationsM) ||
    grid.elevationsM.length !== grid.width * grid.height ||
    grid.elevationsM.some(
      (elevation) => !Number.isFinite(elevation) || elevation < -500 || elevation > 9_000,
    ) ||
    !validBounds(grid.bounds)
  ) {
    throw new Error("Putting survey grid is invalid.");
  }
  return {
    ...input,
    sourceName: input.sourceName.trim(),
    capturedAt: capturedAt.toISOString(),
  };
}

function validBounds(bounds: CourseTwinPuttingSurveyInput["grid"]["bounds"]) {
  return (
    bounds &&
    [bounds.minLatitude, bounds.maxLatitude, bounds.minLongitude, bounds.maxLongitude].every(
      Number.isFinite,
    ) &&
    bounds.minLatitude < bounds.maxLatitude &&
    bounds.minLongitude < bounds.maxLongitude &&
    bounds.minLatitude >= -90 &&
    bounds.maxLatitude <= 90 &&
    bounds.minLongitude >= -180 &&
    bounds.maxLongitude <= 180
  );
}

function gridIsNearCourse(
  bounds: CourseTwinPuttingSurveyInput["grid"]["bounds"],
  latitude: number,
  longitude: number,
) {
  const latitudeMargin = 2_500 / 111_320;
  const longitudeMargin = latitudeMargin / Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  return (
    latitude >= bounds.minLatitude - latitudeMargin &&
    latitude <= bounds.maxLatitude + latitudeMargin &&
    longitude >= bounds.minLongitude - longitudeMargin &&
    longitude <= bounds.maxLongitude + longitudeMargin
  );
}
