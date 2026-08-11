import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChartNoAxesCombined } from "lucide-react";

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
import { getTodayPracticeData, type TodayPracticeShot } from "@/lib/today-session-data";

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
  const improved = [...comparisons].sort((left, right) => right.score - left.score)[0] ?? null;
  const shots = data.shots.filter((shot) => shot.sessionId === sessionId);

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
              label={confidenceLabel(shots.length)}
              tone={shots.length >= 8 ? "positive" : "attention"}
            />
          </div>
          <IOSGroupedList label="Practice changes" className="bg-card">
            <IOSListRow
              label="What improved"
              value={improved?.clubLabel ?? "Baseline built"}
              detail={improved?.summary ?? "This measured session establishes the next comparison."}
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

        <section className="grid gap-2.5">
          <IOSSectionHeader
            title="Dispersion"
            description="Measured landing pattern, not a modelled target result."
          />
          <DispersionPreview shots={shots} />
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader
            title="Flight trajectory"
            description="Compact measured-flight preview."
          />
          <TrajectoryPreview shots={shots} />
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

function DispersionPreview({ shots }: { shots: TodayPracticeShot[] }) {
  const points = shots
    .filter((shot) => shot.carryYd !== null && shot.sideCarryYd !== null)
    .slice(0, 40);
  const maxCarry = Math.max(1, ...points.map((shot) => Number(shot.carryYd)));
  const maxSide = Math.max(20, ...points.map((shot) => Math.abs(Number(shot.sideCarryYd))));

  return (
    <div className="ios-grouped-list overflow-hidden p-3">
      {points.length > 0 ? (
        <svg
          viewBox="0 0 320 190"
          role="img"
          aria-label="Measured shot landing dispersion"
          className="h-auto w-full"
        >
          <rect width="320" height="190" rx="16" className="fill-secondary/60" />
          <path d="M160 180 L160 10" className="stroke-border" strokeDasharray="4 5" />
          {points.map((shot) => {
            const x = 160 + (Number(shot.sideCarryYd) / maxSide) * 130;
            const y = 176 - (Number(shot.carryYd) / maxCarry) * 155;
            return <circle key={shot.id} cx={x} cy={y} r="4" className="fill-primary/75" />;
          })}
        </svg>
      ) : (
        <EmptyChart label="No measured landing coordinates are available." />
      )}
    </div>
  );
}

function TrajectoryPreview({ shots }: { shots: TodayPracticeShot[] }) {
  const flights = shots
    .filter((shot) => shot.carryYd !== null && shot.apexFt !== null)
    .slice(0, 12);
  const maxCarry = Math.max(1, ...flights.map((shot) => Number(shot.carryYd)));
  const maxApex = Math.max(1, ...flights.map((shot) => Number(shot.apexFt)));

  return (
    <div className="ios-grouped-list overflow-hidden p-3">
      {flights.length > 0 ? (
        <svg
          viewBox="0 0 320 170"
          role="img"
          aria-label="Measured shot flight trajectories"
          className="h-auto w-full"
        >
          <rect width="320" height="170" rx="16" className="fill-secondary/60" />
          <path d="M16 150 H304" className="stroke-border" />
          {flights.map((shot) => {
            const endX = 20 + (Number(shot.carryYd) / maxCarry) * 280;
            const apexY = 142 - (Number(shot.apexFt) / maxApex) * 115;
            return (
              <path
                key={shot.id}
                d={`M20 150 Q ${endX / 2} ${apexY} ${endX} 150`}
                fill="none"
                className="stroke-primary/55"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      ) : (
        <EmptyChart label="No measured apex data are available." />
      )}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid min-h-36 place-items-center text-center text-sm text-muted-foreground">
      <span>
        <ChartNoAxesCombined className="mx-auto mb-2 size-6" aria-hidden />
        {label}
      </span>
    </div>
  );
}

function confidenceLabel(shotCount: number) {
  if (shotCount >= 20) return "High confidence";
  if (shotCount >= 8) return "Moderate confidence";
  return "Low confidence";
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}
