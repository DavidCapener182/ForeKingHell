import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlanForSourceSessions } from "@/lib/practice-planner";
import { buildShotPatternPoints, shotPatternConfidence } from "@/lib/shot-pattern-chart-data";
import { getTodayPracticeData } from "@/lib/today-session-data";

export const dynamic = "force-dynamic";

export default async function PracticeSessionReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const userId = await requireCurrentUserId();
  const data = await getTodayPracticeData({ sessionId });

  if (!data.sessions.some((session) => session.id === sessionId)) notFound();

  const plan = await getPracticePlanForSourceSessions(userId, [sessionId]);
  const comparisons = [...data.clubComparisons].sort((left, right) => left.score - right.score);
  const remaining = comparisons[0] ?? null;
  const improved =
    comparisons
      .filter((comparison) => comparison.verdict === "better")
      .sort((left, right) => right.score - left.score)[0] ?? null;
  const shots = data.shots.filter((shot) => shot.sessionId === sessionId);
  const patternPoints = buildShotPatternPoints(
    data.rawShots.filter((shot) => shot.sessionId === sessionId),
  );
  const preferredClub =
    plan?.comparisonSummary && plan.blocks[0]?.clubs[0]
      ? plan.blocks[0].clubs[0]
      : (remaining?.clubType ?? patternPoints[0]?.clubType ?? null);
  const focusConfidence = shotPatternConfidence(
    patternPoints.filter(
      (point) => point.trusted && (!preferredClub || point.clubType === preferredClub),
    ),
  );

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-practice-session-review>
        <MobileTopBar title="Practice review" />

        <section className="ios-grouped-list grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Session verdict
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-7 tracking-tight">
                {data.overall.title}
              </h1>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{data.overall.summary}</p>
            </div>
            <IOSInlineStatus
              label={`${focusConfidence.label} confidence`}
              tone={focusConfidence.label === "Low" ? "attention" : "positive"}
            />
          </div>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader
            title="Shot pattern"
            description="Dispersion first, with measured flight when apex data exists."
          />
          <MobileShotPatternCharts points={patternPoints} preferredClub={preferredClub} />
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader title="What changed" />
          <IOSGroupedList label="Practice changes">
            <IOSListRow
              label="What improved"
              value={improved?.clubLabel ?? "Baseline built"}
              detail={
                improved?.summary ??
                "There is no prior like-for-like baseline strong enough for an improvement claim."
              }
            />
            <IOSListRow
              label="What needs work"
              value={remaining?.clubLabel ?? "Retest"}
              detail={remaining?.summary ?? "Repeat the same measured block before changing focus."}
            />
          </IOSGroupedList>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Four important numbers" />
          <IOSGroupedList label="Important session metrics">
            <IOSMetricRow label="Measured shots" value={String(shots.length)} />
            <IOSMetricRow
              label="Average carry"
              value={formatYards(data.overall.today.carryAverageYd)}
            />
            <IOSMetricRow
              label="Average offline"
              value={formatYards(data.overall.today.offlineAverageYd)}
            />
            <IOSMetricRow
              label="Playable rate"
              value={formatPercent(data.overall.today.playableRate)}
            />
          </IOSGroupedList>
        </section>

        <IOSDisclosureGroup
          label="Club summary"
          items={[
            {
              value: "clubs",
              title: "Club-by-club summary",
              summary: `${comparisons.length} clubs`,
              content: (
                <IOSGroupedList label="Club summaries" className="bg-card">
                  {comparisons.map((comparison) => (
                    <IOSListRow
                      key={comparison.clubType}
                      label={comparison.clubLabel}
                      value={comparison.verdict}
                      detail={`${comparison.today.shotCount} shots · ${formatPercent(comparison.today.playableRate)} playable`}
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
            ...(plan
              ? [
                  {
                    value: "plan",
                    title: "Plan versus actual",
                    summary: plan.score === null ? "Measured" : `${plan.score}/100`,
                    description: plan.verdict,
                    content: (
                      <IOSGroupedList label="Plan result" className="bg-card">
                        <IOSMetricRow label="Blocks" value={String(plan.totalBlocks)} />
                        <IOSMetricRow label="Targets passed" value={String(plan.passedBlocks)} />
                        <IOSMetricRow label="Mixed" value={String(plan.mixedBlocks)} />
                        <IOSMetricRow
                          label="Needs more evidence"
                          value={String(plan.incompleteBlocks)}
                        />
                      </IOSGroupedList>
                    ),
                  },
                ]
              : []),
          ]}
        />

        <Button asChild className="min-h-12 rounded-xl text-base">
          <Link href="/practice?intent=latest_weakness">
            Build next plan
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Link>
        </Button>
      </MobileAppShell>
    </PageShell>
  );
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}
