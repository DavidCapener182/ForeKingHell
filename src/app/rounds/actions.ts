"use server";

import {
  contextRoundStatus,
  relinkRoundScorecard,
  roundCompletionIssue,
} from "@/lib/round-context";
import {
  assertOfflineRoundPrecondition,
  nextRoundVersionTime,
} from "@/lib/offline-round-precondition";
import { manualRoundScorecard } from "@/lib/manual-round-scorecard";
import { applyRoundHoleCorrection } from "@/lib/round-hole-correction";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, asc, desc, eq, isNotNull, or } from "drizzle-orm";

import {
  courses,
  holes,
  rapsodoSyncSessions,
  sessions,
  shareLinks,
  shotReviewEvents,
  shots,
  strokesGainedShotEvents,
  teeSets,
  users,
} from "@/db/schema";
import { correctShotClub, updateClubIdentity } from "@/lib/shot-club-correction";
import { getDb } from "@/db/client";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { evaluateRoundAchievementsForSession } from "@/lib/achievements/service";
import { requireCurrentUserId } from "@/lib/current-user";
import { refreshPracticeEvidenceForReviewedSessions } from "@/lib/practice-planner";
import {
  applyRoundShotDeletionToScorecard,
  isRoundCorrectionDeletionAllowed,
  parseRoundShotDeleteActionInput,
  physicalRoundShotsForAccounting,
  type RoundShotDeleteActionInput,
} from "@/lib/round-shot-deletion";
import { createShareToken, getShareExpiry, hashShareToken } from "@/lib/share-links";
import { recordProductWorkflowEvent } from "@/lib/product-events";
import { reportServerFailure } from "@/lib/server-observability";
import { recordRoundCompletedFeedItem } from "@/lib/social";
import { refreshStockYardagesForClubs } from "@/lib/stock-yardage-refresh";
import {
  recalculateRoundAssignments,
  rebuildRoundStrokesGainedEvents,
} from "@/lib/round-assignments";

type StoredScorecardHole = NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>[number];

export type RoundCreationState = { error: string | null };

export async function createManualRoundWithStateAction(
  _previousState: RoundCreationState,
  formData: FormData,
): Promise<RoundCreationState> {
  try {
    await createManualRoundAction(formData);
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    reportServerFailure("manual_round_creation_failed", error);
    return { error: "The round could not be saved. Your entries are still here. Try again." };
  }
}

