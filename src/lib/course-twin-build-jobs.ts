import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  courseFeatures,
  courses,
  courseTwinBuilds,
  courseTwinCorrections,
  courseTwinPuttingSurveys,
  courseTwins,
  holes,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { buildCourseTwinPlan, selectTerrainAdapters } from "@/lib/course-twin-build-plan";

export type UkCourseTwinCandidate = {
  courseId: string;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  mappedHoles: number;
  mappedGreens: number;
  mappedFairways: number;
  mappedBunkers: number;
  twinStatus: string | null;
  terrainAdapter: string;
  targetTerrainResolutionM: number;
  readinessScore: number;
};

type RawUkCourseTwinCandidate = {
  course_id: string;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  mapped_holes: number | string;
  mapped_greens: number | string;
  mapped_fairways: number | string;
  mapped_bunkers: number | string;
  twin_status: string | null;
};

export async function listUkCourseTwinCandidates(limit = 50): Promise<UkCourseTwinCandidate[]> {
  const boundedLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await getDb().execute(sql<RawUkCourseTwinCandidate>`
    SELECT
      course.id AS course_id,
      course.name,
      course.country,
      course.latitude,
      course.longitude,
      COUNT(DISTINCT hole.hole_number) AS mapped_holes,
      COUNT(DISTINCT feature.id) FILTER (WHERE feature.feature_type = 'green') AS mapped_greens,
      COUNT(DISTINCT feature.id) FILTER (WHERE feature.feature_type = 'fairway') AS mapped_fairways,
      COUNT(DISTINCT feature.id) FILTER (WHERE feature.feature_type = 'bunker') AS mapped_bunkers,
      twin.status AS twin_status
    FROM public.fkh_courses course
    LEFT JOIN public.fkh_holes hole ON hole.course_id = course.id
    LEFT JOIN public.fkh_course_features feature ON feature.course_id = course.id
    LEFT JOIN public.fkh_course_twins twin ON twin.course_id = course.id
    WHERE course.latitude BETWEEN 49.8 AND 60.9
      AND course.longitude BETWEEN -8.3 AND 2.1
      AND (
        course.country IS NULL
        OR lower(course.country) SIMILAR TO '%(england|wales|scotland|northern ireland|united kingdom|uk|gb)%'
      )
    GROUP BY course.id, twin.status
    HAVING COUNT(DISTINCT hole.hole_number) > 0
    ORDER BY
      COUNT(DISTINCT hole.hole_number) DESC,
      COUNT(DISTINCT feature.id) FILTER (WHERE feature.feature_type IN ('green', 'fairway')) DESC,
      course.name ASC
    LIMIT ${boundedLimit}
  `);
  return (Array.from(rows) as unknown as RawUkCourseTwinCandidate[])
    .map((row) => {
      const mappedHoles = Number(row.mapped_holes);
      const mappedGreens = Number(row.mapped_greens);
      const mappedFairways = Number(row.mapped_fairways);
      const mappedBunkers = Number(row.mapped_bunkers);
      const terrain = selectTerrainAdapters(row.country, row.latitude, row.longitude);
      return {
        courseId: row.course_id,
        name: row.name,
        country: row.country,
        latitude: row.latitude,
        longitude: row.longitude,
        mappedHoles,
        mappedGreens,
        mappedFairways,
        mappedBunkers,
        twinStatus: row.twin_status,
        terrainAdapter: terrain.primary,
        targetTerrainResolutionM: terrain.targetResolutionM,
        readinessScore: Math.min(
          100,
          Math.round(
            (mappedHoles / 18) * 55 +
              (Math.min(mappedGreens, 18) / 18) * 20 +
              (Math.min(mappedFairways, 18) / 18) * 20 +
              (mappedBunkers > 0 ? 5 : 0),
          ),
        ),
      };
    })
    .sort(
      (left, right) =>
        right.readinessScore - left.readinessScore || left.name.localeCompare(right.name),
    );
}

export async function enqueueUkCourseTwinBatch({
  requestedByUserId,
  limit = 20,
  force = false,
}: {
  requestedByUserId: string;
  limit?: number;
  force?: boolean;
}) {
  const boundedLimit = Math.max(1, Math.min(50, Math.round(limit)));
  const candidates = (await listUkCourseTwinCandidates(100))
    .filter((candidate) => force || candidate.twinStatus !== "published")
    .slice(0, boundedLimit);
  const results = [];
  for (const candidate of candidates) {
    try {
      const build = await enqueueCourseTwinBuild({
        courseId: candidate.courseId,
        requestedByUserId,
        force,
      });
      results.push({
        courseId: candidate.courseId,
        name: candidate.name,
        ok: Boolean(build),
        build,
      });
    } catch (error) {
      results.push({
        courseId: candidate.courseId,
        name: candidate.name,
        ok: false,
        error: error instanceof Error ? error.message : "Build could not be queued.",
      });
    }
  }
  return {
    requested: candidates.length,
    queued: results.filter((result) => result.ok).length,
    results,
  };
}

