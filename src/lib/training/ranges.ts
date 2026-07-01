export type TrainingRangeKey = "7d" | "4w" | "3m" | "6m" | "1y";

export const TRAINING_RANGE_OPTIONS: Array<{ key: TrainingRangeKey; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "4w", label: "4W" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
];

const RANGE_DAYS: Record<TrainingRangeKey, number> = {
  "7d": 7,
  "4w": 28,
  "3m": 90,
  "6m": 183,
  "1y": 365,
};

export function normalizeTrainingRange(value: string | string[] | undefined): TrainingRangeKey {
  const key = Array.isArray(value) ? value[0] : value;
  return key === "7d" || key === "4w" || key === "3m" || key === "6m" || key === "1y" ? key : "3m";
}

export function trainingRangeDays(rangeKey: TrainingRangeKey) {
  return RANGE_DAYS[rangeKey];
}
