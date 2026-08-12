export type CompanionTee = { id: string; name: string; yards: number | null };

export function selectCompanionTee({
  tees,
  activeRoundTeeId,
  explicitTeeId,
  recentRoundTeeId,
}: {
  tees: CompanionTee[];
  activeRoundTeeId?: string | null;
  explicitTeeId?: string | null;
  recentRoundTeeId?: string | null;
}) {
  return (
    tees.find((tee) => tee.id === activeRoundTeeId) ??
    tees.find((tee) => tee.id === explicitTeeId) ??
    tees.find((tee) => tee.id === recentRoundTeeId) ??
    tees[Math.floor((tees.length - 1) / 2)] ??
    null
  );
}

export function findInProgressRound<
  T extends { roundStatus?: string | null; date?: Date | string | null },
>(rounds: T[]) {
  return (
    [...rounds]
      .filter((round) => round.roundStatus === "in_progress" || round.roundStatus === "active")
      .sort((left, right) => dateValue(right.date) - dateValue(left.date))[0] ?? null
  );
}

export function companionCourseReadiness(input: {
  holeCount: number;
  teeCount: number;
  courseTwinAvailable: boolean;
}) {
  return {
    strategyReady: input.holeCount >= 9 && input.teeCount > 0,
    courseTwinReady: input.courseTwinAvailable,
  };
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}
