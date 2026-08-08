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

import {
  DataPair,
  DataPanel,
  DataTableFrame,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader, MobileTabBar } from "@/components/mobile-sports";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopAiPrompt,
  type DesktopInsightMetric,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getPracticePlannerProgressSummary } from "@/lib/practice-planner";
import type { ClubAnalytics } from "@/lib/club-analytics";
import {
  getProgressData,
  getProgressScoringEvidence,
  type ProgressScoringEvidence,
} from "@/lib/progress-data";
import {
  buildProgressSummary,
  type BestSignal,
  type CoachSummaryGroup,
  type CurrentFormSignal,
  type DataGap,
  type JourneyEvent,
  type PracticePriority,
  type ProgressClub,
  type ProgressClubRow,
  type ProgressSummary,
  type ProgressTrend,
  type TrustLadderItem,
} from "@/lib/progress-summary";
import { saveCurrentWeeklyRecapAction } from "@/app/feature-actions";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import { cn } from "@/lib/utils";
import { buildWeeklyChangeReview, type WeeklyChangeReview } from "@/lib/weekly-change-review";
import { getWeeklyChangeEvidence } from "@/lib/weekly-change-review-data";
import { calculateScoringConfidence } from "@/lib/progress-readiness";

export const dynamic = "force-dynamic";

type ProgressPageProps = {
  searchParams?: Promise<{
    bag?: string;
  }>;
};

type BagMovementFilter = "all" | "woods" | "irons" | "wedges" | "needs-work";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});
const progressBagMovementColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "trust", label: "Trust" },
  { id: "clean-shots", label: "Clean shots" },
  { id: "stock-carry", label: "Stock carry" },
  { id: "movement", label: "Movement" },
];

const progressBagMovementSavedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Clubs needing work",
    href: "/progress?bag=needs-work#bag-movement",
    detail: "Trust, sample size and movement for clubs still below decision confidence.",
  },
  {
    title: "Iron progress checks",
    href: "/progress?bag=irons#bag-movement",
    detail: "Keep iron carry, trust and movement visible for the current roadmap.",
  },
  {
    title: "Wedge scoring movement",
    href: "/progress?bag=wedges#bag-movement",
    detail: "Review wedge stock carry and movement before building the next scoring block.",
  },
];

const progressWorkbenchPrompts: DesktopAiPrompt[] = [
  {
    label: "Explain progress trend",
    prompt:
      "Explain my ForeKingHell progress trend using only the visible progress score, club movement, trust, practice-plan and data-gap evidence. Do not invent missing numbers.",
    icon: LineChart,
  },
  {
    label: "Compare with last month",
    prompt:
      "Compare this progress readout with the previous useful period. Cite visible trust, clean-shot, movement and practice-plan evidence, and call out weak samples.",
    icon: TrendingUp,
  },
  {
    label: "Build practice plan",
    prompt:
      "Build a progress-focused practice plan from this ForeKingHell progress page. Prioritise the next scoring gate and label low-confidence club data.",
    icon: Target,
  },
  {
    label: "Save this insight",
    prompt:
      "Save the clearest progress insight with the exact visible metric, affected club, confidence caveat and next practice action.",
    icon: Bookmark,
  },
  {
    label: "Generate report",
    prompt:
      "Generate a progress report from this ForeKingHell workspace with overall progress, strongest improvement, main blocker, data confidence and next practice plan.",
    icon: ClipboardCheck,
  },
];

export default async function ProgressPage({ searchParams }: ProgressPageProps) {
  const userId = await requireCurrentUserId();
  const [params, data, scoringEvidence, featureData, practicePlannerSummary, weeklyEvidence] =
    await Promise.all([
      searchParams,
      getProgressData(userId),
      getProgressScoringEvidence(userId),
      getFeatureIdeasData(),
      getPracticePlannerProgressSummary(userId),
      getWeeklyChangeEvidence(userId),
    ]);
  const summary = buildProgressSummary(data.clubs);
  const weeklyChangeReview = buildWeeklyChangeReview({
    clubRows: summary.clubRows,
    latestSessionAt: weeklyEvidence.latestSessionAt,
    completedPracticeCount: weeklyEvidence.completedPracticeCount,
    completedSessionCount: weeklyEvidence.completedSessionCount,
    completedRoundCount: weeklyEvidence.completedRoundCount,
    dataQualityIssueCount: weeklyEvidence.dataQualityIssueCount,
    personalBestCount: weeklyEvidence.personalBestCount,
    topPriority: summary.practicePlan[0],
  });
  const mostImproved = summary.rankings.mostImproved;
  const bagFilter = parseBagMovementFilter(params?.bag);

  return (
    <PageShell>
      <MobileRouteHeader title="Home" group="dashboard" activeKey="progress" />
      <MobileTabBar
        activeKey="overview"
        className="sm:hidden"
        tabs={[
          { key: "overview", label: "Overview", href: "/progress" },
          { key: "trends", label: "Trends", href: "#trends" },
          { key: "calendar", label: "Timeline", href: "#journey" },
          { key: "pbs", label: "PBs", href: "/achievements" },
        ]}
      />

      <DesktopWorkbenchLayout
        scope="progress"
        railBreakpoint="wide"
        rail={
          <DesktopInsightRail
            title="AI progress rail"
            description="Explain what is improving, what is weak and which practice block moves the bag forward."
            metrics={progressInsightMetrics(summary, scoringEvidence)}
            evidence={progressInsightEvidence(summary)}
            prompts={progressWorkbenchPrompts}
            actions={[
              {
                label: "Open bag movement",
                href: "/progress#bag-movement",
                detail: "Review the club table behind the progress readout.",
                icon: Table2,
              },
              {
                label: "Open coach",
                href: "/coach",
                detail: "Turn the progress blocker into a coach plan.",
                icon: MessageSquare,
              },
            ]}
          />
        }
      >
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
                    Import a Rapsodo CSV and LM World Tour will build first-vs-latest club
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
            <ProgressScorePanel summary={summary} />
            <GoalProgressPanel summary={summary} scoringEvidence={scoringEvidence} />
            <MobileProgressFirstCard summary={summary} />
            <MobileProgressDimensions summary={summary} clubs={data.clubs} />
            <div className="progress-bento-grid grid min-w-0 gap-4 overflow-x-clip lg:gap-5">
              <ProgressBentoItem span={12}>
                <WeeklyRecapPanel
                  data={featureData}
                  summary={summary}
                  review={weeklyChangeReview}
                />
              </ProgressBentoItem>
              <ProgressBentoItem span={12}>
                <ProgressRoadmapPanel summary={summary} />
              </ProgressBentoItem>
              <ProgressBentoItem span={12}>
                <ProgressPracticePlannerPanel
                  summary={practicePlannerSummary}
                  priorities={summary.practicePlan}
                />
              </ProgressBentoItem>
              <ProgressBentoItem span={12}>
                <div className="progress-analysis-grid grid min-w-0 items-stretch gap-4 lg:gap-5">
                  <div className="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:gap-5">
                    <ComparisonBar summary={summary} />
                    <ProgressSignalsPanel summary={summary} clubs={data.clubs} />
                  </div>
                  <ProgressTrendsPanel summary={summary} />
                </div>
              </ProgressBentoItem>
              <ProgressBentoItem span={12}>
                <div className="progress-main-rail grid min-w-0 items-stretch gap-4 lg:gap-5">
                  <div className="grid h-full min-w-0 content-start gap-4 lg:gap-5">
                    <PracticePlanPanel priorities={summary.practicePlan} />
                    <div id="journey" className="scroll-mt-28">
                      <CoachTimelinePanel summary={summary} />
                    </div>
                  </div>
                  <div className="progress-supporting-rail grid h-full min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 lg:gap-5">
                    <CoachReadoutPanel
                      signal={summary.bestSignal}
                      groups={summary.coachSummary}
                      gaps={summary.dataGaps}
                    />
                    <PracticeCalendarPanel calendar={featureData.practiceCalendar} />
                    <TrustLadderPanel items={summary.trustLadder} />
                  </div>
                </div>
              </ProgressBentoItem>
              <ProgressBentoItem span={12}>
                <BagMovementPanel rows={summary.clubRows} activeFilter={bagFilter} />
              </ProgressBentoItem>
            </div>
          </>
        )}
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function progressInsightMetrics(
  summary: ProgressSummary,
  scoringEvidence: ProgressScoringEvidence,
): DesktopInsightMetric[] {
  const score = progressScore(summary);
  const momentum = progressScoreMomentum(summary);
  const readiness = technicalReadiness(summary);
  const scoringConfidence = scoringConfidenceReadout(scoringEvidence);
  const priority = summary.practicePlan[0];

  return [
    {
      label: "Overall progress",
      value: `${score}/100`,
      detail: progressScoreReadout(summary, momentum),
      tone: score >= 78 ? "green" : score >= 62 ? "amber" : "sky",
    },
    {
      label: "Technical readiness",
      value: `${readiness}%`,
      detail: `Launch-monitor evidence only. ${progressCoachSentence(summary)}`,
      tone: readiness >= 70 ? "green" : readiness >= 50 ? "amber" : "sky",
    },
    {
      label: "Scoring confidence",
      value: scoringConfidence.label,
      detail: scoringConfidence.detail,
      tone: scoringConfidence.tone,
    },
    {
      label: "Average trust",
      value: `${summary.totals.averageTrust}%`,
      detail: `${integerFormatter.format(summary.totals.clubs)} clubs and ${integerFormatter.format(
        summary.totals.trackedCleanShots,
      )} clean stock shots feed this readout.`,
      tone: summary.totals.averageTrust >= 72 ? "green" : "amber",
    },
    {
      label: "Next practice",
      value: priority ? formatClubType(priority.clubType) : "Build baseline",
      detail: priority?.reason ?? "Import clean stock shots before asking for a progress plan.",
      tone: priority?.tone ?? "slate",
    },
  ];
}

