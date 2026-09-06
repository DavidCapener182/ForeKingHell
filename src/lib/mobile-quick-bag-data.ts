import "server-only";

import { directionalMetricSql } from "@/lib/directional-confidence-sql";
import { unstable_cache } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { mobileCourseTwinBagProfile } from "@/lib/mobile-course-twin-evidence";
import { mobileQuickBagClub } from "@/lib/mobile-quick-bag-evidence";

export async function getMobileQuickBag() {
  const userId = await requireCurrentUserId();
  return (await getCachedMobileBagEvidence(userId)).bag;
}

export async function getMobileCourseTwinBagProfiles() {
  const userId = await requireCurrentUserId();
  return (await getCachedMobileBagEvidence(userId)).courseTwinProfiles;
}

// Authentication stays outside the cache. Its argument keys the compact result by owner.
// Existing shot mutations revalidate /quick-bag or the root layout; the TTL also
// refreshes provider imports without retaining the full shot history in the cache.
const getCachedMobileBagEvidence = unstable_cache(
  calculateMobileBagEvidence,
  ["mobile-bag-model-evidence-v4"],
  { revalidate: 60 },
);

async function calculateMobileBagEvidence(userId: string) {
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
        sideCarryYd: directionalMetricSql(shots.sideCarryYd),
        ballSpeedMph: shots.ballSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        spinRate: shots.spinRate,
        spinAxis: shots.spinAxis,
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
  const bag = equipment.map((club) => mobileQuickBagClub(club, byClub.get(club.id) ?? []));
  const courseTwinProfiles = bag.flatMap((club) => {
    const profile = mobileCourseTwinBagProfile(club, byClub.get(club.id) ?? []);
    return profile ? [profile] : [];
  });
  return { bag, courseTwinProfiles };
}
