import { getRequestAppSurface } from "@/lib/app-surface-server";
import { MobileTrainingLoad } from "@/components/training/mobile-training-load";
import Link from "next/link";

import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { TrainingLoadRangeView } from "@/components/training/TrainingLoadRangeView";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { requireCurrentUserId } from "@/lib/current-user";
import type { SpeedDevelopmentSummary } from "@/lib/speed-development";
import { getSpeedCoachCardData } from "@/lib/speed-training-data";
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
  if ((await getRequestAppSurface()) === "companion") {
    const data = await getTrainingOverTimeData(userId, "1y");
    return (
      <PageShell>
        <MobileTrainingLoad data={data} initialRange={rangeKey} />
      </PageShell>
    );
  }
  const [data, speedCoachData] = await Promise.all([
    getTrainingOverTimeData(userId, "1y"),
    getSpeedCoachCardData(userId),
  ]);
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

        <SpeedReadinessPanel development={speedCoachData.development} />

        <TrainingLoadRangeView data={data} initialRangeKey={rangeKey} />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SpeedReadinessPanel({ development }: { development: SpeedDevelopmentSummary }) {
  const { readiness } = development;

  return (
    <DataPanel id="speed-readiness">
      <SectionHeader
        title="Speed Readiness"
        description="Why today is a speed, transfer or recovery day, using current golf load and speed evidence."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
            <Button asChild size="sm" variant="outline">
              <Link href="/speed" prefetch={false}>
                Open Speed Centre
              </Link>
            </Button>
          </div>
        }
      />
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(12rem,0.32fr)_minmax(0,0.68fr)]">
        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Readiness score
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
            {readiness.score}
            <span className="text-lg font-semibold text-muted-foreground">/100</span>
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-foreground">
            {readiness.recommendation}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" aria-label="Speed readiness reasons">
          {readiness.reasons.map((reason) => (
            <div key={reason.label} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{reason.label}</p>
                <StatusPill
                  tone={
                    reason.state === "positive"
                      ? "green"
                      : reason.state === "caution"
                        ? "amber"
                        : "slate"
                  }
                >
                  {reason.state === "positive"
                    ? "Supports speed"
                    : reason.state === "caution"
                      ? "Use caution"
                      : "Needs evidence"}
                </StatusPill>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{reason.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}
