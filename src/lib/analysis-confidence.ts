export type AnalysisConfidenceLabel = "early" | "developing" | "reliable" | "strong";

export type AnalysisConfidenceInput = {
  sampleSize: number;
  sessionCount: number;
  recencyDays: number | null;
  outlierRate: number;
  metricCompleteness: number;
  coefficientOfVariation: number | null;
  crossSessionConsistency: number | null;
};

export type ConfidenceComponent = {
  key: keyof AnalysisConfidenceInput;
  label: string;
  assessment: "limited" | "mixed" | "healthy";
};

export function analysisConfidence(input: AnalysisConfidenceInput) {
  const components = [
    component("sampleSize", "Sample size", sampleScore(input.sampleSize)),
    component("sessionCount", "Sessions", sessionScore(input.sessionCount)),
    component("recencyDays", "Recency", recencyScore(input.recencyDays)),
    component("outlierRate", "Outlier share", inverseBand(input.outlierRate, 0.05, 0.12, 0.25)),
    component("metricCompleteness", "Metric coverage", clamp01(input.metricCompleteness)),
    component(
      "coefficientOfVariation",
      "Variance",
      input.coefficientOfVariation === null
        ? 0.25
        : inverseBand(input.coefficientOfVariation, 0.08, 0.15, 0.3),
    ),
    component(
      "crossSessionConsistency",
      "Across sessions",
      input.crossSessionConsistency === null ? 0.25 : clamp01(input.crossSessionConsistency),
    ),
  ] as const;
  const score =
    components[0].value * 0.25 +
    components[1].value * 0.15 +
    components[2].value * 0.15 +
    components[3].value * 0.1 +
    components[4].value * 0.15 +
    components[5].value * 0.1 +
    components[6].value * 0.1;
  const label: AnalysisConfidenceLabel =
    input.sampleSize < 10 || input.sessionCount < 2
      ? "early"
      : score >= 0.82 && input.sampleSize >= 50 && input.sessionCount >= 3
        ? "strong"
        : score >= 0.65
          ? "reliable"
          : score >= 0.45
            ? "developing"
            : "early";

  return {
    label,
    components: components.map(({ key, label: componentLabel, assessment }) => ({
      key,
      label: componentLabel,
      assessment,
    })) as ConfidenceComponent[],
  };
}

export function confidenceDisplayLabel(label: AnalysisConfidenceLabel) {
  return label === "early"
    ? "Early signal"
    : label === "developing"
      ? "Developing"
      : label === "reliable"
        ? "Reliable"
        : "Strong evidence";
}

function component(key: ConfidenceComponent["key"], label: string, value: number) {
  return {
    key,
    label,
    value,
    assessment: value >= 0.72 ? "healthy" : value >= 0.42 ? "mixed" : "limited",
  } as const;
}

function sampleScore(count: number) {
  if (count >= 100) return 1;
  if (count >= 50) return 0.82;
  if (count >= 20) return 0.62;
  if (count >= 10) return 0.42;
  return Math.max(0, count) / 25;
}

function sessionScore(count: number) {
  if (count >= 6) return 1;
  if (count >= 4) return 0.8;
  if (count >= 2) return 0.55;
  return count === 1 ? 0.25 : 0;
}

function recencyScore(days: number | null) {
  if (days === null) return 0.2;
  if (days <= 14) return 1;
  if (days <= 45) return 0.8;
  if (days <= 90) return 0.6;
  if (days <= 180) return 0.35;
  return 0.15;
}

function inverseBand(value: number, good: number, mixed: number, poor: number) {
  return value <= good ? 1 : value <= mixed ? 0.72 : value <= poor ? 0.42 : 0.15;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
