import type { TrainingSessionListItem } from "@/lib/training/trainingData";
import { clampRpe } from "@/lib/training/trainingLoad";

export type DisplayTrainingSessionListItem = TrainingSessionListItem & {
  entryCount: number;
};

export function groupRecentTrainingSessions(
  sessions: TrainingSessionListItem[],
): DisplayTrainingSessionListItem[] {
  const groupedSessions: DisplayTrainingSessionListItem[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const session of sessions) {
    if (!shouldGroupLaunchMonitorSession(session)) {
      groupedSessions.push({ ...session, entryCount: 1 });
      continue;
    }

    const key = [
      session.sessionDate,
      session.sourceType,
      session.title.trim().toLowerCase(),
      session.holesPlayed ?? "no-holes",
    ].join(":");
    const existingIndex = groupIndexByKey.get(key);

    if (existingIndex === undefined) {
      groupIndexByKey.set(key, groupedSessions.length);
      groupedSessions.push({ ...session, entryCount: 1 });
      continue;
    }

    groupedSessions[existingIndex] = mergeTrainingSessions(
      groupedSessions[existingIndex]!,
      session,
    );
  }

  return groupedSessions;
}

function shouldGroupLaunchMonitorSession(session: TrainingSessionListItem) {
  return (
    (session.sourceType === "launch_monitor" || session.sourceType === "imported") &&
    session.holesPlayed === null &&
    session.totalSwings !== null
  );
}

function mergeTrainingSessions(
  current: DisplayTrainingSessionListItem,
  next: TrainingSessionListItem,
): DisplayTrainingSessionListItem {
  const totalSwings = sumNullable(current.totalSwings, next.totalSwings);
  const sessionLoad = current.sessionLoad + next.sessionLoad;

  return {
    ...current,
    id: `${current.id}:grouped`,
    sourceId: current.sourceId ?? next.sourceId,
    durationMinutes: sumNullable(current.durationMinutes, next.durationMinutes),
    totalSwings,
    fullSwings: sumNullable(current.fullSwings, next.fullSwings),
    shortGameSwings: sumNullable(current.shortGameSwings, next.shortGameSwings),
    puttingSwings: sumNullable(current.puttingSwings, next.puttingSwings),
    rpe: totalSwings && totalSwings > 0 ? clampRpe(sessionLoad / totalSwings) : current.rpe,
    sessionLoad,
    entryCount: current.entryCount + 1,
  };
}

function sumNullable(a: number | null, b: number | null) {
  if (a === null && b === null) {
    return null;
  }

  return (a ?? 0) + (b ?? 0);
}
