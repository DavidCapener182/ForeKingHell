export type CompanionTee = { id: string; name: string; yards: number | null };

export function initialRoundHoleIndex(holes: Array<{ score?: number | null }>) {
  const unscored = holes.findIndex((hole) => hole.score == null);
  return unscored < 0 ? Math.max(0, holes.length - 1) : unscored;
}

export function activeRoundStrategy(round: {
  courseId: string | null;
  teeSetId: string | null;
  scorecardJson: Array<{ holeNumber: number; score?: number | null }> | null;
}) {
  const holes = [...(round.scorecardJson ?? [])].sort((a, b) => a.holeNumber - b.holeNumber);
  const currentHole =
    holes.find((hole) => hole.score == null)?.holeNumber ?? holes.at(-1)?.holeNumber ?? 1;
  const params = new URLSearchParams({ courseId: round.courseId ?? "", hole: String(currentHole) });
  if (round.teeSetId) params.set("teeSetId", round.teeSetId);
  return { currentHole, href: round.courseId ? `/courses/strategy?${params}` : null };
}

export function selectCompanionTee<T extends CompanionTee>({
  tees,
  activeRoundTeeId,
  explicitTeeId,
  recentRoundTeeId,
}: {
  tees: T[];
  activeRoundTeeId?: string | null;
  explicitTeeId?: string | null;
  recentRoundTeeId?: string | null;
}): T | null {
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
