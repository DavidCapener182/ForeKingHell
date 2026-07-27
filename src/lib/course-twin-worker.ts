import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { courseTwinBuilds, courseTwinCorrections, courseTwins } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  applyCourseTwinCorrections,
  type CourseTwinCorrectionInput,
} from "@/lib/course-twin-corrections";
import { stageCourseTwinVersion } from "@/lib/course-twin-package-store";
import {
  parseCourseTwinWorkerCompletion,
  signCourseTwinWorkerPayload,
} from "@/lib/course-twin-worker-protocol";

const DISPATCH_TIMEOUT_MS = 10_000;

export async function dispatchNextCourseTwinBuild() {
  const workerUrl = requiredEnv("COURSE_TWIN_BUILDER_URL");
  const secret = requiredEnv("COURSE_TWIN_WORKER_SECRET");
  const db = getDb();
  const [candidate] = await db
    .select({
      id: courseTwinBuilds.id,
      courseTwinId: courseTwinBuilds.courseTwinId,
      inputFingerprint: courseTwinBuilds.inputFingerprint,
      progress: courseTwinBuilds.progressJson,
      retryCount: courseTwinBuilds.retryCount,
    })
    .from(courseTwinBuilds)
    .where(eq(courseTwinBuilds.status, "queued"))
    .orderBy(asc(courseTwinBuilds.createdAt))
    .limit(1);
  if (!candidate) return null;

  const [claimed] = await db
    .update(courseTwinBuilds)
    .set({ status: "dispatching", updatedAt: new Date() })
    .where(and(eq(courseTwinBuilds.id, candidate.id), eq(courseTwinBuilds.status, "queued")))
    .returning({ id: courseTwinBuilds.id });
  if (!claimed) return null;

  const callbackBase = requiredEnv("COURSE_TWIN_CALLBACK_BASE_URL").replace(/\/$/, "");
  const body = JSON.stringify({
    protocolVersion: 1,
    buildId: candidate.id,
    courseTwinId: candidate.courseTwinId,
    inputFingerprint: candidate.inputFingerprint,
    plan: candidate.progress.plan,
    callbackUrl: `${callbackBase}/api/course-twins/builds/${candidate.id}/complete`,
  });
  const timestamp = String(Date.now());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("jobs", `${workerUrl.replace(/\/$/, "")}/`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FKH-Timestamp": timestamp,
        "X-FKH-Signature": signCourseTwinWorkerPayload(body, timestamp, secret),
      },
      body,
      signal: controller.signal,
    });
    const result: unknown = await response.json();
    if (!response.ok || !isRecord(result) || typeof result.executionReference !== "string") {
      throw new Error(`Course builder rejected dispatch with status ${response.status}.`);
    }
    await db
      .update(courseTwinBuilds)
      .set({
        status: "running",
        executionReference: result.executionReference.slice(0, 260),
        startedAt: new Date(),
        updatedAt: new Date(),
        progressJson: { ...candidate.progress, stage: "running", percent: 5 },
      })
      .where(eq(courseTwinBuilds.id, candidate.id));
    return { buildId: candidate.id, executionReference: result.executionReference };
  } catch (error) {
    const retryCount = candidate.retryCount + 1;
    await db
      .update(courseTwinBuilds)
      .set({
        status: retryCount >= 3 ? "failed" : "queued",
        retryCount,
        errorCode: "dispatch_failed",
        errorMessage:
          error instanceof Error ? error.message.slice(0, 2_000) : "Builder dispatch failed.",
        completedAt: retryCount >= 3 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(courseTwinBuilds.id, candidate.id));
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeCourseTwinBuild(buildId: string, rawCompletion: unknown) {
  const completion = parseCourseTwinWorkerCompletion(rawCompletion);
  const db = getDb();
  const [build] = await db
    .select({
      id: courseTwinBuilds.id,
      courseTwinId: courseTwinBuilds.courseTwinId,
      inputFingerprint: courseTwinBuilds.inputFingerprint,
      status: courseTwinBuilds.status,
    })
    .from(courseTwinBuilds)
    .where(eq(courseTwinBuilds.id, buildId))
    .limit(1);
  if (!build || !["running", "validating"].includes(build.status)) return null;
  if (completion.status === "failed") {
    await db
      .update(courseTwinBuilds)
      .set({
        status: "failed",
        errorCode: completion.errorCode,
        errorMessage: completion.errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courseTwinBuilds.id, buildId));
    await db
      .update(courseTwins)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(courseTwins.id, build.courseTwinId), eq(courseTwins.status, "building")));
    return { status: "failed" as const };
  }
  if (completion.manifest.course.id !== (await courseIdForTwin(build.courseTwinId))) {
    throw new Error("Worker manifest course does not match the queued Course Twin.");
  }

  await db
    .update(courseTwinBuilds)
    .set({
      status: "validating",
      progressJson: { stage: "validating", percent: 90 },
      updatedAt: new Date(),
    })
    .where(eq(courseTwinBuilds.id, buildId));
  const correctionRows = await db
    .select({
      id: courseTwinCorrections.id,
      correctionType: courseTwinCorrections.correctionType,
      targetReference: courseTwinCorrections.targetReference,
      correctionJson: courseTwinCorrections.correctionJson,
    })
    .from(courseTwinCorrections)
    .where(
      and(
        eq(courseTwinCorrections.courseTwinId, build.courseTwinId),
        eq(courseTwinCorrections.status, "accepted"),
      ),
    );
  const corrected = applyCourseTwinCorrections(
    completion.manifest,
    correctionRows as CourseTwinCorrectionInput[],
  );
  const version = await stageCourseTwinVersion({
    courseTwinId: build.courseTwinId,
    buildId,
    inputFingerprint: build.inputFingerprint,
    manifest: corrected.manifest,
    assets: completion.assets,
  });
  await db.transaction(async (transaction) => {
    await transaction
      .update(courseTwinBuilds)
      .set({
        status: "ready",
        completedAt: new Date(),
        updatedAt: new Date(),
        progressJson: {
          stage: "ready_for_review",
          percent: 100,
          versionId: version.id,
          metrics: completion.metrics,
        },
      })
      .where(eq(courseTwinBuilds.id, buildId));
    await transaction
      .update(courseTwins)
      .set({ status: "ready", updatedAt: new Date() })
      .where(and(eq(courseTwins.id, build.courseTwinId), eq(courseTwins.status, "building")));
  });
  return { status: "ready" as const, version };
}

async function courseIdForTwin(courseTwinId: string) {
  const [twin] = await getDb()
    .select({ courseId: courseTwins.courseId })
    .from(courseTwins)
    .where(eq(courseTwins.id, courseTwinId))
    .limit(1);
  return twin?.courseId ?? null;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Course Twin builder dispatch.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
