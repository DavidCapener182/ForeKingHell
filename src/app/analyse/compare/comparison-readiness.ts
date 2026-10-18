/** Presentation guard: a numerical delta alone must not become an improvement verdict. */
export function comparisonReadiness(
  focusShots: number,
  baselineShots: number,
  confidence?: string,
): "missing" | "limited" | "supported" {
  if (focusShots <= 0 || baselineShots <= 0) return "missing";
  if (
    focusShots < 10 ||
    baselineShots < 10 ||
    (confidence !== "reliable" && confidence !== "strong")
  )
    return "limited";
  return "supported";
}
