import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { TrainingLoadRangeView } from "@/components/training/TrainingLoadRangeView";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <DesktopWorkbenchLayout scope="training-load">
        <PageHeader
          eyebrow={<StatusPill tone="green">Training management</StatusPill>}
          title="Training Load"
          description="Golf Form, Training Fitness and Recent Load over time"
          actions={
            <Button asChild>
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

        {latestFatigue >= 120 ? (
          <Alert variant="destructive" data-training-load-warning>
            <AlertTitle>Recent load is high</AlertTitle>
            <AlertDescription>
              Keep the next plan technical or recovery-led until the recent-load signal eases.
            </AlertDescription>
          </Alert>
        ) : null}

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
    <Card className="shadow-sm" data-training-practice-recommendation>
      <CardHeader>
        <div>
          <StatusPill tone={loadHigh ? "amber" : "green"}>{suitability}</StatusPill>
          <CardTitle className="mt-3 text-2xl tracking-normal">Practice Planner load fit</CardTitle>
          <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
            {practiceSummary.latestCompleted
              ? `${practiceSummary.latestCompleted.title} finished with a ${practiceSummary.latestCompleted.score ?? "--"} practice score while Training Load read ${statusLabel}.`
              : `No completed structured plan yet. Training Load currently reads ${statusLabel}.`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ConnectedMetricBar
          embedded
          label="Practice planner load fit metrics"
          className="sm:grid-cols-3 xl:grid-cols-3"
          metrics={[
            {
              label: "Completed plans",
              value: integerFormatter.format(practiceSummary.completedCount),
            },
            {
              label: "Average score",
              value:
                practiceSummary.averageScore === null ? "--" : `${practiceSummary.averageScore}`,
            },
            { label: "Recent Load", value: formatMetric(recentLoad) },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function formatMetric(value: number) {
  return integerFormatter.format(Math.round(value));
}