export async function createManualRoundAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const creationId = nullableString(formData, "creationId") ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creationId))
    throw new Error("Invalid round request.");
  const teeSetId = requiredString(formData, "teeSetId");
  const notes = nullableString(formData, "notes");
  const equipmentNotes = nullableString(formData, "equipmentNotes");
  const roundStatus = parseRoundStatus(formData);
  const date = dateFromForm(formData, "date");
  const holeCount = numberFromForm(formData, "holeCount") ?? 18;
  if (!Number.isInteger(holeCount) || holeCount < 1 || holeCount > 18)
    throw new Error("Choose a scorecard with 1 to 18 holes.");
  const now = new Date();

  const [teeSet] = await db
    .select({
      id: teeSets.id,
      name: teeSets.name,
      courseId: teeSets.courseId,
      courseName: courses.name,
    })
    .from(teeSets)
    .innerJoin(courses, eq(teeSets.courseId, courses.id))
    .where(
      and(
        eq(teeSets.id, teeSetId),
        or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
      ),
    )
    .limit(1);

  if (!teeSet) {
    throw new Error("Tee set not found.");
  }

  const courseHoles = await db
    .select({
      holeNumber: holes.holeNumber,
      par: holes.par,
      yards: holes.yards,
      strokeIndex: holes.strokeIndex,
    })
    .from(holes)
    .where(eq(holes.teeSetId, teeSet.id))
    .orderBy(asc(holes.holeNumber));
  const scorecardJson = manualRoundScorecard(formData, courseHoles, roundStatus === "complete");

  const session = await db.transaction(async (tx) => {
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

    const [created] = await tx
      .insert(sessions)
      .values({
        id: creationId,
        userId,
        source: "manual",
        type: "real_round",
        date,
        courseId: teeSet.courseId,
        teeSetId: teeSet.id,
        location: teeSet.courseName,
        courseName: teeSet.courseName,
        roundStatus,
        weatherJson: parseWeather(formData),
        scorecardJson,
        notes,
        equipmentNotes,
        rawUploadId: `manual-round-${creationId}`,
        fileName: `${teeSet.courseName} ${date.toISOString().slice(0, 10)}.scorecard`,
        rawCsvText: "",
        createdAt: now,
      })
      .onConflictDoNothing({ target: sessions.id })
      .returning({
        id: sessions.id,
        roundStatus: sessions.roundStatus,
        scorecardJson: sessions.scorecardJson,
        courseName: sessions.courseName,
      });
    if (created) return { ...created, newlyCreated: true };
    const [existing] = await tx
      .select({
        id: sessions.id,
        roundStatus: sessions.roundStatus,
        scorecardJson: sessions.scorecardJson,
        courseName: sessions.courseName,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, creationId),
          eq(sessions.userId, userId),
          eq(sessions.rawUploadId, `manual-round-${creationId}`),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("Round request could not be restored.");
    return { ...existing, newlyCreated: false };
  });

  if (session.roundStatus === "complete") {
    await evaluateRoundAchievementsForSessionWithFlash(session.id, userId);
    await recordRoundCompletedFeedItem({
      userId,
      sessionId: session.id,
      courseName: session.courseName,
      score: scorecardTotal(session.scorecardJson ?? []),
      source: "manual",
    });
  }
  if (session.newlyCreated)
    recordProductWorkflowEvent("round_created", {
      source: "manual",
      roundStatus,
      holeCount,
    });
  revalidateRound(session.id);
  redirect(`/rounds/${session.id}`);
}

export async function completeLiveRoundAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const round = await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: sessions.id,
        updatedAt: sessions.updatedAt,
        scorecardJson: sessions.scorecardJson,
        courseName: sessions.courseName,
        source: sessions.source,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .for("update");
    if (!current) throw new Error("Round not found.");
    assertOfflineRoundPrecondition({ ...current, userId });
    const issue = roundCompletionIssue(current.scorecardJson);
    if (issue) throw new Error(issue);
    await tx
      .update(sessions)
      .set({ roundStatus: "complete", updatedAt: nextRoundVersionTime(current.updatedAt) })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    return current;
  });
  await publishRoundCompletion(round, userId);
  revalidateRound(sessionId);
}

async function publishRoundCompletion(
  round: Pick<typeof sessions.$inferSelect, "id" | "scorecardJson" | "courseName" | "source">,
  userId: string,
) {
  try {
    await evaluateRoundAchievementsForSessionWithFlash(round.id, userId);
  } catch (error) {
    reportServerFailure("round_completion_achievements_failed", error);
  }
  await recordRoundCompletedFeedItem({
    userId,
    sessionId: round.id,
    courseName: round.courseName,
    score: scorecardTotal(round.scorecardJson ?? []),
    source: round.source,
  });
}

export async function updateRoundContextAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const roundStatus = contextRoundStatus(formData.get("roundStatus"));
  const round = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: sessions.id,
        updatedAt: sessions.updatedAt,
        scorecardJson: sessions.scorecardJson,
        courseName: sessions.courseName,
        source: sessions.source,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .for("update");
    if (!current) throw new Error("Round not found.");
    assertOfflineRoundPrecondition({ ...current, userId });
    if (roundStatus === "complete") {
      const issue = roundCompletionIssue(current.scorecardJson);
      if (issue) throw new Error(issue);
    }
    await tx
      .update(sessions)
      .set({
        roundStatus,
        weatherJson: parseWeather(formData),
        equipmentNotes: nullableString(formData, "equipmentNotes"),
        notes: nullableString(formData, "notes"),
        updatedAt: nextRoundVersionTime(current.updatedAt),
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    return current;
  });
  if (roundStatus === "complete") await publishRoundCompletion(round, userId);
  revalidateRound(sessionId);
}

