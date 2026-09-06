"use server";

import { directionalMetricSql } from "@/lib/directional-confidence-sql";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  analysisSnapshots,
  contentExports,
  practicePlans,
  practiceResults,
  sessions,
  shareLinks,
  shots,
  userProfiles,
  users,
} from "@/db/schema";
import { buildCoachSummary } from "@/lib/coach";
import { coachReportTemplates, hashReportPassword } from "@/lib/coach-report-access";
import {
  buildCoachReportSnapshot,
  parseCoachReportSections,
  type CoachReportNote,
} from "@/lib/coach-report";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProductPreferences } from "@/lib/product-preferences";
import { getProgressData } from "@/lib/progress-data";
import { createShareToken, getShareExpiry, hashShareToken } from "@/lib/share-links";

const LOOKBACK_DAYS = 28;

export async function createCoachReportAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  let selectedSections = parseCoachReportSections(formData.getAll("sections"));
  const hideExactShotData = formData.get("hideExactShotData") === "on";
  if (hideExactShotData)
    selectedSections = selectedSections.filter((section) => section !== "raw_evidence");

  if (selectedSections.length === 0) {
    redirect("/coach/reports?error=select_sections");
  }

  const selected = new Set(selectedSections);
  const now = new Date();
  const lookback = new Date(now);
  lookback.setUTCDate(lookback.getUTCDate() - LOOKBACK_DAYS);

  const [
    preferences,
    progressData,
    recentSessions,
    measuredRows,
    planRows,
    noteRows,
    rawRows,
    comparisonRows,
    profileRows,
    roundRows,
  ] = await Promise.all([
    getProductPreferences(userId),
    selected.has("key_trends") ||
    selected.has("bag_gaps") ||
    selected.has("bag_numbers") ||
    selected.has("personal_bests")
      ? getProgressData(userId)
      : Promise.resolve({ clubs: [] }),
    selected.has("recent_sessions")
      ? db
          .select({
            id: sessions.id,
            date: sessions.date,
            type: sessions.type,
            source: sessions.source,
            courseName: sessions.courseName,
            fileName: sessions.fileName,
            shotCount: count(shots.id),
          })
          .from(sessions)
          .leftJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
          .where(eq(sessions.userId, userId))
          .groupBy(
            sessions.id,
            sessions.date,
            sessions.type,
            sessions.source,
            sessions.courseName,
            sessions.fileName,
          )
          .orderBy(desc(sessions.date))
          .limit(8)
      : Promise.resolve([]),
    selected.has("practice_adherence")
      ? db
          .select({ total: count(sessions.id) })
          .from(sessions)
          .where(and(eq(sessions.userId, userId), gte(sessions.date, lookback)))
      : Promise.resolve([{ total: 0 }]),
    selected.has("practice_adherence")
      ? db
          .select({
            status: practicePlans.status,
            completedAt: practicePlans.completedAt,
          })
          .from(practicePlans)
          .where(and(eq(practicePlans.userId, userId), gte(practicePlans.plannedAt, lookback)))
      : Promise.resolve([]),
    selected.has("notes")
      ? loadSelectedNotes(userId, lookback)
      : Promise.resolve<CoachReportNote[]>([]),
    selected.has("raw_evidence")
      ? db
          .select({
            sessionId: shots.sessionId,
            sessionDate: sessions.date,
            club: shots.clubType,
            shotNumber: shots.shotNumber,
            carryYd: shots.carryYd,
            sideCarryYd: directionalMetricSql(shots.sideCarryYd),
            ballSpeedMph: shots.ballSpeedMph,
            launchAngleDeg: shots.launchAngleDeg,
            quality: shots.qualityTag,
          })
          .from(shots)
          .innerJoin(sessions, and(eq(sessions.id, shots.sessionId), eq(sessions.userId, userId)))
          .where(eq(shots.userId, userId))
          .orderBy(desc(shots.shotAt))
          .limit(20)
      : Promise.resolve([]),
    selected.has("saved_comparisons")
      ? db
          .select({
            id: analysisSnapshots.id,
            name: analysisSnapshots.name,
            capturedAt: analysisSnapshots.capturedAt,
            notes: analysisSnapshots.notes,
            summary: analysisSnapshots.summaryJson,
          })
          .from(analysisSnapshots)
          .where(
            and(
              eq(analysisSnapshots.userId, userId),
              sql`${analysisSnapshots.chartStateJson}->>'view' = 'session_comparison'`,
            ),
          )
          .orderBy(desc(analysisSnapshots.capturedAt))
          .limit(12)
      : Promise.resolve([]),
    selected.has("profile_summary")
      ? db
          .select({
            displayName: userProfiles.displayName,
            fallbackName: users.name,
            homeCourse: userProfiles.homeCourse,
            handicapBand: userProfiles.handicapBand,
            primaryLaunchMonitor: userProfiles.primaryLaunchMonitor,
          })
          .from(users)
          .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
          .where(eq(users.id, userId))
          .limit(1)
      : Promise.resolve([]),
    selected.has("course_performance")
      ? db
          .select({
            date: sessions.date,
            courseName: sessions.courseName,
            location: sessions.location,
            scorecard: sessions.scorecardJson,
          })
          .from(sessions)
          .where(and(eq(sessions.userId, userId), eq(sessions.type, "real_round")))
          .orderBy(desc(sessions.date))
          .limit(8)
      : Promise.resolve([]),
  ]);

  const coach = buildCoachSummary(progressData.clubs);
  const completedPlans = planRows.filter(
    (plan) =>
      plan.status === "complete" ||
      plan.status === "completed" ||
      plan.status === "analysed" ||
      Boolean(plan.completedAt),
  ).length;
  const snapshot = buildCoachReportSnapshot({
    generatedAt: now,
    selectedSections,
    seasonPlan: preferences.seasonPlan,
    seasonGoals: preferences.goals,
    profileSummary: profileRows[0]
      ? {
          displayName:
            profileRows[0].displayName || profileRows[0].fallbackName || "ForeKingHell golfer",
          homeCourse: profileRows[0].homeCourse,
          handicapBand: profileRows[0].handicapBand,
          primaryLaunchMonitor: profileRows[0].primaryLaunchMonitor,
        }
      : undefined,
    bagNumbers: coach.clubCards.map((club) => ({
      club: club.clubName,
      stockCarryYd: club.stockCarryYd,
      playableRate: club.playableRate,
      sampleSize: club.sampleSize,
      confidence:
        club.sampleSize >= 20 && club.trustIndex >= 70
          ? "High confidence"
          : club.sampleSize >= 8
            ? "Moderate confidence"
            : "Low confidence",
    })),
    coach,
    recentSessions: recentSessions.map((session) => ({
      id: session.id,
      date: session.date.toISOString(),
      label: session.courseName ?? session.fileName ?? formatSessionType(session.type),
      source: session.source,
      shotCount: Number(session.shotCount),
    })),
    practiceAdherence: {
      lookbackDays: LOOKBACK_DAYS,
      targetSessions: preferences.seasonPlan.weeklySessions * 4,
      plannedSessions: planRows.length,
      completedSessions: completedPlans,
      completionRate:
        planRows.length > 0 ? Math.round((completedPlans / planRows.length) * 100) : null,
      measuredSessions: Number(measuredRows[0]?.total ?? 0),
    },
    coursePerformance: roundRows.map((round) => {
      const scored = (round.scorecard ?? []).filter(
        (hole): hole is typeof hole & { score: number } => typeof hole.score === "number",
      );
      return {
        date: round.date.toISOString(),
        course: round.courseName ?? round.location ?? "Recorded round",
        grossScore: scored.length ? scored.reduce((total, hole) => total + hole.score, 0) : null,
        holesRecorded: scored.length,
      };
    }),
    personalBests: progressData.clubs.flatMap((club) => {
      const carryYd = club.analytics.distance.personalBestCarryYd;
      return carryYd === null
        ? []
        : [
            {
              club:
                coach.clubCards.find((item) => item.clubId === club.clubId)?.clubName ??
                club.clubType,
              carryYd,
              evidenceShots: club.analytics.sample.cleanShots,
            },
          ];
    }),
    savedComparisons: comparisonRows.map((comparison) => {
      const summary = record(comparison.summary);
      return {
        id: comparison.id,
        name: comparison.name,
        capturedAt: comparison.capturedAt.toISOString(),
        notes: comparison.notes,
        focusLabel: cleanSnapshotText(summary.focusLabel, "Focus sample"),
        baselineLabel: cleanSnapshotText(summary.baselineLabel, "Baseline sample"),
        focusShots: snapshotNumber(summary.focusShots),
        baselineShots: snapshotNumber(summary.baselineShots),
        verdict: cleanSnapshotText(summary.verdict, "Saved comparison"),
        summary: cleanSnapshotText(summary.summary, "No comparison summary saved."),
        delta: Object.fromEntries(
          Object.entries(record(summary.delta)).map(([key, value]) => [
            key,
            typeof value === "number" && Number.isFinite(value) ? value : null,
          ]),
        ),
      };
    }),
    notes: noteRows,
    rawEvidence: rawRows.map((shot) => ({
      ...shot,
      sessionDate: shot.sessionDate.toISOString(),
    })),
  });
  const token = createShareToken();
  const expiryDays = parseExpiryDays(formData.get("expiryDays"));
  const sourceId = randomUUID();
  const template = coachReportTemplates.some((item) => item.value === formData.get("template"))
    ? String(formData.get("template"))
    : "coach";
  const accessConfig = {
    selectedSections,
    template,
    passwordHash: hashReportPassword(String(formData.get("password") ?? "")),
    disableDownload: formData.get("disableDownload") === "on",
    hideExactShotData,
    hideSocialInformation: formData.get("hideSocialInformation") === "on",
    accessHistory: [] as string[],
  };

  await db.transaction(async (tx) => {
    const [contentExport] = await tx
      .insert(contentExports)
      .values({
        userId,
        sourceType: "coach_report",
        sourceId,
        templateKey: `${template}_report_v1`,
        platform: "web",
        format: "json",
        status: "ready",
        snapshotJson: snapshot as unknown as Record<string, unknown>,
        renderConfigJson: accessConfig,
        updatedAt: now,
      })
      .returning({ id: contentExports.id });

    await tx.insert(shareLinks).values({
      userId,
      tokenHash: hashShareToken(token),
      resourceType: "coach_report",
      resourceId: contentExport.id,
      title: snapshot.title,
      expiresAt: getShareExpiry(expiryDays, now),
      updatedAt: now,
    });
  });

  revalidatePath("/coach/reports");
  redirect(`/coach/reports?share=${encodeURIComponent(token)}`);
}

