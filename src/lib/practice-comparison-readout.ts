type Measurements = {
  carry: number | null;
  ballSpeed: number | null;
  offline: number | null;
  carrySpread: number | null;
};

/** Descriptive bands, not a significance test or a diagnosis of performance. */
export function stablePracticeReadout(metrics: Measurements): string | null {
  const { carry, ballSpeed, offline, carrySpread } = metrics;
  if (
    carry === null ||
    ballSpeed === null ||
    offline === null ||
    carrySpread === null ||
    !Object.values(metrics).every(Number.isFinite) ||
    Math.abs(carry) >= 2 ||
    Math.abs(ballSpeed) >= 1
  )
    return null;
  if (offline >= 5 || carrySpread >= 5 || offline <= -2 || carrySpread <= -2) return null;
  return offline >= 2 || carrySpread >= 2
    ? "Distance and speed stable — dispersion slightly wider"
    : "Distance, speed and dispersion stable";
}

export function practiceSampleContext(current: number, previous: number): string {
  const notes: string[] = [];
  if (Math.min(current, previous) < 10) notes.push("Small sample: treat this as an early signal.");
  if (
    Math.min(current, previous) > 0 &&
    Math.max(current, previous) >= 2 * Math.min(current, previous)
  ) {
    notes.push(
      "Unequal samples: the larger sample may reveal more variation; shot count alone does not explain a wider spread.",
    );
  }
  return notes.join(" ");
}
