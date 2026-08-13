import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import type { TrainingOverTimeData } from "@/lib/training/trainingData";
import type { TrainingStatus } from "@/lib/training/trainingStatus";
import type { SessionFormSignal } from "@/lib/training/sessionForm";

type TrainingSummaryCardsProps = {
  summary: TrainingOverTimeData["summary"];
  status: TrainingStatus;
  sessionFormSignal: SessionFormSignal;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

export function TrainingSummaryCards({
  summary,
  status,
  sessionFormSignal,
}: TrainingSummaryCardsProps) {
  return (
    <ConnectedMetricBar
      label="Current training load metrics"
      className="md:grid-cols-3 xl:grid-cols-3"
      metrics={[
        {
          label: "Golf Form",
          value: numberFormatter.format(Math.round(summary.form.value)),
          detail: "How well comparable golf evidence is trending.",
          trend: `${status.label} · ${sessionFormSignal.summaryLabel}`,
        },
        {
          label: "Training Fitness",
          value: numberFormatter.format(Math.round(summary.fitness.value)),
          detail: "Long-term golf workload capacity.",
          trend: formatConditioningChange(summary.fitness.change),
        },
        {
          label: "Recent Load",
          value: numberFormatter.format(Math.round(summary.fatigue.value)),
          detail: "Recent seven-day golf workload.",
          trend: formatAcuteLoadChange(summary.fatigue.value, summary.fatigue.change),
        },
      ]}
    />
  );
}

function formatConditioningChange(change: number) {
  const rounded = Math.round(change);
  if (rounded <= -5) return "Volume easing";
  if (rounded >= 5) return "Fitness building";
  return "Fitness holding";
}

function formatAcuteLoadChange(value: number, change: number) {
  const roundedValue = Math.round(value);
  const roundedChange = Math.round(change);
  if (roundedValue >= 120 || roundedChange >= 80) return "Heavy week";
  if (roundedValue >= 70 || roundedChange >= 25) return "Above normal";
  if (roundedChange <= -25) return "Load easing";
  return "Normal recent load";
}
