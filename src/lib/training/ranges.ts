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

export const TRAINING_ACTIVITY_OPTIONS = [
  { key: "all", label: "All activities" },
  { key: "round", label: "Rounds" },
  { key: "practice", label: "Practice" },
  { key: "manual", label: "Manual entries" },
  { key: "launch_monitor", label: "Launch monitor" },
  { key: "imported", label: "Imported entries" },
] as const;
export type TrainingActivity = (typeof TRAINING_ACTIVITY_OPTIONS)[number]["key"];
export type TrainingScope = { from: string; to: string; activity: TrainingActivity; q: string };
export function parseTrainingScope(
  query: Record<string, string | string[] | undefined>,
  today: string,
): { scope: TrainingScope; error: string | null } {
  const value = (key: string) => {
    const raw = query[key];
    return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  };
  const from = value("from"),
    to = value("to"),
    activity = value("activity") || "all";
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  let error: string | null = null;
  if ((from || to) && (!validDate(from) || !validDate(to)))
    error = "Choose valid start and end dates.";
  else if (from && from > to) error = "The start date must be on or before the end date.";
  else if (to > today) error = "Training history cannot end in the future.";
  else if (from && from < "2000-01-01") error = "Choose a start date on or after 1 January 2000.";
  if (!TRAINING_ACTIVITY_OPTIONS.some((option) => option.key === activity))
    error = "Choose a supported activity scope.";
  return {
    scope: {
      from: error ? "" : from,
      to: error ? "" : to,
      activity: TRAINING_ACTIVITY_OPTIONS.some((option) => option.key === activity)
        ? (activity as TrainingActivity)
        : "all",
      q: value("q").trim().slice(0, 200),
    },
    error,
  };
}
