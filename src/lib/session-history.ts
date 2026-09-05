import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { SessionTimelineItem } from "@/app/sessions/session-timeline";
import { getDb } from "@/db/client";
import { practicePlans, sessions, shots } from "@/db/schema";
import { formatClubType } from "@/lib/club-format";
import {
  buildShotPatternPoints,
  summarizeShotPattern,
  type ShotPatternPoint,
} from "@/lib/shot-pattern-chart-data";
import { isShotEvidenceEligible } from "@/lib/shot-review";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export async function getRecentSessionHistory(
  userId: string,
  limit = 24,
  options: { includeShotPatterns?: boolean } = {},
): Promise<SessionTimelineItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: sessions.id,
      type: sessions.type,
      source: sessions.source,
      date: sessions.date,
      courseName: sessions.courseName,
      fileName: sessions.fileName,
      playContext: sessions.playContext,
      notes: sessions.notes,
      equipmentNotes: sessions.equipmentNotes,
      rawUploadId: sessions.rawUploadId,
      scorecardJson: sessions.scorecardJson,
      practicePlanId: practicePlans.id,
      practiceScore: practicePlans.practiceScore,
      matchConfidence: practicePlans.matchConfidence,
      shotCount: sql<number>`count(${shots.id})::int`,
    })
    .from(sessions)
    .leftJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .leftJoin(
      practicePlans,
      and(eq(practicePlans.sourceSessionId, sessions.id), eq(practicePlans.userId, userId)),
    )
    .where(eq(sessions.userId, userId))
    .groupBy(sessions.id, practicePlans.id)
    .orderBy(desc(sessions.date))
    .limit(limit);

  const sessionIds = rows.map((row) => row.id);
  const shotRows = sessionIds.length
    ? await db
        .select({
          id: shots.id,
          sessionId: shots.sessionId,
          clubType: shots.clubType,
          carryYd: shots.carryYd,
          totalYd: shots.totalYd,
          sideCarryYd: shots.sideCarryYd,
          apexFt: shots.apexFt,
          launchAngleDeg: shots.launchAngleDeg,
          launchDirectionDeg: shots.launchDirectionDeg,
          ballSpeedMph: shots.ballSpeedMph,
          shotNumber: shots.shotNumber,
          shotAt: shots.shotAt,
          reviewStatus: shots.reviewStatus,
          shotCategory: shots.shotCategory,
          qualityTag: shots.qualityTag,
        })
        .from(shots)
        .where(and(eq(shots.userId, userId), inArray(shots.sessionId, sessionIds)))
    : [];
  const pointsBySession = new Map<string, ShotPatternPoint[]>();

  const eligibleShots = shotRows.filter(isShotEvidenceEligible);
  const trustedShotIds = new Set(eligibleShots.map((shot) => shot.id));
  for (const shot of eligibleShots) {
    const point = buildShotPatternPoints([shot], { trustedShotIds })[0];
    if (!point) continue;
    pointsBySession.set(shot.sessionId, [...(pointsBySession.get(shot.sessionId) ?? []), point]);
  }

  return rows.map((row) => {
    const isRound = row.type === "round" || row.type === "real_round";
    const points = pointsBySession.get(row.id) ?? [];
    const clubTypes = [...new Set(points.map((point) => point.clubType))];
    const clubLabels = clubTypes.map(formatClubType);
    const shotCount = Number(row.shotCount ?? 0);
    const roundScoreLabel = isRound ? formatRoundScore(row.scorecardJson) : null;
    const pattern = summarizeShotPattern(points.filter((point) => point.trusted));
    const sourceLabel = formatLabel(row.source);
    const typeLabel = sessionCategory({
      isRound,
      type: row.type,
      source: row.source,
      playContext: row.playContext,
    });

    return {
      id: row.id,
      isRound,
      title:
        row.courseName ??
        (clubLabels.length ? compactList(clubLabels, 3) : null) ??
        row.fileName ??
        typeLabel,
      dateGroup: sessionDateGroup(row.date),
      dateLabel: dateFormatter.format(row.date),
      timeLabel: timeFormatter.format(row.date),
      shotCount,
      resultLabel: roundScoreLabel ?? `${shotCount} shot${shotCount === 1 ? "" : "s"}`,
      sourceLabel,
      typeLabel,
      contextLabel: row.courseName ?? compactList(clubLabels, 3) ?? formatLabel(row.playContext),
      clubs: clubTypes,
      clubsLabel: compactList(clubLabels, 3) ?? "No clubs recorded",
      notes: row.notes,
      equipmentNotes: row.equipmentNotes,
      verdict:
        row.practiceScore !== null
          ? `Practice usefulness ${row.practiceScore}/100`
          : isRound
            ? "Round review ready"
            : shotCount > 0
              ? "Measured review ready"
              : "Activity recorded",
      mainImprovement: improvementReadout({
        practiceScore: row.practiceScore,
        planLinked: Boolean(row.practicePlanId),
        shotCount,
        clubCount: clubTypes.length,
      }),
      mainIssue: issueReadout(pattern),
      planLinked: Boolean(row.practicePlanId),
      importedEvidence: Boolean(row.rawUploadId || row.fileName || row.source !== "manual"),
      roundScoreLabel,
      evidenceConfidence: evidenceConfidence(shotCount, row.matchConfidence),
      points: options.includeShotPatterns === false ? [] : points,
      importantMetrics: importantMetrics({ points, shotCount, roundScoreLabel }),
    } satisfies SessionTimelineItem;
  });
}

