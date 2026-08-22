"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { rapsodoSyncSessions, sessions, shotReviewEvents, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { recordProductWorkflowEvent } from "@/lib/product-events";
import { refreshPracticeEvidenceForReviewedSessions } from "@/lib/practice-planner";
import { reportServerFailure } from "@/lib/server-observability";
import {
  isPermanentShotDeletionRestricted,
  parseShotDeleteActionInput,
  type ShotDeleteActionInput,
} from "@/lib/shot-deletion";
import {
  buildShotReviewMutation,
  effectiveShotReviewStatus,
  isPersistedShotReviewNoOp,
  parseShotReviewActionInput,
  type ShotReviewActionInput,
} from "@/lib/shot-review";
import { refreshStockYardagesForClubs } from "@/lib/stock-yardage-refresh";

export async function reviewShotsAction(input: ShotReviewActionInput) {
  return applyOwnedShotReview(input);
}

export async function excludeShotAction(
  shotId: string,
  details: { reason: string; confidence: number },
) {
  return applyOwnedShotReview({
    shotIds: [shotId],
    status: "user_excluded",
    reason: details.reason,
    confidence: details.confidence,
  });
}

export async function restoreShotAction(shotId: string, reason: string) {
  return applyOwnedShotReview({
    shotIds: [shotId],
    status: "restored",
    reason,
    confidence: 1,
  });
}

export async function deleteShotAction(shotId: string) {
  return deleteShotsAction({ shotIds: [shotId] });
}

export async function deleteShotsAction(input: ShotDeleteActionInput) {
  const userId = await requireCurrentUserId();
  const deletion = parseShotDeleteActionInput(input);
  const deletedAt = new Date();
  const deleted = await getDb().transaction(async (tx) => {
    const ownedShots = await tx
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        clubId: shots.clubId,
        playContext: shots.playContext,
        courseHoleNumber: shots.courseHoleNumber,
        sessionType: sessions.type,
        sessionPlayContext: sessions.playContext,
        sessionCourseId: sessions.courseId,
      })
      .from(shots)
      .innerJoin(sessions, and(eq(sessions.id, shots.sessionId), eq(sessions.userId, userId)))
      .where(and(eq(shots.userId, userId), inArray(shots.id, deletion.shotIds)))
      .for("update");

    if (ownedShots.length !== deletion.shotIds.length) {
      throw new Error("One or more shots were not found. Refresh and try again.");
    }

    const providerSessionRows = await tx
      .select({
        sessionId: rapsodoSyncSessions.importedSessionId,
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(rapsodoSyncSessions)
      .where(
        and(
          eq(rapsodoSyncSessions.userId, userId),
          inArray(rapsodoSyncSessions.importedSessionId, [
            ...new Set(ownedShots.map((shot) => shot.sessionId)),
          ]),
        ),
      )
      .orderBy(desc(rapsodoSyncSessions.updatedAt));
    const providerMetadataBySessionId = new Map<
      string,
      { providerKind: string; providerSessionMode: string | null }
    >();
    for (const providerSession of providerSessionRows) {
      if (
        providerSession.sessionId &&
        !providerMetadataBySessionId.has(providerSession.sessionId)
      ) {
        providerMetadataBySessionId.set(providerSession.sessionId, {
          providerKind: providerSession.providerKind,
          providerSessionMode: providerSession.providerSessionMode,
        });
      }
    }

    const restrictedShots = ownedShots.filter((shot) => {
      const providerMetadata = providerMetadataBySessionId.get(shot.sessionId);
      return isPermanentShotDeletionRestricted({
        ...shot,
        providerKind: providerMetadata?.providerKind,
        providerSessionMode: providerMetadata?.providerSessionMode,
      });
    });
    if (restrictedShots.length > 0) {
      throw new Error(
        `${restrictedShots.length} course-managed ${restrictedShots.length === 1 ? "shot" : "shots"} cannot be permanently deleted from Shot Explorer. Exclude from stats here, or manage the shot inside its round or course workflow.`,
      );
    }

    const deletedShots = await tx
      .delete(shots)
      .where(and(eq(shots.userId, userId), inArray(shots.id, deletion.shotIds)))
      .returning({ id: shots.id });

    if (deletedShots.length !== deletion.shotIds.length) {
      throw new Error("One or more shots changed during deletion. Refresh and try again.");
    }

    await refreshStockYardagesForClubs(tx, {
      userId,
      clubContexts: ownedShots.map((shot) => ({
        clubId: shot.clubId,
        playContext: shot.playContext,
      })),
      calculatedAt: deletedAt,
    });

    return {
      shotIds: deletedShots.map((shot) => shot.id),
      sessionIds: [...new Set(ownedShots.map((shot) => shot.sessionId))],
    };
  });

  try {
    await refreshPracticeEvidenceForReviewedSessions(userId, deleted.sessionIds);
  } catch (error) {
    reportServerFailure("shot_delete_practice_refresh_failed", error, {
      "app.session_count": deleted.sessionIds.length,
      "app.shot_count": deleted.shotIds.length,
    });
  }

  revalidateShotDerivedRoutes(deleted.sessionIds);
  return { deletedShotIds: deleted.shotIds };
}

