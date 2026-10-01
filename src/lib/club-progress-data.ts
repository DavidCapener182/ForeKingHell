import "server-only";
import { and, asc, eq, inArray, lte, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { roundSessionTypes } from "@/lib/round-sessions";
import { practiceShotSelect, type TodayPracticeShot } from "@/lib/today-session-data";
import { detectShotDataIntegrityIssue } from "@/lib/shot-data-integrity";
import { buildClubProgress, type ProgressHistoryState } from "@/lib/today-club-trends";

export const CLUB_PROGRESS_BOUNDS = {
  candidateSessionsPerSeries: 80,
  candidatePairs: 2000,
  shotRows: 40000,
  summariesPerSeries: 22,
} as const;
export const clubProgressLoadingMethod =
  "History scans up to 80 candidate uploads per club/provider/type/session context/shot context, at most 2,000 club-session pairs and 40,000 shot rows. Incomplete uploads are omitted, never averaged as complete sessions. Limits are applied to comparable series before summary windows. Only compact session summaries reach the browser.";

/** Owner checks cover every joined table; selected Today rows are re-read from the database.
 * A bound is an evidence limit, not proof that this is the first practice session.
 */
export async function getClubProgressData(selectedShots?: TodayPracticeShot[]) {
  const accountId = await requireCurrentUserId();
  const currentIds =
    selectedShots === undefined ? null : [...new Set(selectedShots.map((s) => s.sessionId))];
  if (currentIds?.length === 0)
    return {
      accountId,
      clubs: [],
      history: "complete" as ProgressHistoryState,
      invalidSessionCount: 0,
      method: clubProgressLoadingMethod,
    };
  const timestamps = selectedShots
    ?.map((s) => new Date(s.sessionDate ?? s.shotAt).getTime())
    .filter(Number.isFinite);
  const cutoff = timestamps?.length ? new Date(Math.max(...timestamps)) : new Date();
  const clubIds =
    selectedShots === undefined
      ? null
      : [...new Set(selectedShots.map((s) => s.clubId).filter((id): id is string => Boolean(id)))];
  const where = and(
    eq(shots.userId, accountId),
    eq(sessions.userId, accountId),
    eq(clubs.userId, accountId),
    eq(clubs.active, true),
    notInArray(sessions.type, [...roundSessionTypes]),
    lte(sessions.date, cutoff),
    clubIds?.length ? inArray(clubs.id, clubIds) : undefined,
  );
  try {
    const db = getDb();
    // Rank candidate uploads per comparable series. Another provider/context cannot use its allowance.
    const candidates = db
      .select({
        clubId: shots.clubId,
        sessionId: sessions.id,
        count: sql<number>`count(*)::int`.as("reading_count"),
        rank: sql<number>`row_number() over (partition by ${shots.clubId}, ${sessions.source}, ${sessions.type}, ${sessions.playContext}, ${shots.playContext} order by ${sessions.date} desc, ${sessions.id} desc)`.as(
          "series_rank",
        ),
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .where(where)
      .groupBy(
        shots.clubId,
        sessions.id,
        sessions.source,
        sessions.type,
        sessions.playContext,
        shots.playContext,
        sessions.date,
      )
      .as("candidate_uploads");
    const pairs = await db
      .select()
      .from(candidates)
      .where(
        or(
          lte(candidates.rank, CLUB_PROGRESS_BOUNDS.candidateSessionsPerSeries + 1),
          currentIds?.length ? inArray(candidates.sessionId, currentIds) : undefined,
        ),
      )
      .orderBy(
        currentIds?.length
          ? asc(sql`case when ${inArray(candidates.sessionId, currentIds)} then 0 else 1 end`)
          : asc(candidates.rank),
        asc(candidates.rank),
        asc(candidates.clubId),
        asc(candidates.sessionId),
      )
      .limit(CLUB_PROGRESS_BOUNDS.candidatePairs + 1);
    let bounded =
      pairs.length > CLUB_PROGRESS_BOUNDS.candidatePairs ||
      pairs.some((p) => p.rank > CLUB_PROGRESS_BOUNDS.candidateSessionsPerSeries);
    const selectedPairs = pairs
      .slice(0, CLUB_PROGRESS_BOUNDS.candidatePairs)
      .filter(
        (p) =>
          p.rank <= CLUB_PROGRESS_BOUNDS.candidateSessionsPerSeries ||
          currentIds?.includes(p.sessionId),
      );
    const ids = [...new Set([...selectedPairs.map((p) => p.sessionId), ...(currentIds ?? [])])];
    if (!ids.length)
      return {
        accountId,
        clubs: [],
        history: "complete" as ProgressHistoryState,
        invalidSessionCount: 0,
        method: clubProgressLoadingMethod,
      };
    const rows = await db
      .select(practiceShotSelect)
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .innerJoin(clubs, eq(shots.clubId, clubs.id))
      .where(and(where, inArray(shots.sessionId, ids)))
      .orderBy(asc(sessions.id), asc(shots.id))
      .limit(CLUB_PROGRESS_BOUNDS.shotRows + 1);
    bounded ||= rows.length > CLUB_PROGRESS_BOUNDS.shotRows;
    // Whole sessions only, even at the row bound. Candidate counts include each shot context.
    const expected = new Map<string, number>();
    for (const p of pairs) {
      const key = `${p.clubId}/${p.sessionId}`;
      expected.set(key, (expected.get(key) ?? 0) + p.count);
    }
    const actual = new Map<string, number>();
    for (const s of rows.slice(0, CLUB_PROGRESS_BOUNDS.shotRows)) {
      const key = `${s.clubId}/${s.sessionId}`;
      actual.set(key, (actual.get(key) ?? 0) + 1);
    }
    const complete = rows
      .slice(0, CLUB_PROGRESS_BOUNDS.shotRows)
      .filter(
        (s) =>
          actual.get(`${s.clubId}/${s.sessionId}`) === expected.get(`${s.clubId}/${s.sessionId}`),
      );
    const model = buildClubProgress(
      complete.map((s) => ({ ...s, dataIntegrityIssue: detectShotDataIntegrityIssue(s) })),
      currentIds,
    );
    // Retain all in-scope Today uploads so local session switching always has its own predecessor.
    for (const c of model.clubs) {
      const firstCurrent = c.points.findIndex((p) => p.current);
      const start = Math.max(0, c.points.length - CLUB_PROGRESS_BOUNDS.summariesPerSeries);
      const keepFrom =
        currentIds !== null && firstCurrent >= 0
          ? Math.min(start, Math.max(0, firstCurrent - CLUB_PROGRESS_BOUNDS.summariesPerSeries))
          : start;
      bounded ||= keepFrom > 0;
      c.points = c.points.slice(keepFrom);
    }
    return {
      accountId,
      ...model,
      history: (bounded ? "bounded" : "complete") as ProgressHistoryState,
      method: clubProgressLoadingMethod,
    };
  } catch (error) {
    console.error(
      "Club progress history loading failed",
      error instanceof Error ? error.message : "Unknown database error",
    );
    // Current values survive a history failure; active identities and eligibility are still applied.
    const model = buildClubProgress(selectedShots ?? [], currentIds);
    return {
      accountId,
      ...model,
      history: "failed" as ProgressHistoryState,
      method: clubProgressLoadingMethod,
    };
  }
}