function sessionCategory({
  isRound,
  type,
  source,
  playContext,
}: {
  isRound: boolean;
  type: string;
  source: string;
  playContext: string;
}) {
  if (isRound) return "Round";
  if (`${type} ${source} ${playContext}`.toLowerCase().includes("simulat")) return "Simulator";
  return "Practice";
}

function sessionDateGroup(date: Date) {
  const todayKey = dateKeyFormatter.format(new Date());
  const dateKey = dateKeyFormatter.format(date);
  if (dateKey === todayKey) return "Today";

  const today = new Date(`${todayKey}T00:00:00Z`);
  const sessionDate = new Date(`${dateKey}T00:00:00Z`);
  const difference = Math.round((today.getTime() - sessionDate.getTime()) / 86_400_000);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  return difference >= 0 && difference <= mondayOffset ? "This week" : "Earlier";
}

function improvementReadout({
  practiceScore,
  planLinked,
  shotCount,
  clubCount,
}: {
  practiceScore: number | null;
  planLinked: boolean;
  shotCount: number;
  clubCount: number;
}) {
  if (practiceScore !== null) return `Plan response captured at ${practiceScore}/100 usefulness.`;
  if (planLinked) return "Practice-plan evidence is linked and ready for the next comparison.";
  if (shotCount > 0)
    return `A measured baseline now covers ${shotCount} shots across ${clubCount || 1} club${clubCount === 1 ? "" : "s"}.`;
  return "No like-for-like improvement claim is available yet.";
}

function issueReadout(pattern: ReturnType<typeof summarizeShotPattern>) {
  if (pattern.sampleSize === 0)
    return "No measured dispersion is available for a reliable issue call.";
  const width =
    pattern.sideLowYd === null || pattern.sideHighYd === null
      ? null
      : Math.round(pattern.sideHighYd - pattern.sideLowYd);
  const direction = pattern.typicalMiss
    ? pattern.typicalMiss === "Central"
      ? "centred"
      : pattern.typicalMiss.toLowerCase()
    : "mixed";
  return `The typical miss finished ${direction}${width === null ? "" : ` across an ${width} yd 80% window`}.`;
}

function importantMetrics({
  points,
  shotCount,
  roundScoreLabel,
}: {
  points: ShotPatternPoint[];
  shotCount: number;
  roundScoreLabel: string | null;
}) {
  const trusted = points.filter((point) => point.trusted);
  const carries = trusted.flatMap((point) => (point.carryYd === null ? [] : [point.carryYd]));
  const offline = trusted.flatMap((point) =>
    point.sideCarryYd === null ? [] : [Math.abs(point.sideCarryYd)],
  );
  const apex = trusted.flatMap((point) => (point.apexFt === null ? [] : [point.apexFt]));

  return [
    {
      label: roundScoreLabel ? "Score" : "Measured shots",
      value: roundScoreLabel ?? String(shotCount),
    },
    { label: "Average carry", value: formatAverage(carries, "yd") },
    { label: "Average offline", value: formatAverage(offline, "yd") },
    { label: "Average apex", value: formatAverage(apex, "ft") },
  ];
}

function formatAverage(values: number[], unit: string) {
  if (!values.length) return "—";
  return `${Math.round(values.reduce((total, value) => total + value, 0) / values.length)} ${unit}`;
}

function compactList(values: string[], limit: number) {
  if (!values.length) return null;
  const visible = values.slice(0, limit);
  return values.length > limit
    ? `${visible.join(", ")} +${values.length - limit}`
    : visible.join(", ");
}

function formatRoundScore(
  scorecard: Array<{
    score?: number | null;
  }> | null,
) {
  const recordedScores = (scorecard ?? []).flatMap((hole) =>
    typeof hole.score === "number" && Number.isFinite(hole.score) ? [hole.score] : [],
  );
  if (recordedScores.length === 0) return null;
  const gross = recordedScores.reduce((total, score) => total + score, 0);
  return recordedScores.length === 18
    ? `${gross} gross`
    : `${gross} gross · ${recordedScores.length} holes`;
}

function evidenceConfidence(
  shotCount: number,
  matchConfidence: number | null,
): "High" | "Moderate" | "Low" {
  if (shotCount >= 20 && (matchConfidence === null || matchConfidence >= 75)) return "High";
  if (shotCount >= 8) return "Moderate";
  return "Low";
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
