import "server-only";

import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { importFiles, importRows, sessions } from "@/db/schema";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlanReviewForSourceSession } from "@/lib/practice-planner";
import { buildShotPatternPoints, shotPatternConfidence } from "@/lib/shot-pattern-chart-data";
import { companionReviewRoute } from "@/lib/session-review-route";
import { getTodayPracticeData } from "@/lib/today-session-data";

export async function getCompanionImportResult(sessionId: string) {
  const userId = await requireCurrentUserId();
  const [session] = await getDb()
    .select({
      id: sessions.id,
      type: sessions.type,
      source: sessions.source,
      date: sessions.date,
      fileName: sessions.fileName,
      courseName: sessions.courseName,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  if (!session) return null;

  const [data, practiceReview, rawCountRows, importFileRows] = await Promise.all([
    getTodayPracticeData({ sessionId }),
    getPracticePlanReviewForSourceSession(userId, sessionId),
    getDb()
      .select({ value: count() })
      .from(importRows)
      .where(and(eq(importRows.userId, userId), eq(importRows.sessionId, sessionId))),
    getDb()
      .select({ status: importFiles.status, parseVersion: importFiles.parseVersion })
      .from(importFiles)
      .where(and(eq(importFiles.userId, userId), eq(importFiles.sessionId, sessionId)))
      .limit(1),
  ]);
  const sessionShots = data.rawShots.filter((shot) => shot.sessionId === sessionId);
  const cleanShots = data.shots.filter((shot) => shot.sessionId === sessionId);
  const patternPoints = buildShotPatternPoints(sessionShots);
  const comparisons = data.clubComparisons;
  const improved =
    comparisons
      .filter((comparison) => comparison.verdict === "better")
      .sort((left, right) => right.score - left.score)[0] ?? null;
  const needsWork =
    comparisons
      .filter((comparison) => comparison.verdict === "worse" || comparison.verdict === "mixed")
      .sort((left, right) => left.score - right.score)[0] ??
    [...comparisons].sort((left, right) => left.score - right.score)[0] ??
    null;
  const preferredClub =
    practiceReview?.comparison?.planVsActual.plannedClubs.find((club) =>
      patternPoints.some((point) => point.clubType === club),
    ) ??
    needsWork?.clubType ??
    patternPoints[0]?.clubType ??
    null;
  const confidence = shotPatternConfidence(
    patternPoints.filter(
      (point) => point.trusted && (!preferredClub || point.clubType === preferredClub),
    ),
  );

  return {
    session,
    reviewHref: companionReviewRoute(session),
    isRound: companionReviewRoute(session).startsWith("/rounds/"),
    shotCount: sessionShots.length,
    clubCount: new Set(sessionShots.map((shot) => shot.clubType)).size,
    rawRowCount: Number(rawCountRows[0]?.value ?? 0),
    questionableRowCount: Math.max(0, sessionShots.length - cleanShots.length),
    clubs: [...new Set(sessionShots.map((shot) => formatClubType(shot.clubType)))],
    sourceStatus: importFileRows[0]?.status ?? "saved",
    parseVersion: importFileRows[0]?.parseVersion ?? `${session.source}-v1`,
    verdict: data.overall,
    confidence,
    practiceReview,
    improved,
    needsWork,
    preferredClub,
    patternPoints,
  };
}
