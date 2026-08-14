import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

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
        description="Plain-English read on Golf Form, workload and evidence confidence."
        action={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
      />
      <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section
          className="rounded-lg border border-border bg-muted/35 p-4"
          aria-labelledby="training-latest-read-title"
        >
          <div
            id="training-latest-read-title"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
            Latest read
          </div>
          <p className="mt-3 text-xl font-semibold tracking-normal text-foreground">
            {latest ? status.detail : "Start logging to build your golf training profile."}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {latest
              ? status.advice
              : "Golf Form, Training Fitness and Recent Load will become more useful once several rounds or practice sessions have a load score."}
          </p>
        </section>
        <section
          className="rounded-lg border border-[var(--status-information-border)] bg-[var(--status-information-surface)] p-5 text-[var(--status-information-foreground)]"
          aria-labelledby="training-coach-summary-title"
          data-training-coach-summary
        >
          <div className="flex items-center justify-between gap-3">
            <div
              id="training-coach-summary-title"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Coach summary
            </div>
            <StatusPill tone="sky">{confidence.score} evidence</StatusPill>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-normal">
            {latest ? coachSummaryLead(status.label) : "Start logging to unlock the coaching read."}
          </p>
          <div className="mt-4 grid gap-2">
            {coachSummaryLines({ latest, trend, confidence, sessionFormSignal }).map((line) => (
              <div key={line} className="flex gap-2 text-sm leading-5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{line}</span>
              </div>
            ))}
            <div className="flex gap-2 text-sm leading-5 opacity-85">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-[var(--status-warning-foreground)]"
                aria-hidden="true"
              />
              <span>
                This guides practice intensity and recovery. It is not a medical or injury
                diagnosis.
              </span>
            </div>
          </div>
        </section>
      </CardContent>
    </DataPanel>
  );
}

function coachSummaryLead(label: string) {
  return `Golf Form remains at ${label}.`;
}

function coachSummaryLines({
  latest,
  trend,
  confidence,
  sessionFormSignal,
}: {
  latest: FitnessFreshnessPoint | null;
  trend: TrainingTrend;
  confidence: TrainingConfidence;
  sessionFormSignal: SessionFormSignal;
}) {
  if (!latest) {
    return [
      "Log one round, range session or speed block to start the workload model.",
      "Evidence confidence will build as comparable sessions accumulate.",
    ];
  }

  return [
    `Golf Form is ${Math.round(latest.form).toLocaleString("en-GB")} against your 100 baseline.`,
    `Recent load is ${Math.round(latest.fatigue).toLocaleString("en-GB")} against Training Fitness ${Math.round(latest.fitness).toLocaleString("en-GB")}.`,
    trend.detail,
    sessionFormSignal.detail,
    `Evidence confidence is ${confidence.label.toLowerCase()}: ${confidence.detail}`,
    `Latest session signal: ${sessionFormSignal.label}. Evidence strength: ${sessionFormSignal.confidence}.`,
  ];
}
