import "server-only";

import { and, asc, desc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { roundSessionTypes } from "@/lib/round-sessions";
import { detectShotDataIntegrityIssue } from "@/lib/shot-data-integrity";
import type { TodayProgressHistoryDay } from "@/lib/today-progress";
import { practiceShotSelect } from "@/lib/today-session-data";

const PREVIOUS_PRACTICE_DAY_LIMIT = 5;

export async function getTodayProgressHistory({
  beforeDateKey,
}: {
  beforeDateKey: string;
}): Promise<TodayProgressHistoryDay[]> {
  const userId = await requireCurrentUserId();
  if (!isValidDateKey(beforeDateKey)) {
    throw new Error("A valid selected practice date is required for progress history.");
  }

  const db = getDb();
  const practiceDateKey = sql<string>`to_char(${shots.shotAt} at time zone 'Europe/London', 'YYYY-MM-DD')`;
  const before = sql`(${beforeDateKey}::date::timestamp at time zone 'Europe/London')`;
  const eligibleHistory = and(
    eq(shots.userId, userId),
    eq(sessions.userId, userId),
    eq(clubs.userId, userId),
    notInArray(sessions.type, [...roundSessionTypes]),
    lt(shots.shotAt, before),
  );

  // Bound the number of complete practice days, not individual uploads or shot rows.
  const days = await db
    .select({ dateKey: practiceDateKey })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(eligibleHistory)
    .groupBy(practiceDateKey)
    .orderBy(desc(practiceDateKey))
    .limit(PREVIOUS_PRACTICE_DAY_LIMIT);

  if (days.length === 0) {
    return [];
  }

  const rows = await db
    .select({ ...practiceShotSelect, dateKey: practiceDateKey })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(
      and(
        eligibleHistory,
        inArray(
          practiceDateKey,
          days.map((day) => day.dateKey),
        ),
      ),
    )
    .orderBy(asc(shots.shotAt), asc(shots.sessionId), asc(shots.shotNumber), asc(shots.id));

  const history: TodayProgressHistoryDay[] = days.map(({ dateKey }) => ({
    dateKey,
    rawShots: [],
  }));
  const byDate = new Map(history.map((day) => [day.dateKey, day]));
  for (const { dateKey, ...shot } of rows) {
    // Preserve original fields and excluded rows; the model applies shared clean-shot
    // eligibility before masking any direction measurements that lack confidence.
    byDate.get(dateKey)?.rawShots.push({
      ...shot,
      dataIntegrityIssue: detectShotDataIntegrityIssue(shot),
    });
  }

  return history;
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
