import { mean, sampleStandardDeviation } from "@/lib/analysis-statistics";
import { practiceSampleContext } from "@/lib/practice-comparison-readout";
import type { ClubSpeedMeasurementTrust } from "@/lib/club-speed-evidence";
import type { TodayPracticeShot } from "@/lib/today-session-data";

type MetricDefinition = {
  key: TrendMetric;
  label: string;
  unit: string;
  digits: number;
  description: string;
  read: (shot: TodayPracticeShot) => number | null;
  calculate: (values: number[]) => number | null;
  increase: string;
  decrease: string;
  band?: number;
  control?: boolean;
  clubEvidence?: boolean;
};
export type TrendMetric =
  | "carryYd"
  | "totalYd"
  | "ballSpeedMph"
  | "clubSpeedMph"
  | "smashFactor"
  | "accuracy"
  | "consistency"
  | "launchAngleDeg";
export const trendMetrics: readonly MetricDefinition[] = [
  {
    key: "carryYd",
    label: "Carry",
    unit: "yd",
    digits: 1,
    description: "Session mean recorded carry",
    read: (s) => s.carryYd,
    calculate: mean,
    increase: "longer carry",
    decrease: "shorter carry",
    band: 2,
  },
  {
    key: "totalYd",
    label: "Total",
    unit: "yd",
    digits: 1,
    description: "Session mean recorded total",
    read: (s) => s.totalYd,
    calculate: mean,
    increase: "longer total",
    decrease: "shorter total",
  },
  {
    key: "ballSpeedMph",
    label: "Ball speed",
    unit: "mph",
    digits: 1,
    description: "Session mean recorded ball speed",
    read: (s) => s.ballSpeedMph,
    calculate: mean,
    increase: "faster ball speed",
    decrease: "slower ball speed",
    band: 1,
  },
  {
    key: "clubSpeedMph",
    label: "Club speed",
    unit: "mph",
    digits: 1,
    description: "Session mean within one club evidence class",
    read: (s) => s.clubSpeedMph,
    calculate: mean,
    increase: "faster club speed",
    decrease: "slower club speed",
    clubEvidence: true,
  },
  {
    key: "smashFactor",
    label: "Smash",
    unit: "",
    digits: 2,
    description: "Session mean recorded smash within one club evidence class",
    read: (s) => s.smashFactor,
    calculate: mean,
    increase: "higher smash",
    decrease: "lower smash",
    clubEvidence: true,
  },
  {
    key: "accuracy",
    label: "Accuracy",
    unit: "yd",
    digits: 1,
    description:
      "Average lateral miss: mean absolute side-carry distance, not complete target proximity",
    read: (s) => (s.sideCarryYd == null ? null : Math.abs(s.sideCarryYd)),
    calculate: mean,
    increase: "more lateral miss",
    decrease: "less lateral miss",
    band: 2,
    control: true,
  },
  {
    key: "consistency",
    label: "Consistency",
    unit: "yd",
    digits: 1,
    description: "Carry spread: sample standard deviation, requiring at least two readings",
    read: (s) => s.carryYd,
    calculate: sampleStandardDeviation,
    increase: "wider carry spread",
    decrease: "tighter carry spread",
    band: 2,
    control: true,
  },
  {
    key: "launchAngleDeg",
    label: "Launch",
    unit: "°",
    digits: 1,
    description: "Session mean recorded launch angle",
    read: (s) => s.launchAngleDeg,
    calculate: mean,
    increase: "higher launch",
    decrease: "lower launch",
  },
];
export const clubFamilies = ["Driver", "Woods", "Hybrids", "Irons", "Wedges"] as const;
export type ClubFamily = (typeof clubFamilies)[number];
export const evidenceClasses = ["measured", "estimated", "unknown"] as const;
type Metrics = Record<TrendMetric, number | null>;
type Counts = Record<TrendMetric, number>;
export type TrendPoint = {
  sessionId: string;
  date: string;
  timestamp: number;
  current: boolean;
  shotCount: number;
  fileName: string | null;
  ambiguousTime: boolean;
  weather: string;
  values: Metrics;
  counts: Counts;
  clubEvidence: Record<ClubSpeedMeasurementTrust, { values: Metrics; counts: Counts }>;
};
export type ClubTrend = {
  id: string;
  clubId: string;
  clubType: string;
  family: ClubFamily;
  label: string;
  source: string;
  context: string;
  playContext: string;
  shotPlayContext: string;
  defaultEvidence: ClubSpeedMeasurementTrust;
  points: TrendPoint[];
};
export type ProgressHistoryState = "complete" | "bounded" | "failed";
export function metricReading(
  point: TrendPoint | undefined,
  key: TrendMetric,
  trust: ClubSpeedMeasurementTrust,
) {
  const metric = trendMetrics.find((m) => m.key === key)!;
  const data = metric.clubEvidence ? point?.clubEvidence[trust] : point;
  return { value: data?.values[key] ?? null, count: data?.counts[key] ?? 0 };
}
export function formatTrendValue(value: number | null, key: TrendMetric) {
  const metric = trendMetrics.find((m) => m.key === key)!;
  return value === null
    ? "Unavailable"
    : `${value.toFixed(metric.digits)}${metric.unit ? ` ${metric.unit}` : ""}`;
}
export function compareClubSessions(
  club: ClubTrend,
  sessionId: string,
  key: TrendMetric,
  trust = club.defaultEvidence,
  history: ProgressHistoryState = "complete",
) {
  const index = club.points.findIndex((p) => p.sessionId === sessionId);
  const current = club.points[index];
  const previous = club.points[index - 1];
  const a = metricReading(current, key, trust);
  const b = metricReading(previous, key, trust);
  const delta = a.value !== null && b.value !== null ? a.value - b.value : null;
  const metric = trendMetrics.find((m) => m.key === key)!;
  const adequate =
    a.count >= 3 && b.count >= 3 && !current?.ambiguousTime && !previous?.ambiguousTime;
  let text = !current
    ? "Selected session unavailable"
    : !previous
      ? history === "failed"
        ? "History loading failed"
        : history === "bounded"
          ? "Baseline unavailable within loading bound"
          : "First comparable session"
      : a.value === null
        ? "Current reading unavailable"
        : b.value === null
          ? "Previous reading unavailable"
          : !adequate
            ? "Building a baseline"
            : metric.band && Math.abs(delta!) < metric.band
              ? "Broadly stable within a descriptive band"
              : delta === 0
                ? "No numerical change"
                : delta! > 0
                  ? metric.increase
                  : metric.decrease;
  if (current?.ambiguousTime || previous?.ambiguousTime)
    text += " · upload order ambiguous at the same recorded time";
  return {
    current,
    previous,
    a,
    b,
    delta,
    adequate,
    text,
    sampleContext: previous ? practiceSampleContext(a.count, b.count) : "",
  };
}
export function rollingSessionAverage(values: (number | null)[]) {
  return values.map((_, index) =>
    index < 2 || values.slice(index - 2, index + 1).some((v) => v === null)
      ? null
      : mean(values.slice(index - 2, index + 1) as number[]),
  );
}
/** Equal-session OLS against elapsed days, requiring five >=3-reading sessions.
 * Gaps are retained in the chart; only adequately sampled values enter this descriptive fit.
 */
