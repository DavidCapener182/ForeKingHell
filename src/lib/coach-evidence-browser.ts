import "server-only";

import { and, count, desc, eq, max } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";

export type CoachEvidenceBrowserData = {
  sessionCount: number;
  latestSessionAt: Date | null;
  roundCount: number;
  sourceRecordCount: number;
  sources: Array<{ source: string; sessionCount: number }>;
  latestRound: {
    id: string;
    label: string;
    date: Date;
    totalScore: number | null;
    totalPar: number | null;
    holes: number;
  } | null;
};

export async function getCoachEvidenceBrowserData(
  userId: string,
): Promise<CoachEvidenceBrowserData> {
  const db = getDb();
  const [sessionTotals, roundTotals, shotTotals, sourceRows, latestRoundRows] = await Promise.all([
    db
      .select({ count: count(), latest: max(sessions.date) })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    db
      .select({ count: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.type, "real_round"))),
    db.select({ count: count() }).from(shots).where(eq(shots.userId, userId)),
    db
      .select({ source: sessions.source, sessionCount: count() })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .groupBy(sessions.source)
      .orderBy(desc(count())),
    db
      .select({
        id: sessions.id,
        courseName: sessions.courseName,
        fileName: sessions.fileName,
        date: sessions.date,
        scorecardJson: sessions.scorecardJson,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.type, "real_round")))
      .orderBy(desc(sessions.date))
      .limit(1),
  ]);

  const latestRoundRow = latestRoundRows[0] ?? null;
  const scorecard = latestRoundRow?.scorecardJson ?? [];
  const scoredHoles = scorecard.filter((hole) => typeof hole.score === "number");
  const parHoles = scorecard.filter((hole) => typeof hole.par === "number");

  return {
    sessionCount: sessionTotals[0]?.count ?? 0,
    latestSessionAt: sessionTotals[0]?.latest ?? null,
    roundCount: roundTotals[0]?.count ?? 0,
    sourceRecordCount: shotTotals[0]?.count ?? 0,
    sources: sourceRows.map((row) => ({
      source: row.source,
      sessionCount: row.sessionCount,
    })),
    latestRound: latestRoundRow
      ? {
          id: latestRoundRow.id,
          label: latestRoundRow.courseName ?? latestRoundRow.fileName ?? "Latest round",
          date: latestRoundRow.date,
          totalScore:
            scoredHoles.length > 0 && scoredHoles.length === scorecard.length
              ? scoredHoles.reduce((total, hole) => total + (hole.score ?? 0), 0)
              : null,
          totalPar:
            parHoles.length > 0 ? parHoles.reduce((total, hole) => total + hole.par, 0) : null,
          holes: scorecard.length,
        }
      : null,
  };
}
