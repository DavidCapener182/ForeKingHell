import { and, asc, desc, eq, or, sql } from "drizzle-orm";

import { courses, holes, sessions, teeSets, users } from "@/db/schema";
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

export type ScorecardCourseHole = {
  holeNumber: number;
  par: number;
  yards: number;
  name: string | null;
};

export type ReusableCourseScorecard = {
  courseName: string;
  teeSetId: string | null;
  source: "saved_round" | "course_database";
  holes: ScorecardCourseHole[];
};

const TPC_WHITE_YARDAGES = [
  360, 469, 134, 324, 422, 333, 382, 168, 522, 351, 469, 296, 141, 377, 366, 470, 115, 387,
];
const BOOTLE_YELLOW_YARDAGES = [
  190, 336, 371, 325, 165, 326, 371, 375, 473, 349, 131, 366, 330, 177, 442, 373, 352, 387,
];
const MOUNTAIN_PARK_YELLOW_YARDAGES = [167, 257, 271, 165, 313, 447, 380, 358, 236];

export async function ensureKnownCourseForSession(
  courseName: string | null | undefined,
): Promise<CourseSessionLink> {
  const canonicalName = canonicalKnownCourseNameForSession(courseName);

  if (!canonicalName) {
    return { courseId: null, teeSetId: null };
  }

  if (canonicalName === TPC_SAWGRASS_STADIUM_COURSE.name) {
    return ensureTpcSawgrassStadiumCourse();
  }

  if (canonicalName === BOOTLE_GOLF_COURSE.name) {
    return ensureBootleGolfCourse();
  }

  if (canonicalName === MOUNTAIN_PARK_COURSE.name) {
    return ensureMountainParkCourse();
  }

  return { courseId: null, teeSetId: null };
}

export function canonicalKnownCourseNameForSession(courseName: string | null | undefined) {
  if (!courseName) {
    return null;
  }

  if (/sawgrass/i.test(courseName) || /players.*stadium|stadium.*players/i.test(courseName)) {
    return TPC_SAWGRASS_STADIUM_COURSE.name;
  }

  if (/bootle/i.test(courseName)) {
    return BOOTLE_GOLF_COURSE.name;
  }

  if (/mountain park/i.test(courseName)) {
    return MOUNTAIN_PARK_COURSE.name;
  }

  return null;
}

export async function findReusableCourseScorecardForSession({
  userId,
  courseName,
}: {
  userId: string;
  courseName: string | null | undefined;
}): Promise<ReusableCourseScorecard | null> {
  const nameCandidates = reusableCourseNameCandidates(courseName);

  if (nameCandidates.length === 0) {
    return null;
  }

  const db = getDb();
  const sessionNameMatches = nameCandidates.map(
    (name) => sql`lower(${sessions.courseName}) = ${name}`,
  );
  const recentScorecards = await db
    .select({
      courseName: sessions.courseName,
      teeSetId: sessions.teeSetId,
      scorecardJson: sessions.scorecardJson,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sessionNameMatches.length === 1 ? sessionNameMatches[0] : or(...sessionNameMatches),
      ),
    )
    .orderBy(desc(sessions.date), desc(sessions.createdAt))
    .limit(20);

  for (const row of recentScorecards) {
    const scorecardHoles = reusableHolesFromScorecardJson(row.scorecardJson);

    if (isReusableScorecard(scorecardHoles)) {
      return {
        courseName: row.courseName ?? courseName?.trim() ?? "",
        teeSetId: row.teeSetId,
        source: "saved_round",
        holes: scorecardHoles,
      };
    }
  }

  const courseNameMatches = nameCandidates.map((name) => sql`lower(${courses.name}) = ${name}`);
  const courseRows = await db
    .select({
      courseName: courses.name,
      teeSetId: teeSets.id,
      holeNumber: holes.holeNumber,
      par: holes.par,
      yards: holes.yards,
    })
    .from(courses)
    .innerJoin(teeSets, eq(teeSets.courseId, courses.id))
    .innerJoin(holes, eq(holes.teeSetId, teeSets.id))
    .where(
      and(
        or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
        courseNameMatches.length === 1 ? courseNameMatches[0] : or(...courseNameMatches),
      ),
    )
    .orderBy(asc(courses.name), asc(teeSets.name), asc(holes.holeNumber));
  const scorecardsByTeeSet = new Map<
    string,
    {
      courseName: string;
      teeSetId: string;
      holes: ScorecardCourseHole[];
    }
  >();

  for (const row of courseRows) {
    const existing = scorecardsByTeeSet.get(row.teeSetId) ?? {
      courseName: row.courseName,
      teeSetId: row.teeSetId,
      holes: [],
    };

    existing.holes.push({
      holeNumber: row.holeNumber,
      par: row.par,
      yards: row.yards,
      name: null,
    });
    scorecardsByTeeSet.set(row.teeSetId, existing);
  }

  const scorecards = [...scorecardsByTeeSet.values()];
  const selectedScorecard =
    scorecards.find((scorecard) => isReusableScorecard(scorecard.holes)) ??
    scorecards.find((scorecard) => scorecard.holes.length > 0);

  if (!selectedScorecard) {
    return null;
  }

  return {
    ...selectedScorecard,
    source: "course_database",
    holes: selectedScorecard.holes.sort((left, right) => left.holeNumber - right.holeNumber),
  };
}

