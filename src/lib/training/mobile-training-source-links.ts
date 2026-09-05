import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rapsodoSyncSessions, sessions, speedTrainingSessions } from "@/db/schema";
import type { TrainingSessionListItem } from "./trainingData";
import { isRoundHistorySession } from "@/lib/round-sessions";

/** Training source IDs span multiple tables; resolve ownership before offering a detail link. */
export async function getMobileTrainingSourceLinks(
  userId: string,
  training: TrainingSessionListItem[],
) {
  const ids = [...new Set(training.flatMap((row) => (row.sourceId ? [row.sourceId] : [])))];
  const links: Record<string, { href: string; label: string }> = {};
  if (!ids.length) return links;
  const [measured, speed] = await Promise.all([
    getDb()
      .select({
        id: sessions.id,
        type: sessions.type,
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(sessions)
      .leftJoin(
        rapsodoSyncSessions,
        and(
          eq(rapsodoSyncSessions.importedSessionId, sessions.id),
          eq(rapsodoSyncSessions.userId, userId),
        ),
      )
      .where(and(eq(sessions.userId, userId), inArray(sessions.id, ids))),
    getDb()
      .select({ id: speedTrainingSessions.id })
      .from(speedTrainingSessions)
      .where(and(eq(speedTrainingSessions.userId, userId), inArray(speedTrainingSessions.id, ids))),
  ]);
  for (const row of measured) {
    const round = isRoundHistorySession(row);
    links[row.id] = {
      href: round ? `/rounds/${row.id}` : `/sessions/${row.id}`,
      label: round ? "View round" : "View measured session",
    };
  }
  for (const row of speed)
    links[row.id] = { href: `/speed/sessions/${row.id}`, label: "View speed session" };
  return links;
}
