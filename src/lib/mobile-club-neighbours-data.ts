import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { calculateStockYardage, type StockShot } from "@/lib/stock-yardage";
import { isShortGameTouchClubType } from "@/lib/club-format";

export async function getMobileClubNeighbours() {
  const userId = await requireCurrentUserId();
  const rows = await getDb()
    .select({
      id: clubs.id,
      type: clubs.type,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      shotAt: shots.shotAt,
      reviewStatus: shots.reviewStatus,
      qualityTag: shots.qualityTag,
      shotCategory: shots.shotCategory,
      courseHoleNumber: shots.courseHoleNumber,
      sessionType: sessions.type,
    })
    .from(clubs)
    .innerJoin(shots, and(eq(shots.clubId, clubs.id), eq(shots.userId, userId)))
    .innerJoin(sessions, and(eq(shots.sessionId, sessions.id), eq(sessions.userId, userId)))
    .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
    .orderBy(desc(shots.shotAt), desc(shots.shotNumber));
  const grouped = new Map<string, { id: string; type: string; shots: StockShot[] }>();
  for (const row of rows) {
    const item = grouped.get(row.id) ?? { id: row.id, type: row.type, shots: [] };
    item.shots.push(row);
    grouped.set(row.id, item);
  }
  return [...grouped.values()]
    .filter((c) => !isShortGameTouchClubType(c.type) || c.type === "sw")
    .map((c) => ({
      id: c.id,
      type: c.type,
      carry: calculateStockYardage(c.shots, c.shots.length, { clubType: c.type })
        .latestReliableCarryYd,
    }));
}
