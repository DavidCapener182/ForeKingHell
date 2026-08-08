export type ScoringConfidenceLabel = "No evidence" | "Low" | "Building" | "Moderate" | "Strong";
export type ScoringConfidenceTone = "green" | "sky" | "amber" | "slate";

export function calculateScoringConfidence(comparableRoundCount: number): {
  label: ScoringConfidenceLabel;
  tone: ScoringConfidenceTone;
} {
  if (comparableRoundCount >= 10) {
    return { label: "Strong", tone: "green" };
  }

  if (comparableRoundCount >= 6) {
    return { label: "Moderate", tone: "sky" };
  }

  if (comparableRoundCount >= 3) {
    return { label: "Building", tone: "amber" };
  }

  if (comparableRoundCount > 0) {
    return { label: "Low", tone: "amber" };
  }

  return { label: "No evidence", tone: "slate" };
}

export function isComparableScoredRound(scorecard: Array<{ score?: number | null }> | null) {
  return (
    (scorecard?.length ?? 0) >= 9 &&
    scorecard?.every((hole) => typeof hole.score === "number" && Number.isFinite(hole.score)) ===
      true
  );
}
