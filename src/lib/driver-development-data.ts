import "server-only";
import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { shots, sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { getSpeedCoachCardData } from "@/lib/speed-training-data";
import { buildDriverDevelopmentSnapshot } from "@/lib/driver-development-snapshot";

/** One owner-scoped source shared by every surface. No persistent cache of review decisions. */
export const getDriverDevelopmentSnapshot = cache(async (userId?: string, date?: string) => {
  userId ??= await requireCurrentUserId();
  const rows = await getDb()
    .select({
      id: shots.id,
      sessionId: shots.sessionId,
      clubId: shots.clubId,
      clubType: shots.clubType,
      shotAt: shots.shotAt,
      sessionSource: sessions.source,
      sessionType: sessions.type,
      playContext: shots.playContext,
      fileName: sessions.fileName,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      ballSpeedMph: shots.ballSpeedMph,
      clubSpeedMph: shots.clubSpeedMph,
      smashFactor: shots.smashFactor,
      launchAngleDeg: shots.launchAngleDeg,
      launchDirectionDeg: shots.launchDirectionDeg,
      attackAngleDeg: shots.attackAngleDeg,
      clubPathDeg: shots.clubPathDeg,
      faceAngleDeg: shots.faceAngleDeg,
      apexFt: shots.apexFt,
      sideCarryYd: shots.sideCarryYd,
      spinRate: shots.spinRate,
      spinAxis: shots.spinAxis,
      clubDataEstType: shots.clubDataEstType,
      reviewStatus: shots.reviewStatus,
      qualityTag: shots.qualityTag,
      shotCategory: shots.shotCategory,
      sourceRawJson: shots.sourceRawJson,
      dataConfidence: sessions.dataConfidenceJson,
    })
    .from(shots)
    .innerJoin(sessions, and(eq(shots.sessionId, sessions.id), eq(sessions.userId, userId)))
    .where(and(eq(shots.userId, userId), eq(shots.clubType, "driver")))
    .orderBy(desc(shots.shotAt), desc(shots.id));
  if (!rows.length) return null;
  const { development } = await getSpeedCoachCardData(userId);
  return buildDriverDevelopmentSnapshot(rows, date, development.project);
});
