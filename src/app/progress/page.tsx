import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  LineChart,
  ListChecks,
  Sparkles,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  DataPair,
  DataPanel,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader, MobileTabBar } from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatClubType } from "@/lib/club-format";
import type { ClubAnalytics } from "@/lib/club-analytics";
import { getProgressData } from "@/lib/progress-data";
import {
  buildProgressSummary,
  type BestSignal,
  type CoachSummaryGroup,
  type DataGap,
  type JourneyEvent,
  type PracticePriority,
  type ProgressClubRow,
  type ProgressSummary,
  type ProgressTrend,
  type TrustLadderItem,
} from "@/lib/progress-summary";
import { saveCurrentWeeklyRecapAction } from "@/app/feature-actions";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

export default async function ProgressPage() {
  const [data, featureData] = await Promise.all([getProgressData(), getFeatureIdeasData()]);
  const summary = buildProgressSummary(data.clubs);
  const mostImproved = summary.rankings.mostImproved;

  return (
    <PageShell>
      <MobileRouteHeader title="Dashboard" group="dashboard" activeKey="progress" />
      <MobileTabBar
        activeKey="overview"
        className="sm:hidden"
        tabs={[
          { key: "overview", label: "Overview", href: "/progress" },
          { key: "trends", label: "Trends", href: "#trends" },
          { key: "calendar", label: "Calendar", href: "#journey" },
          { key: "pbs", label: "PBs", href: "/achievements" },
        ]}
      />

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowRight className="size-4 rotate-180" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/bag" prefetch={false}>
              <Target className="size-4" />
              Bag
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="sky">Personal baseline</StatusPill>
            <StatusPill tone="amber">Progress verdict: Improving, but uneven</StatusPill>
          </div>
        }
        title="Bag progress"
        description={heroVerdict(summary)}
        visual={<PageArtwork variant="progress" alt="" className="h-full min-h-44" />}
        actions={
          mostImproved ? (
            <Button asChild size="lg" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href={`/bag/${mostImproved.clubId}/analytics`} prefetch={false}>
                <Brain className="size-4" />
                View supporting shots
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import first CSV
              </Link>
            </Button>
          )
        }
        metrics={[
          {
            label: "Clean stock shots",
            value: integerFormatter.format(summary.totals.trackedCleanShots),
            detail: "Used for progress checks",
          },
          {
            label: "Tracked clubs",
            value: integerFormatter.format(summary.totals.clubs),
            detail: `${integerFormatter.format(summary.totals.shots)} launch monitor rows`,
          },
          {
            label: "Average trust",
            value: `${summary.totals.averageTrust}%`,
            detail: "Distance, direction, strike and sample depth",
          },
          {
            label: "Playable rate",
            value: formatRate(summary.totals.averagePlayableRate),
            detail: "Across clubs with enough direction data",
          },
        ]}
      />

      {data.clubs.length === 0 ? (
        <>
          <DataPanel>
            <CardContent className="flex flex-col items-center gap-3 py-7 text-center sm:gap-4 sm:py-14">
              <Sparkles className="size-8 text-emerald-500 sm:size-9" />
              <div>
                <p className="text-lg font-semibold sm:text-xl">No progress baseline yet</p>
                <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground sm:leading-6">
                  Import a Rapsodo CSV and ForeKingHell will build first-vs-latest club
                  comparisons automatically.
                </p>
              </div>
              <Button asChild>
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import CSV
                </Link>
              </Button>
            </CardContent>
          </DataPanel>
          <section className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 sm:hidden">
            <p className="text-sm font-semibold">Next useful data</p>
            <div className="grid gap-2">
              <DataPair label="Best import" value="Rapsodo range CSV" />
              <DataPair label="Minimum sample" value="8+ clean shots per club" />
              <DataPair label="Then review" value="Trends, PBs and coach signal" />
            </div>
          </section>
          <section className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Import data",
                description: "Start with the next range or course CSV.",
                href: "/import",
                icon: Upload,
              },
              {
                title: "Map clubs",
                description: "Confirm the bag so stock numbers compare cleanly.",
                href: "/bag",
                icon: Target,
              },
              {
                title: "Open coach",
                description: "Turn the first baseline into a practice plan.",
                href: "/coach",
                icon: Brain,
              },
            ].map((step) => {
              const Icon = step.icon;

              return (
                <Link
                  key={step.href}
                  href={step.href}
                  prefetch={false}
                  className="grid min-h-24 gap-2 rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm transition-colors hover:border-emerald-300"
                >
                  <Icon className="size-5 text-emerald-600" />
                  <span className="text-sm font-semibold">{step.title}</span>
                  <span className="text-sm leading-5 text-muted-foreground">{step.description}</span>
                </Link>
              );
            })}
          </section>
        </>
      ) : (
        <>
          <MobileProgressFirstCard summary={summary} />
          <WeeklyRecapPanel data={featureData} summary={summary} />
          <ComparisonBar summary={summary} />
          <ProgressSignalsPanel summary={summary} clubs={data.clubs} />

          <DataPanel id="trends">
            <SectionHeader
              title="Progress trends"
              description="Movement from the first clean baseline to the latest clean baseline."
              action={<LineChart className="size-5 text-sky-500" />}
            />
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {summary.trends.map((trend) => (
                  <TrendCard key={trend.label} trend={trend} summary={summary} />
                ))}
              </div>
            </CardContent>
          </DataPanel>

          <PracticePlanPanel priorities={summary.practicePlan} />
          <CoachReadoutPanel signal={summary.bestSignal} groups={summary.coachSummary} gaps={summary.dataGaps} />

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <BagMovementPanel rows={summary.clubRows} />
            <TrustLadderPanel items={summary.trustLadder} />
          </section>

          <div id="journey" className="scroll-mt-28">
            <JourneyPanel events={summary.journey} />
          </div>
        </>
      )}
    </PageShell>
  );
}

