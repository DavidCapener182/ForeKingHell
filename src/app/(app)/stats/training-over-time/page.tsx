import { requirePlanUser } from "@/lib/require-plan-access";
import { RoundTrainingEffort } from "@/components/training/RoundTrainingEffort";
import { getMobileTrainingSourceLinks } from "@/lib/training/mobile-training-source-links";
import { SpeedReadinessPanel } from "@/app/stats/training-over-time/speed-readiness-panel";

import { PageHeader, PageShell } from "@/components/premium";
import { TrainingLoadRangeView } from "@/components/training/TrainingLoadRangeView";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { requireCurrentUserId } from "@/lib/current-user";
import { getSpeedCoachCardData } from "@/lib/speed-training-data";
import { getTrainingOverTimeData, normalizeTrainingRange } from "@/lib/training/trainingData";

import { parseTrainingScope } from "@/lib/training/ranges";

export const dynamic = "force-dynamic";

type TrainingOverTimePageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
    activity?: string | string[];
    q?: string | string[];
    saved?: string | string[];
  }>;
};

async function TrainingOverTimePage({ searchParams }: TrainingOverTimePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rangeKey = normalizeTrainingRange(resolvedSearchParams.range);
  const parsedScope = parseTrainingScope(
    resolvedSearchParams,
    new Date().toISOString().slice(0, 10),
  );
  const userId = await requireCurrentUserId();
  const [data, speedCoachData] = await Promise.all([
    getTrainingOverTimeData(userId, "1y", parsedScope.scope.from || undefined),
    getSpeedCoachCardData(userId),
  ]);
  const sourceLinks = await getMobileTrainingSourceLinks(userId, data.sessions);
  const saved = Boolean(resolvedSearchParams.saved);

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="training-load">
        <PageHeader
          eyebrow={
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Training management
            </span>
          }
          title="Training Load"
          description="Review logged golf workload and choose your next session. Readiness is app guidance, not medical clearance."
        />

        {saved ? (
          <Alert>
            <AlertDescription>
              Golf load saved. Golf Form, Training Fitness and Recent Load have been recalculated.
            </AlertDescription>
          </Alert>
        ) : null}

        <RoundTrainingEffort sessions={data.sessions} />

        <SpeedReadinessPanel development={speedCoachData.development} />

        <TrainingLoadRangeView
          initialScope={parsedScope.scope}
          scopeError={parsedScope.error}
          data={data}
          initialRangeKey={rangeKey}
          sourceLinks={sourceLinks}
        />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

export default async function SubscriptionPage(props: Parameters<typeof TrainingOverTimePage>[0]) {
  await requirePlanUser("advanced_analytics");
  return <TrainingOverTimePage {...props} />;
}
