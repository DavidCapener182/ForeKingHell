import type { ClubBenchmarkMetricKey } from "@/lib/club-benchmarks";

/** Frozen reference identity: no numerical threshold has changed in this release. */
export const BENCHMARK_REFERENCE_VERSION = "lmwt-legacy-v1";
export const BENCHMARK_CALCULATION_VERSION = "best-30-carry-v1";
export const BENCHMARK_REGISTRY = Object.freeze({
  version: BENCHMARK_REFERENCE_VERSION,
  label: "Legacy v1 · LMWT benchmark bands",
  calculationVersion: BENCHMARK_CALCULATION_VERSION,
  aggregation: "Arithmetic mean of available shot-level readings within the selected carry cohort",
  selectionRule:
    "Best 30 longest eligible clean full swings within the disclosed equipment, source and time scope; fewer than 30 is provisional best-N",
  nextLevelSemantics:
    "The selected mean must reach the next threshold; individual shots need not all exceed it",
  impactSummary:
    "Historical numerical boundaries preserved. LMWT bands and legacy Tour anchors are now explicitly distinguished; reference relabelling is not player improvement.",
});

export function benchmarkMetricUnit(
  metric: ClubBenchmarkMetricKey,
): "yd" | "mph" | "deg" | "rpm" | "ratio" {
  switch (metric) {
    case "carryYd":
    case "maxHeightYd":
      return "yd";
    case "clubSpeedMph":
    case "ballSpeedMph":
      return "mph";
    case "smashFactor":
      return "ratio";
    case "spinRate":
      return "rpm";
    default:
      return "deg";
  }
}

export function benchmarkMetricInterpretation(metric: ClubBenchmarkMetricKey) {
  switch (metric) {
    case "maxHeightYd":
    case "landAngleDeg":
    case "launchAngleDeg":
    case "spinRate":
    case "attackAngleDeg":
      return "Above Tour reference; not necessarily a better flight. Suitability depends on intended shot, equipment and compatible same-shot evidence.";
    case "smashFactor":
      return "Efficiency reference for these selected shots. High smash does not establish centred contact or Tour-level golf; equipment and flight matter.";
    default:
      return "Higher numerical progression is not proof of better scoring or current typical performance.";
  }
}
