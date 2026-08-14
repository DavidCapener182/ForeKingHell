import {
  analysisConfidence,
  confidenceDisplayLabel,
  type AnalysisConfidenceLabel,
} from "@/lib/analysis-confidence";
import type { CompareData, CompareDelta, CompareSampleSummary } from "@/lib/compare-data";

export type ComparisonMetricProvenance = {
  key: keyof CompareDelta;
  label: string;
  value: number | null;
  unit: "yd" | "mph" | "deg" | "points";
  direction: "better" | "worse" | "mixed" | "unavailable";
  source: string;
  method: string;
  confidence: AnalysisConfidenceLabel;
  confidenceLabel: string;
  caveat: string;
};

const definitions: Array<{
  key: keyof CompareDelta;
  label: string;
  unit: ComparisonMetricProvenance["unit"];
  lowerIsBetter: boolean;
  method: string;
}> = [
  {
    key: "carryDeltaYd",
    label: "Carry distance",
    unit: "yd",
    lowerIsBetter: false,
    method: "Difference between median stock-shot carry",
  },
  {
    key: "ballSpeedDeltaMph",
    label: "Ball speed",
    unit: "mph",
    lowerIsBetter: false,
    method: "Difference between mean recorded ball speed",
  },
  {
    key: "launchDeltaDeg",
    label: "Launch angle",
    unit: "deg",
    lowerIsBetter: false,
    method: "Difference between mean launch angle; direction alone is not a quality verdict",
  },
  {
    key: "offlineDeltaYd",
    label: "Average offline",
    unit: "yd",
    lowerIsBetter: true,
    method: "Difference between mean absolute side carry",
  },
  {
    key: "coneDeltaYd",
    label: "Shot cone",
    unit: "yd",
    lowerIsBetter: true,
    method: "Difference between selected-sample dispersion cone width",
  },
  {
    key: "playableRateDelta",
    label: "Playable shots",
    unit: "points",
    lowerIsBetter: false,
    method: "Percentage-point change in playable stock shots",
  },
  {
    key: "bigMissRateDelta",
    label: "Big misses",
    unit: "points",
    lowerIsBetter: true,
    method: "Percentage-point change in classified big misses",
  },
];

export function buildComparisonProvenance(data: CompareData): ComparisonMetricProvenance[] {
  const confidence = confidenceForSamples(data.focus, data.baseline);
  const source = `${data.focus.stockShots} focus stock shots from ${data.focus.sessions} session${data.focus.sessions === 1 ? "" : "s"}; ${data.baseline.stockShots} baseline stock shots from ${data.baseline.sessions} session${data.baseline.sessions === 1 ? "" : "s"}`;
  const caveat = comparisonCaveat(data.focus, data.baseline);

  return definitions.map((definition) => {
    const value = data.delta[definition.key];
    return {
      ...definition,
      value,
      direction: metricDirection(definition.key, value, definition.lowerIsBetter),
      source,
      confidence: confidence.label,
      confidenceLabel: confidenceDisplayLabel(confidence.label),
      caveat,
    };
  });
}

function confidenceForSamples(focus: CompareSampleSummary, baseline: CompareSampleSummary) {
  const rawShots = focus.rawShots + baseline.rawShots;
  const stockShots = focus.stockShots + baseline.stockShots;
  const availableMetrics = [
    focus.carryMedianYd,
    focus.ballSpeedAverageMph,
    focus.launchAverageDeg,
    focus.absoluteOfflineAverageYd,
    baseline.carryMedianYd,
    baseline.ballSpeedAverageMph,
    baseline.launchAverageDeg,
    baseline.absoluteOfflineAverageYd,
  ].filter((value) => value !== null).length;

  return analysisConfidence({
    sampleSize: Math.min(focus.stockShots, baseline.stockShots),
    sessionCount: Math.min(focus.sessions, baseline.sessions),
    recencyDays: null,
    outlierRate: rawShots > 0 ? Math.max(0, (rawShots - stockShots) / rawShots) : 1,
    metricCompleteness: availableMetrics / 8,
    coefficientOfVariation: null,
    crossSessionConsistency: Math.min(focus.sessions, baseline.sessions) >= 2 ? 0.6 : null,
  });
}

function metricDirection(
  key: keyof CompareDelta,
  value: number | null,
  lowerIsBetter: boolean,
): ComparisonMetricProvenance["direction"] {
  if (value === null) return "unavailable";
  const meaningfulChange: Record<keyof CompareDelta, number> = {
    carryDeltaYd: 2,
    ballSpeedDeltaMph: 1,
    launchDeltaDeg: Number.POSITIVE_INFINITY,
    offlineDeltaYd: 2,
    coneDeltaYd: 4,
    playableRateDelta: 5,
    bigMissRateDelta: 4,
  };
  if (Math.abs(value) < meaningfulChange[key]) return "mixed";
  const improved = lowerIsBetter ? value < 0 : value > 0;
  return improved ? "better" : "worse";
}

function comparisonCaveat(focus: CompareSampleSummary, baseline: CompareSampleSummary) {
  if (focus.stockShots < 10 || baseline.stockShots < 10) {
    return "Small sample: treat this as an early signal and collect more comparable shots.";
  }
  if (focus.sessions < 2 || baseline.sessions < 2) {
    return "Single-session conditions can move the result; confirm it in another session.";
  }
  return "The comparison describes recorded launch-monitor outcomes, not a cause on its own.";
}
