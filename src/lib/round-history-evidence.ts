export type HistoryHole = {
  holeNumber: number;
  par: number;
  score?: number | null;
  penalties?: number | null;
};

/** Partial scoring stays visible but never becomes a completed performance result. */
export function roundHistoryScore(holes: HistoryHole[], status: string) {
  const scored = holes.filter(
    (hole): hole is HistoryHole & { score: number } =>
      typeof hole.score === "number" && Number.isFinite(hole.score) && hole.score > 0,
  );
  const totalScore = scored.length ? scored.reduce((sum, hole) => sum + hole.score, 0) : null;
  const totalPar = holes.length ? holes.reduce((sum, hole) => sum + hole.par, 0) : null;
  const complete = holes.length > 0 && scored.length === holes.length && status !== "in_progress";
  const toPar =
    totalScore === null ? null : totalScore - scored.reduce((sum, hole) => sum + hole.par, 0);
  return { totalScore, totalPar, toPar, complete, scoredHoles: scored.length };
}

export function roundHistoryVerdict(holes: HistoryHole[], status: string) {
  const evidence = roundHistoryScore(holes, status);
  if (!evidence.complete)
    return status === "in_progress" ? "Continue round" : "Complete the scorecard";
  const penalties = holes.reduce((sum, hole) => sum + (hole.penalties ?? 0), 0);
  if (penalties >= 2) return `${penalties} penalty strokes recorded`;
  const worst = [...holes].sort(
    (a, b) => (b.score ?? b.par) - b.par - ((a.score ?? a.par) - a.par),
  )[0];
  const difference = worst ? (worst.score ?? worst.par) - worst.par : 0;
  if (worst && difference >= 2) return `Hole ${worst.holeNumber} · ${difference} over par`;
  if (evidence.toPar === 0) return "Finished at level par";
  if ((evidence.toPar ?? 0) < 0) return `Finished ${Math.abs(evidence.toPar!)} under par`;
  const parsOrBetter = holes.filter((hole) => (hole.score ?? Infinity) <= hole.par).length;
  return `${parsOrBetter} of ${holes.length} holes at par or better`;
}

export function comparableScoringRounds<
  T extends { type: string; roundStatus: string; scorecardHoles: HistoryHole[] },
>(rounds: T[], context: "course" | "simulator", holes: number) {
  return rounds
    .filter(
      (round) =>
        (round.type === "real_round") === (context === "course") &&
        round.scorecardHoles.length === holes &&
        roundHistoryScore(round.scorecardHoles, round.roundStatus).complete,
    )
    .slice(0, 8)
    .reverse();
}
