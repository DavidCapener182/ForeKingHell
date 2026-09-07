import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions, shots, strokesGainedShotEvents } from "@/db/schema";

export async function getOwnedStrokesGainedPracticeEvents(userId: string, eventIds: string[]) {
  return getDb()
    .select({
      id: strokesGainedShotEvents.id,
      sessionId: strokesGainedShotEvents.sessionId,
      category: strokesGainedShotEvents.category,
      strokesGained: strokesGainedShotEvents.strokesGained,
    })
    .from(strokesGainedShotEvents)
    .innerJoin(
      sessions,
      and(eq(sessions.id, strokesGainedShotEvents.sessionId), eq(sessions.userId, userId)),
    )
    .leftJoin(shots, and(eq(shots.id, strokesGainedShotEvents.shotId), eq(shots.userId, userId)))
    .where(
      and(
        eq(strokesGainedShotEvents.userId, userId),
        inArray(strokesGainedShotEvents.id, eventIds),
        or(isNull(strokesGainedShotEvents.shotId), shotEvidenceSqlPredicate()),
      ),
    );
}

export function shotEvidenceSqlPredicate() {
  return and(
    inArray(shots.reviewStatus, ["included", "restored"]),
    or(
      eq(shots.reviewStatus, "restored"),
      and(
        eq(shots.reviewStatus, "included"),
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'`,
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not in ('exclude', 'excluded', 'delete', 'deleted', 'calibration', 'warm-up', 'warmup', 'warm_up', 'bad-data', 'bad_data', 'invalid', 'launch-monitor-error', 'misread', 'fat', 'mishit', 'thin', 'top')`,
        sql`lower(trim(coalesce(${shots.shotCategory}, ''))) not in ('warm-up', 'warmup', 'warm_up')`,
      ),
    ),
  )!;
}
