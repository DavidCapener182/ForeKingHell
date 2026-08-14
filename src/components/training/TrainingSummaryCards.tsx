import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

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
          detail: `${status.label}. ${plainFormMeaning(summary.form.value)} ${sessionFormSignal.summaryLabel}.`,
          trend: <MetricDirection change={summary.form.change} />,
        },
        {
          label: "Training Fitness",
          value: numberFormatter.format(Math.round(summary.fitness.value)),
          detail: "Your longer-term capacity from rounds, practice and speed work.",
          trend: <MetricDirection change={summary.fitness.change} />,
          className: "hidden sm:grid",
        },
        {
          label: "Recent Load",
          value: numberFormatter.format(Math.round(summary.fatigue.value)),
          detail: plainLoadMeaning(summary.fatigue.value),
          trend: <MetricDirection change={summary.fatigue.change} />,
        },
      ]}
    />
  );
}

function MetricDirection({ change }: { change: number }) {
  const rounded = Math.round(change);
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;

  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {rounded === 0 ? "Holding" : `${rounded > 0 ? "+" : ""}${rounded} this week`}
    </span>
  );
}

function plainFormMeaning(value: number) {
  if (value >= 110) return "Comparable golf is clearly above your baseline.";
  if (value >= 100) return "Comparable golf is holding at or above baseline.";
  if (value >= 90) return "Comparable golf has dipped below your baseline.";
  return "Comparable golf is well below baseline, so avoid chasing volume.";
}

function plainLoadMeaning(value: number) {
  if (value >= 120) return "Your short-term workload is high; a lighter next session may help.";
  if (value >= 70) return "Your short-term workload is elevated but still manageable.";
  return "Your short-term workload is controlled and leaves room to train.";
}
