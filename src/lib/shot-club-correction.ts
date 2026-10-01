import { recordOfflineRoundCommit } from "@/lib/offline-operation-ledger";
import "server-only";

import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubs, sessions, shotReviewEvents, shots, users } from "@/db/schema";
import { buildClubKey, normalizeClubType } from "@/lib/rapsodo/parser";
import { refreshPracticeEvidenceForReviewedSessions } from "@/lib/practice-planner";
import {
  recalculateRoundAssignments,
  rebuildRoundStrokesGainedEvents,
} from "@/lib/round-assignments";
import { refreshStockYardagesForClubs } from "@/lib/stock-yardage-refresh";
import {
  assertOfflineRoundPrecondition,
  nextRoundVersionTime,
} from "@/lib/offline-round-precondition";
import { reportServerFailure } from "@/lib/server-observability";

/** Shared by round editing and Shot Explorer. Measurements/confidence stay untouched. */
export async function correctShotClub(input: {
  userId: string;
  shotId: string;
  clubId: string;
  expectedSessionId?: string;
}): Promise<{ sessionId: string; previousClubId: string; warning?: string }> {
  const { userId, shotId, clubId, expectedSessionId } = input;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    ![shotId, clubId, ...(expectedSessionId ? [expectedSessionId] : [])].every((value) =>
      uuid.test(value),
    )
  )
    throw new Error("Choose a shot and a club from your bag.");
  const changed = await getDb().transaction(async (tx) => {
    // Serialize single-shot and whole-club corrections before reading club identity.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const [reference] = await tx
      .select({ sessionId: shots.sessionId })
      .from(shots)
      .where(and(eq(shots.id, shotId), eq(shots.userId, userId)))
      .limit(1);
    if (!reference || (expectedSessionId && reference.sessionId !== expectedSessionId))
      throw new Error("Shot not found in this session.");
    // Match score/course correction lock order before locking the shot.
    const [session] = await tx
      .select({
        id: sessions.id,
        updatedAt: sessions.updatedAt,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(eq(sessions.id, reference.sessionId), eq(sessions.userId, userId)))
      .limit(1)
      .for("update");
    if (!session) throw new Error("Round not found.");
    assertOfflineRoundPrecondition({ ...session, userId });
    const [shot] = await tx
      .select({
        id: shots.id,
        clubId: shots.clubId,
        clubType: shots.clubType,
        playContext: shots.playContext,
        reviewStatus: shots.reviewStatus,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .where(
        and(
          eq(shots.id, shotId),
          eq(shots.sessionId, reference.sessionId),
          eq(shots.userId, userId),
        ),
      )
      .limit(1)
      .for("update");
    const [club] = await tx
      .select({ id: clubs.id, type: clubs.type })
      .from(clubs)
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
      .limit(1);
    if (!session || !shot || !club)
      throw new Error("The shot or club is unavailable. Refresh and try again.");
    if (shot.clubId !== club.id || shot.clubType !== club.type) {
      await tx
        .update(shots)
        .set({ clubId: club.id, clubType: club.type })
        .where(and(eq(shots.id, shot.id), eq(shots.userId, userId)));
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
    }
    if (session.scorecardJson?.length) {
      const scorecard = await recalculateRoundAssignments(session.id, userId, tx);
      await rebuildRoundStrokesGainedEvents(
        session.id,
        userId,
        scorecard ?? session.scorecardJson,
        tx,
      );
    } else {
      await tx
        .update(sessions)
        .set({ updatedAt: nextRoundVersionTime(session.updatedAt) })
        .where(and(eq(sessions.id, session.id), eq(sessions.userId, userId)));
    }
    await refreshStockYardagesForClubs(tx, {
      userId,
      clubContexts: [
        { clubId: shot.clubId, playContext: shot.playContext },
        { clubId: club.id, playContext: shot.playContext },
      ],
      calculatedAt: new Date(),
    });
    await recordOfflineRoundCommit(tx, userId, session.id);
    return { sessionId: session.id, previousClubId: shot.clubId };
  });
  // Retry the refresh even when the club is already correct, without adding another audit event.
  const warning = await refreshCorrectedPracticeEvidence(userId, [changed.sessionId]);
  return warning ? { ...changed, warning } : changed;
}

/** Apply a whole selection atomically and refresh derived evidence once per scope. */
export async function correctShotsClub(input: {
  userId: string;
  shotIds: string[];
  clubId: string;
}) {
  const { userId, clubId } = input;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !Array.isArray(input.shotIds) ||
    !input.shotIds.length ||
    input.shotIds.length > 50 ||
    ![clubId, ...input.shotIds].every((id) => typeof id === "string" && uuid.test(id))
  )
    throw new Error("Choose between 1 and 50 shots and an active club from your bag.");
  const shotIds = [...new Set(input.shotIds)];
  const changed = await getDb().transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const references = await tx
      .select({ sessionId: shots.sessionId })
      .from(shots)
      .where(and(inArray(shots.id, shotIds), eq(shots.userId, userId)));
    if (references.length !== shotIds.length)
      throw new Error("One or more shots are unavailable. Refresh and try again.");
    const sessionIds = [...new Set(references.map((shot) => shot.sessionId))].sort();
    const ownedSessions = await tx
      .select({
        id: sessions.id,
        updatedAt: sessions.updatedAt,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(inArray(sessions.id, sessionIds), eq(sessions.userId, userId)))
      .orderBy(asc(sessions.id))
      .for("update");
    if (ownedSessions.length !== sessionIds.length)
      throw new Error("One or more sessions are unavailable.");
    for (const session of ownedSessions) assertOfflineRoundPrecondition({ ...session, userId });
    const ownedShots = await tx
      .select({
        id: shots.id,
        sessionId: shots.sessionId,
        clubId: shots.clubId,
        clubType: shots.clubType,
        playContext: shots.playContext,
        reviewStatus: shots.reviewStatus,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .where(and(inArray(shots.id, shotIds), eq(shots.userId, userId)))
      .orderBy(asc(shots.id))
      .for("update");
    if (
      ownedShots.length !== shotIds.length ||
      ownedShots.some((shot) => !sessionIds.includes(shot.sessionId))
    )
      throw new Error("The selection changed. Refresh and try again.");
    const [club] = await tx
      .select({ id: clubs.id, type: clubs.type })
      .from(clubs)
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId), eq(clubs.active, true)))
      .limit(1);
    if (!club) throw new Error("Choose an active club from your bag.");
    const updates = ownedShots.filter(
      (shot) => shot.clubId !== club.id || shot.clubType !== club.type,
    );
    if (updates.length) {
      await tx
        .update(shots)
        .set({ clubId: club.id, clubType: club.type })
        .where(
          and(
            inArray(
              shots.id,
              updates.map((shot) => shot.id),
            ),
            eq(shots.userId, userId),
          ),
        );
      await tx.insert(shotReviewEvents).values(
        updates.map((shot) => ({
          userId,
          shotId: shot.id,
          previousStatus: shot.reviewStatus,
          status: shot.reviewStatus,
          reason: `Club corrected from ${shot.clubType} (${shot.clubId}) to ${club.type} (${club.id}). Measurements retained.`,
          confidence: 1,
          source: "user" as const,
          previousQualityTag: shot.qualityTag,
          resultingQualityTag: shot.qualityTag,
        })),
      );
      const changedSessionIds = new Set(updates.map((shot) => shot.sessionId));
      for (const session of ownedSessions.filter((session) => changedSessionIds.has(session.id))) {
        if (session.scorecardJson?.length) {
          const scorecard = await recalculateRoundAssignments(session.id, userId, tx);
          await rebuildRoundStrokesGainedEvents(
            session.id,
            userId,
            scorecard ?? session.scorecardJson,
            tx,
          );
        } else {
          await tx
            .update(sessions)
            .set({ updatedAt: nextRoundVersionTime(session.updatedAt) })
            .where(and(eq(sessions.id, session.id), eq(sessions.userId, userId)));
        }
        await recordOfflineRoundCommit(tx, userId, session.id);
      }
      await refreshStockYardagesForClubs(tx, {
        userId,
        clubContexts: updates.flatMap((shot) => [
          { clubId: shot.clubId, playContext: shot.playContext },
          { clubId: club.id, playContext: shot.playContext },
        ]),
        calculatedAt: new Date(),
      });
    }
    return { sessionIds, count: shotIds.length };
  });
  const warning = await refreshCorrectedPracticeEvidence(userId, changed.sessionIds);
  return { ...changed, warning };
}

