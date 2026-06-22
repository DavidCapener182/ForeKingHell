import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Dumbbell, LineChart, Plus, ShieldCheck, Sparkles } from "lucide-react";

import { MobileRouteHeader } from "@/components/mobile-sports";
import {
  DataPanel,
  EmptyState,
  MobileSectionChips,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { RecentTrainingSessions } from "@/components/training/RecentTrainingSessions";
import { TrainingLoadBars } from "@/components/training/TrainingLoadBars";
import { TrainingOverTimeChart } from "@/components/training/TrainingOverTimeChart";
import { TrainingSessionForm } from "@/components/training/TrainingSessionForm";
import { TrainingSourceSuggestions } from "@/components/training/TrainingSourceSuggestions";
import { TrainingStatusCard } from "@/components/training/TrainingStatusCard";
import { TrainingSummaryCards } from "@/components/training/TrainingSummaryCards";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getTrainingOverTimeData,
  normalizeTrainingRange,
  type TrainingRangeKey,
} from "@/lib/training/trainingData";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TrainingOverTimePageProps = {
  searchParams?: Promise<{
    range?: string | string[];
    saved?: string | string[];
  }>;
};

const rangeOptions: Array<{ key: TrainingRangeKey; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "4w", label: "4W" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
];

const integerFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

export default async function TrainingOverTimePage({ searchParams }: TrainingOverTimePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rangeKey = normalizeTrainingRange(resolvedSearchParams.range);
  const userId = await requireCurrentUserId();
  const data = await getTrainingOverTimeData(userId, rangeKey);
  const saved = Boolean(resolvedSearchParams.saved);

  return (
    <PageShell>
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="training" />

      <PageHeader
        eyebrow={<StatusPill tone="green">Golf Fitness</StatusPill>}
        title="Training Over Time"
        description="Golf conditioning, acute load and golf form over time"
        metrics={[
          {
            label: "Golf Conditioning",
            value: formatMetric(data.latest?.fitness ?? 0),
            detail: `${data.conditioningDays}-day golf workload`,
          },
          {
            label: "Acute load",
            value: formatMetric(data.latest?.fatigue ?? 0),
            detail: "7-day acute golf load",
          },
          {
            label: "Golf Form",
            value: formatMetric(data.latest?.form ?? 0),
            detail: data.status.label,
          },
          {
            label: "Confidence",
            value: formatMetric(data.confidence.score),
            detail: data.confidence.label,
          },
        ]}
        actions={
          <Button asChild className="premium-action">
            <Link href="#log-load">
              <Plus className="size-4" />
              Log Golf Load
            </Link>
          </Button>
        }
      />

      {saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
          Golf load saved. Golf Conditioning, acute load and Golf Form have been recalculated.
        </div>
      ) : null}

      <RangeControls activeKey={rangeKey} />

      <MobileSectionChips
        items={[
          { label: "Summary", href: "#summary" },
          { label: "Chart", href: "#chart" },
          { label: "Load", href: "#load" },
          { label: "Log", href: "#log-load" },
          { label: "Recent", href: "#recent" },
        ]}
      />

      {!data.hasTrainingData ? (
        <TrainingEmptyState conditioningDays={data.conditioningDays} />
      ) : null}

      <div id="summary">
        <TrainingSummaryCards
          summary={data.summary}
          status={data.status}
          sessionFormSignal={data.sessionFormSignal}
        />
      </div>

      <DataPanel id="chart">
        <SectionHeader
          title="Golf Conditioning & Performance"
          description="Golf Conditioning and acute load track your workload. Golf Form tracks how well your comparable golf is moving against your 100 baseline."
          action={<StatusPill tone={data.status.tone}>{data.status.label}</StatusPill>}
        />
        <CardContent>
          <TrainingOverTimeChart data={data.series} sessionMarkers={data.sessionMarkers} />
        </CardContent>
      </DataPanel>

      <DataPanel id="load">
        <SectionHeader
          title="Daily swing load"
          description="Each bar is the total session load logged for that day."
          action={<BarChart3 className="size-5 text-emerald-700" aria-hidden="true" />}
        />
        <CardContent>
          <TrainingLoadBars data={data.series} />
        </CardContent>
      </DataPanel>

      <TrainingStatusCard
        latest={data.latest}
        status={data.status}
        trend={data.trend}
        confidence={data.confidence}
        sessionFormSignal={data.sessionFormSignal}
      />

      <EfficiencyCards cards={data.efficiencyCards} />

      <TrainingSourceSuggestions suggestions={data.suggestions} rangeKey={rangeKey} />

      <DataPanel id="log-load">
        <SectionHeader
          title="Log Golf Load"
          description="Add a round, practice block, speed session or manual workload entry."
          action={<Dumbbell className="size-5 text-emerald-700" aria-hidden="true" />}
        />
        <TrainingSessionForm rangeKey={rangeKey} today={data.today} />
      </DataPanel>

      <RecentTrainingSessions sessions={data.recentSessions} />
    </PageShell>
  );
}

function RangeControls({ activeKey }: { activeKey: TrainingRangeKey }) {
  return (
    <nav
      aria-label="Training range"
      className="premium-command-surface flex w-full gap-1 overflow-x-auto rounded-lg p-1 sm:w-fit"
    >
      {rangeOptions.map((option) => (
        <Link
          key={option.key}
          href={`/stats/training-over-time?range=${option.key}`}
          className={cn(
            "min-h-9 min-w-12 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors",
            option.key === activeKey
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function TrainingEmptyState({ conditioningDays }: { conditioningDays: number }) {
  return (
    <DataPanel>
      <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <EmptyState
          icon={<LineChart className="size-5" aria-hidden="true" />}
          title="Start logging rounds or practice sessions to build your golf training profile."
          description="Golf Conditioning is your long-term golf load, acute load is your short-term workload, and Golf Form shows whether comparable sessions are moving the right way."
          action={
            <Button asChild>
              <Link href="#log-load">
                <Plus className="size-4" />
                Log first session
              </Link>
            </Button>
          }
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <PrimerCard
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            title="Golf Conditioning"
            detail={`${conditioningDays}-day golf workload capacity. It moves slowly so short quiet spells do not look like lost conditioning.`}
          />
          <PrimerCard
            icon={<BarChart3 className="size-4" aria-hidden="true" />}
            title="Acute load"
            detail="7-day golf workload. It moves quickly after hard practice, walking rounds or speed work."
          />
          <PrimerCard
            icon={<Sparkles className="size-4" aria-hidden="true" />}
            title="Golf Form"
            detail="Indexed golf form. 100 is your baseline, 110+ is very good, and 120+ is peak form."
          />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function PrimerCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function EfficiencyCards({
  cards,
}: {
  cards: Array<{
    title: string;
    detail: string;
    metric: string;
  }>;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.title} className="rounded-lg border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Performance Efficiency
          </p>
          <p className="mt-2 text-base font-semibold tracking-normal text-foreground">
            {card.title}
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{card.detail}</p>
          <p className="mt-3 text-sm font-semibold text-emerald-900">{card.metric}</p>
        </article>
      ))}
    </section>
  );
}

function formatMetric(value: number) {
  return integerFormatter.format(Math.round(value));
}
