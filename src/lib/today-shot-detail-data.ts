import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, rapsodoSyncSessions, sessions, shotReviewEvents, shots } from "@/db/schema";
import {
  buildShotMasterDetailDto,
  type ShotMasterDetailReviewEventSource,
} from "@/lib/shot-master-detail-dto";

const TODAY_DETAIL_QUERY_BATCH_SIZE = 250;

export async function getTodayShotDetailRows(input: { userId: string; shotIds: string[] }) {
  const shotIds = [...new Set(input.shotIds)];
  if (shotIds.length === 0) return [];

  const db = getDb();
  const rows = (
    await Promise.all(
      chunkTodayDetailIds(shotIds).map((shotIdBatch) =>
        db
          .select({
            id: shots.id,
            sessionId: shots.sessionId,
            sessionSource: sessions.source,
            sessionType: sessions.type,
            sessionPlayContext: sessions.playContext,
            sessionCourseId: sessions.courseId,
            fileName: sessions.fileName,
            shotAt: shots.shotAt,
            shotNumber: shots.shotNumber,
            courseHoleNumber: shots.courseHoleNumber,
            courseHoleShotNumber: shots.courseHoleShotNumber,
            clubType: shots.clubType,
            clubBrand: clubs.brand,
            clubModel: clubs.model,
            carryYd: shots.carryYd,
            totalYd: shots.totalYd,
            ballSpeedMph: shots.ballSpeedMph,
            clubSpeedMph: shots.clubSpeedMph,
            launchAngleDeg: shots.launchAngleDeg,
            launchDirectionDeg: shots.launchDirectionDeg,
            apexFt: shots.apexFt,
            sideCarryYd: shots.sideCarryYd,
            attackAngleDeg: shots.attackAngleDeg,
            clubPathDeg: shots.clubPathDeg,
            faceAngleDeg: shots.faceAngleDeg,
            descentAngleDeg: shots.descentAngleDeg,
            smashFactor: shots.smashFactor,
            spinRate: shots.spinRate,
            spinAxis: shots.spinAxis,
            shotShape: shots.shotShape,
            shotCategory: shots.shotCategory,
            qualityTag: shots.qualityTag,
            reviewStatus: shots.reviewStatus,
            reviewReason: shots.reviewReason,
            reviewConfidence: shots.reviewConfidence,
            reviewSource: shots.reviewSource,
            reviewedAt: shots.reviewedAt,
            clubDataEstType: shots.clubDataEstType,
            sourceRawJson: shots.sourceRawJson,
          })
          .from(shots)
          .innerJoin(
            sessions,
            and(eq(shots.sessionId, sessions.id), eq(sessions.userId, input.userId)),
          )
          .innerJoin(clubs, and(eq(shots.clubId, clubs.id), eq(clubs.userId, input.userId)))
          .where(and(eq(shots.userId, input.userId), inArray(shots.id, shotIdBatch))),
      ),
    )
  ).flat();

  const sessionIds = [...new Set(rows.map((shot) => shot.sessionId))];
  const [reviewEventBatches, providerSessionBatches] = await Promise.all([
    Promise.all(
      chunkTodayDetailIds(rows.map((shot) => shot.id)).map((shotIdBatch) =>
        db
          .select({
            id: shotReviewEvents.id,
            shotId: shotReviewEvents.shotId,
            previousStatus: shotReviewEvents.previousStatus,
            status: shotReviewEvents.status,
            reason: shotReviewEvents.reason,
            confidence: shotReviewEvents.confidence,
            source: shotReviewEvents.source,
            previousQualityTag: shotReviewEvents.previousQualityTag,
            resultingQualityTag: shotReviewEvents.resultingQualityTag,
            createdAt: shotReviewEvents.createdAt,
          })
          .from(shotReviewEvents)
          .where(
            and(
              eq(shotReviewEvents.userId, input.userId),
              inArray(shotReviewEvents.shotId, shotIdBatch),
            ),
          )
          .orderBy(desc(shotReviewEvents.createdAt)),
      ),
    ),
    Promise.all(
      chunkTodayDetailIds(sessionIds).map((sessionIdBatch) =>
        db
          .select({
            sessionId: rapsodoSyncSessions.importedSessionId,
            providerKind: rapsodoSyncSessions.providerKind,
            providerSessionMode: rapsodoSyncSessions.providerSessionMode,
          })
          .from(rapsodoSyncSessions)
          .where(
            and(
              eq(rapsodoSyncSessions.userId, input.userId),
              inArray(rapsodoSyncSessions.importedSessionId, sessionIdBatch),
            ),
          )
          .orderBy(desc(rapsodoSyncSessions.updatedAt)),
      ),
    ),
  ]);
  const reviewEvents = reviewEventBatches.flat();
  const providerSessionRows = providerSessionBatches.flat();
  const eventsByShotId = new Map<string, ShotMasterDetailReviewEventSource[]>();

  for (const event of reviewEvents) {
    const events = eventsByShotId.get(event.shotId) ?? [];
    events.push(event);
    eventsByShotId.set(event.shotId, events);
  }
  const providerMetadataBySessionId = new Map<
    string,
    { providerKind: string; providerSessionMode: string | null }
  >();

  for (const providerSession of providerSessionRows) {
    if (providerSession.sessionId && !providerMetadataBySessionId.has(providerSession.sessionId)) {
      providerMetadataBySessionId.set(providerSession.sessionId, {
        providerKind: providerSession.providerKind,
        providerSessionMode: providerSession.providerSessionMode,
      });
    }
  }

  const rowsById = new Map(
    rows.map((shot) => {
      const providerMetadata = providerMetadataBySessionId.get(shot.sessionId);
      return [
        shot.id,
        buildShotMasterDetailDto({
          ...shot,
          providerKind: providerMetadata?.providerKind ?? null,
          providerSessionMode: providerMetadata?.providerSessionMode ?? null,
          sourceRawJson: shot.sourceRawJson ?? {},
          reviewEvents: eventsByShotId.get(shot.id) ?? [],
        }),
      ];
    }),
  );

  return shotIds.flatMap((shotId) => {
    const shot = rowsById.get(shotId);
    return shot ? [shot] : [];
  });
}

function chunkTodayDetailIds(ids: string[]) {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += TODAY_DETAIL_QUERY_BATCH_SIZE) {
    batches.push(ids.slice(index, index + TODAY_DETAIL_QUERY_BATCH_SIZE));
  }
  return batches;
}
