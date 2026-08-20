import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, sessions, shots, stockYardages } from "@/db/schema";
import { isShortGameTouchClubType, isTrackedClubType } from "@/lib/club-format";
import { calculateStockYardage } from "@/lib/stock-yardage";

type StockYardageTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

export async function refreshStockYardagesForClubs(
  tx: StockYardageTransaction,
  input: {
    userId: string;
    clubContexts: Array<{ clubId: string; playContext: string }>;
    calculatedAt?: Date;
  },
) {
  const clubContexts = [
    ...new Map(
      input.clubContexts.map((item) => [`${item.clubId}:${item.playContext}`, item] as const),
    ).values(),
  ];
  const clubIds = [...new Set(clubContexts.map((item) => item.clubId))];

  if (clubIds.length === 0) {
    return;
  }

  const clubRows = await tx
    .select({ id: clubs.id, type: clubs.type })
    .from(clubs)
    .where(and(eq(clubs.userId, input.userId), inArray(clubs.id, clubIds)));

  for (const club of clubRows) {
    if (!isTrackedClubType(club.type) || isShortGameTouchClubType(club.type)) {
      continue;
    }

    const contexts = clubContexts.filter((item) => item.clubId === club.id);

    for (const context of contexts) {
      const clubShots = await tx
        .select({
          clubType: shots.clubType,
          carryYd: shots.carryYd,
          totalYd: shots.totalYd,
          sideCarryYd: shots.sideCarryYd,
          ballSpeedMph: shots.ballSpeedMph,
          launchAngleDeg: shots.launchAngleDeg,
          courseHoleNumber: shots.courseHoleNumber,
          playContext: shots.playContext,
          sessionType: sessions.type,
          reviewStatus: shots.reviewStatus,
          shotCategory: shots.shotCategory,
          qualityTag: shots.qualityTag,
          shotAt: shots.shotAt,
        })
        .from(shots)
        .innerJoin(sessions, eq(shots.sessionId, sessions.id))
        .where(
          and(
            eq(shots.userId, input.userId),
            eq(sessions.userId, input.userId),
            eq(shots.clubId, club.id),
            eq(shots.playContext, context.playContext),
          ),
        )
        .orderBy(desc(shots.shotAt));
      const stock = calculateStockYardage(clubShots, 50, { clubType: club.type });
      const snapshot = {
        calculatedAt: input.calculatedAt ?? new Date(),
        sampleSize: stock.sampleSize,
        carryMedianYd: stock.carryMedianYd,
        carryMeanYd: stock.carryMeanYd,
        carryP75Yd: stock.carryP75Yd,
        carryP25Yd: stock.carryP25Yd,
        totalMedianYd: stock.totalMedianYd,
        dispersionLeftYd: stock.dispersionLeftYd,
        dispersionRightYd: stock.dispersionRightYd,
        confidenceScore: stock.confidenceScore,
        recommendedPlayNumberYd: stock.recommendedPlayNumberYd,
      };
      const [latestSnapshot] = await tx
        .select({ id: stockYardages.id })
        .from(stockYardages)
        .where(
          and(
            eq(stockYardages.userId, input.userId),
            eq(stockYardages.clubId, club.id),
            eq(stockYardages.playContext, context.playContext),
          ),
        )
        .orderBy(
          desc(stockYardages.calculatedAt),
          desc(stockYardages.createdAt),
          desc(stockYardages.id),
        )
        .limit(1);

      if (latestSnapshot) {
        await tx
          .update(stockYardages)
          .set(snapshot)
          .where(
            and(eq(stockYardages.id, latestSnapshot.id), eq(stockYardages.userId, input.userId)),
          );
      } else {
        await tx.insert(stockYardages).values({
          userId: input.userId,
          clubId: club.id,
          playContext: context.playContext,
          ...snapshot,
        });
      }
    }
  }
}