export async function createRoundShareLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const expiryDays = numberFromForm(formData, "expiryDays");
  const token = createShareToken();
  const now = new Date();
  const [round] = await db
    .select({ id: sessions.id, courseName: sessions.courseName, fileName: sessions.fileName })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!round) {
    throw new Error("Round not found.");
  }

  await db.insert(shareLinks).values({
    userId,
    tokenHash: hashShareToken(token),
    resourceType: "round",
    resourceId: round.id,
    title: round.courseName ?? round.fileName ?? "Shared round",
    expiresAt: getShareExpiry(expiryDays, now),
    updatedAt: now,
  });

  revalidateRound(sessionId);
  redirect(`/rounds/${sessionId}?share=${encodeURIComponent(token)}`);
}

export async function createCourseTwinReplayShareLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const token = createShareToken();
  const now = new Date();
  const [round] = await db
    .select({
      id: sessions.id,
      courseId: sessions.courseId,
      courseName: sessions.courseName,
      fileName: sessions.fileName,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!round?.courseId) {
    throw new Error("This round is not linked to a playable Course Twin.");
  }

  await db.insert(shareLinks).values({
    userId,
    tokenHash: hashShareToken(token),
    resourceType: "course_twin_replay",
    resourceId: round.id,
    title: `${round.courseName ?? round.fileName ?? "Round"} 3D replay`,
    expiresAt: getShareExpiry(30, now),
    updatedAt: now,
  });

  revalidateRound(sessionId);
  redirect(`/share/course-twin/${encodeURIComponent(token)}`);
}

export async function revokeRoundShareLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const shareLinkId = requiredString(formData, "shareLinkId");

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(shareLinks.id, shareLinkId),
        eq(shareLinks.userId, userId),
        eq(shareLinks.resourceId, sessionId),
      ),
    );

  revalidateRound(sessionId);
}