export async function enqueueCourseTwinBuild({
  courseId,
  requestedByUserId,
  force = false,
}: {
  courseId: string;
  requestedByUserId: string;
  force?: boolean;
}) {
  const db = getDb();
  const [course, holeRows, featureRows, puttingSurveyRows] = await Promise.all([
    db
      .select({
        id: courses.id,
        name: courses.name,
        externalId: courses.externalId,
        country: courses.country,
        latitude: courses.latitude,
        longitude: courses.longitude,
        metadata: courses.googleMetadataJson,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1),
    db
      .select({
        holeNumber: holes.holeNumber,
        par: holes.par,
        yards: holes.yards,
        strokeIndex: holes.strokeIndex,
        teeLat: holes.teeLat,
        teeLng: holes.teeLng,
        greenLat: holes.greenLat,
        greenLng: holes.greenLng,
        centerline: holes.centerlineGeojson,
        updatedAt: holes.updatedAt,
      })
      .from(holes)
      .where(eq(holes.courseId, courseId)),
    db
      .select({
        id: courseFeatures.id,
        holeNumber: courseFeatures.holeNumber,
        featureType: courseFeatures.featureType,
        geometry: courseFeatures.geometryJson,
        source: courseFeatures.source,
        updatedAt: courseFeatures.updatedAt,
      })
      .from(courseFeatures)
      .where(eq(courseFeatures.courseId, courseId)),
    db
      .select({
        holeNumber: courseTwinPuttingSurveys.holeNumber,
        sourceName: courseTwinPuttingSurveys.sourceName,
        sourceUrl: courseTwinPuttingSurveys.sourceUrl,
        capturedAt: courseTwinPuttingSurveys.capturedAt,
        gridSpacingM: courseTwinPuttingSurveys.gridSpacingM,
        verticalAccuracyMm: courseTwinPuttingSurveys.verticalAccuracyMm,
        grid: courseTwinPuttingSurveys.gridJson,
        updatedAt: courseTwinPuttingSurveys.updatedAt,
      })
      .from(courseTwinPuttingSurveys)
      .where(
        and(
          eq(courseTwinPuttingSurveys.courseId, courseId),
          eq(courseTwinPuttingSurveys.status, "verified"),
        ),
      ),
  ]);

  const courseRow = course[0];
  if (!courseRow || courseRow.latitude === null || courseRow.longitude === null) return null;
  const correctionRows = await db
    .select({ id: courseTwinCorrections.id, updatedAt: courseTwinCorrections.updatedAt })
    .from(courseTwinCorrections)
    .innerJoin(courseTwins, eq(courseTwinCorrections.courseTwinId, courseTwins.id))
    .where(and(eq(courseTwins.courseId, courseId), eq(courseTwinCorrections.status, "accepted")))
    .orderBy(desc(courseTwinCorrections.updatedAt));
  const uniqueHoleNumbers = new Set(holeRows.map((row) => row.holeNumber));
  const expectedHoles = uniqueHoleNumbers.size >= 9 ? uniqueHoleNumbers.size : 18;
  const featureCounts = featureRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.featureType] = (counts[row.featureType] ?? 0) + 1;
    return counts;
  }, {});
  const sourceRevision = latestTimestamp([
    courseRow.updatedAt,
    ...holeRows.map((row) => row.updatedAt),
    ...featureRows.map((row) => row.updatedAt),
    ...puttingSurveyRows.map((row) => row.updatedAt),
  ]);
  const correctionRevision = correctionRows[0]
    ? `${correctionRows[0].updatedAt.toISOString()}:${correctionRows.map((row) => row.id).join(",")}`
    : null;
  const plan = buildCourseTwinPlan({
    courseId,
    courseName: courseRow.name,
    externalId: courseRow.externalId,
    country: courseRow.country,
    latitude: courseRow.latitude,
    longitude: courseRow.longitude,
    expectedHoles,
    mappedHoles: uniqueHoleNumbers.size,
    mappedFeatureCounts: featureCounts,
    scorecardVerified:
      typeof courseRow.metadata?.scorecardVerifiedAt === "string" &&
      Number.isFinite(new Date(courseRow.metadata.scorecardVerifiedAt).getTime()),
    courseUpdatedAt: sourceRevision.toISOString(),
    correctionRevision,
    sourceGeometry: {
      holes: holeRows.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        yards: hole.yards,
        strokeIndex: hole.strokeIndex,
        tee: [hole.teeLng, hole.teeLat],
        green: [hole.greenLng, hole.greenLat],
        centerline: hole.centerline.coordinates,
      })),
      features: featureRows.map((feature) => ({
        id: feature.id,
        holeNumber: feature.holeNumber,
        featureType: feature.featureType,
        geometry: feature.geometry,
        source: feature.source,
      })),
      puttingSurveys: puttingSurveyRows.map((survey) => ({
        holeNumber: survey.holeNumber,
        sourceName: survey.sourceName,
        sourceUrl: survey.sourceUrl,
        capturedAt: survey.capturedAt.toISOString(),
        gridSpacingM: survey.gridSpacingM,
        verticalAccuracyMm: survey.verticalAccuracyMm,
        grid: survey.grid,
      })),
    },
  });
  const idempotencyKey = force
    ? `${courseId}:${plan.inputFingerprint}:${randomUUID()}`
    : `${courseId}:${plan.inputFingerprint}`;

  return db.transaction(async (transaction) => {
    await transaction
      .insert(courseTwins)
      .values({
        courseId,
        status: "draft",
        qualityGrade: plan.quality.grade,
        supportedModesJson: plan.quality.supportedModes,
      })
      .onConflictDoNothing({ target: courseTwins.courseId });
    const [twin] = await transaction
      .select({ id: courseTwins.id, status: courseTwins.status })
      .from(courseTwins)
      .where(eq(courseTwins.courseId, courseId))
      .limit(1);
    if (!twin) throw new Error("Course Twin metadata could not be created.");

    const [created] = await transaction
      .insert(courseTwinBuilds)
      .values({
        courseTwinId: twin.id,
        requestedByUserId,
        status: "queued",
        idempotencyKey,
        inputFingerprint: plan.inputFingerprint,
        progressJson: {
          stage: "queued",
          percent: 0,
          plan,
          requestedAt: new Date().toISOString(),
        },
      })
      .onConflictDoNothing({ target: courseTwinBuilds.idempotencyKey })
      .returning({
        id: courseTwinBuilds.id,
        status: courseTwinBuilds.status,
        createdAt: courseTwinBuilds.createdAt,
      });
    const build =
      created ??
      (
        await transaction
          .select({
            id: courseTwinBuilds.id,
            status: courseTwinBuilds.status,
            createdAt: courseTwinBuilds.createdAt,
          })
          .from(courseTwinBuilds)
          .where(eq(courseTwinBuilds.idempotencyKey, idempotencyKey))
          .limit(1)
      )[0];
    if (!build) throw new Error("Course Twin build could not be queued.");

    if (twin.status !== "published") {
      await transaction
        .update(courseTwins)
        .set({
          status: "building",
          qualityGrade: plan.quality.grade,
          supportedModesJson: plan.quality.supportedModes,
          updatedAt: new Date(),
        })
        .where(eq(courseTwins.id, twin.id));
    }

    return {
      courseTwinId: twin.id,
      buildId: build.id,
      status: build.status,
      createdAt: build.createdAt.toISOString(),
      deduplicated: !created,
      plan,
    };
  });
}

export async function getLatestCourseTwinBuild(courseId: string) {
  const [row] = await getDb()
    .select({
      courseTwinId: courseTwins.id,
      twinStatus: courseTwins.status,
      qualityGrade: courseTwins.qualityGrade,
      activeVersionId: courseTwins.activeVersionId,
      buildId: courseTwinBuilds.id,
      buildStatus: courseTwinBuilds.status,
      progress: courseTwinBuilds.progressJson,
      errorCode: courseTwinBuilds.errorCode,
      errorMessage: courseTwinBuilds.errorMessage,
      createdAt: courseTwinBuilds.createdAt,
      updatedAt: courseTwinBuilds.updatedAt,
    })
    .from(courseTwins)
    .leftJoin(courseTwinBuilds, eq(courseTwinBuilds.courseTwinId, courseTwins.id))
    .where(eq(courseTwins.courseId, courseId))
    .orderBy(desc(courseTwinBuilds.createdAt))
    .limit(1);
  return row ?? null;
}

function latestTimestamp(values: Date[]) {
  return values.reduce(
    (latest, value) => (value > latest ? value : latest),
    values[0] ?? new Date(0),
  );
}
