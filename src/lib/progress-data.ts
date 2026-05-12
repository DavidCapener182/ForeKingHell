import { and, asc, desc, eq } from "drizzle-orm";

import { clubs, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { clubSortValue, isTrackedClubType } from "@/lib/club-format";
import {
  calculateClubAnalytics,
  type BagClubAnalyticsContext,
  type ClubAnalyticsShot,
} from "@/lib/club-analytics";
import { requireCurrentUserId } from "@/lib/current-user";
import type { ProgressClub } from "@/lib/progress-summary";
import { calculateStockYardage } from "@/lib/stock-yardage";

export type ProgressData = {
  clubs: ProgressClub[];
};

export async function getProgressData(userId?: string): Promise<ProgressData> {
  const db = getDb();
  userId ??= await requireCurrentUserId();
  const [clubRows, shotRows] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .select({
        id: shots.id,
        clubId: shots.clubId,
        clubType: shots.clubType,
        sessionId: shots.sessionId,
        shotNumber: shots.shotNumber,
        shotAt: shots.shotAt,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        clubSpeedMph: shots.clubSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        launchDirectionDeg: shots.launchDirectionDeg,
        apexFt: shots.apexFt,
        attackAngleDeg: shots.attackAngleDeg,
        clubPathDeg: shots.clubPathDeg,
        descentAngleDeg: shots.descentAngleDeg,
        smashFactor: shots.smashFactor,
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
        clubDataEstType: shots.clubDataEstType,
        courseHoleNumber: shots.courseHoleNumber,
        sessionType: sessions.type,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(eq(shots.userId, userId))
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber)),
  ]);
  const trackedClubs = clubRows.filter((club) => isTrackedClubType(club.type));
  const shotsByClubId = new Map<string, typeof shotRows>();

  for (const shot of shotRows) {
    const group = shotsByClubId.get(shot.clubId) ?? [];
    group.push(shot);
    shotsByClubId.set(shot.clubId, group);
  }

  const bagContext: BagClubAnalyticsContext[] = trackedClubs
    .map((club) => {
      const clubShots = shotsByClubId.get(club.id) ?? [];
      const stock = calculateStockYardage(clubShots, 50, { clubType: club.type });

      return {
        clubId: club.id,
        clubType: club.type,
        stockCarryYd: stock.carryMedianYd,
        confidenceScore: stock.confidenceScore,
        sampleSize: stock.sampleSize,
      };
    })
    .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType));

  return {
    clubs: trackedClubs
      .map((club) => {
        const analyticsShots = (shotsByClubId.get(club.id) ?? []).map((shot) =>
          toAnalyticsShot(shot, club.type),
        );

        return {
          clubId: club.id,
          clubType: club.type,
          brandModel: [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model",
          analytics: calculateClubAnalytics({
            clubType: club.type,
            shots: analyticsShots,
            bagContext,
          }),
        };
      })
      .sort((left, right) => clubSortValue(left.clubType) - clubSortValue(right.clubType)),
  };
}

type ProgressShotRow = {
  id: string;
  clubId: string;
  clubType: string;
  sessionId: string;
  shotNumber: number | null;
  shotAt: Date;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  shotCategory: string | null;
  qualityTag: string | null;
  clubDataEstType: string | null;
  courseHoleNumber: number | null;
  sessionType: string | null;
};

function toAnalyticsShot(shot: ProgressShotRow, clubType: string): ClubAnalyticsShot {
  return {
    ...shot,
    clubType,
    shotAt: shot.shotAt.toISOString(),
  };
}
