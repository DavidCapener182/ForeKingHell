import "server-only";

import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  importJobs,
  offlineOperations,
  practicePlans,
  sessions,
  shots,
  stockYardages,
} from "@/db/schema";

export async function getWeeklyChangeEvidence(userId: string, now = new Date()) {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7);
  const sinceIso = since.toISOString();

  const [latestSession, completedRows, sessionRows, issueRows, personalBestRows] =
    await Promise.all([
      getDb()
        .select({ date: sessions.date })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.date))
        .limit(1),
      getDb()
        .select({ total: count(practicePlans.id) })
        .from(practicePlans)
        .where(
          and(
            eq(practicePlans.userId, userId),
            inArray(practicePlans.status, ["completed", "analysed"]),
            gte(practicePlans.completedAt, since),
          ),
        ),
      getDb()
        .select({
          sessions: count(sessions.id),
          rounds: sql<number>`count(*) filter (where ${sessions.type} = 'real_round')::int`,
        })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gte(sessions.date, since))),
      getDb()
        .select({
          suspiciousShots: sql<number>`count(*) filter (where ${shots.carryYd} <= 0 or ${shots.carryYd} > 400 or ${shots.totalYd} > 500)::int`,
          unmappedShots: sql<number>`count(*) filter (where lower(trim(${shots.clubType})) in ('other', 'unknown', 'ot', ''))::int`,
          staleStocks: sql<number>`(select count(distinct ${stockYardages.clubId})::int from ${stockYardages} where ${stockYardages.userId} = ${userId} and ${stockYardages.calculatedAt} < now() - interval '90 days')`,
          failedSyncs: sql<number>`(select count(*)::int from ${importJobs} where ${importJobs.userId} = ${userId} and ${importJobs.status} in ('failed', 'error'))`,
          failedOffline: sql<number>`(select count(*)::int from ${offlineOperations} where ${offlineOperations.userId} = ${userId} and ${offlineOperations.status} = 'failed_permanent')`,
        })
        .from(shots)
        .where(eq(shots.userId, userId)),
      getDb().execute<{ total: number }>(sql`
      select count(*)::int as total
      from (
        select
          ${shots.shotAt} as shot_at,
          ${shots.carryYd} as carry_yd,
          max(${shots.carryYd}) over (
            partition by ${shots.clubId}
            order by ${shots.shotAt}, ${shots.id}
            rows between unbounded preceding and 1 preceding
          ) as prior_best
        from ${shots}
        where ${shots.userId} = ${userId}
          and ${shots.carryYd} is not null
          and ${shots.reviewStatus} in ('included', 'restored')
          and (
            ${shots.reviewStatus} = 'restored'
            or (
              ${shots.reviewStatus} = 'included'
              and lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'
              and lower(trim(coalesce(${shots.qualityTag}, ''))) not in (
                'exclude', 'excluded', 'delete', 'deleted', 'calibration', 'warm-up', 'warmup',
                'warm_up', 'bad-data', 'bad_data', 'invalid', 'launch-monitor-error', 'misread',
                'fat', 'mishit', 'thin', 'top'
              )
              and lower(trim(coalesce(${shots.shotCategory}, ''))) not in (
                'warm-up', 'warmup', 'warm_up'
              )
            )
          )
      ) ranked
      where shot_at >= ${sinceIso}::timestamptz
        and (prior_best is null or carry_yd > prior_best)
    `),
    ]);

  const issues = issueRows[0];

  return {
    latestSessionAt: latestSession[0]?.date ?? null,
    completedPracticeCount: Number(completedRows[0]?.total ?? 0),
    completedSessionCount: Number(sessionRows[0]?.sessions ?? 0),
    completedRoundCount: Number(sessionRows[0]?.rounds ?? 0),
    dataQualityIssueCount:
      Number(issues?.suspiciousShots ?? 0) +
      Number(issues?.unmappedShots ?? 0) +
      Number(issues?.staleStocks ?? 0) +
      Number(issues?.failedSyncs ?? 0) +
      Number(issues?.failedOffline ?? 0),
    personalBestCount: Number(personalBestRows[0]?.total ?? 0),
  };
}
