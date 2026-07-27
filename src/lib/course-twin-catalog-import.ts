import "server-only";

import { createHash } from "node:crypto";

import { and, asc, eq, lte } from "drizzle-orm";

import { courseTwinCatalogJobs, courses, holes } from "@/db/schema";
import { getDb } from "@/db/client";
import { ensureCourseAutoImport } from "@/lib/course-auto-enrichment";
import { enqueueCourseTwinBuild } from "@/lib/course-twin-build-jobs";

const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export type CourseTwinCatalogCandidate = {
  externalId: string;
  osmType: "node" | "way" | "relation";
  osmId: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  website: string | null;
  mappedHoles: number;
  mappedGreens: number;
  mappedFairways: number;
  mappedBunkers: number;
  mappedTees: number;
  mappedWater: number;
  readinessScore: number;
  sourceRegion: string;
};

export async function importCourseTwinCatalog({
  candidates,
  requestedByUserId,
  force = false,
}: {
  candidates: CourseTwinCatalogCandidate[];
  requestedByUserId: string;
  force?: boolean;
}) {
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 50) {
    throw new Error("Course Twin catalogue must contain between 1 and 50 candidates.");
  }
  const validated = candidates.map(validateCandidate);
  const batchFingerprint = createHash("sha256")
    .update(JSON.stringify(validated))
    .digest("hex")
    .slice(0, 24);
  const db = getDb();
  const jobs = [];

  for (const candidate of validated) {
    const idempotencyKey = `catalog:${batchFingerprint}:${candidate.externalId}:${force ? "force" : "normal"}`;
    const [created] = await db
      .insert(courseTwinCatalogJobs)
      .values({
        requestedByUserId,
        externalId: candidate.externalId,
        idempotencyKey,
        candidateJson: candidate,
        force,
      })
      .onConflictDoNothing({ target: courseTwinCatalogJobs.idempotencyKey })
      .returning({ id: courseTwinCatalogJobs.id, status: courseTwinCatalogJobs.status });
    const existing =
      created ??
      (
        await db
          .select({ id: courseTwinCatalogJobs.id, status: courseTwinCatalogJobs.status })
          .from(courseTwinCatalogJobs)
          .where(eq(courseTwinCatalogJobs.idempotencyKey, idempotencyKey))
          .limit(1)
      )[0];
    if (!existing) throw new Error(`Catalogue job could not be queued for ${candidate.name}.`);
    jobs.push({
      id: existing.id,
      externalId: candidate.externalId,
      name: candidate.name,
      status: existing.status,
      deduplicated: !created,
    });
  }

  return {
    requested: validated.length,
    queued: jobs.filter((job) => job.status === "queued").length,
    jobs,
  };
}