export async function ensureCourseForSession({
  userId,
  courseName,
  scorecardHoles,
}: {
  userId: string;
  courseName: string | null | undefined;
  scorecardHoles: ScorecardCourseHole[] | null | undefined;
}): Promise<CourseSessionLink> {
  const knownCourse = await ensureKnownCourseForSession(courseName);

  if (knownCourse.courseId) {
    return knownCourse;
  }

  return ensureManualScorecardCourseForSession(userId, courseName, scorecardHoles);
}

async function ensureManualScorecardCourseForSession(
  userId: string,
  courseName: string | null | undefined,
  scorecardHoles: ScorecardCourseHole[] | null | undefined,
): Promise<CourseSessionLink> {
  const name = courseName?.trim();
  const holesForTee =
    scorecardHoles?.filter((hole) => Number.isFinite(hole.par) && Number.isFinite(hole.yards)) ??
    [];

  if (!name || holesForTee.length === 0) {
    return { courseId: null, teeSetId: null };
  }

  const db = getDb();
  const now = new Date();
  const par = holesForTee.reduce((total, hole) => total + hole.par, 0);
  const yards = holesForTee.reduce((total, hole) => total + hole.yards, 0);
  const externalId = manualScorecardExternalId(userId, name);

  return db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: userId,
        preferredUnits: "yards",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          updatedAt: now,
        },
      });

    const [course] = await tx
      .insert(courses)
      .values({
        name,
        provider: "manual",
        externalId,
        visibility: "private",
        createdByUserId: userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courses.provider, courses.externalId],
        set: {
          name,
          visibility: "private",
          createdByUserId: userId,
          updatedAt: now,
        },
      })
      .returning({ id: courses.id });

    const [teeSet] = await tx
      .insert(teeSets)
      .values({
        courseId: course.id,
        name: scorecardTeeSetName(holesForTee.length),
        par,
        yards,
        meters: Math.round(yards * 0.9144),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [teeSets.courseId, teeSets.name],
        set: {
          par,
          yards,
          meters: Math.round(yards * 0.9144),
          updatedAt: now,
        },
      })
      .returning({ id: teeSets.id });

    return { courseId: course.id, teeSetId: teeSet.id };
  });
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

function scorecardTeeSetName(holeCount: number) {
  return `Scorecard (${holeCount} holes)`;
}

function manualScorecardExternalId(userId: string, courseName: string) {
  const slug = courseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `rapsodo-scorecard-${userId}-${slug || "course"}`;
}

function reusableCourseNameCandidates(courseName: string | null | undefined) {
  const rawName = courseName?.trim();
  const canonicalName = canonicalKnownCourseNameForSession(rawName);

  return Array.from(
    new Set(
      [rawName, canonicalName]
        .filter((name): name is string => Boolean(name))
        .map((name) => name.toLowerCase()),
    ),
  );
}

function reusableHolesFromScorecardJson(scorecardJson: unknown): ScorecardCourseHole[] {
  if (!Array.isArray(scorecardJson)) {
    return [];
  }

  return scorecardJson
    .map((hole): ScorecardCourseHole | null => {
      if (!hole || typeof hole !== "object") {
        return null;
      }

      const row = hole as Record<string, unknown>;
      const holeNumber = reusablePositiveInteger(row.holeNumber);
      const par = reusablePositiveInteger(row.par);
      const yards = reusablePositiveInteger(row.yards);

      if (
        holeNumber === null ||
        holeNumber < 1 ||
        holeNumber > 18 ||
        par === null ||
        par < 3 ||
        par > 6 ||
        yards === null ||
        yards < 50 ||
        yards > 800
      ) {
        return null;
      }

      return {
        holeNumber,
        par,
        yards,
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
      };
    })
    .filter((hole): hole is ScorecardCourseHole => hole !== null)
    .sort((left, right) => left.holeNumber - right.holeNumber);
}

function reusablePositiveInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : null;
}

function isReusableScorecard(scorecardHoles: ScorecardCourseHole[]) {
  if (scorecardHoles.length !== 9 && scorecardHoles.length !== 18) {
    return false;
  }

  const uniqueHoleNumbers = new Set(scorecardHoles.map((hole) => hole.holeNumber));
  return uniqueHoleNumbers.size === scorecardHoles.length;
}