function progressInsightEvidence(summary: ProgressSummary) {
  const evidence = [
    `${integerFormatter.format(summary.totals.trackedCleanShots)} clean stock shots across ${integerFormatter.format(
      summary.totals.clubs,
    )} clubs.`,
    `${integerFormatter.format(
      summary.totals.shots,
    )} launch-monitor rows with average trust at ${summary.totals.averageTrust}%.`,
    `Playable rate is ${formatRate(summary.totals.averagePlayableRate)} where direction data is available.`,
  ];
  const bestSignal = summary.bestSignal;
  const strongest = strongestImprovementRow(summary);
  const priority = summary.practicePlan[0];
  const dataGap = summary.dataGaps[0];

  if (bestSignal) {
    evidence.push(`${bestSignal.value.replace(/\.$/, "")}: ${bestSignal.why}`);
  }

  if (strongest) {
    evidence.push(
      `${formatClubType(strongest.clubType)}: ${strongestImprovementDetail(strongest)}.`,
    );
  }

  if (priority) {
    evidence.push(`${priority.title}: ${priority.reason}`);
  }

  if (dataGap) {
    evidence.push(`${formatClubType(dataGap.clubType)} data gap: ${dataGap.detail}`);
  }

  return evidence.slice(0, 6);
}

type ProgressSpan = 3 | 5 | 6 | 7 | 9 | 12;

function ProgressBentoItem({ span, children }: { span: ProgressSpan; children: ReactNode }) {
  return (
    <div className={`progress-bento-item progress-span-${span} min-w-0 max-w-full overflow-x-clip`}>
      {children}
    </div>
  );
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
      <div className="grid gap-3 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:px-7">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
              Personal baseline
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
              <span className="sm:hidden">{progressVerdictLabel(summary)}</span>
              <span className="hidden sm:inline">
                Progress verdict: {progressVerdictChip(summary)}
              </span>
            </span>
          </div>
          <h1 className="mt-3 text-[26px] font-bold leading-8 tracking-normal text-[#111827] sm:mt-4 sm:text-3xl sm:leading-10">
            Bag progress
          </h1>
          <p className="mt-2 hidden max-w-3xl text-sm font-medium leading-6 text-[#667085] sm:block">
            {heroVerdict(summary)}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_240px] lg:grid-cols-1">
          <div className="flex items-center justify-start lg:justify-end">
            <Button
              asChild
              variant="outline"
              data-primary-action
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
            <PageArtwork variant="progress" alt="" className="h-full min-h-28" priority />
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

