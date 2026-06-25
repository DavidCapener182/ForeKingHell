import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  HelpCircle,
  LineChart,
  Bookmark,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { DataPair, DataPanel, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { MobileRouteHeader, MobileTabBar } from "@/components/mobile-sports";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
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
  type CurrentFormSignal,
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
      <style>{`
        @media (min-width: 1024px) {
          .progress-bento-grid {
            grid-template-columns: repeat(12, minmax(0, 1fr));
            align-items: stretch;
          }

          .progress-bento-item {
            min-width: 0;
            height: 100%;
          }

          .progress-bento-item > * {
            height: 100%;
          }

          .progress-span-3 {
            grid-column: span 3 / span 3;
          }

          .progress-span-5 {
            grid-column: span 5 / span 5;
          }

          .progress-span-6 {
            grid-column: span 6 / span 6;
          }

          .progress-span-7 {
            grid-column: span 7 / span 7;
          }

          .progress-span-9 {
            grid-column: span 9 / span 9;
          }

          .progress-span-12 {
            grid-column: span 12 / span 12;
          }
        }
      `}</style>
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

      <ProgressHeroPanel summary={summary} mostImproved={mostImproved} />

      {data.clubs.length === 0 ? (
        <>
          <DataPanel>
            <CardContent className="flex flex-col items-center gap-3 py-7 text-center sm:gap-4 sm:py-14">
              <Sparkles className="size-8 text-emerald-500 sm:size-9" />
              <div>
                <p className="text-lg font-semibold sm:text-xl">No progress baseline yet</p>
                <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground sm:leading-6">
                  Import a Rapsodo CSV and LM World Tour will build first-vs-latest club comparisons
                  automatically.
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
                  <span className="text-sm leading-5 text-muted-foreground">
                    {step.description}
                  </span>
                </Link>
              );
            })}
          </section>
        </>
      ) : (
        <>
          <MobileProgressFirstCard summary={summary} />
          <div className="progress-bento-grid grid gap-4 lg:gap-5">
            <ProgressBentoItem span={12}>
              <WeeklyRecapPanel data={featureData} summary={summary} />
            </ProgressBentoItem>
            <ProgressBentoItem span={12}>
              <ComparisonBar summary={summary} />
            </ProgressBentoItem>
            <ProgressBentoItem span={6}>
              <ProgressSignalsPanel summary={summary} clubs={data.clubs} />
            </ProgressBentoItem>
            <ProgressBentoItem span={6}>
              <ProgressTrendsPanel summary={summary} />
            </ProgressBentoItem>
            <ProgressBentoItem span={6}>
              <PracticePlanPanel priorities={summary.practicePlan} />
            </ProgressBentoItem>
            <ProgressBentoItem span={6}>
              <CoachReadoutPanel
                signal={summary.bestSignal}
                groups={summary.coachSummary}
                gaps={summary.dataGaps}
              />
            </ProgressBentoItem>
            <ProgressBentoItem span={9}>
              <BagMovementPanel rows={summary.clubRows} />
            </ProgressBentoItem>
            <ProgressBentoItem span={3}>
              <TrustLadderPanel items={summary.trustLadder} />
            </ProgressBentoItem>
            <ProgressBentoItem span={12}>
              <div id="journey" className="h-full scroll-mt-28">
                <JourneyPanel events={summary.journey} />
              </div>
            </ProgressBentoItem>
          </div>
        </>
      )}
    </PageShell>
  );
}

type ProgressSpan = 3 | 5 | 6 | 7 | 9 | 12;

function ProgressBentoItem({ span, children }: { span: ProgressSpan; children: ReactNode }) {
  return <div className={`progress-bento-item progress-span-${span}`}>{children}</div>;
}

function ProgressHeroPanel({
  summary,
  mostImproved,
}: {
  summary: ProgressSummary;
  mostImproved: ProgressClubRow | null;
}) {
  const metrics = [
    {
      label: "Clean stock shots",
      value: integerFormatter.format(summary.totals.trackedCleanShots),
      detail: "Used for progress checks",
      icon: Sparkles,
    },
    {
      label: "Tracked clubs",
      value: integerFormatter.format(summary.totals.clubs),
      detail: `${integerFormatter.format(summary.totals.shots)} launch monitor rows`,
      icon: Target,
    },
    {
      label: "Average trust",
      value: `${summary.totals.averageTrust}%`,
      detail: "Distance, direction, strike and sample depth",
      icon: ShieldCheck,
    },
    {
      label: "Playable rate",
      value: formatRate(summary.totals.averagePlayableRate),
      detail: "Across clubs with enough direction data",
      icon: BarChart3,
    },
  ];

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#DFE7DF] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.055)]">
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:px-7">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
              Personal baseline
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
              Progress verdict: Improving, but uneven
            </span>
          </div>
          <h1 className="mt-4 text-[26px] font-bold leading-8 tracking-normal text-[#111827] sm:text-3xl sm:leading-10">
            Bag progress
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#667085]">
            {heroVerdict(summary)}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-1">
          <div className="flex items-center justify-start lg:justify-end">
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-lg border-[#087A3D] bg-white px-5 text-sm font-semibold text-[#087A3D] shadow-sm hover:bg-emerald-50 hover:text-[#065F32]"
            >
              <Link
                href={mostImproved ? `/bag/${mostImproved.clubId}/analytics` : "/import"}
                prefetch={false}
              >
                {mostImproved ? <Brain className="size-4" /> : <Upload className="size-4" />}
                {mostImproved ? "View supporting shots" : "Import first CSV"}
              </Link>
            </Button>
          </div>
          <div className="hidden h-28 overflow-hidden rounded-lg sm:block">
            <PageArtwork variant="progress" alt="" className="h-full min-h-28" />
          </div>
        </div>
      </div>
      <div className="grid border-t border-[#EDF1ED] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-7">
        {metrics.map((metric, index) => (
          <ProgressHeroMetric
            key={metric.label}
            metric={metric}
            className={index > 0 ? "border-t sm:border-l sm:border-t-0" : ""}
          />
        ))}
      </div>
    </section>
  );
}