async function applyOwnedShotReview(input: unknown) {
  const userId = await requireCurrentUserId();
  const review = parseShotReviewActionInput(input);
  const reviewed = await getDb().transaction(async (tx) => {
    const ownedShots = await tx
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        clubId: shots.clubId,
        playContext: shots.playContext,
        reviewStatus: shots.reviewStatus,
        qualityTag: shots.qualityTag,
        reviewPreviousQualityTag: shots.reviewPreviousQualityTag,
        shotCategory: shots.shotCategory,
      })
      .from(shots)
      .where(and(eq(shots.userId, userId), inArray(shots.id, review.shotIds)))
      .for("update");

    if (ownedShots.length !== review.shotIds.length) {
      throw new Error("One or more shots were not found. Refresh and try again.");
    }

    const reviewedAt = new Date();
    const changedShots: typeof ownedShots = [];
    for (const shot of ownedShots) {
      if (isPersistedShotReviewNoOp(shot, review.status)) {
        continue;
      }

      const mutation = buildShotReviewMutation(
        {
          reviewStatus: effectiveShotReviewStatus({
            reviewStatus: shot.reviewStatus,
            qualityTag: shot.qualityTag,
            shotCategory: shot.shotCategory,
          }),
          qualityTag: shot.qualityTag,
          reviewPreviousQualityTag: shot.reviewPreviousQualityTag,
        },
        review.status,
      );

      const [updatedShot] = await tx
        .update(shots)
        .set({
          qualityTag: mutation.qualityTag,
          reviewStatus: mutation.reviewStatus,
          reviewReason: review.reason,
          reviewConfidence: review.confidence,
          reviewSource: "user",
          reviewPreviousQualityTag: mutation.reviewPreviousQualityTag,
          reviewedAt,
        })
        .where(and(eq(shots.id, shot.id), eq(shots.userId, userId)))
        .returning({ id: shots.id });

      if (!updatedShot) {
        throw new Error("A shot changed during review. Refresh and try again.");
      }

      await tx.insert(shotReviewEvents).values({
        userId,
        shotId: shot.id,
        previousStatus: mutation.previousStatus,
        status: mutation.reviewStatus,
        reason: review.reason,
        confidence: review.confidence,
        source: "user",
        previousQualityTag: mutation.previousQualityTag,
        resultingQualityTag: mutation.qualityTag,
        createdAt: reviewedAt,
      });
      changedShots.push(shot);
    }

    if (changedShots.length > 0) {
      await refreshStockYardagesForClubs(tx, {
        userId,
        clubContexts: changedShots.map((shot) => ({
          clubId: shot.clubId,
          playContext: shot.playContext,
        })),
        calculatedAt: reviewedAt,
      });
    }

    return {
      shotIds: changedShots.map((shot) => shot.id),
      sessionIds: [...new Set(changedShots.map((shot) => shot.sessionId))],
      status: review.status,
    };
  });

  if (reviewed.shotIds.length === 0) {
    return { reviewedShotIds: [], status: reviewed.status };
  }

  try {
    await refreshPracticeEvidenceForReviewedSessions(userId, reviewed.sessionIds);
  } catch (error) {
    reportServerFailure("shot_review_practice_refresh_failed", error, {
      "app.session_count": reviewed.sessionIds.length,
      "app.shot_count": reviewed.shotIds.length,
    });
  }
  revalidateShotDerivedRoutes(reviewed.sessionIds);
  recordProductWorkflowEvent("shot_review_completed", {
    action: reviewed.status,
    count: reviewed.shotIds.length,
  });
  return { reviewedShotIds: reviewed.shotIds, status: reviewed.status };
}

function revalidateShotDerivedRoutes(sessionIds: string[]) {
  for (const path of [
    "/shots",
    "/today",
    "/dashboard",
    "/bag",
    "/progress",
    "/sessions",
    "/analyse",
    "/strokes-gained",
    "/stats/training-over-time",
    "/speed",
    "/practice",
  ]) {
    revalidatePath(path);
  }

  for (const sessionId of sessionIds) {
    revalidatePath(`/sessions/${sessionId}`);
  }
  revalidatePath("/", "layout");
}
