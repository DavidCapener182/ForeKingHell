"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { shotReviewEvents, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { recordProductWorkflowEvent } from "@/lib/product-events";
import {
  buildShotReviewMutation,
  effectiveShotReviewStatus,
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
    for (const shot of ownedShots) {
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
    }

    await refreshStockYardagesForClubs(tx, {
      userId,
      clubContexts: ownedShots.map((shot) => ({
        clubId: shot.clubId,
        playContext: shot.playContext,
      })),
      calculatedAt: reviewedAt,
    });

    return {
      shotIds: ownedShots.map((shot) => shot.id),
      sessionIds: [...new Set(ownedShots.map((shot) => shot.sessionId))],
      status: review.status,
    };
  });

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
