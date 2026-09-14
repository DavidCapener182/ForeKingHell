import { practiceSampleContext, stablePracticeReadout } from "./practice-comparison-readout";
import type { ClubDayComparison } from "./today-session-data";

/** Keep measured change in plain language; longer carry is not labelled improvement. */
export function mobileComparisonSummary(comparison: ClubDayComparison) {
  const stable = mobileComparisonReadout(comparison);
  const parts: string[] = stable ? [`${stable}.`] : [];
  const miss = comparison.offlineDeltaYd;
  if (miss != null && Number.isFinite(miss)) {
    parts.push(
      Math.abs(miss) < 0.05
        ? "Average sideways miss was unchanged."
        : `${Math.abs(miss).toFixed(1)} yd ${miss < 0 ? "less" : "more"} average sideways miss.`,
    );
  }
  const carry = comparison.carryDeltaYd;
  if (carry != null && Number.isFinite(carry)) {
    parts.push(
      Math.abs(carry) < 0.05
        ? "Average carry was unchanged."
        : `${Math.abs(carry).toFixed(1)} yd ${carry > 0 ? "longer" : "shorter"} average carry.`,
    );
  }
  const sample = practiceSampleContext(comparison.today.shotCount, comparison.previous.shotCount);
  return [parts.length ? parts.join(" ") : comparison.summary, sample].filter(Boolean).join(" ");
}

/** Surface the strongest control gain and the biggest control cost, keeping all clubs in the review. */
export function mobileReviewHighlights<T extends { comparison: ClubDayComparison | null }>(
  clubs: T[],
) {
  const comparable = clubs.filter(
    (club) =>
      club.comparison &&
      club.comparison.verdict !== "new" &&
      club.comparison.today.shotCount >= 5 &&
      club.comparison.previous.shotCount >= 5,
  );
  const directional = comparable.filter((club) => club.comparison!.offlineDeltaYd != null);
  const improvement = [...directional]
    .filter((club) => club.comparison!.offlineDeltaYd! < 0)
    .sort((a, b) => a.comparison!.offlineDeltaYd! - b.comparison!.offlineDeltaYd!)[0];
  const concern = [...directional]
    .filter((club) => club.comparison!.offlineDeltaYd! > 0)
    .sort((a, b) => b.comparison!.offlineDeltaYd! - a.comparison!.offlineDeltaYd!)[0];
  return [
    ...new Set([improvement, concern, ...comparable].filter((club): club is T => Boolean(club))),
  ].slice(0, 2);
}

export function mobileComparisonReadout(comparison: ClubDayComparison) {
  if (comparison.verdict === "new") return null;
  return stablePracticeReadout({
    carry: comparison.carryDeltaYd,
    ballSpeed: comparison.ballSpeedDeltaMph,
    offline: comparison.offlineDeltaYd,
    carrySpread: comparison.consistencyDeltaYd,
  });
}