export function describeSessionTrend(
  points: TrendPoint[],
  key: TrendMetric,
  trust: ClubSpeedMeasurementTrust,
) {
  const usable = points
    .map((p) => ({ ...metricReading(p, key, trust), t: p.timestamp, ambiguous: p.ambiguousTime }))
    .filter((p) => p.value !== null && p.count >= 3 && !p.ambiguous);
  if (usable.length < 5)
    return "Building a longer-term baseline: five adequately sampled sessions required";
  const times = usable.map((p) => (p.t - usable[0].t) / 86400000);
  const averageTime = mean(times)!;
  const averageValue = mean(usable.map((p) => p.value!))!;
  const denominator = times.reduce((sum, t) => sum + (t - averageTime) ** 2, 0);
  if (!denominator) return "Recorded session times do not support a trend";
  const slope =
    usable.reduce((sum, p, i) => sum + (times[i] - averageTime) * (p.value! - averageValue), 0) /
    denominator;
  const fittedChange = slope * (times.at(-1)! - times[0]);
  const metric = trendMetrics.find((m) => m.key === key)!;
  const text =
    metric.band && Math.abs(fittedChange) < metric.band
      ? "broadly stable"
      : `${fittedChange >= 0 ? metric.increase : metric.decrease} over recent sessions`;
  return `${text} · descriptive equal-session trend (${usable.length} sessions; fitted change ${fittedChange >= 0 ? "+" : ""}${formatTrendValue(fittedChange, key)}). ${practiceSampleContext(Math.min(...usable.map((p) => p.count)), Math.max(...usable.map((p) => p.count)))}`;
}
export function sessionTradeoffs(club: ClubTrend, sessionId: string) {
  const comparisons = ["carryYd", "accuracy", "consistency", "ballSpeedMph"].map((key) =>
    compareClubSessions(club, sessionId, key as TrendMetric),
  );
  const [carry, accuracy, spread, speed] = comparisons;
  if (
    carry.adequate &&
    carry.delta !== null &&
    carry.delta >= 2 &&
    accuracy.adequate &&
    accuracy.delta !== null &&
    accuracy.delta >= 2
  )
    return "Longer carry with more lateral miss.";
  if (
    spread.adequate &&
    spread.delta !== null &&
    spread.delta <= -2 &&
    carry.adequate &&
    carry.delta !== null &&
    carry.delta <= -2
  )
    return "Tighter carry spread with materially shorter carry.";
  if (
    speed.adequate &&
    speed.delta !== null &&
    speed.delta >= 1 &&
    (!accuracy.adequate || !spread.adequate)
  )
    return "Faster ball speed without supported control evidence.";
  return "";
}
