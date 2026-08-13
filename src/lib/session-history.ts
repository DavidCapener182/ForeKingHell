import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { SessionTimelineItem } from "@/app/sessions/session-timeline";
import { getDb } from "@/db/client";
import { practicePlans, sessions, shots } from "@/db/schema";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export async function getRecentSessionHistory(
  userId: string,
  limit = 24,
): Promise<SessionTimelineItem[]> {
  const rows = await getDb()
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

  return rows.map((row) => ({
    id: row.id,
    isRound: row.type === "round" || row.type === "real_round",
    title: row.courseName ?? row.fileName ?? formatLabel(row.type),
    dateLabel: dateFormatter.format(row.date),
    timeLabel: timeFormatter.format(row.date),
    shotCount: Number(row.shotCount ?? 0),
    typeLabel: formatLabel(row.type),
    sourceLabel: formatLabel(row.source),
    contextLabel: formatLabel(row.playContext),
    notes: row.notes,
    equipmentNotes: row.equipmentNotes,
    verdict:
      row.practiceScore !== null
        ? `Practice usefulness ${row.practiceScore}/100`
        : row.type === "round" || row.type === "real_round"
          ? "Round review ready"
          : Number(row.shotCount ?? 0) > 0
            ? "Measured review ready"
            : "Activity recorded",
    planLinked: Boolean(row.practicePlanId),
    evidenceConfidence: evidenceConfidence(Number(row.shotCount ?? 0), row.matchConfidence),
  }));
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
