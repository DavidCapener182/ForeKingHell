import { calculateHandicapSummary } from "@/lib/round-handicap";

type ScoringRound = { id: string; type: string; handicapDifferential: number | null };

/** Reconstruct the existing estimate at this round, without later scores or mixed contexts. */
export function calculateRoundHandicapEffect(roundsNewestFirst: ScoringRound[], roundId: string) {
  const index = roundsNewestFirst.findIndex((round) => round.id === roundId);
  const selected = roundsNewestFirst[index];
  if (
    !selected ||
    selected.handicapDifferential === null ||
    !Number.isFinite(selected.handicapDifferential)
  )
    return null;

  const real = selected.type === "real_round";
  const values = roundsNewestFirst
    .slice(index)
    .filter((round) => (round.type === "real_round") === real)
    .map((round) => round.handicapDifferential);
  const current = calculateHandicapSummary(values);
  const previous = calculateHandicapSummary(values.slice(1));
  return {
    scope: real ? "Course" : "Simulator",
    previous: previous.value,
    current: current.value,
    delta: current.trend.delta,
    direction: current.trend.direction,
    methodLabel: current.methodLabel,
    sampleSize: current.sampleSize,
  };
}
