import type { ProgressSummary } from "@/lib/progress-summary";

/** One existing practice ranking supplies the headline, evidence and action on both surfaces. */
export function progressRecommendation(summary: ProgressSummary) {
  const priority = summary.practicePlan[0];
  if (!priority) return null;
  const evidence = summary.clubRows.find((row) => row.clubId === priority.clubId);
  const query = new URLSearchParams({
    source: "progress",
    club: priority.clubType.toLowerCase().replace(/[^a-z0-9]/g, ""),
  });
  return {
    ...priority,
    href: `/practice?${query}`,
    evidence: evidence
      ? `${evidence.confidenceLabel} evidence · ${evidence.sampleSize} clean shots · ${evidence.trustIndex}% club trust.`
      : "Comparable evidence is still being collected.",
  };
}