export async function processNextCourseTwinCatalogJob() {
  const db = getDb();
  const now = new Date();
  const [candidate] = await db
    .select()
    .from(courseTwinCatalogJobs)
    .where(
      and(
        eq(courseTwinCatalogJobs.status, "queued"),
        lte(courseTwinCatalogJobs.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(courseTwinCatalogJobs.nextAttemptAt), asc(courseTwinCatalogJobs.createdAt))
    .limit(1);
  if (!candidate) return null;

  const [claimed] = await db
    .update(courseTwinCatalogJobs)
    .set({ status: "running", startedAt: now, updatedAt: now, errorCode: null, errorMessage: null })
    .where(
      and(eq(courseTwinCatalogJobs.id, candidate.id), eq(courseTwinCatalogJobs.status, "queued")),
    )
    .returning({ id: courseTwinCatalogJobs.id });
  if (!claimed) return null;

  try {
    const catalogCandidate = validateCandidate(
      candidate.candidateJson as CourseTwinCatalogCandidate,
    );
    const course = await upsertCatalogCourse(catalogCandidate);
    const currentHoles = await db
      .select({ id: holes.id })
      .from(holes)
      .where(eq(holes.courseId, course.id));
    const enrichment = await ensureCourseAutoImport(course, currentHoles.length, {
      forceGeometry: true,
      skipGoogle: true,
    });
    const mappedHoles = await db
      .select({ id: holes.id })
      .from(holes)
      .where(eq(holes.courseId, course.id));
    if (mappedHoles.length < 1) {
      throw new Error(`No playable hole geometry was imported (${enrichment.status}).`);
    }
    if (!candidate.requestedByUserId) {
      throw new Error("Catalogue job no longer has a requesting administrator.");
    }
    const build = await enqueueCourseTwinBuild({
      courseId: course.id,
      requestedByUserId: candidate.requestedByUserId,
      force: candidate.force,
    });
    if (!build) throw new Error("Course Twin build could not be queued.");
    await db
      .update(courseTwinCatalogJobs)
      .set({
        status: "completed",
        courseId: course.id,
        buildId: build.buildId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courseTwinCatalogJobs.id, candidate.id));
    return {
      jobId: candidate.id,
      status: "completed" as const,
      courseId: course.id,
      buildId: build.buildId,
      mappedHoles: mappedHoles.length,
    };
  } catch (error) {
    const retryCount = candidate.retryCount + 1;
    const failed = retryCount >= MAX_RETRIES;
    const retryDelay = RETRY_DELAYS_MS[Math.min(retryCount - 1, RETRY_DELAYS_MS.length - 1)];
    await db
      .update(courseTwinCatalogJobs)
      .set({
        status: failed ? "failed" : "queued",
        retryCount,
        errorCode: "catalog_enrichment_failed",
        errorMessage:
          error instanceof Error ? error.message.slice(0, 2_000) : "Catalogue enrichment failed.",
        completedAt: failed ? new Date() : null,
        nextAttemptAt: new Date(Date.now() + retryDelay),
        updatedAt: new Date(),
      })
      .where(eq(courseTwinCatalogJobs.id, candidate.id));
    return {
      jobId: candidate.id,
      status: failed ? ("failed" as const) : ("retrying" as const),
      retryCount,
    };
  }
}

async function upsertCatalogCourse(candidate: CourseTwinCatalogCandidate) {
  const now = new Date();
  const [course] = await getDb()
    .insert(courses)
    .values({
      name: candidate.name,
      country: candidate.country,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      provider: "osm",
      externalId: candidate.externalId,
      websiteUrl: candidate.website,
      visibility: "shared",
      googleMetadataJson: catalogMetadata(candidate),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [courses.provider, courses.externalId],
      set: {
        name: candidate.name,
        country: candidate.country,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        websiteUrl: candidate.website,
        visibility: "shared",
        updatedAt: now,
      },
    })
    .returning();
  if (!course) throw new Error("Course row could not be imported.");
  return course;
}

function catalogMetadata(candidate: CourseTwinCatalogCandidate) {
  return {
    source: "course-twin-first-wave",
    osmType: candidate.osmType,
    osmId: candidate.osmId,
    sourceRegion: candidate.sourceRegion,
    readinessScore: candidate.readinessScore,
    mappedEvidence: {
      holes: candidate.mappedHoles,
      greens: candidate.mappedGreens,
      fairways: candidate.mappedFairways,
      bunkers: candidate.mappedBunkers,
      tees: candidate.mappedTees,
      water: candidate.mappedWater,
    },
  };
}

export function validateCandidate(candidate: CourseTwinCatalogCandidate) {
  if (
    !candidate ||
    !/^osm-(node|way|relation)-\d+$/.test(candidate.externalId) ||
    !["node", "way", "relation"].includes(candidate.osmType) ||
    !/^\d+$/.test(candidate.osmId) ||
    candidate.externalId !== `osm-${candidate.osmType}-${candidate.osmId}` ||
    typeof candidate.name !== "string" ||
    candidate.name.trim().length < 2 ||
    candidate.name.length > 180 ||
    typeof candidate.country !== "string" ||
    !Number.isFinite(candidate.latitude) ||
    !Number.isFinite(candidate.longitude) ||
    candidate.latitude < 49.8 ||
    candidate.latitude > 60.9 ||
    candidate.longitude < -8.3 ||
    candidate.longitude > 2.1 ||
    !Number.isInteger(candidate.mappedHoles) ||
    candidate.mappedHoles < 9 ||
    candidate.mappedHoles > 54 ||
    !Number.isInteger(candidate.readinessScore) ||
    candidate.readinessScore < 0 ||
    candidate.readinessScore > 100
  ) {
    throw new Error("Course Twin catalogue candidate is invalid.");
  }
  if (candidate.website !== null) {
    const website = new URL(candidate.website);
    if (!website.protocol.match(/^https?:$/)) throw new Error("Course website is invalid.");
  }
  return {
    ...candidate,
    name: candidate.name.trim(),
    country: candidate.country.trim(),
  };
}
