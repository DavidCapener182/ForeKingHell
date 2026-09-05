import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { shots, sessions, clubs } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { createAutomaticShotReviewer } from "./automatic-shot-review";
import { formatClubType } from "./club-format";

export const AUTOMATIC_REVIEW_BATCH = 200;
export async function getAutomaticShotReviewData(page: number) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const selection = {
    id: shots.id,
    sessionId: shots.sessionId,
    clubId: shots.clubId,
    clubType: shots.clubType,
    playContext: shots.playContext,
    sessionSource: sessions.source,
    carryYd: shots.carryYd,
    totalYd: shots.totalYd,
    ballSpeedMph: shots.ballSpeedMph,
    clubSpeedMph: shots.clubSpeedMph,
    smashFactor: shots.smashFactor,
    shotCategory: shots.shotCategory,
    qualityTag: shots.qualityTag,
    reviewStatus: shots.reviewStatus,
    reviewSource: shots.reviewSource,
  };
  const where = and(eq(shots.userId, userId), eq(sessions.userId, userId));
  const [candidates, history, bag] = await Promise.all([
    db
      .select({
        ...selection,
        shotAt: shots.shotAt,
        shotNumber: shots.shotNumber,
        fileName: sessions.fileName,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(where)
      .orderBy(desc(shots.shotAt), desc(shots.id))
      .limit(AUTOMATIC_REVIEW_BATCH + 1)
      .offset((page - 1) * AUTOMATIC_REVIEW_BATCH),
    db
      .select(selection)
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(where)
      .orderBy(desc(shots.shotAt), desc(shots.id))
      .limit(4000),
    db.select({ id: clubs.id, type: clubs.type }).from(clubs).where(eq(clubs.userId, userId)),
  ]);
  const review = createAutomaticShotReviewer(history);
  const rows = candidates.slice(0, AUTOMATIC_REVIEW_BATCH).flatMap((shot) => {
    const suggestion = review(shot);
    return suggestion && suggestion.actionable !== false
      ? [
          {
            ...shot,
            shotAt: shot.shotAt.toISOString(),
            clubLabel: formatClubType(shot.clubType),
            suggestion,
          },
        ]
      : [];
  });
  return {
    rows,
    scanned: Math.min(candidates.length, AUTOMATIC_REVIEW_BATCH),
    hasNext: candidates.length > AUTOMATIC_REVIEW_BATCH,
    clubs: bag.map((club) => ({ value: club.id, label: formatClubType(club.type) })),
  };
}
export type AutomaticReviewRow = Awaited<
  ReturnType<typeof getAutomaticShotReviewData>
>["rows"][number];
