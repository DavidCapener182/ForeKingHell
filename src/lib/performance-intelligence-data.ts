import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubEquipmentHistory, clubs, sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildPerformanceIntelligence } from "@/lib/performance-intelligence";
import { performanceSourceContext } from "@/lib/performance-shot-adapter";

export function benchmarkIntelligenceEnabled() {
  return process.env.BENCHMARK_INTELLIGENCE_ENABLED !== "0";
}

/** Request-scoped owner checks on every joined table; no cross-user cache or raw rows reach clients. */
export async function getPerformanceEvidenceData(clubId?: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [rows, equipment] = await Promise.all([
    db
      .select({
        id: shots.id,
        clubId: shots.clubId,
        sessionId: sessions.id,
        shotAt: shots.shotAt,
        sessionDate: sessions.date,
        sessionCreatedAt: sessions.createdAt,
        carryYd: shots.carryYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        smashFactor: shots.smashFactor,
        apexFt: shots.apexFt,
        descentAngleDeg: shots.descentAngleDeg,
        launchAngleDeg: shots.launchAngleDeg,
        spinRate: shots.spinRate,
        attackAngleDeg: shots.attackAngleDeg,
        source: sessions.source,
        sessionType: sessions.type,
        playContext: sessions.playContext,
        shotPlayContext: shots.playContext,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        reviewStatus: shots.reviewStatus,
        clubDataEstType: shots.clubDataEstType,
        sourceRawJson: shots.sourceRawJson,
        dataConfidence: sessions.dataConfidenceJson,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .where(
        and(
          eq(shots.userId, userId),
          eq(sessions.userId, userId),
          eq(clubs.userId, userId),
          clubId ? eq(clubs.id, clubId) : eq(clubs.active, true),
        ),
      )
      .orderBy(desc(sessions.date), desc(shots.shotAt)),
    db
      .select({
        id: clubEquipmentHistory.id,
        clubId: clubEquipmentHistory.clubId,
        effectiveFrom: clubEquipmentHistory.effectiveFrom,
        effectiveTo: clubEquipmentHistory.effectiveTo,
        ballModelId: clubEquipmentHistory.ballModelId,
      })
      .from(clubEquipmentHistory)
      .where(
        and(
          eq(clubEquipmentHistory.userId, userId),
          clubId ? eq(clubEquipmentHistory.clubId, clubId) : undefined,
        ),
      ),
  ]);
  const observations = rows.map((row) => ({ ...row, ...performanceSourceContext(row, equipment) }));
  return { intelligence: buildPerformanceIntelligence(observations), observations };
}

export async function getPerformanceIntelligenceData(clubId?: string) {
  return (await getPerformanceEvidenceData(clubId)).intelligence;
}