function ProgressHeroMetric({
  metric,
  className,
}: {
  metric: {
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
  };
  className?: string;
}) {
  const Icon = metric.icon;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-[#DFE7DF] px-3 py-3",
        className,
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#E8F7EE] text-[#087A3D]">
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">
          {metric.label}
        </p>
        <p className="mt-1 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
          {metric.value}
        </p>
        <p className="mt-1 text-sm leading-5 text-[#667085]">{metric.detail}</p>
      </div>
    </div>
  );
}

function WeeklyRecapPanel({ data, summary }: { data: FeatureIdeasData; summary: ProgressSummary }) {
  const longTermTrust = summary.rankings.mostTrusted ?? summary.rankings.mostImproved;
  const currentForm = summary.rankings.currentForm;
  const weakestSignal = summary.rankings.needsWork;
  const topPriority = summary.practicePlan[0];
  const sessionsLabel = weeklySessionsLabel(data.weeklyRecap);
  const weeklyRead = weeklyReadout(summary);

  return (
    <section className="flex h-full flex-col rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-7 tracking-normal text-[#111827]">
            Weekly recap
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#667085]">
            {data.weeklyRecap.metric} · {sessionsLabel} · Personal baseline comparison
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CFE7D6] bg-[#F8FCF9] px-4 text-sm font-semibold text-[#087A3D]">
            <HelpCircle className="size-4" />
            How recap works
          </span>
          <form action={saveCurrentWeeklyRecapAction}>
            <Button
              type="submit"
              variant="outline"
              className="h-10 rounded-lg border-[#DFE7DF] bg-white px-4 text-sm font-semibold"
            >
              <Bookmark className="size-4" />
              Save weekly recap
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-4 grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid gap-3">
          <div className="grid gap-2 lg:grid-cols-2">
            <WeeklyRecapNotice
              icon={TrendingUp}
              text={`${sessionsLabel} in this week's sample. Keep the next goal tight and measurable.`}
            />
            <WeeklyRecapNotice
              icon={Sparkles}
              text={
                <>
                  <span className="font-semibold text-[#111827]">This week&apos;s read: </span>
                  {weeklyRead}
                </>
              }
            />
          </div>

          <div className="grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <WeeklyRecapCard
              label="Long-term trust"
              value={
                longTermTrust ? formatClubType(longTermTrust.clubType) : data.weeklyRecap.bestClub
              }
              detail={
                longTermTrust
                  ? longTermTrustDetail(longTermTrust, summary)
                  : "Keep building clean stock-shot samples"
              }
              href={longTermTrust ? `/bag/${longTermTrust.clubId}/analytics` : undefined}
              tone="green"
              icon={Trophy}
            />
            <WeeklyRecapCard
              label="Current form"
              value={currentForm ? formatClubType(currentForm.clubType) : "Needs sample"}
              detail={
                currentForm
                  ? currentFormDetail(currentForm)
                  : "Latest-session form appears after 3+ clean shots"
              }
              href={currentForm ? `/bag/${currentForm.clubId}/analytics` : undefined}
              tone={currentForm?.tone ?? "slate"}
              icon={Sparkles}
            />
            <WeeklyRecapCard
              label="Weakest signal"
              value={weakestSignal ? formatClubType(weakestSignal.clubType) : "Needs sample"}
              detail={
                weakestSignal
                  ? `${weakestSignal.trustIndex}% trust · lowest reliable-data club`
                  : "Review the next clean baseline"
              }
              href={weakestSignal ? `/bag/${weakestSignal.clubId}/analytics` : undefined}
              tone="amber"
              icon={TrendingDown}
            />
            <WeeklyRecapCard
              label="Next goal"
              value={topPriority?.title ?? "Build next baseline"}
              detail={nextGoalDetail(topPriority)}
              href={topPriority ? `/bag/${topPriority.clubId}/analytics` : "/import"}
              tone={topPriority?.tone ?? "slate"}
              icon={Target}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#DFE7DF] bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#111827]">Practice plan calendar</p>
            <span className="rounded-full border border-[#E5E7EB] bg-slate-50 px-3 py-1 text-sm font-semibold text-[#475467]">
              {data.practiceCalendar.length} planned
            </span>
          </div>
          <div
            aria-label="Practice plan calendar"
            tabIndex={0}
            className="mt-3 grid gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {data.practiceCalendar.slice(0, 4).map((item) => (
              <div
                key={`${item.title}-${item.date.toISOString()}`}
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5"
              >
                <span className="grid size-9 place-items-center rounded-full bg-[#E8F7EE] text-[#087A3D]">
                  <CalendarDays className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                    {shortDateFormatter.format(item.date)}
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold text-[#111827]">
                    {compactPracticeTitle(item.title)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WeeklyRecapNotice({ icon: Icon, text }: { icon: LucideIcon; text: ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[#CFE7D6] bg-[#F8FCF9] px-3 py-2 text-sm leading-6 text-[#475467]">
      <span className="grid size-8 place-items-center rounded-full bg-[#E8F7EE] text-[#087A3D]">
        <Icon className="size-4" />
      </span>
      <p>{text}</p>
    </div>
  );
}

function WeeklyRecapCard({
  label,
  value,
  detail,
  href,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
  tone: Tone;
  icon: LucideIcon;
}) {
  const content = (
    <div
      className={cn(
        "grid h-full min-h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border p-4 transition-colors hover:border-emerald-300",
        weeklyRecapToneStyles[tone].card,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-[0.12em]",
              weeklyRecapToneStyles[tone].label,
            )}
          >
            {label}
          </p>
          <span className={cn("size-2 rounded-full", compactToneClasses[tone].split(" ")[0])} />
        </div>
        <p className="mt-2 text-lg font-bold leading-6 tracking-normal text-[#111827]">{value}</p>
        <p className="mt-2 text-sm leading-5 text-[#475467]">{detail}</p>
      </div>
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          weeklyRecapToneStyles[tone].icon,
        )}
      >
        <Icon className="size-6" />
      </span>
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}

const weeklyRecapToneStyles: Record<Tone, { card: string; label: string; icon: string }> = {
  green: {
    card: "border-emerald-200 bg-[#F8FCF9]",
    label: "text-emerald-800",
    icon: "bg-emerald-50 text-emerald-700",
  },
  sky: {
    card: "border-sky-200 bg-[#F8FBFF]",
    label: "text-sky-800",
    icon: "bg-sky-50 text-sky-700",
  },
  pink: {
    card: "border-pink-200 bg-pink-50/35",
    label: "text-pink-800",
    icon: "bg-pink-50 text-pink-700",
  },
  amber: {
    card: "border-amber-200 bg-[#FFFBF4]",
    label: "text-amber-800",
    icon: "bg-amber-50 text-amber-800",
  },
  slate: {
    card: "border-slate-200 bg-slate-50/60",
    label: "text-slate-700",
    icon: "bg-slate-100 text-slate-600",
  },
};

function MobileProgressFirstCard({ summary }: { summary: ProgressSummary }) {
  const mostImproved = summary.rankings.mostImproved;
  const needsWork = summary.rankings.needsWork;

  return (
    <section className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 sm:hidden">
      <div>
        <p className="text-sm font-semibold text-[#0B7A3B]">This week</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal">
          {mostImproved
            ? `${formatClubType(mostImproved.clubType)} is moving best`
            : "Build a comparable baseline"}
        </h2>
        <p className="mt-2 text-sm leading-5 text-[#6B7280]">
          {needsWork
            ? `${formatClubType(needsWork.clubType)} is the biggest drop: ${needsWork.primaryMiss.toLowerCase()} miss, ${needsWork.trustIndex}% trust.`
            : "Import another session to separate best improvement, biggest drop and next action."}
        </p>
      </div>
      <Button
        asChild
        className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
        data-primary-action
      >
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
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Comparison
        </p>
        <p className="mt-1 font-semibold">Progress controls</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Compared with
        </p>
        <p className="mt-1 font-semibold">Personal baseline</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Period
        </p>
        <p className="mt-1 font-semibold">All saved data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Confidence: based on {integerFormatter.format(summary.totals.trackedCleanShots)} clean
          stock shots
        </p>
      </div>
      <div
        aria-label="Progress period"
        className="inline-flex w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-sm text-muted-foreground sm:justify-self-end"
      >
        <span className="rounded-md bg-background px-2.5 py-1 font-medium text-foreground shadow-sm">
          All data
        </span>
        <span className="px-2.5 py-1 font-medium">Last 30 days</span>
        <span className="px-2.5 py-1 font-medium">Last 10 sessions</span>
      </div>
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
  const currentForm = summary.rankings.currentForm;

  return (
    <section className="rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
      <ProgressSectionHeader
        icon={TrendingUp}
        title="Progress signals"
        description="The clearest gains, risks and priorities from the current comparison."
        tone="green"
      />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
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
          detail={
            mainConcern
              ? `${mainConcern.trustIndex}% trust · lowest trust club with usable data`
              : "No weak signal has separated yet"
          }
          href={mainConcern ? `/bag/${mainConcern.clubId}/analytics` : undefined}
          tone="amber"
        />
      </div>
      <div className="mt-4 grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2">
        <SignalSummaryCard
          label="Long-term trust"
          value={mostReliable ? formatClubType(mostReliable.clubType) : "--"}
          detail={
            mostReliable
              ? `${mostReliable.trustIndex}% trust · ${mostReliable.sampleSize} clean shots`
              : "Need more shots"
          }
          href={mostReliable ? `/bag/${mostReliable.clubId}/analytics` : undefined}
          icon={Gauge}
          tone="sky"
        />
        <SignalSummaryCard
          label="Current form"
          value={currentForm ? formatClubType(currentForm.clubType) : "--"}
          detail={currentForm ? currentFormDetail(currentForm) : "Need latest-session clean shots"}
          href={currentForm ? `/bag/${currentForm.clubId}/analytics` : undefined}
          icon={Sparkles}
          tone={currentForm?.tone ?? "slate"}
        />
        <SignalSummaryCard
          label="Strongest improvement"
          value={strongestImprovement ? formatClubType(strongestImprovement.clubType) : "--"}
          detail={
            strongestImprovement
              ? strongestImprovementDetail(strongestImprovement)
              : "Need comparable baselines"
          }
          href={strongestImprovement ? `/bag/${strongestImprovement.clubId}/analytics` : undefined}
          icon={TrendingUp}
          tone="green"
        />
        <SignalSummaryCard
          label="Most volatile"
          value={mostVolatile ? formatClubType(mostVolatile.clubType) : "--"}
          detail={
            mostVolatile
              ? `${formatRate(findAnalytics(clubs, mostVolatile.clubId)?.accuracy.bigMissRate ?? null)} big miss rate`
              : "Need side-carry data"
          }
          href={mostVolatile ? `/bag/${mostVolatile.clubId}/analytics` : undefined}
          icon={TrendingDown}
          tone="pink"
        />
      </div>
    </section>
  );
}

function ProgressSectionHeader({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: Tone;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl border",
            progressIconToneStyles[tone],
          )}
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-7 tracking-normal text-[#111827]">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#667085]">{description}</p>
        </div>
      </div>
      <span
        className={cn(
          "hidden size-10 shrink-0 place-items-center rounded-xl border sm:grid",
          progressIconToneStyles[tone],
        )}
      >
        <Icon className="size-5" />
      </span>
    </div>
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
    <div
      className={cn(
        "grid h-full min-h-32 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border p-4 transition-colors hover:border-emerald-300",
        progressSignalToneStyles[tone].card,
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          progressSignalToneStyles[tone].icon,
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.14em]",
            progressSignalToneStyles[tone].label,
          )}
        >
          {label}
        </p>
        <p className="mt-1.5 text-xl font-bold leading-7 tracking-normal text-[#111827]">{value}</p>
        <p className="mt-3 text-sm leading-5 text-[#475467]">
          <EmphasizedLead text={detail} tone={tone} />
        </p>
        {note ? <p className="mt-1.5 text-xs leading-5 text-[#667085]">{note}</p> : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}

function SignalSummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href?: string;
  tone: Tone;
}) {
  const content = (
    <div className="grid h-full min-h-28 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[#DFE7DF] bg-white p-4 transition-colors hover:border-emerald-300">
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          progressSignalToneStyles[tone].icon,
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm leading-5 text-[#667085]">{label}</p>
        <p className="mt-1 text-lg font-bold leading-6 tracking-normal text-[#111827]">{value}</p>
        <p className="mt-2 text-sm leading-5 text-[#475467]">{detail}</p>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}

function EmphasizedLead({ text, tone }: { text: string; tone: Tone }) {
  const match = text.match(/^([+-]?\d+(?:\.\d+)?%?|[+-]?\d+(?:\.\d+)?\s?yd)(.*)$/i);

  if (!match) {
    return text;
  }

  return (
    <>
      <span className={cn("font-bold", progressSignalToneStyles[tone].emphasis)}>{match[1]}</span>
      {match[2]}
    </>
  );
}

function ProgressTrendsPanel({ summary }: { summary: ProgressSummary }) {
  return (
    <section
      id="trends"
      className="flex h-full scroll-mt-28 flex-col rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6"
    >
      <ProgressSectionHeader
        icon={LineChart}
        title="Progress trends"
        description="Movement from the first clean baseline to the latest clean baseline."
        tone="sky"
      />
      <div className="mt-5 grid flex-1 auto-rows-fr gap-3 md:grid-cols-2">
        {summary.trends.map((trend) => (
          <TrendCard key={trend.label} trend={trend} summary={summary} />
        ))}
      </div>
    </section>
  );
}

function TrendCard({ trend, summary }: { trend: ProgressTrend; summary: ProgressSummary }) {
  return (
    <div className="flex h-full min-h-44 flex-col rounded-xl border border-[#DFE7DF] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-[#667085]">
            {trend.label}
          </p>
          <p className="mt-1 text-xl font-bold leading-7 tracking-normal text-[#111827]">
            {trend.value}
          </p>
        </div>
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg border",
            progressIconToneStyles[trend.tone],
          )}
        >
          <BarChart3 className="size-4" />
        </div>
      </div>
      <Sparkline points={trend.points} tone={trend.tone} />
      <p className="mt-3 text-sm leading-5 text-[#475467]">{trendVerdict(trend, summary)}</p>
      {trendFootnote(trend, summary) ? (
        <p className="mt-1 text-xs leading-5 text-[#667085]">{trendFootnote(trend, summary)}</p>
      ) : null}
    </div>
  );
}

function Sparkline({ points, tone }: { points: number[]; tone: Tone }) {
  if (points.length < 2) {
    return (
      <div className="mt-3 grid h-16 place-items-center rounded-lg bg-slate-50 text-xs text-muted-foreground">
        More data needed
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 180;
  const height = 64;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point - min) / range) * (height - 10) - 5;

    return `${roundForSvg(x)},${roundForSvg(y)}`;
  });
  const lastPoint = coordinates[coordinates.length - 1]?.split(",").map(Number) ?? [
    width,
    height / 2,
  ];

  return (
    <div className="mt-3 rounded-lg bg-white px-2 py-1">
      <svg
        className="h-16 w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Trend line"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          x2={width}
          y1={height * 0.35}
          y2={height * 0.35}
          stroke="#D9E1E7"
          strokeDasharray="4 7"
          strokeWidth="1"
        />
        <line
          x1="0"
          x2={width}
          y1={height * 0.72}
          y2={height * 0.72}
          stroke="#D9E1E7"
          strokeDasharray="4 7"
          strokeWidth="1"
        />
        <polyline
          fill="none"
          points={coordinates.join(" ")}
          stroke={strokeForTone(tone)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={lastPoint[0]}
          cy={lastPoint[1]}
          r="4"
          fill={strokeForTone(tone)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function PracticePlanPanel({ priorities }: { priorities: PracticePriority[] }) {
  const [topPriority] = priorities;
  const visiblePriorityCount = Math.min(priorities.length, 5);

  return (
    <section className="flex h-full flex-col rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
      {topPriority ? (
        <div className="grid min-h-0 items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <PracticePriorityFeatureCard priority={topPriority} />
          <div className="flex min-h-0 flex-col rounded-xl border border-[#DFE7DF] bg-slate-50/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111827]">Ranked priorities</p>
                <p className="text-xs leading-5 text-[#667085]">
                  Priority 1 starts the queue. Scroll for the rest.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#475467]">
                {visiblePriorityCount} visible / {priorities.length}
              </span>
            </div>
            <div className="min-h-0 max-h-[31rem] overflow-y-auto pr-1 [scrollbar-gutter:stable]">
              <div className="grid gap-2.5">
                {priorities.map((priority, index) => (
                  <PracticePriorityCompactCard
                    key={priority.clubId}
                    priority={priority}
                    index={index + 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-muted-foreground">
          Import clean stock shots to unlock a ranked practice plan.
        </div>
      )}
    </section>
  );
}

function PracticePriorityFeatureCard({ priority }: { priority: PracticePriority }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-[linear-gradient(135deg,#F7FCF9_0%,#FFFFFF_100%)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            Priority 1 focus
          </Badge>
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-normal text-[#111827]">
            {priority.title}
          </h2>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-semibold",
            priorityLabelClass(priority.tone),
          )}
        >
          {priority.priorityLabel}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        <PracticeHeroArtwork />
        <div className="grid gap-3 sm:grid-cols-2">
          <PracticeInfoBlock icon={HelpCircle} label="Why" text={practiceReasonCopy(priority)} />
          <PracticeInfoBlock icon={ClipboardCheck} label="Task" text={priority.drill} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#111827]">
          <span className="flex items-center gap-2 font-medium">
            Coach score
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold">
              {priority.score}
            </span>
          </span>
          <span className="mt-1 block text-xs leading-4 text-[#667085]">
            Higher means practice this sooner.
          </span>
        </span>
        <Button
          asChild
          className="h-10 rounded-lg bg-[#087A3D] px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(8,122,61,0.18)] hover:bg-[#065F32]"
        >
          <Link href={`/bag/${priority.clubId}/analytics`} prefetch={false}>
            <Target className="size-4" />
            {practiceCtaLabel(priority)}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PracticeHeroArtwork() {
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50">
      <Image
        src="/assets/generated/progress-practice-green.png"
        alt=""
        fill
        sizes="(min-width: 1280px) 320px, 90vw"
        className="scale-[1.03] object-cover"
        priority={false}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/5 via-transparent to-white/5" />
    </div>
  );
}

function PracticeInfoBlock({
  icon: Icon,
  label,
  text,
}: {
  icon: LucideIcon;
  label: string;
  text: string;
}) {
  return (
    <div className="grid min-h-24 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-[#DFE7DF] bg-white p-3">
      <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-800">{label}</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[#111827]">{text}</p>
      </div>
    </div>
  );
}

function priorityLabelClass(tone: Tone) {
  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function PracticePriorityThumb({ priority, index }: { priority: PracticePriority; index: number }) {
  const variant = index === 2 ? "course" : index === 3 ? "target" : "club";
  const isStrikeImage = priority.title.toLowerCase().includes("strike");

  return (
    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-50">
      {variant === "course" ? (
        <>
          <PracticeGreenThumbArtwork />
          <span className="absolute inset-0 bg-emerald-950/5" />
        </>
      ) : null}
      {variant === "target" ? <TargetGridArtwork /> : null}
      {variant === "club" ? (
        isStrikeImage ? (
          <Image
            src="/assets/generated/progress-9i-face-strike.png"
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <ClubArtwork
            clubType={priority.clubType}
            alt=""
            className="size-full rounded-full border-0 bg-transparent"
            imageClassName="px-2 py-2"
            sizes="40px"
            showGroundLine={false}
          />
        )
      ) : null}
    </span>
  );
}

function PracticeGreenThumbArtwork() {
  return (
    <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="80" height="80" fill="#EAF7EE" />
      <path d="M0 61C14 54 30 50 49 49C61 48 71 50 80 55V80H0Z" fill="#8FC86F" />
      <path d="M0 53C14 44 33 39 58 39C67 39 75 40 80 42V69H0Z" fill="#B7DE8B" />
      <ellipse cx="48" cy="43" rx="21" ry="11" fill="#DDF3C4" />
      <path d="M49 24V42" stroke="#0B7A3B" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M49 24C54 26 59 29 63 33C57 34 53 36 49 39Z" fill="#EF4444" />
      <circle cx="35" cy="43" r="2.4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.2" />
    </svg>
  );
}

function TargetGridArtwork() {
  return (
    <svg viewBox="0 0 80 80" className="size-full" aria-hidden="true">
      <rect width="80" height="80" fill="#F8F3E9" />
      <path d="M40 0v80M0 40h80" stroke="#64748B" strokeDasharray="3 4" strokeWidth="1" />
      <path d="M20 0v80M60 0v80M0 20h80M0 60h80" stroke="#D6D3CA" strokeWidth="1" />
      <circle cx="40" cy="40" r="4" fill="#087A3D" />
      <circle cx="26" cy="42" r="3" fill="#8ACB75" />
      <circle cx="54" cy="28" r="3" fill="#8ACB75" />
      <circle cx="57" cy="50" r="3" fill="#8ACB75" />
      <circle cx="34" cy="26" r="3" fill="#8ACB75" />
    </svg>
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
      className={cn(
        "grid min-h-[5.25rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-xl border p-2.5 transition-colors hover:border-emerald-300",
        index === 1 ? "border-emerald-200 bg-emerald-50/60" : "border-[#DFE7DF] bg-white",
      )}
    >
      <PracticePriorityThumb priority={priority} index={index} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className="bg-white">
            Priority {index}
          </Badge>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
              priorityLabelClass(priority.tone),
            )}
          >
            {priority.priorityLabel}
          </span>
        </div>
        <h2 className="mt-1 line-clamp-1 text-sm font-bold leading-5 tracking-normal text-[#111827]">
          {priority.title}
        </h2>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs leading-5 text-[#667085]">
            {practiceReasonCopy(priority)}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
            <Target className="size-4" />
            {priority.score}
          </span>
        </div>
      </div>
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
    <section className="flex h-full flex-col rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <MessageSquare className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-7 tracking-normal text-[#111827]">
              Coach readout
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#667085]">
              A plain-English readout of what is improving, what needs attention and what to
              practise next.
            </p>
          </div>
        </div>
        <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald-600" />
      </div>
      <div className="mt-5 grid flex-1 gap-4">
        {signal ? (
          <BestSignalBanner signal={signal} />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-muted-foreground">
            No best signal has separated yet. Keep importing comparable stock-shot sessions.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => (
            <div
              key={group.title}
              className={cn("min-w-0", group.title === "Data gaps" ? "md:col-span-2" : "")}
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={cn("size-2.5 rounded-full ring-4", compactToneClasses[group.tone])}
                />
                <h2 className="font-semibold tracking-normal">{group.title}</h2>
              </div>
              <div className="space-y-3">
                {group.title === "Data gaps" && gaps.length > 0
                  ? gaps.slice(0, 2).map((gap) => <DataGapRichCard key={gap.clubId} gap={gap} />)
                  : group.items.map((item, index) => {
                      const content = (
                        <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <span className="min-w-0">
                            <p className="text-sm font-medium leading-5">{item.label}</p>
                            {item.detail ? (
                              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                                {item.detail}
                              </p>
                            ) : null}
                          </span>
                          <CoachItemIcon tone={group.tone} />
                        </div>
                      );

                      return item.clubId ? (
                        <Link
                          key={`${group.title}-${index}`}
                          href={`/bag/${item.clubId}/analytics`}
                          prefetch={false}
                          className="block hover:text-emerald-700"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div key={`${group.title}-${index}`}>{content}</div>
                      );
                    })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CoachItemIcon({ tone }: { tone: Tone }) {
  if (tone === "green") {
    return <CheckCircle2 className="size-5 text-emerald-600" />;
  }

  if (tone === "amber" || tone === "pink") {
    return <AlertTriangle className="size-5 text-amber-600" />;
  }

  return <Gauge className="size-5 text-slate-500" />;
}

function DataGapRichCard({ gap }: { gap: DataGap }) {
  return (
    <Link
      href={`/bag/${gap.clubId}/analytics`}
      prefetch={false}
      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-300"
    >
      <p className="text-sm font-medium leading-5">
        {formatClubType(gap.clubType)} needs more clean stock shots
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-100 text-sm">
        <CoachDataRow label="Baseline" value={`${gap.cleanShots} clean baseline shots`} />
        <CoachDataRow label="Target" value="10 full stock shots" />
        <CoachDataRow
          label="Next action"
          value={`Build ${formatClubType(gap.clubType)} baseline`}
          highlight
        />
      </div>
    </Link>
  );
}

function CoachDataRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
      <span className="text-[#667085]">{label}</span>
      <span className={cn("font-semibold text-[#111827]", highlight ? "text-emerald-700" : "")}>
        {value}
      </span>
    </div>
  );
}

function BestSignalBanner({ signal }: { signal: BestSignal }) {
  const content = (
    <div className="grid min-h-28 grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-lg border border-emerald-200 bg-[linear-gradient(135deg,#F7FCF9_0%,#FFFFFF_100%)] p-4 transition-colors hover:border-emerald-400">
      <span className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
        <Zap className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-emerald-800">Best signal</p>
        <p className="mt-2 text-lg font-bold leading-7 text-[#111827]">{signal.value}</p>
        <p className="mt-2 text-sm leading-6 text-[#111827]">
          <span className="font-semibold">Why it matters: </span>
          {signal.why}
        </p>
        <p className="mt-1 text-sm leading-5 text-[#667085]">{signal.detail}</p>
      </div>
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
    <DataPanel className="h-full">
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
                <TableCell>
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", bagRowMarkerClass(row))}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/bag/${row.clubId}/analytics`}
                        prefetch={false}
                        className="font-semibold hover:text-emerald-700"
                      >
                        {formatClubType(row.clubType)}
                      </Link>
                      <p className="mt-0.5 max-w-44 truncate text-xs text-muted-foreground">
                        {row.brandModel}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusPill
                    tone={row.trustIndex >= 68 ? "green" : row.trustIndex >= 62 ? "sky" : "amber"}
                  >
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
    <DataPanel className="h-full">
      <SectionHeader
        title="Trust ladder"
        description="Trust considers distance, direction, strike quality, and clean-shot sample depth."
        action={<Gauge className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-2">
        {items.map((item) => (
          <Link
            key={item.clubId}
            href={`/bag/${item.clubId}/analytics`}
            prefetch={false}
            title="Based on distance consistency, direction, strike quality, and clean-shot sample depth."
            className="grid grid-cols-[3.5rem_auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 hover:border-emerald-300"
          >
            <p className="font-semibold">{formatClubType(item.clubType)}</p>
            <p className="font-semibold tabular-nums">
              {item.trustIndex === null ? "--" : `${item.trustIndex}%`}
            </p>
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
    <DataPanel className="h-full">
      <SectionHeader
        title="Journey"
        description="Recent milestones and notable movement from the current data."
        action={<StatusPill tone="slate">Latest 4</StatusPill>}
      />
      <CardContent>
        <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
          {visibleEvents.map((event, index) => (
            <Link
              key={`${event.title}-${index}`}
              href={`/bag/${event.clubId}/analytics`}
              prefetch={false}
              className="relative block h-full rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-300"
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
  const trusted = summary.rankings.mostTrusted;
  const currentForm = summary.rankings.currentForm;
  const bestSignal = summary.bestSignal;
  const dataGap = summary.dataGaps[0];
  const needsWork = summary.rankings.needsWork;

  if (trusted && currentForm && trusted.clubId !== currentForm.clubId) {
    return `${formatClubType(trusted.clubType)} is the long-term trust leader; ${formatClubType(currentForm.clubType)} has the latest-session form. ${bestSignal ? bestSignal.value.replace(/\.$/, "") : "Keep the next block comparable"}.`;
  }

  if (trusted && bestSignal && dataGap) {
    return `${formatClubType(trusted.clubType)} remains the long-term trust leader, ${bestSignal.value.replace(/\.$/, "")}, and ${formatClubType(dataGap.clubType)} still needs a clean stock baseline.`;
  }

  if (trusted && needsWork) {
    return `${formatClubType(trusted.clubType)} remains the long-term trust leader, while ${formatClubType(needsWork.clubType)} still needs attention.`;
  }

  return "Keep building comparable stock-shot samples so the strongest club, weakest signal and next practice target separate clearly.";
}

function longTermTrustDetail(row: ProgressClubRow, summary: ProgressSummary) {
  const isMostTrusted = row.clubId === summary.rankings.mostTrusted?.clubId;
  const isBestMovement = row.clubId === summary.rankings.mostImproved?.clubId;

  if (isMostTrusted && isBestMovement) {
    return "Long-term trust leader and strongest movement";
  }

  if (isMostTrusted) {
    return `${row.trustIndex}% trust · ${row.sampleSize} clean shots · all-data baseline`;
  }

  return improvementDetail(row);
}

function currentFormDetail(signal: CurrentFormSignal) {
  const parts = [`Latest session: ${signal.shotCount} clean shots`];

  if (isMeaningful(signal.offlineDeltaYd, 0.5)) {
    parts.push(
      `offline ${Math.abs(signal.offlineDeltaYd)} yd ${
        signal.offlineDeltaYd <= 0 ? "tighter" : "wider"
      }`,
    );
  } else if (signal.latestOfflineAverageYd !== null) {
    parts.push(`${numberFormatter.format(signal.latestOfflineAverageYd)} yd offline avg`);
  }

  if (isMeaningful(signal.carryDeltaYd, 0.5)) {
    parts.push(`carry ${formatSigned(signal.carryDeltaYd)} yd`);
  } else if (isMeaningful(signal.ballSpeedDeltaMph, 0.3)) {
    parts.push(`ball speed ${formatSigned(signal.ballSpeedDeltaMph)} mph`);
  }

  return parts.join(" · ");
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
  return (
    [...rows]
      .filter(
        (row) => row.sampleSize >= 6 && row.offlineDeltaYd !== null && row.offlineDeltaYd <= -2,
      )
      .sort(
        (left, right) => Math.abs(right.offlineDeltaYd ?? 0) - Math.abs(left.offlineDeltaYd ?? 0),
      )[0] ?? null
  );
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
      const reliableClause = reliable.length
        ? `${formatClubList(reliable)} ${reliable.length === 1 ? "is" : "are"} reliable`
        : "Trust is still forming";
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
    needsWork
      ? `${formatClubType(needsWork.clubType)} remains the lowest-trust club with enough clean shots`
      : null,
  ].filter(Boolean);

  return parts.length
    ? `${parts.join(", ")}.`
    : "Latest clean baseline vs first clean baseline. Offline going down is good.";
}

function bagRowMarkerClass(row: ProgressClubRow) {
  if (row.sampleSize < 10 || row.confidenceLabel === "Not enough data") {
    return "bg-slate-300";
  }

  if (row.trustIndex <= 62) {
    return "bg-amber-400";
  }

  if (row.offlineDeltaYd !== null && row.offlineDeltaYd <= -2) {
    return "bg-sky-400";
  }

  if (row.carryDeltaYd !== null && row.carryDeltaYd >= 5) {
    return "bg-emerald-500";
  }

  return "bg-transparent";
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

const progressIconToneStyles: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  pink: "border-rose-200 bg-rose-50 text-rose-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

const progressSignalToneStyles: Record<
  Tone,
  { card: string; icon: string; label: string; emphasis: string }
> = {
  green: {
    card: "border-emerald-200 bg-[linear-gradient(135deg,#f8fcf9_0%,#ffffff_100%)]",
    icon: "bg-emerald-50 text-emerald-700",
    label: "text-emerald-800",
    emphasis: "text-[#087A3D]",
  },
  sky: {
    card: "border-sky-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)]",
    icon: "bg-sky-50 text-sky-700",
    label: "text-sky-800",
    emphasis: "text-[#2563EB]",
  },
  pink: {
    card: "border-rose-200 bg-[linear-gradient(135deg,#fff6f5_0%,#ffffff_100%)]",
    icon: "bg-rose-50 text-rose-700",
    label: "text-rose-800",
    emphasis: "text-[#D92D20]",
  },
  amber: {
    card: "border-amber-200 bg-[linear-gradient(135deg,#fffbf4_0%,#ffffff_100%)]",
    icon: "bg-amber-50 text-amber-800",
    label: "text-amber-800",
    emphasis: "text-[#C25500]",
  },
  slate: {
    card: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_100%)]",
    icon: "bg-slate-100 text-slate-600",
    label: "text-slate-700",
    emphasis: "text-[#475467]",
  },
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

function findAnalytics(clubs: Array<{ clubId: string; analytics: ClubAnalytics }>, clubId: string) {
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