/** Edit or merge a bag club and refresh every affected session, not just the open round. */
export async function updateClubIdentity(input: {
  userId: string;
  sessionId: string;
  clubId: string;
  clubType: string;
  brand: string | null;
  model: string | null;
}): Promise<{ sessionIds: string[]; clubId: string; warning?: string }> {
  const { userId, sessionId, clubId, brand, model } = input;
  const clubType = normalizeClubType(input.clubType);
  const normalizedClubKey = buildClubKey(clubType, brand, model);
  const changed = await getDb().transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const [reference] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1);
    if (!reference) throw new Error("Round not found.");
    const [current] = await tx
      .select()
      .from(clubs)
      .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)))
      .limit(1);
    if (!current) throw new Error("Club not found.");
    const [duplicate] = await tx
      .select()
      .from(clubs)
      .where(
        and(
          eq(clubs.userId, userId),
          eq(clubs.normalizedClubKey, normalizedClubKey),
          ne(clubs.id, clubId),
        ),
      )
      .limit(1);
    const targetId = duplicate?.id ?? clubId;
    const targetType = duplicate?.type ?? clubType;
    // Include destination sessions so a repeated merge can repair downstream practice refresh.
    const references = await tx
      .selectDistinct({ id: shots.sessionId })
      .from(shots)
      .where(and(eq(shots.userId, userId), inArray(shots.clubId, [clubId, targetId])));
    const affectedIds = [...new Set([sessionId, ...references.map((row) => row.id)])];
    const affectedSessions = await tx
      .select({
        id: sessions.id,
        updatedAt: sessions.updatedAt,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), inArray(sessions.id, affectedIds)))
      .orderBy(asc(sessions.id))
      .for("update");
    const lockedReference = affectedSessions.find((session) => session.id === sessionId);
    if (!lockedReference) throw new Error("Round not found.");
    assertOfflineRoundPrecondition({ ...lockedReference, userId });
    const evidence = await tx
      .select({
        id: shots.id,
        clubId: shots.clubId,
        clubType: shots.clubType,
        playContext: shots.playContext,
        reviewStatus: shots.reviewStatus,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .where(
        and(
          eq(shots.userId, userId),
          inArray(
            shots.sessionId,
            affectedSessions.map((row) => row.id),
          ),
          inArray(shots.clubId, [clubId, targetId]),
        ),
      )
      .orderBy(asc(shots.id))
      .for("update");
    const now = new Date();
    if (duplicate) {
      await tx
        .update(clubs)
        .set({ active: false, updatedAt: now })
        .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));
      await tx
        .update(clubs)
        .set({ active: true, updatedAt: now })
        .where(and(eq(clubs.id, targetId), eq(clubs.userId, userId)));
    } else {
      await tx
        .update(clubs)
        .set({ type: clubType, brand, model, normalizedClubKey, active: true, updatedAt: now })
        .where(and(eq(clubs.id, clubId), eq(clubs.userId, userId)));
    }
    const moved = evidence.filter(
      (shot) =>
        shot.clubId === clubId && (shot.clubId !== targetId || shot.clubType !== targetType),
    );
    // Bound query parameters for golfers with a long imported history.
    for (let offset = 0; offset < moved.length; offset += 500) {
      const batch = moved.slice(offset, offset + 500);
      await tx
        .update(shots)
        .set({ clubId: targetId, clubType: targetType })
        .where(
          and(
            eq(shots.userId, userId),
            inArray(
              shots.id,
              batch.map((shot) => shot.id),
            ),
          ),
        );
      await tx.insert(shotReviewEvents).values(
        batch.map((shot) => ({
          userId,
          shotId: shot.id,
          previousStatus: shot.reviewStatus,
          status: shot.reviewStatus,
          reason: `Bag club corrected from ${shot.clubType} (${shot.clubId}) to ${targetType} (${targetId}). Measurements retained.`,
          confidence: 1,
          source: "user" as const,
          previousQualityTag: shot.qualityTag,
          resultingQualityTag: shot.qualityTag,
        })),
      );
    }
    for (const session of affectedSessions) {
      if (session.scorecardJson?.length) {
        const scorecard = await recalculateRoundAssignments(session.id, userId, tx);
        await rebuildRoundStrokesGainedEvents(
          session.id,
          userId,
          scorecard ?? session.scorecardJson,
          tx,
        );
      } else {
        await tx
          .update(sessions)
          .set({ updatedAt: nextRoundVersionTime(session.updatedAt) })
          .where(and(eq(sessions.id, session.id), eq(sessions.userId, userId)));
      }
    }
    await refreshStockYardagesForClubs(tx, {
      userId,
      clubContexts: evidence.flatMap((shot) => [
        { clubId: shot.clubId, playContext: shot.playContext },
        { clubId: targetId, playContext: shot.playContext },
      ]),
      calculatedAt: now,
    });
    await recordOfflineRoundCommit(tx, userId, sessionId);
    return { sessionIds: affectedSessions.map((session) => session.id), clubId: targetId };
  });
  const warning = await refreshCorrectedPracticeEvidence(userId, changed.sessionIds);
  return warning ? { ...changed, warning } : changed;
}

async function refreshCorrectedPracticeEvidence(userId: string, sessionIds: string[]) {
  try {
    await refreshPracticeEvidenceForReviewedSessions(userId, sessionIds);
    return undefined;
  } catch (error) {
    reportServerFailure("club_correction_practice_refresh_failed", error, {
      "app.session_count": sessionIds.length,
    });
    return "Club saved, but linked practice results could not refresh. Save this club again to retry.";
  }
}
