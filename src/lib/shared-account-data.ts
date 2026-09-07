import "server-only";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { clubs, sessions, shots, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireReadableAccountUserId } from "@/lib/account-access";
import { isShotEvidenceEligible } from "@/lib/shot-review";

export async function getSharedAccountData(targetUserId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId))
    notFound();
  const access = await requireReadableAccountUserId(targetUserId);
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [profileRows, sessionRows, shotRows, clubRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, targetUserId))
      .orderBy(desc(sessions.date)),
    db
      .select({
        clubType: shots.clubType,
        totalYd: shots.totalYd,
        shotAt: shots.shotAt,
        reviewStatus: shots.reviewStatus,
        qualityTag: shots.qualityTag,
        shotCategory: shots.shotCategory,
      })
      .from(shots)
      .where(
        and(eq(shots.userId, targetUserId), inArray(shots.reviewStatus, ["included", "restored"])),
      ),
    db.select().from(clubs).where(eq(clubs.userId, targetUserId)),
  ]);
  const profile = profileRows[0];

  if (!profile) {
    return null;
  }

  const eligibleShotRows = shotRows.filter(isShotEvidenceEligible);
  const clubCounts = countBy(eligibleShotRows.map((shot) => shot.clubType));
  const topClub =
    [...clubCounts.entries()]
      .map(([clubType, count]) => ({ clubType, count }))
      .sort((a, b) => b.count - a.count)[0] ?? null;
  const longestDriveYd =
    eligibleShotRows
      .filter(
        (shot) =>
          shot.clubType === "driver" &&
          typeof shot.totalYd === "number" &&
          Number.isFinite(shot.totalYd) &&
          shot.totalYd > 0,
      )
      .reduce<number | null>((best, shot) => Math.max(best ?? 0, shot.totalYd ?? 0), null) ?? null;

  return {
    profile,
    accessRole: access.role,
    sessionCount: sessionRows.length,
    shotCount: eligibleShotRows.length,
    recentShotCount: eligibleShotRows.filter((shot) => shot.shotAt >= thirtyDaysAgo).length,
    activeClubCount: clubRows.filter((club) => club.active).length,
    topClub,
    longestDriveYd,
    recentRounds: sessionRows.slice(0, 20).map((session) => {
      const scorecard = session.scorecardJson ?? [];
      return {
        id: session.id,
        date: session.date,
        type: session.type,
        courseName: session.courseName,
        fileName: session.fileName,
        holesPlayed: scorecard.length,
        totalScore: scorecardTotal(scorecard),
      };
    }),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function scorecardTotal(scorecard: NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>) {
  if (
    !scorecard.length ||
    scorecard.some((hole) => typeof hole.score !== "number" || !Number.isFinite(hole.score))
  )
    return null;
  return scorecard.reduce((total, hole) => total + (hole.score ?? 0), 0);
}
