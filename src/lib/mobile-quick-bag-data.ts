import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { mobileQuickBagClub } from "@/lib/mobile-quick-bag-evidence";

export async function getMobileQuickBag() {
  const userId = await requireCurrentUserId();
  const [equipment, measured] = await Promise.all([
    getDb()
      .select({ id: clubs.id, type: clubs.type, brand: clubs.brand, model: clubs.model })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true))),
    getDb()
      .select({
        clubId: clubs.id,
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
      .orderBy(desc(shots.shotAt), desc(shots.shotNumber)),
  ]);
  const byClub = new Map<string, typeof measured>();
  for (const shot of measured) {
    const group = byClub.get(shot.clubId) ?? [];
    group.push(shot);
    byClub.set(shot.clubId, group);
  }
  return equipment.map((club) => mobileQuickBagClub(club, byClub.get(club.id) ?? []));
}