function ProgressScorePanel({ summary }: { summary: ProgressSummary }) {
  const score = progressScore(summary);
  const momentum = progressScoreMomentum(summary);
  const signals = progressScoreClubSignals(summary);
  const readout = progressScoreReadout(summary, momentum);

  return (
    <section className="grid gap-4 rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)] lg:items-center lg:p-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Gauge className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#667085]">
              Progress score
            </p>
            <p className="mt-1 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
              Overall progress {score} / 100
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-2.5 rounded-full bg-[#087A3D]"
            style={{ width: `${score}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill tone={momentum >= 0 ? "green" : "amber"}>
            {momentum >= 0 ? (
              <TrendingUp className="mr-1 size-3.5" />
            ) : (
              <TrendingDown className="mr-1 size-3.5" />
            )}
            Momentum {formatSigned(momentum)} vs baseline
          </StatusPill>
          <span className="text-sm leading-5 text-[#667085]">{readout}</span>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {signals.map((signal) => {
          const Icon = signal.direction === "up" ? TrendingUp : TrendingDown;

          return (
            <Link
              key={signal.clubId}
              href={`/bag/${signal.clubId}/analytics`}
              prefetch={false}
              className={cn(
                "grid min-h-24 gap-2 rounded-lg border p-3 transition-colors hover:border-emerald-300",
                progressScoreClubClasses[signal.tone],
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#111827]">
                  {formatClubType(signal.clubType)}
                </span>
                <Icon className="size-4" />
              </div>
              <p className="text-lg font-bold leading-6 tracking-normal">{signal.value}</p>
              <p className="text-xs leading-4 text-[#667085]">{signal.detail}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function GoalProgressPanel({
  summary,
  scoringEvidence,
}: {
  summary: ProgressSummary;
  scoringEvidence: ProgressScoringEvidence;
}) {
  const progress = technicalReadiness(summary);
  const trend = break80Trend(summary);
  const needs = break80Needs(summary);
  const sentence = progressCoachSentence(summary);
  const scoringConfidence = scoringConfidenceReadout(scoringEvidence);

  return (
    <section className="grid gap-4 rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="green">
            <Target className="mr-1 size-3.5" />
            Technical profile
          </StatusPill>
          <StatusPill tone={trend >= 0 ? "green" : "amber"}>
            {trend >= 0 ? (
              <TrendingUp className="mr-1 size-3.5" />
            ) : (
              <TrendingDown className="mr-1 size-3.5" />
            )}
            Trend {formatSigned(trend)}%
          </StatusPill>
        </div>
        <h2 className="mt-3 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
          Technical readiness
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          How strong the current launch-monitor pattern is. This does not predict a score.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <span className="text-4xl font-bold leading-none tracking-normal text-[#111827]">
              {progress}%
            </span>
            <span className="text-sm font-semibold text-[#087A3D]">
              {goalProgressLabel(progress)}
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-[#087A3D]"
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
          <p className="mt-3 text-sm font-medium leading-6 text-[#475467]">
            <span className="font-semibold text-[#111827]">Coach summary: </span>
            {sentence}
          </p>
        </div>
        <div className="grid min-w-[11rem] gap-3">
          <div className="rounded-xl border border-[#DFE7DF] bg-[#F8FCF9] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
              Scoring confidence
            </p>
            <p className="mt-1 text-lg font-bold text-[#111827]">{scoringConfidence.label}</p>
            <p className="mt-1 text-xs leading-5 text-[#667085]">{scoringConfidence.detail}</p>
          </div>
          <div className="grid gap-2 rounded-xl border border-[#DFE7DF] bg-[#F8FCF9] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">Need</p>
            <div className="flex flex-wrap gap-2 md:grid">
              {needs.map((club) => (
                <span
                  key={club}
                  className="rounded-lg border border-[#CFE7D6] bg-white px-3 py-1.5 text-sm font-semibold text-[#087A3D]"
                >
                  {club}
                </span>
              ))}
            </div>
          </div>
        </div>
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

function WeeklyRecapPanel({
  data,
  summary,
  review,
}: {
  data: FeatureIdeasData;
  summary: ProgressSummary;
  review: WeeklyChangeReview;
}) {
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

      <p className="mt-4 rounded-xl border border-[#CFE7D6] bg-[#F8FCF9] px-4 py-3 text-sm font-medium leading-6 text-[#475467]">
        <span className="font-semibold text-[#111827]">This week&apos;s read: </span>
        {weeklyRead}
      </p>

      <div className="mt-4 grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <WeeklyRecapCard
          label="Largest improvement"
          value={review.largestImprovement.value}
          detail={review.largestImprovement.detail}
          href={review.largestImprovement.href}
          tone={review.largestImprovement.tone}
          icon={TrendingUp}
        />
        <WeeklyRecapCard
          label="Largest decline"
          value={review.largestDecline.value}
          detail={review.largestDecline.detail}
          href={review.largestDecline.href}
          tone={review.largestDecline.tone}
          icon={TrendingDown}
        />
        <WeeklyRecapCard
          label="Sessions and rounds"
          value={review.completedVolume.value}
          detail={review.completedVolume.detail}
          href="/sessions"
          tone={review.completedVolume.tone}
          icon={ClipboardCheck}
        />
        <WeeklyRecapCard
          label="Data-quality issues"
          value={review.dataQuality.value}
          detail={review.dataQuality.detail}
          href="/analyse/workspace#data-quality"
          tone={review.dataQuality.tone}
          icon={ShieldCheck}
        />
        <WeeklyRecapCard
          label="New personal bests"
          value={review.personalBests.value}
          detail={review.personalBests.detail}
          href="/achievements"
          tone={review.personalBests.tone}
          icon={Trophy}
        />
        <WeeklyRecapCard
          label="Data freshness"
          value={review.dataFreshness.value}
          detail={review.dataFreshness.detail}
          tone={review.dataFreshness.tone}
          icon={CalendarDays}
        />
        <WeeklyRecapCard
          label="Practice completed"
          value={review.practiceCompleted.value}
          detail={review.practiceCompleted.detail}
          href="/practice"
          tone={review.practiceCompleted.tone}
          icon={CheckCircle2}
        />
        <WeeklyRecapCard
          label="Bag-number change"
          value={review.bagNumberChange.value}
          detail={review.bagNumberChange.detail}
          href="/progress#bag-movement"
          tone={review.bagNumberChange.tone}
          icon={BarChart3}
        />
        <WeeklyRecapCard
          label="One next action"
          value={review.nextAction.value}
          detail={review.nextAction.detail}
          href={review.nextAction.href}
          tone={review.nextAction.tone}
          icon={Target}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild className="min-h-11 rounded-xl">
          <Link href={review.nextAction.href} prefetch={false}>
            <Target className="size-4" />
            Take next action
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href="/practice" prefetch={false}>
            Build next practice
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href="/coach/workspace" prefetch={false}>
            Share with coach
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href="/coach/reports?template=monthly" prefetch={false}>
            Export weekly report
          </Link>
        </Button>
      </div>
    </section>
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

function PracticeCalendarPanel({ calendar }: { calendar: FeatureIdeasData["practiceCalendar"] }) {
  return (
    <section className="@container/progress-calendar rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-7 tracking-normal text-[#111827]">
            Practice calendar
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#667085]">
            The planned work sits below the weekly read so the recap stays focused.
          </p>
        </div>
        <StatusPill tone={calendar.length > 0 ? "sky" : "slate"}>
          {calendar.length} planned
        </StatusPill>
      </div>
      <div
        aria-label="Practice plan calendar"
        tabIndex={0}
        className="mt-4 grid gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring @md/progress-calendar:grid-cols-2"
      >
        {calendar.length > 0 ? (
          calendar.slice(0, 4).map((item) => (
            <div
              key={`${item.title}-${item.date.toISOString()}`}
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8FCF9] px-3 py-3"
            >
              <span className="grid size-10 place-items-center rounded-full bg-[#E8F7EE] text-[#087A3D]">
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
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[#CFE1D2] bg-white px-4 py-4 text-sm leading-6 text-[#667085] @md/progress-calendar:col-span-2">
            Save a weekly recap or practice plan to pin the next calendar block.
          </p>
        )}
      </div>
    </section>
  );
}

function ProgressRoadmapPanel({ summary }: { summary: ProgressSummary }) {
  const roadmapItems = buildRoadmapItems(summary);

  return (
    <section className="premium-card overflow-hidden rounded-lg">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F7EE] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#087A3D]">
            <Sparkles className="size-4" />
            This week
          </div>
          <h2 className="mt-4 text-3xl font-bold leading-9 tracking-normal text-[#111827]">
            {roadmapGoalLabel()}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Three actions from shot pattern, trust, and movement data. Finish these before chasing
            more chart detail.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <DataPair label="Average trust" value={`${summary.totals.averageTrust}%`} />
            <DataPair
              label="Clean shots"
              value={integerFormatter.format(summary.totals.trackedCleanShots)}
            />
            <DataPair
              label="Playable rate"
              value={
                summary.totals.averagePlayableRate === null
                  ? "--"
                  : `${numberFormatter.format(summary.totals.averagePlayableRate)}%`
              }
            />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {roadmapItems.map((item, index) => (
            <Link
              key={`${item.title}-${index}`}
              href={item.href}
              prefetch={false}
              className="group grid min-h-[13rem] grid-rows-[auto_1fr_auto] rounded-lg border border-[#DDE8DE] bg-white/80 p-4 transition-colors hover:border-[#CFE7D6] hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
                    {roadmapStepLabel(index)}
                  </p>
                  <p className="mt-2 text-lg font-bold leading-6 text-[#111827]">{item.title}</p>
                </div>
                <StatusPill tone={item.tone}>{item.label}</StatusPill>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#667085]">{item.detail}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#087A3D]">
                {item.action}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgressPracticePlannerPanel({
  summary,
  priorities,
}: {
  summary: Awaited<ReturnType<typeof getPracticePlannerProgressSummary>>;
  priorities: PracticePriority[];
}) {
  const priorityOne = priorities[0] ?? null;
  const priorityCompletion =
    priorityOne && summary.topFocus?.label.toLowerCase().includes(priorityOne.clubType)
      ? summary.topFocus.completedCount
      : 0;

  return (
    <section className="premium-card overflow-hidden rounded-lg">
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
            <ClipboardCheck className="size-4" />
            Structured practice
          </div>
          <h2 className="mt-4 text-3xl font-bold leading-9 tracking-normal text-[#111827]">
            {summary.completedCount > 0
              ? `${summary.completedCount} planned sessions completed`
              : "Plan the next session"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            {priorityOne
              ? `Priority 1: ${priorityOne.title}. Completed structured sessions against this focus: ${priorityCompletion}.`
              : "Import more stock-shot data to connect planner work to roadmap priorities."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <DataPair label="Planned" value={integerFormatter.format(summary.plannedCount)} />
          <DataPair label="Completed" value={integerFormatter.format(summary.completedCount)} />
          <DataPair
            label="Average score"
            value={summary.averageScore === null ? "--" : `${summary.averageScore}`}
          />
          <DataPair
            label="Top focus"
            value={summary.topFocus ? summary.topFocus.label : "Waiting"}
          />
        </div>
        <div className="lg:col-span-2">
          <Button asChild className="premium-action rounded-lg">
            <Link href="/practice" prefetch={false}>
              Open Practice Planner
            </Link>
          </Button>
        </div>
      </div>
    </section>
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

function MobileProgressDimensions({
  summary,
  clubs,
}: {
  summary: ProgressSummary;
  clubs: ProgressClub[];
}) {
  const mostImproved = summary.rankings.mostImproved;
  const mostTrusted = summary.rankings.mostTrusted;
  const strikeClub = [...clubs]
    .filter((club) => club.analytics.sample.stockShots >= 3)
    .sort(
      (left, right) =>
        right.analytics.consistency.strikeConsistencyScore -
        left.analytics.consistency.strikeConsistencyScore,
    )[0];
  const directionClub = [...clubs]
    .filter((club) => club.analytics.sample.stockShots >= 3)
    .sort(
      (left, right) =>
        right.analytics.consistency.directionConsistencyScore -
        left.analytics.consistency.directionConsistencyScore,
    )[0];
  const speedMover = [...summary.clubRows]
    .filter((row) => row.sampleSize >= 6 && row.ballSpeedDeltaMph !== null)
    .sort(
      (left, right) =>
        Math.abs(right.ballSpeedDeltaMph ?? 0) - Math.abs(left.ballSpeedDeltaMph ?? 0),
    )[0];
  const rows = [
    {
      label: "Performance",
      value: mostImproved ? formatClubType(mostImproved.clubType) : "Building",
      detail: mostImproved ? strongestImprovementDetail(mostImproved) : "No stable mover yet.",
    },
    {
      label: "Consistency",
      value: mostTrusted ? formatClubType(mostTrusted.clubType) : "Building",
      detail: mostTrusted
        ? `${mostTrusted.trustIndex}% trust from ${mostTrusted.sampleSize} clean shots.`
        : "Needs a comparable clean sample.",
    },
    {
      label: "Strike quality",
      value: strikeClub
        ? `${strikeClub.analytics.consistency.strikeConsistencyScore}/100`
        : "No signal",
      detail: strikeClub
        ? `${formatClubType(strikeClub.clubType)} · ${strikeClub.analytics.sample.stockShots} clean shots.`
        : "Smash and ball-speed evidence is still too thin.",
    },
    {
      label: "Direction control",
      value: directionClub
        ? `${directionClub.analytics.consistency.directionConsistencyScore}/100`
        : "No signal",
      detail: directionClub
        ? `${formatClubType(directionClub.clubType)} · ${formatRate(directionClub.analytics.accuracy.playableShotRate)} playable.`
        : "Offline evidence is still too thin.",
    },
    {
      label: "Speed",
      value:
        speedMover?.ballSpeedDeltaMph !== null && speedMover?.ballSpeedDeltaMph !== undefined
          ? `${formatSigned(speedMover.ballSpeedDeltaMph)} mph`
          : "No stable shift",
      detail: speedMover
        ? `${formatClubType(speedMover.clubType)} versus its personal baseline.`
        : "Needs six comparable clean shots.",
    },
    {
      label: "Training volume",
      value: `${integerFormatter.format(summary.totals.trackedCleanShots)} clean shots`,
      detail: "Evidence depth only; more shots is not automatic improvement.",
    },
    {
      label: "Confidence / sample",
      value: `${summary.totals.averageTrust}% average trust`,
      detail: `${summary.totals.clubs} clubs · ${summary.dataGaps.length} current data gaps.`,
    },
  ];

  return (
    <section aria-labelledby="progress-dimensions" className="ios-grouped-list sm:hidden">
      <div className="ios-grouped-row px-4 py-3">
        <h2 id="progress-dimensions" className="text-[17px] font-semibold">
          Progress dimensions
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Improvement, repeatability and evidence depth are scored separately.
        </p>
      </div>
      <dl>
        {rows.map((row) => (
          <div key={row.label} className="ios-grouped-row px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
              <dd className="text-right text-[15px] font-semibold tabular-nums">{row.value}</dd>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{row.detail}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Tone = "green" | "sky" | "pink" | "amber" | "slate";

function ComparisonBar({ summary }: { summary: ProgressSummary }) {
  return (
    <section className="grid gap-3 rounded-lg border border-[#D9DED8] bg-white px-4 py-3 sm:grid-cols-3 sm:items-start">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Comparison
        </p>
        <p className="mt-1 font-semibold">Progress controls</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Baseline
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
        className="inline-flex w-fit max-w-full flex-wrap items-center justify-center rounded-lg bg-muted p-[3px] text-sm text-muted-foreground sm:col-span-3 sm:justify-self-start"
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
    <section className="flex h-full flex-col rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
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
          label="Most trusted historically"
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
          label="Best current form"
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
        "grid h-full min-h-40 grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-xl border p-5 transition-colors hover:border-emerald-300",
        progressSignalToneStyles[tone].card,
      )}
    >
      <span
        className={cn(
          "grid size-12 place-items-center rounded-xl",
          progressSignalToneStyles[tone].icon,
        )}
      >
        <Icon className="size-6" />
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
        <p className="mt-2 text-2xl font-bold leading-8 tracking-normal text-[#111827]">{value}</p>
        <p className="mt-4 text-sm leading-5 text-[#475467]">
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
  const trendRows = progressTrendChartRows(summary.trends);

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
      <ChartAccessibleFallback
        title="Progress trends"
        summary={progressTrendChartSummary(summary.trends)}
        columns={[
          { key: "trend", label: "Trend" },
          { key: "point", label: "Point" },
          { key: "value", label: "Value" },
          { key: "direction", label: "Good direction" },
          { key: "readout", label: "Readout" },
        ]}
        rows={trendRows}
        className="mt-4"
      />
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
    <div className="clubhouse-chart-plot mt-3 rounded-lg bg-card px-2 py-1">
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
          stroke="var(--chart-grid, #D9E1E7)"
          strokeDasharray="4 7"
          strokeWidth="1"
        />
        <line
          x1="0"
          x2={width}
          y1={height * 0.72}
          y2={height * 0.72}
          stroke="var(--chart-grid, #D9E1E7)"
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

function progressTrendChartSummary(trends: ProgressTrend[]) {
  if (trends.length === 0) {
    return "No progress trend rows are available yet; import more comparable clean shots before reading movement.";
  }

  const usableTrends = trends.filter((trend) => trend.points.length >= 2);
  const positiveTrends = trends.filter((trend) => trend.tone === "green");
  const watchTrends = trends.filter((trend) => trend.tone === "amber" || trend.tone === "pink");
  const leadTrend = trends[0];

  return [
    `${integerFormatter.format(usableTrends.length)} of ${integerFormatter.format(trends.length)} progress trend cards have enough points for a sparkline.`,
    leadTrend ? `${leadTrend.label}: ${leadTrend.value}.` : null,
    positiveTrends.length > 0
      ? `${integerFormatter.format(positiveTrends.length)} trend${positiveTrends.length === 1 ? "" : "s"} currently read positive.`
      : null,
    watchTrends.length > 0
      ? `${integerFormatter.format(watchTrends.length)} trend${watchTrends.length === 1 ? "" : "s"} need more review.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function progressTrendChartRows(trends: ProgressTrend[]) {
  return trends.flatMap((trend) => {
    if (trend.points.length === 0) {
      return [
        {
          _key: `${trend.label}-empty`,
          trend: trend.label,
          point: "No points",
          value: "--",
          direction: formatTrendDirection(trend.goodDirection),
          readout: trend.value,
        },
      ];
    }

    return trend.points.map((point, index) => ({
      _key: `${trend.label}-${index}`,
      trend: trend.label,
      point:
        index === 0
          ? "Baseline"
          : index === trend.points.length - 1
            ? "Latest"
            : `Point ${index + 1}`,
      value: numberFormatter.format(point),
      direction: formatTrendDirection(trend.goodDirection),
      readout: trend.value,
    }));
  });
}

function formatTrendDirection(direction: ProgressTrend["goodDirection"]) {
  if (direction === "up") {
    return "Higher is better";
  }

  if (direction === "down") {
    return "Lower is better";
  }

  return "Stable is useful";
}

function PracticePlanPanel({ priorities }: { priorities: PracticePriority[] }) {
  const [topPriority] = priorities;
  const visiblePriorityCount = Math.min(priorities.length, 5);

  return (
    <section className="flex flex-col rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
      {topPriority ? (
        <div className="grid min-h-0 items-start gap-4 min-[2400px]:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
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
          <Image
            src="/assets/generated/progress-practice-green.png"
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
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
    <section className="@container/progress-coach flex flex-col rounded-[22px] border border-[#DFE7DF] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.055)] lg:p-6">
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
      <div className="mt-5 grid gap-4">
        {signal ? (
          <BestSignalBanner signal={signal} />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-muted-foreground">
            No best signal has separated yet. Keep importing comparable stock-shot sessions.
          </div>
        )}
        <div className="grid gap-3 @lg/progress-coach:grid-cols-2">
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
    <div className="grid min-h-36 grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-lg border border-emerald-200 bg-[linear-gradient(135deg,#F7FCF9_0%,#FFFFFF_100%)] p-5 transition-colors hover:border-emerald-400">
      <span className="grid size-12 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
        <Zap className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold text-emerald-800">Best signal</p>
        <p className="mt-2 text-xl font-bold leading-7 text-[#111827]">{signal.value}</p>
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

const bagMovementFilterOptions: Array<{ key: BagMovementFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "woods", label: "Woods" },
  { key: "irons", label: "Irons" },
  { key: "wedges", label: "Wedges" },
  { key: "needs-work", label: "Needs work" },
];

function parseBagMovementFilter(value: string | undefined): BagMovementFilter {
  return bagMovementFilterOptions.some((option) => option.key === value)
    ? (value as BagMovementFilter)
    : "all";
}

function buildBagMovementFilters(rows: ProgressClubRow[]) {
  return bagMovementFilterOptions.map((option) => ({
    ...option,
    count: rows.filter((row) => bagMovementFilterMatches(row, option.key)).length,
  }));
}

function bagMovementFilterHref(filter: BagMovementFilter) {
  return filter === "all" ? "/progress#bag-movement" : `/progress?bag=${filter}#bag-movement`;
}

function bagMovementFilterMatches(row: ProgressClubRow, filter: BagMovementFilter) {
  switch (filter) {
    case "woods":
      return progressClubFamily(row.clubType) === "wood";
    case "irons":
      return progressClubFamily(row.clubType) === "iron";
    case "wedges":
      return progressClubFamily(row.clubType) === "wedge";
    case "needs-work":
      return (
        row.sampleSize < 10 || row.trustIndex <= 62 || row.confidenceLabel === "Not enough data"
      );
    default:
      return true;
  }
}

function progressClubFamily(clubType: string): "wood" | "iron" | "wedge" {
  const normalized = clubType.toLowerCase();

  if (normalized === "driver" || /^[1-9][wh]$/.test(normalized) || normalized === "hybrid") {
    return "wood";
  }

  if (["pw", "gw", "aw", "sw", "lw", "wedge"].includes(normalized)) {
    return "wedge";
  }

  return "iron";
}

function BagMovementPanel({
  rows,
  activeFilter,
}: {
  rows: ProgressClubRow[];
  activeFilter: BagMovementFilter;
}) {
  const filteredRows = rows.filter((row) => bagMovementFilterMatches(row, activeFilter));
  const filters = buildBagMovementFilters(rows);

  return (
    <DataPanel id="bag-movement" className="scroll-mt-28">
      <SectionHeader
        title="Bag movement"
        description={bagMovementSummary(filteredRows.length > 0 ? filteredRows : rows)}
        action={<Table2 className="size-5 text-sky-600" />}
      />
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const isActive = filter.key === activeFilter;

            return (
              <Link
                key={filter.key}
                href={bagMovementFilterHref(filter.key)}
                prefetch={false}
                className={cn(
                  "inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-[#087A3D] bg-[#E8F7EE] text-[#087A3D]"
                    : "border-[#DFE7DF] bg-white text-[#475467] hover:border-[#CFE7D6] hover:bg-[#F8FCF9]",
                )}
              >
                {filter.label}
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">{filter.count}</span>
              </Link>
            );
          })}
        </div>
        <div data-workbench-scope="progress-bag-movement">
          <DesktopTableWorkbenchControls
            viewKey="progress-bag-movement"
            scope="progress-bag-movement"
            currentViewLabel="Progress bag movement"
            resultLabel={`${filteredRows.length} clubs`}
            columns={progressBagMovementColumns}
            suggestedViews={progressBagMovementSavedViews}
            exportTableId="progress-bag-movement"
            exportFileName="forekinghell-progress-bag-movement.csv"
            className="mb-3"
          />

          <DataTableFrame mainTable mainTableLabel="Progress bag movement table" stickyFirstColumn>
            <Table
              data-workbench-export-table="progress-bag-movement"
              aria-describedby="progress-bag-movement-summary"
              className="min-w-[1120px]"
            >
              <TableCaption id="progress-bag-movement-summary" className="sr-only">
                Club progress table showing club, trust, clean stock shots, stock carry and
                movement.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <TableRow>
                  <TableHead data-column="club" className="sticky left-0 z-20 min-w-56 bg-white">
                    Club
                  </TableHead>
                  <TableHead data-column="trust">Trust</TableHead>
                  <TableHead data-column="clean-shots">Clean shots</TableHead>
                  <TableHead data-column="stock-carry">Stock carry</TableHead>
                  <TableHead data-column="movement">Movement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <TableRow key={row.clubId} tabIndex={0} className="focus-aaa outline-none">
                      <TableCell
                        data-column="club"
                        className="sticky left-0 z-10 min-w-56 bg-white"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-1.5 size-2 shrink-0 rounded-full",
                              bagRowMarkerClass(row),
                            )}
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
                      <TableCell data-column="trust">
                        <StatusPill
                          tone={
                            row.trustIndex >= 68 ? "green" : row.trustIndex >= 62 ? "sky" : "amber"
                          }
                        >
                          {row.trustIndex}% trust
                        </StatusPill>
                      </TableCell>
                      <TableCell data-column="clean-shots">{row.sampleSize}</TableCell>
                      <TableCell data-column="stock-carry">
                        {formatYards(row.stockCarryYd)}
                      </TableCell>
                      <TableCell data-column="movement">
                        <MovementPills row={row} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={progressBagMovementColumns.length}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      No clubs match this filter yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableFrame>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function MovementPills({ row }: { row: ProgressClubRow }) {
  const items = movementItems(row);
  const itemsByMetric = new Map(items.map((item) => [item.metric, item]));
  const status = movementStatus(row);
  const StatusIcon = status.icon;

  return (
    <div
      className="grid min-w-[35rem] items-center gap-2"
      style={{ gridTemplateColumns: "6.25rem 5.75rem 7.6rem 6.35rem 5.75rem" }}
    >
      <StatusPill tone={status.tone}>
        <StatusIcon className="mr-1 size-3.5" />
        {status.label}
      </StatusPill>
      {items.length === 0 ? (
        <span className="col-span-4 text-sm text-muted-foreground">
          No meaningful movement detected
        </span>
      ) : (
        movementMetricOrder.map((metric) => {
          const item = itemsByMetric.get(metric);

          return item ? (
            <MovementMetricPill key={metric} item={item} />
          ) : (
            <span key={metric} aria-hidden="true" className="h-12" />
          );
        })
      )}
    </div>
  );
}

const movementMetricOrder = ["Carry", "Offline", "Ball speed", "Launch"] as const;

function MovementMetricPill({ item }: { item: MovementItem }) {
  return (
    <span
      className={cn(
        "grid h-12 w-full content-center gap-0.5 rounded-lg border px-2.5 py-1.5",
        movementPillToneClasses[item.tone],
      )}
    >
      <span className="text-base font-bold leading-5">{item.value}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{item.metric}</span>
    </span>
  );
}

function TrustLadderPanel({ items }: { items: TrustLadderItem[] }) {
  return (
    <DataPanel stretch className="h-full">
      <SectionHeader
        title="Trust ladder"
        description="Trust considers distance, direction, strike quality, and clean-shot sample depth."
        action={<Gauge className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid flex-1 content-between gap-2">
        {items.map((item) => (
          <Link
            key={item.clubId}
            href={`/bag/${item.clubId}/analytics`}
            prefetch={false}
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

function CoachTimelinePanel({ summary }: { summary: ProgressSummary }) {
  const items = coachTimelineItems(summary);

  return (
    <DataPanel>
      <SectionHeader
        title="AI Coach timeline"
        description="A running coaching narrative from current progress, next focus and recent milestones."
        action={<StatusPill tone="green">Live narrative</StatusPill>}
      />
      <CardContent className="pt-3">
        <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => (
            <CoachTimelineCard key={`${item.title}-${index}`} item={item} />
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

type CoachTimelineItem = {
  clubId?: string;
  dateLabel: string;
  label: string;
  title: string;
  detail: string;
  action: string;
  tone: Tone;
  icon: LucideIcon;
};

function CoachTimelineCard({ item }: { item: CoachTimelineItem }) {
  const Icon = item.icon;
  const content = (
    <div className="relative grid h-full min-h-44 grid-rows-[auto_1fr_auto] rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-300">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={item.tone}>
          <Icon className="mr-1 size-3" />
          {item.label}
        </StatusPill>
        <StatusPill tone="slate">
          <CalendarDays className="mr-1 size-3" />
          {item.dateLabel}
        </StatusPill>
      </div>
      <div className="mt-3 min-w-0">
        <p className="text-base font-semibold leading-6 text-[#111827]">{item.title}</p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{item.detail}</p>
      </div>
      <p className="mt-4 text-sm font-semibold text-[#087A3D]">{item.action}</p>
    </div>
  );

  return item.clubId ? (
    <Link href={`/bag/${item.clubId}/analytics`} prefetch={false} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}

function coachTimelineItems(summary: ProgressSummary): CoachTimelineItem[] {
  const items: CoachTimelineItem[] = [];

  if (summary.bestSignal) {
    items.push({
      clubId: summary.bestSignal.clubId,
      dateLabel: "Now",
      label: "Coach read",
      title: summary.bestSignal.value.replace(/\.$/, ""),
      detail: summary.bestSignal.why,
      action: "Protect this trend",
      tone: summary.bestSignal.tone,
      icon: Brain,
    });
  }

  const nextPriority = summary.practicePlan[0];
  if (nextPriority) {
    items.push({
      clubId: nextPriority.clubId,
      dateLabel: "Next block",
      label: "Practice switch",
      title: `${formatClubType(nextPriority.clubType)} becomes the focus`,
      detail: nextPriority.reason,
      action: practiceCtaLabel(nextPriority),
      tone: nextPriority.tone,
      icon: Target,
    });
  }

  for (const event of summary.journey.slice(0, 4)) {
    const milestone = journeyMilestone(event);
    items.push({
      clubId: event.clubId,
      dateLabel: event.dateLabel,
      label: milestone.label,
      title: event.title,
      detail: event.detail,
      action: "Review supporting shots",
      tone: event.tone,
      icon: milestone.icon,
    });
  }

  if (items.length === 0) {
    items.push({
      dateLabel: "Next import",
      label: "Coach read",
      title: "Build the first timeline entry",
      detail:
        "Import a comparable stock-shot session so the coach narrative can start tracking progress.",
      action: "Import CSV",
      tone: "slate",
      icon: Upload,
    });
  }

  return uniqueCoachTimelineItems(items).slice(0, 4);
}

function uniqueCoachTimelineItems(items: CoachTimelineItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.clubId ?? item.title}-${item.label}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function journeyMilestone(event: JourneyEvent): { label: string; icon: LucideIcon; tone: Tone } {
  const title = event.title.toLowerCase();

  if (title.includes("trust leader")) {
    return { label: "Trust leader", icon: Trophy, tone: "green" };
  }

  if (title.includes("trust crossed")) {
    return { label: "Above 75%", icon: Trophy, tone: "green" };
  }

  if (title.includes("start line")) {
    return { label: "Start line", icon: Target, tone: "sky" };
  }

  if (title.includes("now playable")) {
    return { label: "Playable", icon: CheckCircle2, tone: "green" };
  }

  if (title.includes("useful carry")) {
    return { label: "Carry gain", icon: TrendingUp, tone: "green" };
  }

  if (title.includes("carry high")) {
    return { label: "Carry high", icon: Trophy, tone: "sky" };
  }

  return { label: "Milestone", icon: Sparkles, tone: event.tone };
}

type MovementItem = {
  metric: string;
  value: string;
  tone: Tone;
};

function movementStatus(row: ProgressClubRow): { label: string; tone: Tone; icon: LucideIcon } {
  const momentum = progressClubMomentum(row);

  if (momentum >= 3) {
    return { label: "Improving", tone: "green", icon: TrendingUp };
  }

  if (momentum <= -2) {
    return { label: "Regressing", tone: "amber", icon: TrendingDown };
  }

  return { label: "Stable", tone: "slate", icon: Gauge };
}

function movementItems(row: ProgressClubRow) {
  const items: MovementItem[] = [];

  if (isMeaningful(row.carryDeltaYd, 1)) {
    items.push({
      metric: "Carry",
      value: `${formatSigned(row.carryDeltaYd)} yd`,
      tone: row.carryDeltaYd >= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.offlineDeltaYd, 0.5)) {
    items.push({
      metric: "Offline",
      value: `${numberFormatter.format(Math.abs(row.offlineDeltaYd))} yd ${
        row.offlineDeltaYd <= 0 ? "tighter" : "wider"
      }`,
      tone: row.offlineDeltaYd <= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.ballSpeedDeltaMph, 0.3)) {
    items.push({
      metric: "Ball speed",
      value: `${formatSigned(row.ballSpeedDeltaMph)} mph`,
      tone: row.ballSpeedDeltaMph >= 0 ? "green" : "amber",
    });
  }

  if (isMeaningful(row.launchDeltaDeg, 0.3)) {
    items.push({
      metric: "Launch",
      value: `${formatSigned(row.launchDeltaDeg)} deg`,
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

function progressVerdictChip(summary: ProgressSummary) {
  if (summary.totals.trackedCleanShots === 0) {
    return "Build a clean baseline.";
  }

  const standout = progressVerdictStandout(summary);
  const opportunity = progressVerdictOpportunity(summary, standout?.clubId);
  const parts = ["Improving", standout?.text, opportunity].filter(Boolean);

  return `${parts.join(". ")}.`;
}

function progressVerdictLabel(summary: ProgressSummary) {
  if (summary.totals.trackedCleanShots === 0) {
    return "Baseline needed";
  }

  const needsWork = summary.rankings.needsWork;
  return needsWork ? `Improving · ${formatClubType(needsWork.clubType)} next` : "Improving";
}

function progressVerdictStandout(summary: ProgressSummary) {
  const bestSignal = summary.bestSignal;
  if (bestSignal?.clubId) {
    return {
      clubId: bestSignal.clubId,
      text: bestSignal.value.replace(/\.$/, ""),
    };
  }

  const row = summary.rankings.mostImproved ?? summary.rankings.mostTrusted;
  if (!row) {
    return null;
  }

  const club = formatClubType(row.clubType);
  if (isMeaningful(row.offlineDeltaYd, 1)) {
    return {
      clubId: row.clubId,
      text: `${club} dispersion ${numberFormatter.format(Math.abs(row.offlineDeltaYd))} yd ${
        row.offlineDeltaYd <= 0 ? "tighter" : "wider"
      }`,
    };
  }

  if (isMeaningful(row.carryDeltaYd, 1)) {
    return {
      clubId: row.clubId,
      text: `${club} carry ${formatSigned(row.carryDeltaYd)} yd`,
    };
  }

  return {
    clubId: row.clubId,
    text: `${club} trust now ${row.trustIndex}%`,
  };
}

function progressVerdictOpportunity(summary: ProgressSummary, standoutClubId: string | undefined) {
  const priority =
    summary.practicePlan.find((item) => item.clubId !== standoutClubId) ??
    summary.rankings.needsWork;

  if (!priority) {
    return null;
  }

  return `${formatClubType(priority.clubType)} remains the main opportunity`;
}

function progressScore(summary: ProgressSummary) {
  const playable = summary.totals.averagePlayableRate ?? summary.totals.averageTrust;
  const sampleDepth = clampNumber((summary.totals.trackedCleanShots / 180) * 100, 0, 100);
  const movement = clampNumber(
    50 + averageNumber(summary.clubRows.map(progressClubMomentum)) * 4,
    0,
    100,
  );

  return Math.round(
    clampNumber(
      summary.totals.averageTrust * 0.45 + playable * 0.25 + sampleDepth * 0.15 + movement * 0.15,
      0,
      100,
    ),
  );
}

function progressScoreMomentum(summary: ProgressSummary) {
  return clampNumber(
    Math.round(averageNumber(summary.clubRows.map(progressClubMomentum)) * 1.5),
    -12,
    12,
  );
}

function progressScoreReadout(summary: ProgressSummary, momentum: number) {
  const rankedSignals = progressScoreClubSignals(summary);
  const best = rankedSignals.find((signal) => signal.direction === "up");
  const drag = rankedSignals.find((signal) => signal.direction === "down");
  const positiveCount = summary.clubRows.filter((row) => progressClubMomentum(row) > 0).length;

  if (momentum >= 4 && best) {
    return `You are improving faster than your baseline trend, led by ${formatClubType(best.clubType)}.`;
  }

  if (momentum <= -3 && drag) {
    return `Progress has slowed because ${formatClubType(drag.clubType)} is pulling the bag trend down.`;
  }

  if (positiveCount > 0 && positiveCount <= 2 && summary.clubRows.length > 2) {
    return `Progress is forming, but only ${positiveCount} clubs are clearly changing.`;
  }

  if (best && drag) {
    return `${formatClubType(best.clubType)} is moving the bag forward; ${formatClubType(drag.clubType)} still needs work.`;
  }

  return "Keep adding comparable stock-shot sessions so the score can separate real movement from noise.";
}

function technicalReadiness(summary: ProgressSummary) {
  const score = progressScore(summary);
  const playable = summary.totals.averagePlayableRate ?? summary.totals.averageTrust;
  const trustedShare =
    summary.clubRows.length === 0
      ? 0
      : (summary.clubRows.filter((row) => row.trustIndex >= 68).length / summary.clubRows.length) *
        100;
  const dataGapPenalty = Math.min(summary.dataGaps.length * 4, 16);

  return Math.round(
    clampNumber(score * 0.55 + playable * 0.25 + trustedShare * 0.2 - dataGapPenalty, 0, 96),
  );
}

function break80Trend(summary: ProgressSummary) {
  return clampNumber(Math.round(progressScoreMomentum(summary) * 1.2), -10, 10);
}

function break80Needs(summary: ProgressSummary) {
  const needs = uniqueClubLabels([
    ...summary.practicePlan.slice(0, 3),
    summary.rankings.needsWork,
    ...summary.dataGaps.slice(0, 1),
  ]).slice(0, 3);

  return needs.length > 0 ? needs : ["More data"];
}

function progressCoachSentence(summary: ProgressSummary) {
  const best = summary.rankings.mostImproved ?? summary.rankings.mostTrusted;
  const blocker = summary.practicePlan[0] ?? summary.rankings.needsWork;

  if (best && blocker && best.clubId !== blocker.clubId) {
    return `${formatClubType(best.clubType)} is moving the bag forward; ${formatClubType(blocker.clubType)} remains the next scoring gate.`;
  }

  if (best) {
    return `${formatClubType(best.clubType)} is the strongest development signal; keep building enough clean shots for the next limiter to separate.`;
  }

  return "The next clean stock-shot block will show which club is holding the scoring goal back.";
}

function goalProgressLabel(progress: number) {
  if (progress >= 80) {
    return "Strong technical base";
  }

  if (progress >= 65) {
    return "Technical base forming";
  }

  if (progress >= 45) {
    return "Building";
  }

  return "Needs baseline";
}

function scoringConfidenceReadout(evidence: ProgressScoringEvidence): {
  label: string;
  detail: string;
  tone: Tone;
} {
  const count = evidence.comparableRoundCount;
  const confidence = calculateScoringConfidence(count);
  const roundLabel = `${integerFormatter.format(count)} comparable real ${count === 1 ? "round" : "rounds"}`;
  const latest = evidence.latestComparableRoundAt
    ? ` Latest: ${shortDateFormatter.format(evidence.latestComparableRoundAt)}.`
    : "";

  if (count > 0) {
    return {
      label: confidence.label,
      detail:
        count < 3
          ? `${roundLabel}; not enough to connect range form to scoring.${latest}`
          : `${roundLabel}.${latest}`,
      tone: confidence.tone,
    };
  }

  return {
    label: confidence.label,
    detail: "Add a scored real round before making a scoring-readiness call.",
    tone: confidence.tone,
  };
}

type ProgressScoreClubSignal = {
  clubId: string;
  clubType: string;
  value: string;
  detail: string;
  tone: Tone;
  direction: "up" | "down";
  momentum: number;
};

type ProgressScoreCandidate = {
  row: ProgressClubRow;
  momentum: number;
};

function progressScoreClubSignals(summary: ProgressSummary): ProgressScoreClubSignal[] {
  const candidates = summary.clubRows
    .filter((row) => row.sampleSize >= 3)
    .map((row) => ({
      row,
      momentum: progressClubMomentum(row),
    }));
  const positives = [...candidates]
    .filter((candidate) => candidate.momentum > 0)
    .sort((left, right) => right.momentum - left.momentum)
    .slice(0, 3);
  const biggestDrag =
    [...candidates]
      .filter((candidate) => candidate.momentum < 0)
      .sort((left, right) => left.momentum - right.momentum)[0] ?? null;
  const fallback = [...candidates].sort(
    (left, right) => Math.abs(right.momentum) - Math.abs(left.momentum),
  );
  const picked = uniqueProgressScoreSignals(
    [...positives, biggestDrag, ...fallback].filter(
      (candidate): candidate is ProgressScoreCandidate => candidate !== null,
    ),
  );

  return picked.slice(0, 4).map(({ row, momentum }) => ({
    clubId: row.clubId,
    clubType: row.clubType,
    value: progressScoreClubValue(row, momentum),
    detail: progressScoreClubDetail(row, momentum),
    tone: momentum >= 0 ? "green" : "amber",
    direction: momentum >= 0 ? "up" : "down",
    momentum,
  }));
}

function uniqueProgressScoreSignals(candidates: ProgressScoreCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    if (seen.has(candidate.row.clubId)) {
      return false;
    }

    seen.add(candidate.row.clubId);
    return true;
  });
}

function progressScoreClubValue(row: ProgressClubRow, momentum: number) {
  if (isMeaningful(row.offlineDeltaYd, 0.5)) {
    return `${numberFormatter.format(Math.abs(row.offlineDeltaYd))} yd ${
      row.offlineDeltaYd <= 0 ? "tighter" : "wider"
    }`;
  }

  if (isMeaningful(row.carryDeltaYd, 1)) {
    return `${formatSigned(row.carryDeltaYd)} yd`;
  }

  if (isMeaningful(row.ballSpeedDeltaMph, 0.3)) {
    return `${formatSigned(row.ballSpeedDeltaMph)} mph`;
  }

  return momentum >= 0 ? "Holding" : "Watch";
}

function progressScoreClubDetail(row: ProgressClubRow, momentum: number) {
  const base = `${row.trustIndex}% trust · ${row.sampleSize} clean shots`;

  return momentum >= 0 ? `${base} · adding progress` : `${base} · limiting progress`;
}

function progressClubMomentum(row: ProgressClubRow) {
  let score = 0;

  if (row.carryDeltaYd !== null) {
    score += clampNumber(row.carryDeltaYd, -8, 8) * 0.45;
  }

  if (row.offlineDeltaYd !== null) {
    score += clampNumber(-row.offlineDeltaYd, -8, 8) * 0.8;
  }

  if (row.ballSpeedDeltaMph !== null) {
    score += clampNumber(row.ballSpeedDeltaMph, -4, 4);
  }

  if (row.trustIndex >= 75) {
    score += 2;
  } else if (row.trustIndex < 60) {
    score -= 1.5;
  }

  if (row.sampleSize < 6) {
    score -= 1;
  }

  return Math.round(score);
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

type RoadmapItem = {
  title: string;
  detail: string;
  label: string;
  action: string;
  href: string;
  tone: Tone;
};

function buildRoadmapItems(summary: ProgressSummary): RoadmapItem[] {
  const items: RoadmapItem[] = summary.practicePlan.slice(0, 3).map((priority) => ({
    title: priority.title,
    detail: priority.reason,
    label: priority.priorityLabel.replace(" priority", ""),
    action: "Start drill",
    href: `/bag/${priority.clubId}/analytics`,
    tone: priority.tone,
  }));

  const weakClub = summary.rankings.needsWork;
  if (items.length < 3 && weakClub) {
    items.push({
      title: `${formatClubType(weakClub.clubType)} trust rebuild`,
      detail: `${weakClub.trustIndex}% trust with ${weakClub.primaryMiss.toLowerCase()} as the main miss pattern.`,
      label: "Leak",
      action: "Review club",
      href: `/bag/${weakClub.clubId}/analytics`,
      tone: "amber",
    });
  }

  const dataGap = summary.dataGaps[0];
  if (items.length < 3 && dataGap) {
    items.push({
      title: `${formatClubType(dataGap.clubType)} data gap`,
      detail: dataGap.detail,
      label: "Sample",
      action: "Fill gap",
      href: `/bag/${dataGap.clubId}/analytics`,
      tone: "slate",
    });
  }

  while (items.length < 3) {
    items.push({
      title: "Build next baseline",
      detail: "Import a comparable session so the roadmap can rank the next practice job.",
      label: "Data",
      action: "Import CSV",
      href: "/import",
      tone: "slate",
    });
  }

  return items.slice(0, 3);
}

function roadmapStepLabel(index: number) {
  if (index === 0) {
    return "Do now";
  }

  if (index === 1) {
    return "Do next";
  }

  return "Later";
}

function roadmapGoalLabel() {
  return "Next scoring roadmap";
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
    case "Carry stable":
      return "Bag-average carry is effectively unchanged. That is a stable baseline, not a regression.";
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

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function averageNumber(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundForSvg(value: number) {
  return Math.round(value * 10) / 10;
}

const progressScoreClubClasses: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50/55 text-emerald-800",
  sky: "border-sky-200 bg-sky-50/55 text-sky-800",
  pink: "border-rose-200 bg-rose-50/55 text-rose-800",
  amber: "border-amber-200 bg-amber-50/55 text-amber-800",
  slate: "border-slate-200 bg-slate-50/70 text-slate-700",
};

const movementPillToneClasses: Record<Tone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  pink: "border-rose-200 bg-rose-50 text-rose-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

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
    green: "var(--chart-series-green, #0B7A3B)",
    sky: "var(--chart-series-sky, #0284C7)",
    pink: "var(--chart-series-pink, #BE185D)",
    amber: "var(--chart-series-amber, #B45309)",
    slate: "var(--chart-series-slate, #64748B)",
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