function WeeklyRecapPanel({
  data,
  summary,
}: {
  data: FeatureIdeasData;
  summary: ProgressSummary;
}) {
  const bestClub = summary.rankings.mostTrusted ?? summary.rankings.mostImproved;
  const weakestSignal = summary.rankings.needsWork;
  const topPriority = summary.practicePlan[0];
  const sessionsLabel = weeklySessionsLabel(data.weeklyRecap);
  const weeklyRead = weeklyReadout(summary);

  return (
    <DataPanel>
      <SectionHeader
        title="Weekly recap"
        description={`${data.weeklyRecap.metric} · ${sessionsLabel} · Personal baseline comparison`}
        action={<StatusPill tone={data.weeklyRecap.tone as Tone}>How recap works</StatusPill>}
      />
      <CardContent className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <p className="text-sm leading-6 text-muted-foreground">
              {`${sessionsLabel} in this week's sample. Keep the next goal tight and measurable.`}
            </p>
            <p className="mt-2 text-sm font-medium leading-6">
              <span className="font-semibold">This week&apos;s read: </span>
              {weeklyRead}
            </p>
          </div>
          <form action={saveCurrentWeeklyRecapAction}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <ClipboardCheck className="size-4" />
              Save weekly recap
            </Button>
          </form>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <WeeklyRecapCard
            label="Best club"
            value={bestClub ? formatClubType(bestClub.clubType) : data.weeklyRecap.bestClub}
            detail={bestClub ? bestClubDetail(bestClub, summary) : "Keep building clean stock-shot samples"}
            href={bestClub ? `/bag/${bestClub.clubId}/analytics` : undefined}
            tone="green"
          />
          <WeeklyRecapCard
            label="Weakest signal"
            value={weakestSignal ? formatClubType(weakestSignal.clubType) : "Needs sample"}
            detail={weakestSignal ? `${weakestSignal.trustIndex}% trust · lowest reliable-data club` : "Review the next clean baseline"}
            href={weakestSignal ? `/bag/${weakestSignal.clubId}/analytics` : undefined}
            tone="amber"
          />
          <WeeklyRecapCard
            label="New PBs"
            value="View PBs & achievements"
            detail="PB details live in the achievements shelf."
            href="/achievements"
            tone="sky"
          />
          <WeeklyRecapCard
            label="Next goal"
            value={topPriority?.title ?? "Build next baseline"}
            detail={nextGoalDetail(topPriority)}
            href={topPriority ? `/bag/${topPriority.clubId}/analytics` : "/import"}
            tone={topPriority?.tone ?? "slate"}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Practice plan calendar</p>
            <StatusPill tone="slate">{data.practiceCalendar.length} planned</StatusPill>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {data.practiceCalendar.slice(0, 4).map((item, index) => (
              <div key={`${item.title}-${item.date.toISOString()}`} className="flex min-w-0 shrink-0 items-center gap-2">
                <div className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {shortDateFormatter.format(item.date)}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">{compactPracticeTitle(item.title)}</p>
                </div>
                {index < Math.min(data.practiceCalendar.length, 4) - 1 ? (
                  <ArrowRight className="size-4 shrink-0 text-slate-400" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function WeeklyRecapCard({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
  tone: Tone;
}) {
  const content = (
    <div className="h-full rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-300">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <span className={cn("mt-0.5 size-2 rounded-full", compactToneClasses[tone].split(" ")[0])} />
      </div>
      <p className="mt-2 text-base font-semibold leading-6 tracking-normal">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function MobileProgressFirstCard({ summary }: { summary: ProgressSummary }) {
  const mostImproved = summary.rankings.mostImproved;
  const needsWork = summary.rankings.needsWork;

  return (
    <section className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 sm:hidden">
      <div>
        <p className="text-sm font-semibold text-[#0B7A3B]">This week</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal">
          {mostImproved ? `${formatClubType(mostImproved.clubType)} is moving best` : "Build a comparable baseline"}
        </h2>
        <p className="mt-2 text-sm leading-5 text-[#6B7280]">
          {needsWork
            ? `${formatClubType(needsWork.clubType)} is the biggest drop: ${needsWork.primaryMiss.toLowerCase()} miss, ${needsWork.trustIndex}% trust.`
            : "Import another session to separate best improvement, biggest drop and next action."}
        </p>
      </div>
      <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]" data-primary-action>
        <Link href={needsWork ? `/bag/${needsWork.clubId}/analytics` : "/import"} prefetch={false}>
          {needsWork ? "Open next action" : "Import session"}
        </Link>
      </Button>
    </section>
  );
}

type Tone = "green" | "sky" | "pink" | "amber" | "slate";

function ComparisonBar({ summary }: { summary: ProgressSummary }) {
  return (
    <section className="grid gap-3 rounded-lg border border-[#D9DED8] bg-white px-4 py-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Comparison</p>
        <p className="mt-1 font-semibold">Progress controls</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Compared with</p>
        <p className="mt-1 font-semibold">Personal baseline</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Period</p>
        <p className="mt-1 font-semibold">All saved data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Confidence: based on {integerFormatter.format(summary.totals.trackedCleanShots)} clean stock shots
        </p>
      </div>
      <Tabs defaultValue="all" className="sm:justify-self-end">
        <TabsList>
          <TabsTrigger className="data-active:bg-[#0B7A3B] data-active:text-white data-active:shadow-sm" value="all">All data</TabsTrigger>
          <TabsTrigger className="data-active:bg-[#0B7A3B] data-active:text-white data-active:shadow-sm" value="30d">Last 30 days</TabsTrigger>
          <TabsTrigger className="data-active:bg-[#0B7A3B] data-active:text-white data-active:shadow-sm" value="10s">Last 10 sessions</TabsTrigger>
        </TabsList>
      </Tabs>
    </section>
  );
}

function ProgressSignalsPanel({
  summary,
  clubs,
}: {
  summary: ProgressSummary;
  clubs: Array<{ clubId: string; analytics: ClubAnalytics }>;
}) {
  const bestMovement = summary.rankings.mostImproved;
  const mainConcern = summary.rankings.needsWork;
  const mostReliable = summary.rankings.mostTrusted;
  const strongestImprovement = strongestImprovementRow(summary);
  const mostVolatile = summary.rankings.mostVolatile;

  return (
    <DataPanel>
      <SectionHeader
        title="Progress signals"
        description="The clearest gains, risks and priorities from the current comparison."
        action={<TrendingUp className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <LargeSignalCard
            icon={TrendingUp}
            label="Best movement"
            value={bestMovement ? formatClubType(bestMovement.clubType) : "--"}
            detail={bestMovement ? bestMovementDetail(bestMovement) : "Need comparable baselines"}
            note={bestMovement ? offlineMovementNote(bestMovement) : undefined}
            href={bestMovement ? `/bag/${bestMovement.clubId}/analytics` : undefined}
            tone="green"
          />
          <LargeSignalCard
            icon={AlertTriangle}
            label="Main concern"
            value={mainConcern ? formatClubType(mainConcern.clubType) : "--"}
            detail={mainConcern ? `${mainConcern.trustIndex}% trust · lowest trust club with usable data` : "No weak signal has separated yet"}
            href={mainConcern ? `/bag/${mainConcern.clubId}/analytics` : undefined}
            tone="amber"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Most reliable"
            value={mostReliable ? formatClubType(mostReliable.clubType) : "--"}
            detail={mostReliable ? `${mostReliable.trustIndex}% trust · ${mostReliable.sampleSize} clean shots` : "Need more shots"}
            href={mostReliable ? `/bag/${mostReliable.clubId}/analytics` : undefined}
            icon={Gauge}
            tone="sky"
          />
          <MetricCard
            label="Strongest improvement"
            value={strongestImprovement ? formatClubType(strongestImprovement.clubType) : "--"}
            detail={strongestImprovement ? strongestImprovementDetail(strongestImprovement) : "Need comparable baselines"}
            href={strongestImprovement ? `/bag/${strongestImprovement.clubId}/analytics` : undefined}
            icon={TrendingUp}
            tone="green"
          />
          <MetricCard
            label="Needs attention"
            value={mainConcern ? formatClubType(mainConcern.clubType) : "--"}
            detail={mainConcern ? "Lowest trust club with usable data" : "No weak signal yet"}
            href={mainConcern ? `/bag/${mainConcern.clubId}/analytics` : undefined}
            icon={ListChecks}
            tone="amber"
          />
          <MetricCard
            label="Most volatile"
            value={mostVolatile ? formatClubType(mostVolatile.clubType) : "--"}
            detail={
              mostVolatile
                ? `${formatRate(findAnalytics(clubs, mostVolatile.clubId)?.accuracy.bigMissRate ?? null)} big miss rate`
                : "Need side-carry data"
            }
            href={mostVolatile ? `/bag/${mostVolatile.clubId}/analytics` : undefined}
            icon={TrendingDown}
            tone="amber"
          />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function LargeSignalCard({
  icon: Icon,
  label,
  value,
  detail,
  note,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  note?: string;
  href?: string;
  tone: Tone;
}) {
  const content = (
    <div className="grid h-full grid-cols-[auto_1fr] gap-3 rounded-lg border border-[#D9DED8] bg-white p-4 transition-colors hover:border-emerald-300">
      <div className={cn("grid size-9 place-items-center rounded-md ring-1", toneClasses[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold leading-tight tracking-normal">{value}</p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p>
        {note ? <p className="mt-1 text-xs leading-4 text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function TrendCard({ trend, summary }: { trend: ProgressTrend; summary: ProgressSummary }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {trend.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-normal">{trend.value}</p>
        </div>
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-md ring-1", toneClasses[trend.tone])}>
          <BarChart3 className="size-4" />
        </div>
      </div>
      <Sparkline points={trend.points} tone={trend.tone} />
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{trendVerdict(trend, summary)}</p>
      {trendFootnote(trend, summary) ? (
        <p className="mt-1 text-xs leading-4 text-muted-foreground">{trendFootnote(trend, summary)}</p>
      ) : null}
    </div>
  );
}

function Sparkline({ points, tone }: { points: number[]; tone: Tone }) {
  if (points.length < 2) {
    return (
      <div className="mt-4 grid h-14 place-items-center rounded-md bg-slate-50 text-xs text-muted-foreground">
        More data needed
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 140;
  const height = 52;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point - min) / range) * (height - 10) - 5;

    return `${roundForSvg(x)},${roundForSvg(y)}`;
  });
  const lastPoint = coordinates[coordinates.length - 1]?.split(",").map(Number) ?? [width, height / 2];

  return (
    <svg className="mt-4 h-14 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend line">
      <line x1="0" x2={width} y1={height - 5} y2={height - 5} stroke="#E5E7EB" strokeWidth="1" />
      <polyline
        fill="none"
        points={coordinates.join(" ")}
        stroke={strokeForTone(tone)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill={strokeForTone(tone)} />
    </svg>
  );
}

function PracticePlanPanel({ priorities }: { priorities: PracticePriority[] }) {
  const [topPriority, ...secondaryPriorities] = priorities;

  return (
    <DataPanel>
      <SectionHeader
        title="Practice plan"
        description="The next actions ranked by trust gap, big misses, launch window, and strike quality."
        action={<Brain className="size-5 text-emerald-600" />}
      />
      <CardContent>
        {topPriority ? (
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <PracticePriorityFeatureCard priority={topPriority} />
            <div className="grid gap-3">
              {secondaryPriorities.map((priority, index) => (
                <PracticePriorityCompactCard key={priority.clubId} priority={priority} index={index + 2} />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-muted-foreground">
            Import clean stock shots to unlock a ranked practice plan.
          </div>
        )}
      </CardContent>
    </DataPanel>
  );
}

function PracticePriorityFeatureCard({ priority }: { priority: PracticePriority }) {
  return (
    <Link
      href={`/bag/${priority.clubId}/analytics`}
      prefetch={false}
      className="block rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 transition-colors hover:border-emerald-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline" className="bg-white">Priority 1</Badge>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-normal">{priority.title}</h2>
        </div>
        <StatusPill tone={priority.tone}>{priority.priorityLabel}</StatusPill>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-white p-3 ring-1 ring-emerald-100">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Why</p>
          <p className="mt-1 text-sm leading-6">{practiceReasonCopy(priority)}</p>
        </div>
        <div className="rounded-md bg-white p-3 ring-1 ring-emerald-100">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Task</p>
          <p className="mt-1 text-sm leading-6">{priority.drill}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <StatusPill tone="slate">Coach score {priority.score}</StatusPill>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <Target className="size-4" />
          {practiceCtaLabel(priority)}
        </span>
      </div>
    </Link>
  );
}

function PracticePriorityCompactCard({
  priority,
  index,
}: {
  priority: PracticePriority;
  index: number;
}) {
  return (
    <Link
      href={`/bag/${priority.clubId}/analytics`}
      prefetch={false}
      className="block rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline">Priority {index}</Badge>
          <h2 className="mt-2 text-base font-semibold leading-6 tracking-normal">{priority.title}</h2>
        </div>
        <StatusPill tone={priority.tone}>{priority.priorityLabel}</StatusPill>
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{practiceReasonCopy(priority)}</p>
      <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
        <Target className="size-4" />
        Open
      </p>
    </Link>
  );
}

function CoachReadoutPanel({
  signal,
  groups,
  gaps,
}: {
  signal: BestSignal | null;
  groups: CoachSummaryGroup[];
  gaps: DataGap[];
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Coach readout"
        description="A plain-English readout of what is improving, what needs attention and what to practise next."
        action={<CheckCircle2 className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-4">
        {signal ? (
          <BestSignalBanner signal={signal} />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-muted-foreground">
            No best signal has separated yet. Keep importing comparable stock-shot sessions.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title} className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full ring-4", compactToneClasses[group.tone])} />
                <h2 className="font-semibold tracking-normal">{group.title}</h2>
              </div>
              <div className="space-y-3">
                {group.title === "Data gaps" && gaps.length > 0 ? (
                  gaps.slice(0, 2).map((gap) => <DataGapRichCard key={gap.clubId} gap={gap} />)
                ) : (
                  group.items.map((item, index) => {
                    const content = (
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="text-sm font-medium leading-5">{item.label}</p>
                        {item.detail ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p> : null}
                      </div>
                    );

                    return item.clubId ? (
                      <Link key={`${group.title}-${index}`} href={`/bag/${item.clubId}/analytics`} prefetch={false} className="block hover:text-emerald-700">
                        {content}
                      </Link>
                    ) : (
                      <div key={`${group.title}-${index}`}>{content}</div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function DataGapRichCard({ gap }: { gap: DataGap }) {
  return (
    <Link
      href={`/bag/${gap.clubId}/analytics`}
      prefetch={false}
      className="block rounded-md border border-slate-200 bg-white p-3 hover:border-emerald-300"
    >
      <p className="text-sm font-medium leading-5">{formatClubType(gap.clubType)} needs more clean stock shots</p>
      <div className="mt-3 grid gap-2 text-sm">
        <DataPair label="Baseline" value={`${gap.cleanShots} clean baseline shots`} />
        <DataPair label="Target" value="10 full stock shots" />
        <DataPair label="Next action" value={`Build ${formatClubType(gap.clubType)} baseline`} />
      </div>
    </Link>
  );
}

function BestSignalBanner({ signal }: { signal: BestSignal }) {
  const content = (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 transition-colors hover:border-emerald-400">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <Zap className="size-4" />
        Best signal
      </div>
      <p className="mt-2 text-lg font-semibold leading-7">{signal.value}</p>
      <p className="mt-1 text-sm leading-6 text-emerald-950/80">
        <span className="font-semibold">Why it matters: </span>
        {signal.why}
      </p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{signal.detail}</p>
    </div>
  );

  return signal.clubId ? (
    <Link href={`/bag/${signal.clubId}/analytics`} prefetch={false} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function BagMovementPanel({ rows }: { rows: ProgressClubRow[] }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Bag movement"
        description={bagMovementSummary(rows)}
        action={<Table2 className="size-5 text-sky-600" />}
      />
      <CardContent>
        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow>
              <TableHead>Club</TableHead>
              <TableHead>Trust</TableHead>
              <TableHead>Clean shots</TableHead>
              <TableHead>Stock carry</TableHead>
              <TableHead>Meaningful movement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.clubId}>
                <TableCell className={cn("border-l-4", bagRowMarkerClass(row))}>
                  <Link href={`/bag/${row.clubId}/analytics`} prefetch={false} className="font-semibold hover:text-emerald-700">
                    {formatClubType(row.clubType)}
                  </Link>
                  <p className="mt-0.5 max-w-44 truncate text-xs text-muted-foreground">{row.brandModel}</p>
                </TableCell>
                <TableCell>
                  <StatusPill tone={row.trustIndex >= 68 ? "green" : row.trustIndex >= 62 ? "sky" : "amber"}>
                    {row.trustIndex}% trust
                  </StatusPill>
                </TableCell>
                <TableCell>{row.sampleSize}</TableCell>
                <TableCell>{formatYards(row.stockCarryYd)}</TableCell>
                <TableCell>
                  <MovementPills row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </DataPanel>
  );
}

function MovementPills({ row }: { row: ProgressClubRow }) {
  const items = movementItems(row);

  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">No meaningful movement detected</span>;
  }

  return (
    <div className="flex min-w-64 flex-wrap gap-2">
      {items.map((item) => (
        <StatusPill key={item.label} tone={item.tone}>
          {item.label}
        </StatusPill>
      ))}
    </div>
  );
}

function TrustLadderPanel({ items }: { items: TrustLadderItem[] }) {
  return (
    <DataPanel className="xl:sticky xl:top-4">
      <SectionHeader
        title="Trust ladder"
        description="Trust considers distance, direction, strike quality, and clean-shot sample depth."
        action={<Gauge className="size-5 text-emerald-600" />}
      />
      <CardContent className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.clubId}
            href={`/bag/${item.clubId}/analytics`}
            prefetch={false}
            title="Based on distance consistency, direction, strike quality, and clean-shot sample depth."
            className="grid grid-cols-[3.5rem_auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-emerald-300"
          >
            <p className="font-semibold">{formatClubType(item.clubType)}</p>
            <p className="font-semibold tabular-nums">{item.trustIndex === null ? "--" : `${item.trustIndex}%`}</p>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium">{item.note}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </DataPanel>
  );
}

function JourneyPanel({ events }: { events: JourneyEvent[] }) {
  const visibleEvents = events.slice(0, 4);

  return (
    <DataPanel>
      <SectionHeader
        title="Journey"
        description="Recent milestones and notable movement from the current data."
        action={<StatusPill tone="slate">Latest 4</StatusPill>}
      />
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {visibleEvents.map((event, index) => (
            <Link
              key={`${event.title}-${index}`}
              href={`/bag/${event.clubId}/analytics`}
              prefetch={false}
              className="relative block rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="slate">
                  <CalendarDays className="mr-1 size-3" />
                  {event.dateLabel}
                </StatusPill>
                <StatusPill tone={event.tone}>{formatClubType(event.clubType)}</StatusPill>
              </div>
              <p className="mt-2 font-semibold">{event.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{event.detail}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function movementItems(row: ProgressClubRow) {
  const items: Array<{ label: string; tone: Tone }> = [];

  if (isMeaningful(row.carryDeltaYd, 0.5)) {
    items.push({
      label: `Carry ${formatSigned(row.carryDeltaYd)} yd`,
      tone: row.carryDeltaYd >= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.offlineDeltaYd, 0.5)) {
    items.push({
      label: `Offline ${Math.abs(row.offlineDeltaYd)} yd ${row.offlineDeltaYd <= 0 ? "tighter" : "wider"}`,
      tone: row.offlineDeltaYd <= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.ballSpeedDeltaMph, 0.3)) {
    items.push({
      label: `Ball speed ${formatSigned(row.ballSpeedDeltaMph)} mph`,
      tone: row.ballSpeedDeltaMph >= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.launchDeltaDeg, 0.3)) {
    items.push({
      label: `Launch ${formatSigned(row.launchDeltaDeg)} deg`,
      tone: "sky",
    });
  }

  return items;
}

function heroVerdict(summary: ProgressSummary) {
  if (summary.totals.trackedCleanShots === 0) {
    return "Import clean stock shots to build your first progress baseline.";
  }

  const trusted = summary.rankings.mostTrusted;
  const tighter = strongestDispersionImprovement(summary.clubRows);
  const needsWork = summary.rankings.needsWork;
  const dataGap = summary.dataGaps[0];
  const goodClubs = uniqueClubLabels([trusted, tighter]).slice(0, 2);
  const holdBack = uniqueClubLabels([needsWork, dataGap]).slice(0, 2);

  if (goodClubs.length > 0 && holdBack.length > 0) {
    return `Compared with your personal baseline, the bag is moving forward. ${formatClubList(goodClubs)} ${goodClubs.length === 1 ? "is" : "are"} trending well, but ${formatClubList(holdBack)} ${holdBack.length === 1 ? "needs" : "need"} work.`;
  }

  return "Compared with your personal baseline, the bag is moving forward. Keep building clean stock-shot depth so the weak spots separate clearly.";
}

function weeklySessionsLabel(weeklyRecap: FeatureIdeasData["weeklyRecap"]) {
  const match = `${weeklyRecap.coachNote} ${weeklyRecap.detail}`.match(/(\d[\d,]*)\s+sessions?/i);
  return match ? `${match[1]} sessions` : "Current sessions";
}

function weeklyReadout(summary: ProgressSummary) {
  const bestClub = summary.rankings.mostTrusted ?? summary.rankings.mostImproved;
  const bestSignal = summary.bestSignal;
  const dataGap = summary.dataGaps[0];
  const needsWork = summary.rankings.needsWork;

  if (bestClub && bestSignal && dataGap) {
    return `${formatClubType(bestClub.clubType)} remains the strongest club, ${bestSignal.value.replace(/\.$/, "")}, and ${formatClubType(dataGap.clubType)} still needs a clean stock baseline.`;
  }

  if (bestClub && needsWork) {
    return `${formatClubType(bestClub.clubType)} remains the strongest club, while ${formatClubType(needsWork.clubType)} still needs attention.`;
  }

  return "Keep building comparable stock-shot samples so the strongest club, weakest signal and next practice target separate clearly.";
}

function bestClubDetail(row: ProgressClubRow, summary: ProgressSummary) {
  const isMostTrusted = row.clubId === summary.rankings.mostTrusted?.clubId;
  const isBestMovement = row.clubId === summary.rankings.mostImproved?.clubId;

  if (isMostTrusted && isBestMovement) {
    return "Most trusted and strongest movement";
  }

  if (isMostTrusted) {
    return `${row.trustIndex}% trust · ${row.sampleSize} clean shots`;
  }

  return improvementDetail(row);
}

function nextGoalDetail(priority: PracticePriority | undefined) {
  if (!priority) {
    return "Import clean stock shots to unlock the next target";
  }

  if (priority.title.toLowerCase().includes("baseline")) {
    return "10 full stock shots needed";
  }

  return priority.reason;
}

function practiceReasonCopy(priority: PracticePriority) {
  if (priority.title.toLowerCase().includes("baseline")) {
    return `${formatClubType(priority.clubType)} needs 10 clean full-stock shots before the app can trust its carry and direction baseline.`;
  }

  return priority.reason;
}

function practiceCtaLabel(priority: PracticePriority) {
  if (priority.title.toLowerCase().includes("baseline")) {
    return `Start ${formatClubType(priority.clubType)} baseline`;
  }

  return "Start practice";
}

function compactPracticeTitle(title: string) {
  return title
    .replace(/\b20-minute\b/gi, "")
    .replace(/\bplan\b/gi, "plan")
    .replace(/\s+/g, " ")
    .trim();
}

function strongestImprovementRow(summary: ProgressSummary) {
  return strongestDispersionImprovement(summary.clubRows) ?? summary.rankings.mostImproved;
}

function strongestDispersionImprovement(rows: ProgressClubRow[]) {
  return [...rows]
    .filter((row) => row.sampleSize >= 6 && row.offlineDeltaYd !== null && row.offlineDeltaYd <= -2)
    .sort((left, right) => Math.abs(right.offlineDeltaYd ?? 0) - Math.abs(left.offlineDeltaYd ?? 0))[0] ?? null;
}

function strongestImprovementDetail(row: ProgressClubRow) {
  if (row.offlineDeltaYd !== null && row.offlineDeltaYd <= -2) {
    return `Dispersion improved by ${numberFormatter.format(Math.abs(row.offlineDeltaYd))} yd`;
  }

  return improvementDetail(row);
}

function bestMovementDetail(row: ProgressClubRow) {
  if (row.carryDeltaYd !== null && row.carryDeltaYd >= 1) {
    const control =
      row.offlineDeltaYd === null || Math.abs(row.offlineDeltaYd) < 2
        ? "control broadly stable"
        : row.offlineDeltaYd <= -2
          ? "dispersion tighter"
          : "control needs watching";
    return `${formatSigned(row.carryDeltaYd)} yd carry · ${control}`;
  }

  return improvementDetail(row);
}

function offlineMovementNote(row: ProgressClubRow) {
  if (row.offlineDeltaYd === null || Math.abs(row.offlineDeltaYd) < 0.1) {
    return undefined;
  }

  const direction = row.offlineDeltaYd <= 0 ? "tightened" : "widened";
  return `Offline ${direction} by ${numberFormatter.format(Math.abs(row.offlineDeltaYd))} yd.`;
}

function trendVerdict(trend: ProgressTrend, summary: ProgressSummary) {
  switch (trend.label) {
    case "Trust by club": {
      const reliable = summary.trustLadder
        .filter((item) => (item.trustIndex ?? 0) >= 66)
        .slice(0, 3)
        .map((item) => formatClubType(item.clubType));
      const dataGap = summary.dataGaps[0];
      const reliableClause = reliable.length ? `${formatClubList(reliable)} ${reliable.length === 1 ? "is" : "are"} reliable` : "Trust is still forming";
      const gapClause = dataGap ? `; ${formatClubType(dataGap.clubType)} still needs data.` : ".";
      return `Trust is uneven. ${reliableClause}${gapClause}`;
    }
    case "Offline movement":
      return trend.tone === "green"
        ? "Average offline is improving against the first clean baseline."
        : "Average offline needs another cleaner block before calling it tighter.";
    case "Carry movement": {
      const carryLeader = [...summary.clubRows]
        .filter((row) => row.carryDeltaYd !== null)
        .sort((left, right) => (right.carryDeltaYd ?? 0) - (left.carryDeltaYd ?? 0))[0];
      return carryLeader
        ? `Bag-average carry is moving, led by ${formatClubType(carryLeader.clubType)}.`
        : "Bag-average carry needs more comparable clean baselines.";
    }
    case "Playable rate":
      return "Playable rate remains strong across clubs with enough direction data.";
    default:
      return trend.detail;
  }
}

function trendFootnote(trend: ProgressTrend, summary: ProgressSummary) {
  if (trend.label !== "Trust by club" || summary.dataGaps.length === 0) {
    return null;
  }

  return `Final dip reflects ${formatClubType(summary.dataGaps[0].clubType)} data gap.`;
}

function bagMovementSummary(rows: ProgressClubRow[]) {
  const carryLeader = [...rows]
    .filter((row) => row.carryDeltaYd !== null)
    .sort((left, right) => (right.carryDeltaYd ?? 0) - (left.carryDeltaYd ?? 0))[0];
  const tighterLeader = strongestDispersionImprovement(rows);
  const needsWork = [...rows]
    .filter((row) => row.sampleSize >= 3)
    .sort((left, right) => left.trustIndex - right.trustIndex)[0];
  const parts = [
    carryLeader ? `${formatClubType(carryLeader.clubType)} gained the most carry` : null,
    tighterLeader ? `${formatClubType(tighterLeader.clubType)} tightened dispersion` : null,
    needsWork ? `${formatClubType(needsWork.clubType)} remains the lowest-trust club with enough clean shots` : null,
  ].filter(Boolean);

  return parts.length ? `${parts.join(", ")}.` : "Latest clean baseline vs first clean baseline. Offline going down is good.";
}

function bagRowMarkerClass(row: ProgressClubRow) {
  if (row.sampleSize < 10 || row.confidenceLabel === "Not enough data") {
    return "border-slate-300";
  }

  if (row.trustIndex <= 62) {
    return "border-amber-400";
  }

  if (row.offlineDeltaYd !== null && row.offlineDeltaYd <= -2) {
    return "border-sky-400";
  }

  if (row.carryDeltaYd !== null && row.carryDeltaYd >= 5) {
    return "border-emerald-500";
  }

  return "border-transparent";
}

function uniqueClubLabels(values: Array<{ clubType: string } | null | undefined>) {
  const labels: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const label = formatClubType(value.clubType);
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }

  return labels;
}

function formatClubList(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "The bag";
  }

  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function isMeaningful(value: number | null, threshold: number): value is number {
  return value !== null && Math.abs(value) >= threshold;
}

function roundForSvg(value: number) {
  return Math.round(value * 10) / 10;
}

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  slate: "bg-slate-50 text-slate-700 ring-slate-200",
};

const compactToneClasses: Record<Tone, string> = {
  green: "bg-emerald-500 ring-emerald-100",
  sky: "bg-sky-500 ring-sky-100",
  pink: "bg-pink-500 ring-pink-100",
  amber: "bg-amber-500 ring-amber-100",
  slate: "bg-slate-400 ring-slate-200",
};

function strokeForTone(tone: Tone) {
  const strokes: Record<Tone, string> = {
    green: "#0B7A3B",
    sky: "#0284C7",
    pink: "#BE185D",
    amber: "#B45309",
    slate: "#64748B",
  };

  return strokes[tone];
}

function findAnalytics(
  clubs: Array<{ clubId: string; analytics: ClubAnalytics }>,
  clubId: string,
) {
  return clubs.find((club) => club.clubId === clubId)?.analytics;
}

function improvementDetail(row: ProgressClubRow) {
  const parts = [
    row.carryDeltaYd === null ? null : `${formatSigned(row.carryDeltaYd)} yd carry`,
    row.offlineDeltaYd === null
      ? null
      : `${Math.abs(row.offlineDeltaYd)} yd ${row.offlineDeltaYd <= 0 ? "tighter" : "wider"}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : `${row.trustIndex}% trust`;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}
