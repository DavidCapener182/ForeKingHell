import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { CardContent } from "@/components/ui/card";
import { DataPanel, SectionHeader, StatusPill } from "@/components/premium";
import type { FitnessFreshnessPoint } from "@/lib/training/fitnessFreshness";
import type { TrainingConfidence } from "@/lib/training/trainingData";
import type { TrainingStatus, TrainingTrend } from "@/lib/training/trainingStatus";
import type { SessionFormSignal } from "@/lib/training/sessionForm";

type TrainingStatusCardProps = {
  latest: FitnessFreshnessPoint | null;
  status: TrainingStatus;
  trend: TrainingTrend;
  confidence: TrainingConfidence;
  sessionFormSignal: SessionFormSignal;
};

export function TrainingStatusCard({
  latest,
  status,
  trend,
  confidence,
  sessionFormSignal,
}: TrainingStatusCardProps) {
  return (
    <DataPanel>
      <SectionHeader
        title="Training interpretation"
        description="Plain-English read on golf workload, Golf Form and confidence in the signal."
        action={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
      />
      <CardContent className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="premium-hero rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Latest read
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
            {latest ? status.detail : "Start logging to build your golf training profile."}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {latest
              ? status.advice
              : "Golf Conditioning, acute load and Golf Form will become more useful once several rounds or practice sessions have a load score."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Readout
            icon={<TrendingUp className="size-4" aria-hidden="true" />}
            label="Trend"
            value={trend.label}
            detail={trend.detail}
          />
          <Readout
            icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            label="Confidence"
            value={`${confidence.score} - ${confidence.label}`}
            detail={confidence.detail}
          />
          <Readout
            icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            label="Latest session"
            value={sessionFormSignal.label}
            detail={`${sessionFormSignal.detail} Comparison strength: ${sessionFormSignal.confidence}.`}
          />
          <Readout
            icon={<AlertTriangle className="size-4" aria-hidden="true" />}
            label="Accuracy note"
            value="Golf workload signal"
            detail="This may suggest when to adjust practice volume. It is not a medical or injury diagnosis."
          />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function Readout({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tracking-normal text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
