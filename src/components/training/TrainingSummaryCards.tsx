import { Activity, Gauge, Info, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrainingOverTimeData } from "@/lib/training/trainingData";
import type { TrainingStatus } from "@/lib/training/trainingStatus";
import type { SessionFormSignal } from "@/lib/training/sessionForm";
import { cn } from "@/lib/utils";

type TrainingSummaryCardsProps = {
  summary: TrainingOverTimeData["summary"];
  status: TrainingStatus;
  sessionFormSignal: SessionFormSignal;
};

type MetricTooltipCopy = {
  means: string;
  improve: string;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

const metricTooltips: Record<"conditioning" | "acuteLoad" | "golfForm", MetricTooltipCopy> = {
  conditioning: {
    means:
      "Your long-term golf workload capacity from sustained rounds, practice, swing volume and effort. It is not a playing-quality score.",
    improve:
      "Build it with regular logged golf: rounds, focused range work, short-game blocks or speed sessions. Add volume steadily, not through one huge spike.",
  },
  acuteLoad: {
    means:
      "Your recent 7-day golf workload. It reacts quickly to hard practice, walking rounds, high RPE and big swing-volume days.",
    improve:
      "Use it for planning. If it is high, make the next session lighter or more skill-based. If it is low, add a useful practice block or round.",
  },
  golfForm: {
    means:
      "Your golf-quality trend against a 100 baseline. It rises when comparable rounds or practice are better, and dips when performance evidence is worse.",
    improve:
      "Improve it with better comparable golf: tighter dispersion, more playable shots, better scoring, useful speed gains and consistent logged evidence.",
  },
};

export function TrainingSummaryCards({
  summary,
  status,
  sessionFormSignal,
}: TrainingSummaryCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <SummaryCard
        label="Golf Conditioning"
        value={summary.fitness.value}
        change={summary.fitness.change}
        explanation="Long-term golf workload capacity"
        icon={<Gauge className="size-5" aria-hidden="true" />}
        statusLabel={formatConditioningChange(summary.fitness.change)}
        tooltip={metricTooltips.conditioning}
        tone="green"
      />
      <SummaryCard
        label="Acute Load"
        value={summary.fatigue.value}
        change={summary.fatigue.change}
        explanation="Recent golf workload"
        icon={<Activity className="size-5" aria-hidden="true" />}
        statusLabel={formatAcuteLoadChange(summary.fatigue.value, summary.fatigue.change)}
        tooltip={metricTooltips.acuteLoad}
        tone="amber"
      />
      <SummaryCard
        label="Golf Form"
        value={summary.form.value}
        change={summary.form.change}
        explanation="How well your golf is trending"
        icon={<Sparkles className="size-5" aria-hidden="true" />}
        statusLabel={`${status.label} · ${sessionFormSignal.summaryLabel}`}
        tooltip={metricTooltips.golfForm}
        tone={status.tone}
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  change,
  explanation,
  icon,
  statusLabel,
  tooltip,
  tone,
}: {
  label: string;
  value: number;
  change: number;
  explanation: string;
  icon: ReactNode;
  statusLabel?: string;
  tooltip?: MetricTooltipCopy;
  tone: "green" | "sky" | "amber" | "red" | "slate";
}) {
  return (
    <article className="luxury-metric-card grid min-h-36 content-between rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            {tooltip ? <MetricTooltip label={label} tooltip={tooltip} /> : null}
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
            {numberFormatter.format(Math.round(value))}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg ring-1",
            toneClass(tone),
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-foreground">{statusLabel ?? formatChange(change)}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{explanation}</p>
      </div>
    </article>
  );
}

function MetricTooltip({ label, tooltip }: { label: string; tooltip: MetricTooltipCopy }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: what it means and how to improve it`}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-1 ring-slate-200 transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        className="block max-w-80 rounded-lg bg-slate-950 p-3 text-left text-xs leading-5 text-white shadow-xl"
      >
        <p className="font-semibold text-white">What it means</p>
        <p className="mt-1 text-white/85">{tooltip.means}</p>
        <p className="mt-3 font-semibold text-white">How to improve it</p>
        <p className="mt-1 text-white/85">{tooltip.improve}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function formatChange(change: number) {
  const rounded = Math.round(change);
  if (rounded === 0) {
    return "No weekly change";
  }

  return `${rounded > 0 ? "+" : ""}${numberFormatter.format(rounded)} from previous week`;
}

function formatConditioningChange(change: number) {
  const rounded = Math.round(change);

  if (rounded <= -5) {
    return "Recent volume easing";
  }

  if (rounded >= 5) {
    return "Conditioning building";
  }

  return "Conditioning holding";
}

function formatAcuteLoadChange(value: number, change: number) {
  const roundedValue = Math.round(value);
  const roundedChange = Math.round(change);

  if (roundedValue >= 120 || roundedChange >= 80) {
    return "Heavy practice week";
  }

  if (roundedValue >= 70 || roundedChange >= 25) {
    return "Higher than normal";
  }

  if (roundedChange <= -25) {
    return "Load easing";
  }

  return "Normal recent load";
}

function toneClass(tone: "green" | "sky" | "amber" | "red" | "slate") {
  switch (tone) {
    case "green":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "sky":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "amber":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "red":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}
