import Link from "next/link";
import type { ReactNode } from "react";
import { Plus, TrendingUp } from "lucide-react";

import { MobileRouteHeader } from "@/components/mobile-sports";
import { DataPair, DataPanel, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { TrainingLoadRangeView } from "@/components/training/TrainingLoadRangeView";
import { Button } from "@/components/ui/button";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlannerProgressSummary } from "@/lib/practice-planner";
import { getTrainingOverTimeData, normalizeTrainingRange } from "@/lib/training/trainingData";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TrainingOverTimePageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    saved?: string | string[];
  }>;
};

const integerFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});
export default async function TrainingOverTimePage({ searchParams }: TrainingOverTimePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rangeKey = normalizeTrainingRange(resolvedSearchParams.range);
  const userId = await requireCurrentUserId();
  const [data, practiceSummary] = await Promise.all([
    getTrainingOverTimeData(userId, "1y"),
    getPracticePlannerProgressSummary(userId),
  ]);
  const saved = Boolean(resolvedSearchParams.saved);
  const latestForm = data.latest?.form ?? 0;
  const latestFitness = data.latest?.fitness ?? 0;
  const latestFatigue = data.latest?.fatigue ?? 0;

  return (
    <PageShell>
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="training" />

      <DesktopWorkbenchLayout scope="training-load">
        <PageHeader
          eyebrow={<StatusPill tone="green">Training management</StatusPill>}
          title="Training Load"
          description="Golf Form, Training Fitness and Recent Load over time"
          metrics={[
            {
              label: "Golf Form",
              value: (
                <MetricValue featured tone="sky">
                  {formatMetric(latestForm)}
                  <TrendingUp className="size-5" aria-hidden="true" />
                </MetricValue>
              ),
              detail: data.status.label,
              className: "border-sky-200 bg-sky-50/90 text-sky-950 ring-sky-100",
            },
            {
              label: "Training Fitness",
              value: <MetricValue tone="green">{formatMetric(latestFitness)}</MetricValue>,
              detail: `${data.conditioningDays}-day golf workload`,
            },
            {
              label: "Recent Load",
              value: <MetricValue tone="amber">{formatMetric(latestFatigue)}</MetricValue>,
              detail: recentLoadLabel(latestFatigue),
            },
            {
              label: "Evidence Confidence",
              value: <MetricValue tone="purple">{formatMetric(data.confidence.score)}</MetricValue>,
              detail: data.confidence.label,
            },
          ]}
          actions={
            <Button asChild className="premium-action">
              <Link href="#log-load">
                <Plus className="size-4" />
                Log Training
              </Link>
            </Button>
          }
        />

        {saved ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
            Golf load saved. Golf Form, Training Fitness and Recent Load have been recalculated.
          </div>
        ) : null}

        <TrainingPracticePlannerPanel
          statusLabel={data.status.label}
          practiceSummary={practiceSummary}
          recentLoad={latestFatigue}
        />

        <TrainingLoadRangeView data={data} initialRangeKey={rangeKey} />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function TrainingPracticePlannerPanel({
  statusLabel,
  practiceSummary,
  recentLoad,
}: {
  statusLabel: string;
  practiceSummary: Awaited<ReturnType<typeof getPracticePlannerProgressSummary>>;
  recentLoad: number;
}) {
  const loadHigh = recentLoad >= 120;
  const suitability = loadHigh ? "Technical plans preferred" : "Practice load appropriate";

  return (
    <DataPanel>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <StatusPill tone={loadHigh ? "amber" : "green"}>{suitability}</StatusPill>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">Practice Planner load fit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {practiceSummary.latestCompleted
              ? `${practiceSummary.latestCompleted.title} finished with a ${practiceSummary.latestCompleted.score ?? "--"} practice score while Training Load read ${statusLabel}.`
              : `No completed structured plan yet. Training Load currently reads ${statusLabel}.`}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[28rem]">
          <DataPair
            label="Completed plans"
            value={integerFormatter.format(practiceSummary.completedCount)}
          />
          <DataPair
            label="Average score"
            value={practiceSummary.averageScore === null ? "--" : `${practiceSummary.averageScore}`}
          />
          <DataPair label="Recent Load" value={formatMetric(recentLoad)} />
        </div>
      </div>
    </DataPanel>
  );
}

function MetricValue({
  tone,
  featured = false,
  children,
}: {
  tone: "green" | "amber" | "sky" | "purple";
  featured?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        metricToneClass(tone),
        featured ? "text-3xl sm:text-[2rem]" : "",
      )}
    >
      {children}
    </span>
  );
}

function formatMetric(value: number) {
  return integerFormatter.format(Math.round(value));
}

function recentLoadLabel(value: number) {
  if (value >= 120) {
    return "Heavy week";
  }

  if (value >= 70) {
    return "Above normal";
  }

  return "Normal week";
}

function metricToneClass(tone: "green" | "amber" | "sky" | "purple") {
  switch (tone) {
    case "green":
      return "text-emerald-700";
    case "amber":
      return "text-amber-700";
    case "sky":
      return "text-sky-700";
    case "purple":
      return "text-violet-700";
  }
}
