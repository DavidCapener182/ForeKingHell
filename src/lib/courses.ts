import { and, eq } from "drizzle-orm";

import { courses, holes, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  BOOTLE_GOLF_COURSE,
  BOOTLE_GOLF_COURSE_HOLES,
  BOOTLE_GOLF_COURSE_YELLOW_TEE_SET,
  MOUNTAIN_PARK_COURSE,
  MOUNTAIN_PARK_HOLES,
  MOUNTAIN_PARK_YELLOW_TEE_SET,
  TPC_SAWGRASS_STADIUM_COURSE,
  TPC_SAWGRASS_STADIUM_HOLES,
  TPC_SAWGRASS_STADIUM_WHITE_TEE_SET,
} from "@/lib/course-map-data";

export type CourseSessionLink = {
  courseId: string | null;
  teeSetId: string | null;
};

const TPC_WHITE_YARDAGES = [
  360, 469, 134, 324, 422, 333, 382, 168, 522, 351, 469, 296, 141, 377, 366, 470,
  115, 387,
];
const BOOTLE_YELLOW_YARDAGES = [
  190, 336, 371, 325, 165, 326, 371, 375, 473, 349, 131, 366, 330, 177, 442,
  373, 352, 387,
];
const MOUNTAIN_PARK_YELLOW_YARDAGES = [167, 257, 271, 165, 313, 447, 380, 358, 236];

export async function ensureKnownCourseForSession(courseName: string | null | undefined): Promise<CourseSessionLink> {
  if (!courseName) {
    return { courseId: null, teeSetId: null };
  }

  if (/sawgrass|stadium/i.test(courseName)) {
    return ensureTpcSawgrassStadiumCourse();
  }

  if (/bootle/i.test(courseName)) {
    return ensureBootleGolfCourse();
  }

  if (/mountain park/i.test(courseName)) {
    return ensureMountainParkCourse();
  }

  return { courseId: null, teeSetId: null };
}

export async function ensureTpcSawgrassStadiumCourse(): Promise<CourseSessionLink> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [course] = await tx
      .insert(courses)
      .values({
        name: TPC_SAWGRASS_STADIUM_COURSE.name,
        country: TPC_SAWGRASS_STADIUM_COURSE.country,
        provider: TPC_SAWGRASS_STADIUM_COURSE.provider,
        externalId: TPC_SAWGRASS_STADIUM_COURSE.externalId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courses.provider, courses.externalId],
        set: {
          name: TPC_SAWGRASS_STADIUM_COURSE.name,
          country: TPC_SAWGRASS_STADIUM_COURSE.country,
          updatedAt: now,
        },
      })
      .returning({ id: courses.id });

    const [teeSet] = await tx
      .insert(teeSets)
      .values({
        courseId: course.id,
        name: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.name,
        par: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.par,
        courseRating: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.courseRating,
        slopeRating: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.slopeRating,
        yards: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.yards,
        meters: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.meters,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [teeSets.courseId, teeSets.name],
        set: {
          par: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.par,
          courseRating: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.courseRating,
          slopeRating: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.slopeRating,
          yards: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.yards,
          meters: TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.meters,
          updatedAt: now,
        },
      })
      .returning({ id: teeSets.id });

    for (const hole of TPC_SAWGRASS_STADIUM_HOLES) {
      const tee = hole.geometry[0];
      const green = hole.geometry[hole.geometry.length - 1];

      await tx
        .insert(holes)
        .values({
          courseId: course.id,
          teeSetId: teeSet.id,
          holeNumber: hole.holeNumber,
          par: hole.par,
          strokeIndex: hole.handicap,
          yards: TPC_WHITE_YARDAGES[hole.holeNumber - 1],
          teeLat: tee[0],
          teeLng: tee[1],
          greenLat: green[0],
          greenLng: green[1],
          centerlineGeojson: toLineStringGeojson(hole.geometry),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [holes.teeSetId, holes.holeNumber],
          set: {
            par: hole.par,
            strokeIndex: hole.handicap,
            yards: TPC_WHITE_YARDAGES[hole.holeNumber - 1],
            teeLat: tee[0],
            teeLng: tee[1],
            greenLat: green[0],
            greenLng: green[1],
            centerlineGeojson: toLineStringGeojson(hole.geometry),
            updatedAt: now,
          },
        });
    }

    return { courseId: course.id, teeSetId: teeSet.id };
  });
}

