"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { clubs, rapsodoSyncSessions, sessions, shotReviewEvents, shots } from "@/db/schema";
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

/** Club corrections retain raw measurements and rebuild both clubs' trusted evidence. */
export async function correctShotClubAction(shotId: string, clubId: string) {
  const userId = await requireCurrentUserId();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(shotId) || !uuid.test(clubId))
    throw new Error("Choose a shot and a club from your bag.");
  const changed = await getDb().transaction(async (tx) => {
    const [shot] = await tx
      .select()
      .from(shots)
      .where(and(eq(shots.id, shotId), eq(shots.userId, userId)))
      .for("update");
    const [club] = await tx
      .select({ id: clubs.id, type: clubs.type })
      .from(clubs)
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));
    if (!shot || !club) throw new Error("The shot or club is unavailable. Refresh and try again.");
    if (shot.clubId === club.id && shot.clubType === club.type)
      return { sessionId: shot.sessionId, previousClubId: shot.clubId };
    await tx
      .update(shots)
      .set({ clubId: club.id, clubType: club.type })
      .where(and(eq(shots.id, shotId), eq(shots.userId, userId)));
    await tx.insert(shotReviewEvents).values({
      userId,
      shotId,
      previousStatus: shot.reviewStatus,
      status: shot.reviewStatus,
      reason: `Club corrected from ${shot.clubType} (${shot.clubId}) to ${club.type} (${club.id}). Measurements retained.`,
      confidence: 1,
      source: "user",
      previousQualityTag: shot.qualityTag,
      resultingQualityTag: shot.qualityTag,
    });
    await refreshStockYardagesForClubs(tx, {
      userId,
      clubContexts: [
        { clubId: shot.clubId, playContext: shot.playContext },
        { clubId: club.id, playContext: shot.playContext },
      ],
      calculatedAt: new Date(),
    });
    return { sessionId: shot.sessionId, previousClubId: shot.clubId };
  });
  try {
    await refreshPracticeEvidenceForReviewedSessions(userId, [changed.sessionId]);
  } catch (error) {
    reportServerFailure("shot_club_correction_practice_refresh_failed", error, {
      "app.shot_count": 1,
    });
  }
  revalidateShotDerivedRoutes([changed.sessionId]);
  revalidatePath("/quick-bag");
  revalidatePath(`/rounds/${changed.sessionId}`);
  return { previousClubId: changed.previousClubId };
}

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
    "/shots/review",
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

const automaticKeepReason = "Automatic review: golfer kept this shot.";

/** A Keep decision records provenance; Undo only reopens a still-current Keep decision. */
export async function keepAutomaticShotReviewAction(shotIds: string[], undo = false) {
  const userId = await requireCurrentUserId();
  const input = parseShotReviewActionInput({
    shotIds,
    status: "restored",
    reason: automaticKeepReason,
    confidence: 1,
  });
  const changed = await getDb().transaction(async (tx) => {
    const owned = await tx
      .select()
      .from(shots)
      .where(and(eq(shots.userId, userId), inArray(shots.id, input.shotIds)))
      .for("update");
    if (owned.length !== input.shotIds.length)
      throw new Error("A shot is unavailable. Refresh before reviewing.");
    for (const shot of owned) {
      let status = shot.reviewStatus;
      let qualityTag = shot.qualityTag;
      let previousQualityTag = shot.reviewPreviousQualityTag;
      if (undo) {
        if (shot.reviewReason !== automaticKeepReason || shot.reviewSource !== "user")
          throw new Error("This shot was reviewed again. Refresh to see the latest decision.");
        const [event] = await tx
          .select()
          .from(shotReviewEvents)
          .where(and(eq(shotReviewEvents.shotId, shot.id), eq(shotReviewEvents.userId, userId)))
          .orderBy(desc(shotReviewEvents.createdAt))
          .limit(1);
        if (!event || event.reason !== automaticKeepReason)
          throw new Error("This decision has changed and cannot be undone here.");
        status = event.previousStatus;
        qualityTag = event.previousQualityTag;
      } else {
        if (shot.reviewReason === automaticKeepReason && shot.reviewSource === "user") continue;
        if (shot.reviewSource === "user" || !["included", "suggested_exclusion"].includes(status))
          throw new Error("A shot already has a review decision. Refresh to see it.");
        if (status === "suggested_exclusion") {
          const mutation = buildShotReviewMutation(shot, "restored");
          status = mutation.reviewStatus;
          qualityTag = mutation.qualityTag;
          previousQualityTag = mutation.reviewPreviousQualityTag;
        }
      }
      const reason = undo ? "Automatic review reopened by golfer." : automaticKeepReason;
      await tx
        .update(shots)
        .set({
          reviewStatus: status,
          qualityTag,
          reviewPreviousQualityTag: previousQualityTag,
          reviewReason: reason,
          reviewConfidence: undo ? null : 1,
          reviewSource: undo ? "system" : "user",
          reviewedAt: undo ? null : new Date(),
        })
        .where(and(eq(shots.id, shot.id), eq(shots.userId, userId)));
      await tx.insert(shotReviewEvents).values({
        userId,
        shotId: shot.id,
        previousStatus: shot.reviewStatus,
        status,
        reason,
        confidence: 1,
        source: "user",
        previousQualityTag: shot.qualityTag,
        resultingQualityTag: qualityTag,
      });
    }
    await refreshStockYardagesForClubs(tx, {
      userId,
      clubContexts: owned.map((shot) => ({ clubId: shot.clubId, playContext: shot.playContext })),
      calculatedAt: new Date(),
    });
    return { sessionIds: [...new Set(owned.map((shot) => shot.sessionId))] };
  });
  try {
    await refreshPracticeEvidenceForReviewedSessions(userId, changed.sessionIds);
  } catch (error) {
    reportServerFailure("automatic_review_practice_refresh_failed", error, {
      "app.shot_count": input.shotIds.length,
    });
  }
  revalidateShotDerivedRoutes(changed.sessionIds);
  revalidatePath("/shots/review");
}
