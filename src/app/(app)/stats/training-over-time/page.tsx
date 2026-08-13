import Link from "next/link";
import { Plus } from "lucide-react";

import { MobileAppShell, MobileRouteHeader } from "@/components/mobile-sports";
import { DataPair, DataPanel, PageHeader, PageShell, StatusPill } from "@/components/premium";
import {
  MobileTrainingLoadRangeView,
  TrainingLoadRangeView,
} from "@/components/training/TrainingLoadRangeView";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlannerProgressSummary } from "@/lib/practice-planner";
import { getTrainingOverTimeData, normalizeTrainingRange } from "@/lib/training/trainingData";

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
  const latestFatigue = data.latest?.fatigue ?? 0;

  return (
    <PageShell>
      <MobileAppShell className="gap-4">
        <MobileRouteHeader title="Training Load" group="analyse" activeKey="training" />

        {saved ? (
          <div
            role="status"
            className="ios-grouped-list border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100"
          >
            Golf load saved. Golf Form, Training Fitness and Recent Load have been recalculated.
          </div>
        ) : null}

        <MobileTrainingLoadRangeView
          data={data}
          initialRangeKey={rangeKey}
          practiceSummary={{
            completedCount: practiceSummary.completedCount,
            averageScore: practiceSummary.averageScore,
            latestCompleted: practiceSummary.latestCompleted
              ? {
                  title: practiceSummary.latestCompleted.title,
                  score: practiceSummary.latestCompleted.score,
                }
              : null,
          }}
        />
      </MobileAppShell>

      <DesktopWorkbenchLayout scope="training-load" className="hidden lg:grid">
        <PageHeader
          eyebrow={<StatusPill tone="green">Training management</StatusPill>}
          title="Training Load"
          description="Golf Form, Training Fitness and Recent Load over time"
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
          <Alert>
            <AlertDescription>
              Golf load saved. Golf Form, Training Fitness and Recent Load have been recalculated.
            </AlertDescription>
          </Alert>
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

function formatMetric(value: number) {
  return integerFormatter.format(Math.round(value));
}
