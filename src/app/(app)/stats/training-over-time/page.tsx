import { PageHeader, PageShell } from "@/components/premium";
import { TrainingLoadRangeView } from "@/components/training/TrainingLoadRangeView";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { requireCurrentUserId } from "@/lib/current-user";
import { getTrainingOverTimeData, normalizeTrainingRange } from "@/lib/training/trainingData";

export const dynamic = "force-dynamic";

type TrainingOverTimePageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    saved?: string | string[];
  }>;
};

export default async function TrainingOverTimePage({ searchParams }: TrainingOverTimePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rangeKey = normalizeTrainingRange(resolvedSearchParams.range);
  const userId = await requireCurrentUserId();
  const data = await getTrainingOverTimeData(userId, "1y");
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
          description="A golf-specific view of fitness, freshness and what your next session should be."
        />

        {saved ? (
          <Alert>
            <AlertDescription>
              Golf load saved. Golf Form, Training Fitness and Recent Load have been recalculated.
            </AlertDescription>
          </Alert>
        ) : null}

        <TrainingLoadRangeView data={data} initialRangeKey={rangeKey} />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}