export async function ensureBootleGolfCourse(): Promise<CourseSessionLink> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [course] = await tx
      .insert(courses)
      .values({
        name: BOOTLE_GOLF_COURSE.name,
        country: BOOTLE_GOLF_COURSE.country,
        provider: BOOTLE_GOLF_COURSE.provider,
        externalId: BOOTLE_GOLF_COURSE.externalId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courses.provider, courses.externalId],
        set: {
          name: BOOTLE_GOLF_COURSE.name,
          country: BOOTLE_GOLF_COURSE.country,
          updatedAt: now,
        },
      })
      .returning({ id: courses.id });

    const [teeSet] = await tx
      .insert(teeSets)
      .values({
        courseId: course.id,
        name: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.name,
        par: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.par,
        courseRating: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.courseRating,
        slopeRating: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.slopeRating,
        yards: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.yards,
        meters: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.meters,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [teeSets.courseId, teeSets.name],
        set: {
          par: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.par,
          courseRating: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.courseRating,
          slopeRating: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.slopeRating,
          yards: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.yards,
          meters: BOOTLE_GOLF_COURSE_YELLOW_TEE_SET.meters,
          updatedAt: now,
        },
      })
      .returning({ id: teeSets.id });

    for (const hole of BOOTLE_GOLF_COURSE_HOLES) {
      const tee = hole.geometry[0];
      const green = hole.geometry[hole.geometry.length - 1];

      await tx
        .insert(holes)
        .values({
          courseId: course.id,
          teeSetId: teeSet.id,
          holeNumber: hole.holeNumber,
          par: hole.par,
          strokeIndex: hole.handicap,
          yards: BOOTLE_YELLOW_YARDAGES[hole.holeNumber - 1],
          teeLat: tee[0],
          teeLng: tee[1],
          greenLat: green[0],
          greenLng: green[1],
          centerlineGeojson: toLineStringGeojson(hole.geometry),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [holes.teeSetId, holes.holeNumber],
          set: {
            par: hole.par,
            strokeIndex: hole.handicap,
            yards: BOOTLE_YELLOW_YARDAGES[hole.holeNumber - 1],
            teeLat: tee[0],
            teeLng: tee[1],
            greenLat: green[0],
            greenLng: green[1],
            centerlineGeojson: toLineStringGeojson(hole.geometry),
            updatedAt: now,
          },
        });
    }

    return { courseId: course.id, teeSetId: teeSet.id };
  });
}

export async function ensureMountainParkCourse(): Promise<CourseSessionLink> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [course] = await tx
      .insert(courses)
      .values({
        name: MOUNTAIN_PARK_COURSE.name,
        country: MOUNTAIN_PARK_COURSE.country,
        provider: MOUNTAIN_PARK_COURSE.provider,
        externalId: MOUNTAIN_PARK_COURSE.externalId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courses.provider, courses.externalId],
        set: {
          name: MOUNTAIN_PARK_COURSE.name,
          country: MOUNTAIN_PARK_COURSE.country,
          updatedAt: now,
        },
      })
      .returning({ id: courses.id });

    const [teeSet] = await tx
      .insert(teeSets)
      .values({
        courseId: course.id,
        name: MOUNTAIN_PARK_YELLOW_TEE_SET.name,
        par: MOUNTAIN_PARK_YELLOW_TEE_SET.par,
        courseRating: MOUNTAIN_PARK_YELLOW_TEE_SET.courseRating,
        slopeRating: MOUNTAIN_PARK_YELLOW_TEE_SET.slopeRating,
        yards: MOUNTAIN_PARK_YELLOW_TEE_SET.yards,
        meters: MOUNTAIN_PARK_YELLOW_TEE_SET.meters,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [teeSets.courseId, teeSets.name],
        set: {
          par: MOUNTAIN_PARK_YELLOW_TEE_SET.par,
          courseRating: MOUNTAIN_PARK_YELLOW_TEE_SET.courseRating,
          slopeRating: MOUNTAIN_PARK_YELLOW_TEE_SET.slopeRating,
          yards: MOUNTAIN_PARK_YELLOW_TEE_SET.yards,
          meters: MOUNTAIN_PARK_YELLOW_TEE_SET.meters,
          updatedAt: now,
        },
      })
      .returning({ id: teeSets.id });

    for (const hole of MOUNTAIN_PARK_HOLES) {
      const tee = hole.geometry[0];
      const green = hole.geometry[hole.geometry.length - 1];

      await tx
        .insert(holes)
        .values({
          courseId: course.id,
          teeSetId: teeSet.id,
          holeNumber: hole.holeNumber,
          par: hole.par,
          strokeIndex: hole.handicap,
          yards: MOUNTAIN_PARK_YELLOW_YARDAGES[hole.holeNumber - 1],
          teeLat: tee[0],
          teeLng: tee[1],
          greenLat: green[0],
          greenLng: green[1],
          centerlineGeojson: toLineStringGeojson(hole.geometry),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [holes.teeSetId, holes.holeNumber],
          set: {
            par: hole.par,
            strokeIndex: hole.handicap,
            yards: MOUNTAIN_PARK_YELLOW_YARDAGES[hole.holeNumber - 1],
            teeLat: tee[0],
            teeLng: tee[1],
            greenLat: green[0],
            greenLng: green[1],
            centerlineGeojson: toLineStringGeojson(hole.geometry),
            updatedAt: now,
          },
        });
    }

    return { courseId: course.id, teeSetId: teeSet.id };
  });
}

export async function findTpcSawgrassStadiumCourse(): Promise<CourseSessionLink> {
  const db = getDb();
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.provider, TPC_SAWGRASS_STADIUM_COURSE.provider),
        eq(courses.externalId, TPC_SAWGRASS_STADIUM_COURSE.externalId),
      ),
    )
    .limit(1);

  if (!course) {
    return { courseId: null, teeSetId: null };
  }

  const [teeSet] = await db
    .select({ id: teeSets.id })
    .from(teeSets)
    .where(
      and(
        eq(teeSets.courseId, course.id),
        eq(teeSets.name, TPC_SAWGRASS_STADIUM_WHITE_TEE_SET.name),
      ),
    )
    .limit(1);

  return { courseId: course.id, teeSetId: teeSet?.id ?? null };
}

function toLineStringGeojson(points: Array<[number, number]>) {
  return {
    type: "LineString" as const,
    coordinates: points.map(([lat, lng]) => [lng, lat] as [number, number]),
  };
}