export async function revokeCoachReportAction(formData: FormData) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const shareLinkId = requiredString(formData, "shareLinkId");
  const now = new Date();

  await db
    .update(shareLinks)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(shareLinks.id, shareLinkId),
        eq(shareLinks.userId, userId),
        eq(shareLinks.resourceType, "coach_report"),
      ),
    );

  revalidatePath("/coach/reports");
}

async function loadSelectedNotes(userId: string, lookback: Date): Promise<CoachReportNote[]> {
  const db = getDb();
  const [sessionNotes, resultNotes] = await Promise.all([
    db
      .select({ date: sessions.date, text: sessions.notes })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.date, lookback)))
      .orderBy(desc(sessions.date))
      .limit(12),
    db
      .select({ date: practiceResults.createdAt, text: practiceResults.notes })
      .from(practiceResults)
      .where(and(eq(practiceResults.userId, userId), gte(practiceResults.createdAt, lookback)))
      .orderBy(desc(practiceResults.createdAt))
      .limit(12),
  ]);

  return [
    ...sessionNotes
      .filter((note): note is { date: Date; text: string } => Boolean(note.text?.trim()))
      .map((note) => ({
        date: note.date.toISOString(),
        source: "session" as const,
        text: note.text.trim().slice(0, 800),
      })),
    ...resultNotes
      .filter((note): note is { date: Date; text: string } => Boolean(note.text?.trim()))
      .map((note) => ({
        date: note.date.toISOString(),
        source: "practice" as const,
        text: note.text.trim().slice(0, 800),
      })),
  ]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 12);
}

function parseExpiryDays(value: FormDataEntryValue | null) {
  const days = Number(value);
  return days === 7 || days === 30 ? days : 14;
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

function formatSessionType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanSnapshotText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : fallback;
}

function snapshotNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