export async function updateRoundCourseLinkAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const teeSetId = requiredString(formData, "teeSetId");
  await db.transaction(async (tx) => {
    const [session] = await tx
      .select({ updatedAt: sessions.updatedAt, scorecardJson: sessions.scorecardJson })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .for("update");
    if (!session) throw new Error("Round not found.");
    assertOfflineRoundPrecondition({ id: sessionId, userId, updatedAt: session.updatedAt });
    const [teeSet] = await tx
      .select({ id: teeSets.id, courseId: teeSets.courseId, courseName: courses.name })
      .from(teeSets)
      .innerJoin(courses, eq(teeSets.courseId, courses.id))
      .where(
        and(
          eq(teeSets.id, teeSetId),
          or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
        ),
      )
      .limit(1);
    if (!teeSet) throw new Error("Tee set not found.");
    const holeRows = await tx
      .select({
        holeNumber: holes.holeNumber,
        par: holes.par,
        yards: holes.yards,
        strokeIndex: holes.strokeIndex,
      })
      .from(holes)
      .where(eq(holes.teeSetId, teeSet.id))
      .orderBy(asc(holes.holeNumber));
    await tx
      .update(sessions)
      .set({
        courseId: teeSet.courseId,
        teeSetId: teeSet.id,
        courseName: teeSet.courseName,
        location: teeSet.courseName,
        scorecardJson: relinkRoundScorecard(session.scorecardJson ?? [], holeRows),
        updatedAt: nextRoundVersionTime(session.updatedAt),
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    const scorecard = await recalculateRoundAssignments(sessionId, userId, tx);
    if (scorecard) await rebuildRoundStrokesGainedEvents(sessionId, userId, scorecard, tx);
  });
  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

export async function updateShotClubAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const changed = await correctShotClub({
    userId,
    expectedSessionId: sessionId,
    shotId: requiredString(formData, "shotId"),
    clubId: requiredString(formData, "clubId"),
  });
  let warning = changed.warning;
  try {
    await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  } catch (error) {
    reportServerFailure("club_correction_awards_refresh_failed", error);
    warning = [
      warning,
      "Club saved, but round achievements could not refresh. Save again to retry.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  revalidateRound(sessionId);
  return { previousClubId: changed.previousClubId, warning };
}

export async function deleteRoundShotAction(input: RoundShotDeleteActionInput) {
  const userId = await requireCurrentUserId();
  const deletion = parseRoundShotDeleteActionInput(input);
  const deletedAt = new Date();
  const deleted = await getDb().transaction(async (tx) => {
    const [round] = await tx
      .select({
        id: sessions.id,
        type: sessions.type,
        playContext: sessions.playContext,
        courseId: sessions.courseId,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(eq(sessions.id, deletion.sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .for("update");

    if (!round?.scorecardJson) {
      throw new Error("Round not found. Refresh and try again.");
    }

    const [providerSession] = await tx
      .select({
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(rapsodoSyncSessions)
      .where(
        and(
          eq(rapsodoSyncSessions.userId, userId),
          eq(rapsodoSyncSessions.importedSessionId, round.id),
        ),
      )
      .orderBy(desc(rapsodoSyncSessions.updatedAt))
      .limit(1);

    const [ownedShot] = await tx
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        clubId: shots.clubId,
        playContext: shots.playContext,
        courseHoleNumber: shots.courseHoleNumber,
      })
      .from(shots)
      .where(and(eq(shots.id, deletion.shotId), eq(shots.userId, userId)))
      .limit(1)
      .for("update");

    if (!ownedShot) {
      return {
        shotId: deletion.shotId,
        sessionId: round.id,
        affectedHoleNumber: null,
        scoreChanged: false,
        alreadyDeleted: true,
      };
    }

    if (ownedShot.sessionId !== round.id) {
      throw new Error("Shot not found in this round. Refresh and try again.");
    }

    if (ownedShot.courseHoleNumber === null || ownedShot.courseHoleNumber < 1) {
      throw new Error(
        "Assign this shot to a scorecard hole before permanently deleting it from the round.",
      );
    }

    if (
      !isRoundCorrectionDeletionAllowed({
        scorecardJson: round.scorecardJson,
        sessionType: round.type,
        sessionPlayContext: round.playContext,
        sessionCourseId: round.courseId,
        courseHoleNumber: ownedShot.courseHoleNumber,
        providerKind: providerSession?.providerKind,
        providerSessionMode: providerSession?.providerSessionMode,
      })
    ) {
      throw new Error(
        "Permanent course-shot deletion is available only inside a course-managed round correction.",
      );
    }

    const scorecardImpact = applyRoundShotDeletionToScorecard(
      round.scorecardJson,
      ownedShot.courseHoleNumber,
    );

    await tx
      .update(sessions)
      .set({ scorecardJson: scorecardImpact.scorecard, updatedAt: deletedAt })
      .where(and(eq(sessions.id, round.id), eq(sessions.userId, userId)));
    await tx
      .delete(shotReviewEvents)
      .where(and(eq(shotReviewEvents.shotId, ownedShot.id), eq(shotReviewEvents.userId, userId)));
    await tx
      .delete(strokesGainedShotEvents)
      .where(
        and(
          eq(strokesGainedShotEvents.userId, userId),
          eq(strokesGainedShotEvents.sessionId, round.id),
          isNotNull(strokesGainedShotEvents.shotId),
        ),
      );
    const [deletedShot] = await tx
      .delete(shots)
      .where(
        and(eq(shots.id, ownedShot.id), eq(shots.sessionId, round.id), eq(shots.userId, userId)),
      )
      .returning({ id: shots.id });

    if (!deletedShot) {
      throw new Error("The shot changed during deletion. Refresh and try again.");
    }

    const recalculatedScorecard = await recalculateRoundAssignments(round.id, userId, tx);
    await rebuildRoundStrokesGainedEvents(
      round.id,
      userId,
      recalculatedScorecard ?? scorecardImpact.scorecard,
      tx,
    );
    await refreshStockYardagesForClubs(tx, {
      userId,
      clubContexts: [{ clubId: ownedShot.clubId, playContext: ownedShot.playContext }],
      calculatedAt: deletedAt,
    });

    return {
      shotId: deletedShot.id,
      sessionId: round.id,
      affectedHoleNumber: scorecardImpact.affectedHoleNumber,
      scoreChanged: scorecardImpact.scoreChanged,
      alreadyDeleted: false,
    };
  });

  if (!deleted.alreadyDeleted) {
    try {
      await refreshPracticeEvidenceForReviewedSessions(userId, [deleted.sessionId]);
    } catch (error) {
      reportServerFailure("round_shot_delete_practice_refresh_failed", error, {
        "app.session_id": deleted.sessionId,
        "app.shot_count": 1,
      });
    }

    try {
      await evaluateRoundAchievementsForSessionWithFlash(deleted.sessionId, userId);
    } catch (error) {
      reportServerFailure("round_shot_delete_achievement_refresh_failed", error, {
        "app.session_id": deleted.sessionId,
        "app.shot_count": 1,
      });
    }
  }

  revalidateRound(deleted.sessionId);
  return deleted;
}

export async function updateClubAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const changed = await updateClubIdentity({
    userId,
    sessionId: requiredString(formData, "sessionId"),
    clubId: requiredString(formData, "clubId"),
    clubType: requiredString(formData, "clubType"),
    brand: nullableString(formData, "brand"),
    model: nullableString(formData, "model"),
  });
  for (const sessionId of changed.sessionIds) {
    try {
      await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
    } catch (error) {
      reportServerFailure("bulk_club_correction_awards_refresh_failed", error);
      changed.warning = [
        changed.warning,
        "Club saved, but round achievements could not refresh. Save again to retry.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    revalidateRound(sessionId);
  }
  return { warning: changed.warning };
}

export async function updateRoundHoleAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const holeNumber = Number(formData.get("holeNumber"));
  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18)
    throw new Error("Choose a valid scorecard hole.");

  await db.transaction(async (tx) => {
    const [session] = await tx
      .select({
        updatedAt: sessions.updatedAt,
        scorecardJson: sessions.scorecardJson,
        roundStatus: sessions.roundStatus,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .for("update");
    if (!session?.scorecardJson?.some((hole) => hole.holeNumber === holeNumber))
      throw new Error("Round scorecard hole not found.");
    assertOfflineRoundPrecondition({ id: sessionId, userId, updatedAt: session.updatedAt });
    const scorecard = session.scorecardJson.map((hole) =>
      hole.holeNumber === holeNumber
        ? applyRoundHoleCorrection(hole, formData, session.roundStatus === "complete")
        : hole,
    );
    await tx
      .update(sessions)
      .set({ scorecardJson: scorecard, updatedAt: nextRoundVersionTime(session.updatedAt) })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    const recalculated = await recalculateRoundAssignments(sessionId, userId, tx);
    if (recalculated) await rebuildRoundStrokesGainedEvents(sessionId, userId, recalculated, tx);
  });
  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

export async function resplitRoundAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  await getDb().transaction(async (db) => {
    const [session] = await db
      .select({ updatedAt: sessions.updatedAt, scorecardJson: sessions.scorecardJson })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .for("update");
    if (!session?.scorecardJson?.length) throw new Error("Round scorecard not found.");
    assertOfflineRoundPrecondition({ id: sessionId, userId, updatedAt: session.updatedAt });
    const scorecard = session.scorecardJson
      .slice()
      .sort((left, right) => left.holeNumber - right.holeNumber);
    const counts = scorecard.map((hole) => {
      const raw = formData.get(`holeCount-${hole.holeNumber}`);
      const count = typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
      if (!Number.isInteger(count) || count < 0 || count > 12) {
        throw new Error(`Hole ${hole.holeNumber}: enter a whole shot count from 0 to 12.`);
      }
      return count;
    });
    const loadedSessionShots = await db
      .select({
        id: shots.id,
        shotNumber: shots.shotNumber,
        clubId: shots.clubId,
        playContext: shots.playContext,
      })
      .from(shots)
      .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, userId)))
      .orderBy(asc(shots.shotNumber), asc(shots.createdAt))
      .for("update");
    const sessionShots = physicalRoundShotsForAccounting(loadedSessionShots);
    if (counts.reduce((sum, count) => sum + count, 0) > sessionShots.length) {
      throw new Error(
        "The hole counts exceed the number of recorded shots. Review the split and try again.",
      );
    }
    let cursor = 0;
    for (const [index, hole] of scorecard.entries()) {
      const count = counts[index];
      const holeShots = sessionShots.slice(cursor, cursor + count);
      for (const shot of holeShots) {
        await db
          .update(shots)
          .set({ courseHoleNumber: hole.holeNumber })
          .where(
            and(eq(shots.id, shot.id), eq(shots.sessionId, sessionId), eq(shots.userId, userId)),
          );
      }
      cursor += count;
    }
    for (const shot of sessionShots.slice(cursor)) {
      await db
        .update(shots)
        .set({
          courseHoleNumber: null,
          courseHoleShotNumber: null,
          courseHolePar: null,
          courseHoleYards: null,
          distanceRemainingYd: null,
        })
        .where(
          and(eq(shots.id, shot.id), eq(shots.sessionId, sessionId), eq(shots.userId, userId)),
        );
    }
    await db
      .update(sessions)
      .set({
        scorecardJson: scorecard.map((hole) => ({
          ...hole,
          shotAssignmentSource: "manual" as const,
        })),
        updatedAt: nextRoundVersionTime(session.updatedAt),
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    const recalculated = await recalculateRoundAssignments(sessionId, userId, db);
    if (recalculated) await rebuildRoundStrokesGainedEvents(sessionId, userId, recalculated, db);
    await refreshStockYardagesForClubs(db, { userId, clubContexts: sessionShots });
  });
  await refreshPracticeEvidenceForReviewedSessions(userId, [sessionId]);
  await evaluateRoundAchievementsForSessionWithFlash(sessionId, userId);
  revalidateRound(sessionId);
}

async function evaluateRoundAchievementsForSessionWithFlash(
  sessionId: string,
  actorUserId: string,
) {
  const result = await evaluateRoundAchievementsForSession(sessionId, actorUserId);
  await setAchievementUnlockFlash(result.unlockedAchievements);
  return result;
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function dateFromForm(formData: FormData, key: string) {
  const value = requiredString(formData, key);
  const parsed = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${key} is not a valid date.`);
  }

  return parsed;
}

function nullableString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberFromForm(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function parseRoundStatus(formData: FormData) {
  return formData.get("roundStatus") === "in_progress" ? "in_progress" : "complete";
}

function parseWeather(formData: FormData) {
  return {
    conditions: nullableString(formData, "weatherConditions"),
    wind: nullableString(formData, "wind"),
    temperature: nullableString(formData, "temperature"),
  };
}

function scorecardTotal(scorecard: StoredScorecardHole[]) {
  const scores = scorecard
    .map((hole) => hole.score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  return scores.length > 0 ? scores.reduce((total, score) => total + score, 0) : null;
}

function revalidateRound(sessionId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/bag");
  revalidatePath("/shots");
  revalidatePath("/rounds");
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/handicap");
  revalidatePath("/progress");
  revalidatePath("/analyse");
  revalidatePath("/strokes-gained");
  revalidatePath("/stats/training-over-time");
  revalidatePath("/speed");
  revalidatePath("/practice");
  revalidatePath("/courses");
  revalidatePath("/play");
  revalidatePath(`/rounds/${sessionId}`);
  revalidatePath("/achievements");
  revalidatePath("/", "layout");
}
