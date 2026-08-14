import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
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
import { DistanceLossDiagnosisPanel } from "@/components/progress/distance-loss-diagnosis-panel";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DesktopAiPrompt,
  DesktopInsightMetric,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { LazyMetricTrendCard } from "@/components/progress/lazy-metric-trend-card";
import { StatusTimeline } from "@/components/app/status-timeline";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getDistanceLossDiagnosisData } from "@/lib/distance-loss-diagnosis-data";
import { getPracticePlannerProgressSummary } from "@/lib/practice-planner";
import {
  getProgressData,
  getProgressScoringEvidence,
  type ProgressScoringEvidence,
} from "@/lib/progress-data";
import {
  buildProgressSummary,
  type JourneyEvent,
  type PracticePriority,
  type ProgressClubRow,
  type ProgressSummary,
  type ProgressTrend,
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
    title: "Trust review",
    href: "/progress?bag=needs-work#bag-movement",
    detail: "Review low-trust or under-sampled clubs before changing the bag.",
  },
  {
    title: "Bag evolution",
    href: "/bag?tab=history#club-evolution",
    detail: "Open the canonical monthly carry-evolution evidence in Bag.",
  },
  {
    title: "Progress report",
    href: "/progress#bag-movement",
    detail: "Export the visible trust, clean-shot, carry and movement rows.",
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
  const [userId, surface] = await Promise.all([requireCurrentUserId(), getRequestAppSurface()]);
  const [
    params,
    data,
    scoringEvidence,
    distanceLossDiagnosis,
    featureData,
    practicePlannerSummary,
    weeklyEvidence,
  ] = await Promise.all([
    searchParams,
    getProgressData(userId),
    getProgressScoringEvidence(userId),
    getDistanceLossDiagnosisData(userId),
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

  if (surface === "companion") {
    return (
      <PageShell>
        <div className="grid min-w-0 gap-4" data-progress-companion>
          {data.clubs.length === 0 ? (
            <MobileProgressEmptyState />
          ) : (
            <>
              <MobileProgressAnswer
                summary={summary}
                scoringEvidence={scoringEvidence}
                review={weeklyChangeReview}
              />
              <MobileProgressDisclosures
                summary={summary}
                review={weeklyChangeReview}
                diagnosis={distanceLossDiagnosis}
                practicePlannerSummary={practicePlannerSummary}
                practiceCalendar={featureData.practiceCalendar}
                activeFilter={bagFilter}
                openBagByDefault={params?.bag !== undefined}
              />
            </>
          )}
        </div>
      </PageShell>
    );
  }

  const { DesktopInsightRail, DesktopWorkbenchLayout } =
    await import("@/components/app/desktop-workbench");

  return (
    <PageShell>
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
                href: "/bag?tab=history#club-evolution",
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
        <div className="flex items-center justify-between gap-4">
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

        <div className="contents" data-progress-workbench>
          <ProgressHeroPanel summary={summary} mostImproved={mostImproved} />

          {data.clubs.length === 0 ? (
            <AppEmptyState
              icon={<Sparkles className="size-5" />}
              title="No progress baseline yet"
              description="Import a Rapsodo CSV and LM World Tour will build first-vs-latest club comparisons automatically."
              primaryAction={
                <Button asChild>
                  <Link href="/import" prefetch={false}>
                    <Upload className="size-4" />
                    Import CSV
                  </Link>
                </Button>
              }
            />
          ) : (
            <Tabs defaultValue="performance" className="min-w-0 gap-5" data-progress-workspace>
              <TabsList variant="line" aria-label="Progress workspace">
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="goals">Goals</TabsTrigger>
                <TabsTrigger value="load">Training load</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="performance" className="grid min-w-0 gap-5">
                <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                  <WeeklyRecapPanel
                    data={featureData}
                    summary={summary}
                    review={weeklyChangeReview}
                  />
                  <DistanceLossDiagnosisPanel diagnosis={distanceLossDiagnosis} />
                </div>
                <ProgressTrendsPanel summary={summary} />
                <BagMovementPanel rows={summary.clubRows} activeFilter={bagFilter} />
              </TabsContent>

              <TabsContent value="goals" className="grid min-w-0 gap-5">
                <GoalProgressPanel summary={summary} scoringEvidence={scoringEvidence} />
                <ProgressRoadmapPanel summary={summary} />
              </TabsContent>

              <TabsContent value="load" className="grid min-w-0 gap-5">
                <ProgressPracticePlannerPanel
                  summary={practicePlannerSummary}
                  priorities={summary.practicePlan}
                />
              </TabsContent>

              <TabsContent value="timeline" className="grid min-w-0 gap-5">
                <div id="journey" className="scroll-mt-28">
                  <CoachTimelinePanel summary={summary} />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type MobileDistanceDiagnosis = Awaited<ReturnType<typeof getDistanceLossDiagnosisData>>;
type MobilePracticePlannerSummary = Awaited<ReturnType<typeof getPracticePlannerProgressSummary>>;

function MobileProgressEmptyState() {
  return (
    <section
      data-mobile-progress-empty
      className="min-w-0 overflow-hidden rounded-[1.15rem] border border-border bg-card"
    >
      <div className="px-5 pb-5 pt-6">
        <IOSInlineStatus label="Baseline needed" tone="attention" />
        <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-tight text-foreground">
          Build your first progress readout
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          Import a measured Rapsodo session and ForeKingHell will compare each club with your own
          clean-shot baseline.
        </p>
        <Button asChild className="mt-5 min-h-11 w-full rounded-xl" data-primary-action>
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" aria-hidden="true" />
            Import first session
          </Link>
        </Button>
      </div>
      <IOSGroupedList label="What happens next" className="rounded-none border-x-0 border-b-0">
        <IOSListRow
          label="Import measured shots"
          value="Rapsodo CSV"
          detail="Start with one recent range or course session."
        />
        <IOSListRow
          label="Build useful samples"
          value="8+ clean shots"
          detail="Enough comparable stock shots lets a club trend separate."
        />
        <IOSListRow
          label="Review the first action"
          value="Progress + Coach"
          detail="The app will surface the strongest move, weakest area and next practice job."
        />
      </IOSGroupedList>
    </section>
  );
}

function MobileProgressAnswer({
  summary,
  scoringEvidence,
  review,
}: {
  summary: ProgressSummary;
  scoringEvidence: ProgressScoringEvidence;
  review: WeeklyChangeReview;
}) {
  const score = progressScore(summary);
  const momentum = progressScoreMomentum(summary);
  const readiness = technicalReadiness(summary);
  const scoringConfidence = scoringConfidenceReadout(scoringEvidence);
  const strongest = summary.rankings.mostImproved;
  const weakest = summary.rankings.needsWork;
  const dataGap = summary.dataGaps[0] ?? null;

  return (
    <section
      data-mobile-progress-answer
      aria-labelledby="mobile-progress-title"
      className="min-w-0 overflow-hidden rounded-[1.15rem] border border-border bg-card"
    >
      <div className="px-5 pb-5 pt-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Development report
        </p>
        <h1
          id="mobile-progress-title"
          className="mt-1 text-[30px] font-bold leading-9 tracking-tight text-foreground"
        >
          Bag progress
        </h1>
        <div className="mt-4 flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">Current level</p>
            <p className="mt-0.5 text-[40px] font-bold leading-none tracking-tight text-foreground tabular-nums">
              {score}
              <span className="ml-1 text-lg font-semibold text-muted-foreground">/ 100</span>
            </p>
          </div>
          <IOSInlineStatus
            label={`${momentum >= 0 ? "Up" : "Down"} ${numberFormatter.format(Math.abs(momentum))} vs baseline`}
            tone={momentum >= 0 ? "positive" : "attention"}
            className="mb-1 max-w-[54%] flex-wrap justify-end text-right leading-4"
          />
        </div>
        <div
          role="progressbar"
          aria-label="Overall progress score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
        </div>
        <p className="mt-3 text-[14px] leading-5 text-muted-foreground">
          {progressScoreReadout(summary, momentum)}
        </p>
        <div className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1">
          <IOSInlineStatus label={`${readiness}% technical readiness`} tone="info" />
          <IOSInlineStatus
            label={`${scoringConfidence.label} scoring confidence`}
            tone={mobileProgressTone(scoringConfidence.tone)}
          />
        </div>
      </div>

      <div className="border-t border-border px-5 py-5">
        <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Next action
        </p>
        <h2 className="mt-1 text-[20px] font-semibold leading-6 text-foreground">
          {review.nextAction.value}
        </h2>
        <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
          {review.nextAction.detail}
        </p>
        {dataGap ? (
          <div className="mt-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] px-3 py-2.5">
            <IOSInlineStatus
              label={`${formatClubType(dataGap.clubType)} data gap`}
              tone="attention"
            />
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{dataGap.detail}</p>
          </div>
        ) : null}
        <Button asChild className="mt-4 min-h-11 w-full rounded-xl" data-primary-action>
          <Link href={review.nextAction.href} prefetch={false}>
            <Target className="size-4" aria-hidden="true" />
            Take next action
          </Link>
        </Button>
      </div>

      <IOSGroupedList
        label="Strongest and weakest progress signals"
        className="rounded-none border-x-0 border-b-0"
      >
        <IOSListRow
          label="Strongest movement"
          value={strongest ? formatClubType(strongest.clubType) : "Building"}
          detail={strongest ? strongestImprovementDetail(strongest) : "No stable mover yet."}
          href={strongest ? `/bag/${strongest.clubId}/analytics` : undefined}
          status={
            <IOSInlineStatus
              label={strongest ? `${strongest.trustIndex}% trust` : "More evidence needed"}
              tone={strongest ? "positive" : "neutral"}
            />
          }
        />
        <IOSListRow
          label="Weakest area"
          value={weakest ? formatClubType(weakest.clubType) : "No clear leak"}
          detail={
            weakest
              ? `${weakest.primaryMiss} miss · ${weakest.sampleSize} clean shots.`
              : "No sampled club has separated as the main concern."
          }
          href={weakest ? `/bag/${weakest.clubId}/analytics` : undefined}
          status={
            <IOSInlineStatus
              label={weakest ? `${weakest.trustIndex}% trust` : "Stable for now"}
              tone={weakest ? "attention" : "positive"}
            />
          }
        />
      </IOSGroupedList>
    </section>
  );
}

function MobileProgressDisclosures({
  summary,
  review,
  diagnosis,
  practicePlannerSummary,
  practiceCalendar,
  activeFilter,
  openBagByDefault,
}: {
  summary: ProgressSummary;
  review: WeeklyChangeReview;
  diagnosis: MobileDistanceDiagnosis;
  practicePlannerSummary: MobilePracticePlannerSummary;
  practiceCalendar: FeatureIdeasData["practiceCalendar"];
  activeFilter: BagMovementFilter;
  openBagByDefault: boolean;
}) {
  const filteredClubCount = summary.clubRows.filter((row) =>
    bagMovementFilterMatches(row, activeFilter),
  ).length;
  const nextPriority = summary.practicePlan[0] ?? null;
  const timelineCount = coachTimelineItems(summary).length;

  return (
    <section id="mobile-progress-details" className="grid min-w-0 gap-2 scroll-mt-24">
      <IOSSectionHeader
        title="Progress detail"
        description="Open one section when you need the evidence behind the current read."
      />
      <IOSDisclosureGroup
        label="Progress detail sections"
        defaultValue={openBagByDefault ? "bag-movement" : undefined}
        items={[
          {
            value: "this-week",
            title: "This week",
            summary: review.dataFreshness.value,
            description: "Recap, wins, blockers and completed work",
            content: <MobileWeeklyRecap review={review} />,
            contentClassName: "px-3 pb-3 pt-3",
          },
          {
            value: "trends",
            title: "Trends",
            summary: `${summary.trends.length} signals`,
            description: "Baseline movement and specialist trend charts",
            content: <MobileProgressTrends summary={summary} />,
            contentClassName: "px-3 pb-3 pt-3",
          },
          {
            value: "practice",
            title: "Practice",
            summary: nextPriority ? formatClubType(nextPriority.clubType) : "Build baseline",
            description: "The current plan, planner evidence and calendar",
            content: (
              <MobileProgressPractice
                summary={summary}
                planner={practicePlannerSummary}
                calendar={practiceCalendar}
              />
            ),
            contentClassName: "px-3 pb-3 pt-3",
          },
          {
            value: "coach-evidence",
            title: "Coach evidence",
            summary: `${summary.dataGaps.length} data gap${summary.dataGaps.length === 1 ? "" : "s"}`,
            description: "Why the recommendation exists and what limits it",
            content: <MobileCoachEvidence summary={summary} diagnosis={diagnosis} />,
            contentClassName: "px-3 pb-3 pt-3",
          },
          {
            value: "bag-movement",
            title: "Bag movement",
            summary: `${filteredClubCount} club${filteredClubCount === 1 ? "" : "s"}`,
            description: "Native club rows instead of the full workbench table",
            content: <MobileBagMovement rows={summary.clubRows} activeFilter={activeFilter} />,
            contentClassName: "px-3 pb-3 pt-3",
          },
          {
            value: "journey",
            title: "Journey",
            summary: `${timelineCount} update${timelineCount === 1 ? "" : "s"}`,
            description: "The coach narrative and recent milestones",
            content: <MobileProgressJourney summary={summary} />,
            contentClassName: "px-3 pb-3 pt-3",
          },
        ]}
      />
    </section>
  );
}

function MobileWeeklyRecap({ review }: { review: WeeklyChangeReview }) {
  const rows: Array<{
    label: string;
    value: string;
    detail: string;
    href?: string;
    tone: Tone;
  }> = [
    { label: "Largest improvement", ...review.largestImprovement },
    { label: "Largest decline", ...review.largestDecline },
    { label: "Sessions and rounds", ...review.completedVolume, href: "/sessions" },
    {
      label: "Data-quality issues",
      ...review.dataQuality,
      href: "/analyse/workspace#data-quality",
    },
    { label: "New personal bests", ...review.personalBests, href: "/achievements" },
    { label: "Data freshness", ...review.dataFreshness },
    { label: "Practice completed", ...review.practiceCompleted, href: "/practice" },
    {
      label: "Bag-number change",
      ...review.bagNumberChange,
      href: "/progress?bag=all#mobile-bag-movement",
    },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <IOSGroupedList label="This week's progress recap">
        {rows.map((row) => (
          <IOSListRow
            key={row.label}
            label={row.label}
            value={row.value}
            detail={row.detail}
            href={row.href}
            status={
              <IOSInlineStatus
                label={mobileProgressToneLabel(row.tone)}
                tone={mobileProgressTone(row.tone)}
              />
            }
          />
        ))}
      </IOSGroupedList>

      <div className="grid grid-cols-2 gap-2">
        <form action={saveCurrentWeeklyRecapAction} className="min-w-0">
          <Button type="submit" variant="outline" className="min-h-11 w-full rounded-xl px-3">
            <Bookmark className="size-4" aria-hidden="true" />
            Save recap
          </Button>
        </form>
        <Button asChild className="min-h-11 min-w-0 rounded-xl px-3">
          <Link href={review.nextAction.href} prefetch={false}>
            <Target className="size-4" aria-hidden="true" />
            Next action
          </Link>
        </Button>
      </div>

      <IOSGroupedList label="Weekly recap actions">
        <IOSListRow label="Build next practice" href="/practice" />
        <IOSListRow label="Share with coach" href="/coach/workspace" />
        <IOSListRow label="Export weekly report" href="/coach/reports?template=monthly" />
      </IOSGroupedList>
    </div>
  );
}

function MobileProgressTrends({ summary }: { summary: ProgressSummary }) {
  const usableTrendCount = summary.trends.filter((trend) => trend.points.length >= 2).length;

  return (
    <div className="grid min-w-0 gap-4">
      <IOSGroupedList label="Trend comparison context">
        <IOSListRow label="Baseline" value="Personal baseline" />
        <IOSListRow label="Period" value="All saved data" />
        <IOSListRow
          label="Evidence"
          value={`${integerFormatter.format(summary.totals.trackedCleanShots)} clean shots`}
          detail={`${usableTrendCount} of ${summary.trends.length} trends have enough points for a chart.`}
        />
      </IOSGroupedList>

      <IOSGroupedList label="Progress trend charts">
        {summary.trends.length > 0 ? (
          summary.trends.map((trend) => (
            <article key={trend.label} className="ios-grouped-row min-w-0 px-4 py-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-medium leading-5 text-foreground">
                    {trend.label}
                  </h3>
                  <p className="mt-1 text-[22px] font-semibold leading-7 text-foreground tabular-nums">
                    {trend.value}
                  </p>
                </div>
                <IOSInlineStatus
                  label={mobileProgressToneLabel(trend.tone)}
                  tone={mobileProgressTone(trend.tone)}
                  className="shrink-0"
                />
              </div>
              <Sparkline
                points={trend.points}
                tone={trend.tone}
                ariaLabel={`${trend.label} trend: ${trend.value}`}
              />
              <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
                {trendVerdict(trend, summary)}
              </p>
              {trendFootnote(trend, summary) ? (
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                  {trendFootnote(trend, summary)}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <IOSListRow
            label="No stable trends yet"
            detail="Import another comparable clean-shot session to establish movement."
          />
        )}
      </IOSGroupedList>
      <p className="px-1 text-[12px] leading-5 text-muted-foreground">
        {progressTrendChartSummary(summary.trends)}
      </p>
    </div>
  );
}

function MobileProgressPractice({
  summary,
  planner,
  calendar,
}: {
  summary: ProgressSummary;
  planner: MobilePracticePlannerSummary;
  calendar: FeatureIdeasData["practiceCalendar"];
}) {
  const roadmap = buildRoadmapItems(summary);

  return (
    <div className="grid min-w-0 gap-4">
      <IOSSectionHeader
        title="Current plan"
        description="Priority one stays first; deeper task detail lives on the club screen."
      />
      <IOSGroupedList label="Ranked practice priorities">
        {summary.practicePlan.length > 0 ? (
          summary.practicePlan.map((priority, index) => (
            <IOSListRow
              key={priority.clubId}
              label={`${index + 1}. ${priority.title}`}
              value={formatClubType(priority.clubType)}
              detail={`${practiceReasonCopy(priority)} ${priority.drill}`}
              href={`/bag/${priority.clubId}/analytics`}
              status={
                <IOSInlineStatus
                  label={`${priority.priorityLabel} · coach score ${priority.score}`}
                  tone={mobileProgressTone(priority.tone)}
                />
              }
            />
          ))
        ) : (
          <IOSListRow
            label="No ranked practice plan yet"
            detail="Import clean stock shots to unlock the next practice job."
            href="/import"
          />
        )}
      </IOSGroupedList>

      <IOSSectionHeader title="This week's route" />
      <IOSGroupedList label="This week's roadmap">
        {roadmap.map((item, index) => (
          <IOSListRow
            key={`${item.title}-${index}`}
            label={`${roadmapStepLabel(index)} · ${item.title}`}
            value={item.label}
            detail={item.detail}
            href={item.href}
            status={<IOSInlineStatus label={item.action} tone={mobileProgressTone(item.tone)} />}
          />
        ))}
      </IOSGroupedList>

      <IOSSectionHeader title="Planner evidence" />
      <IOSGroupedList label="Practice planner evidence">
        <IOSListRow
          label="Planned sessions"
          value={integerFormatter.format(planner.plannedCount)}
        />
        <IOSListRow
          label="Completed sessions"
          value={integerFormatter.format(planner.completedCount)}
        />
        <IOSListRow
          label="Average score"
          value={planner.averageScore === null ? "--" : `${planner.averageScore}`}
        />
        <IOSListRow
          label="Top completed focus"
          value={planner.topFocus?.label ?? "Waiting"}
          detail={
            planner.topFocus
              ? `${planner.topFocus.completedCount} completed against this focus.`
              : "Complete a measured plan to build effectiveness evidence."
          }
        />
      </IOSGroupedList>

      <IOSSectionHeader title="Calendar" />
      <IOSGroupedList label="Practice calendar">
        {calendar.length > 0 ? (
          calendar
            .slice(0, 4)
            .map((item) => (
              <IOSListRow
                key={`${item.title}-${item.date.toISOString()}`}
                label={compactPracticeTitle(item.title)}
                value={shortDateFormatter.format(item.date)}
              />
            ))
        ) : (
          <IOSListRow
            label="Nothing planned yet"
            detail="Save a recap or practice plan to pin the next calendar block."
          />
        )}
      </IOSGroupedList>

      <Button asChild className="min-h-11 w-full rounded-xl">
        <Link href="/practice" prefetch={false}>
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Open Practice Planner
        </Link>
      </Button>
    </div>
  );
}

function MobileCoachEvidence({
  summary,
  diagnosis,
}: {
  summary: ProgressSummary;
  diagnosis: MobileDistanceDiagnosis;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <IOSSectionHeader title="Recommendation evidence" />
      <IOSGroupedList label="Coach recommendation evidence">
        {summary.bestSignal ? (
          <IOSListRow
            label={summary.bestSignal.title}
            value="Best signal"
            detail={`${summary.bestSignal.value} ${summary.bestSignal.why}`}
            href={
              summary.bestSignal.clubId ? `/bag/${summary.bestSignal.clubId}/analytics` : undefined
            }
            status={
              <IOSInlineStatus
                label={summary.bestSignal.detail}
                tone={mobileProgressTone(summary.bestSignal.tone)}
              />
            }
          />
        ) : (
          <IOSListRow
            label="No best signal has separated"
            detail="Keep importing comparable stock-shot sessions."
          />
        )}
      </IOSGroupedList>

      {summary.coachSummary.map((group) => (
        <div key={group.title} className="grid min-w-0 gap-2">
          <IOSSectionHeader title={group.title} />
          <IOSGroupedList label={group.title}>
            {group.title === "Data gaps" && summary.dataGaps.length > 0
              ? summary.dataGaps.map((gap) => (
                  <IOSListRow
                    key={gap.clubId}
                    label={`${formatClubType(gap.clubType)} needs more clean shots`}
                    value={`${gap.cleanShots} / 10`}
                    detail={`${gap.detail} ${gap.recommendation}`}
                    href={`/bag/${gap.clubId}/analytics`}
                    status={<IOSInlineStatus label="Evidence gap" tone="attention" />}
                  />
                ))
              : group.items.map((item, index) => (
                  <IOSListRow
                    key={`${group.title}-${item.clubId ?? index}`}
                    label={item.label}
                    detail={item.detail}
                    href={item.clubId ? `/bag/${item.clubId}/analytics` : undefined}
                    status={
                      <IOSInlineStatus
                        label={mobileProgressToneLabel(group.tone)}
                        tone={mobileProgressTone(group.tone)}
                      />
                    }
                  />
                ))}
          </IOSGroupedList>
        </div>
      ))}

      <IOSSectionHeader
        title="Trust ladder"
        description="Distance, direction, strike quality and sample depth remain separate evidence."
      />
      <IOSGroupedList label="Club trust ladder">
        {summary.trustLadder.map((item) => (
          <IOSListRow
            key={item.clubId}
            label={formatClubType(item.clubType)}
            value={item.trustIndex === null ? "--" : `${item.trustIndex}%`}
            detail={`${item.note} · ${item.sampleSize} clean shots.`}
            href={`/bag/${item.clubId}/analytics`}
            status={<IOSInlineStatus label={item.label} tone={mobileProgressTone(item.tone)} />}
          />
        ))}
      </IOSGroupedList>

      <MobileDistanceDiagnosis diagnosis={diagnosis} />
    </div>
  );
}

function MobileDistanceDiagnosis({ diagnosis }: { diagnosis: MobileDistanceDiagnosis }) {
  const maxCarry = Math.max(1, ...diagnosis.monthly.map((month) => month.carryYd ?? 0));

  return (
    <section className="grid min-w-0 gap-3" aria-label="Distance diagnosis">
      <IOSSectionHeader
        title="Distance diagnosis"
        description="Measured driver output and matched recent golf-exposure windows."
      />
      <IOSGroupedList label="Distance diagnosis summary">
        <IOSListRow
          label={diagnosis.headline}
          detail={diagnosis.summary}
          status={
            <IOSInlineStatus
              label={diagnosis.confidenceLabel}
              tone={diagnosis.status === "ready" ? "info" : "attention"}
            />
          }
        />
        <IOSListRow
          label="Carry"
          value={formatMobileDiagnosisChange(diagnosis.carryChangeYd, "yd")}
          detail={mobileDiagnosisComparison(diagnosis)}
        />
        <IOSListRow
          label="Measured club speed"
          value={formatMobileDiagnosisChange(diagnosis.clubSpeedChangeMph, "mph")}
          detail={mobileDiagnosisComparison(diagnosis)}
        />
        <IOSListRow
          label="Active golf days"
          value={`${diagnosis.exposure.recentActiveDays} vs ${diagnosis.exposure.previousActiveDays}`}
          detail="Latest 56 days vs previous 56 days."
        />
        <IOSListRow
          label="Measured smash"
          value={formatMobileDiagnosisChange(diagnosis.smashChange, "", 2)}
          detail={mobileDiagnosisComparison(diagnosis)}
        />
      </IOSGroupedList>

      {diagnosis.status === "ready" && diagnosis.monthly.length > 0 ? (
        <div className="min-w-0 rounded-xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                id="mobile-distance-diagnosis-title"
                className="text-[15px] font-medium text-foreground"
              >
                Driver median carry
              </h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Saved Rapsodo full shots · monthly medians
              </p>
            </div>
            <BarChart3 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          </div>
          <div
            role="img"
            aria-label={diagnosis.monthly
              .map(
                (month) =>
                  `${month.label} ${month.carryYd === null ? "no carry" : `${month.carryYd} yards`}`,
              )
              .join(", ")}
            className="mt-4 grid h-40 min-w-0 items-end gap-2 border-b border-border"
            style={{ gridTemplateColumns: `repeat(${diagnosis.monthly.length}, minmax(0, 1fr))` }}
          >
            {diagnosis.monthly.map((month) => (
              <div key={month.key} className="grid h-full min-w-0 content-end gap-1.5 text-center">
                <span className="text-[11px] font-semibold text-foreground tabular-nums">
                  {month.carryYd === null ? "--" : numberFormatter.format(month.carryYd)}
                </span>
                <div className="flex h-24 items-end justify-center">
                  <div
                    className={cn(
                      "w-full max-w-12 rounded-t-md",
                      month.key === diagnosis.current?.key ? "bg-primary" : "bg-sky-400/70",
                    )}
                    style={{
                      height: `${month.carryYd === null ? 0 : Math.max(6, (month.carryYd / maxCarry) * 100)}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>
                <span className="pb-1 text-[11px] text-muted-foreground">{month.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {diagnosis.factors.length > 0 ? (
        <IOSGroupedList label="Distance diagnosis factors">
          {diagnosis.factors.map((factor) => (
            <IOSListRow
              key={factor.key}
              label={factor.label}
              value={factor.status}
              detail={factor.detail}
              status={
                <IOSInlineStatus
                  label={mobileProgressToneLabel(factor.tone)}
                  tone={mobileProgressTone(factor.tone)}
                />
              }
            />
          ))}
        </IOSGroupedList>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-[15px] font-medium text-foreground">Recommended next test</h3>
        <ol className="mt-2 grid gap-2 text-[13px] leading-5 text-muted-foreground">
          {diagnosis.nextSteps.map((step, index) => (
            <li key={step} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-primary tabular-nums">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {diagnosis.caveats.length > 0 ? (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-[13px] font-medium text-foreground">Evidence limits</p>
            <ul className="mt-1.5 grid gap-1 text-[12px] leading-5 text-muted-foreground">
              {diagnosis.caveats.map((caveat) => (
                <li key={caveat}>• {caveat}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <Button asChild variant="outline" className="min-h-11 w-full rounded-xl">
        <Link href="/stats/training-over-time" prefetch={false}>
          <LineChart className="size-4" aria-hidden="true" />
          View training load
        </Link>
      </Button>
    </section>
  );
}

function MobileBagMovement({
  rows,
  activeFilter,
}: {
  rows: ProgressClubRow[];
  activeFilter: BagMovementFilter;
}) {
  const filters = buildBagMovementFilters(rows);
  const filteredRows = rows.filter((row) => bagMovementFilterMatches(row, activeFilter));

  return (
    <div id="mobile-bag-movement" className="grid min-w-0 gap-3 scroll-mt-24">
      <nav aria-label="Filter bag movement" className="max-w-full overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {filters.map((filter) => {
            const isActive = filter.key === activeFilter;

            return (
              <Link
                key={filter.key}
                href={mobileBagMovementFilterHref(filter.key)}
                prefetch={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-aaa inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold outline-none transition-colors motion-reduce:transition-none",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground active:bg-secondary",
                )}
              >
                {filter.label}
                <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[11px] tabular-nums">
                  {filter.count}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <IOSGroupedList label="Club movement">
        {filteredRows.length > 0 ? (
          filteredRows.map((row) => {
            const status = movementStatus(row);

            return (
              <IOSListRow
                key={row.clubId}
                label={formatClubType(row.clubType)}
                value={formatYards(row.stockCarryYd)}
                detail={`${row.brandModel} · ${row.sampleSize} clean shot${row.sampleSize === 1 ? "" : "s"}.`}
                href={`/bag/${row.clubId}/analytics`}
                status={
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <IOSInlineStatus
                      label={`${row.trustIndex}% trust`}
                      tone={row.trustIndex >= 68 ? "positive" : "attention"}
                    />
                    <span className="text-[12px] leading-5 text-muted-foreground">
                      {status.label} · {mobileMovementDetail(row)}
                    </span>
                  </span>
                }
              />
            );
          })
        ) : (
          <IOSListRow
            label="No clubs match this filter"
            detail="Choose another club family or import more clean stock shots."
          />
        )}
      </IOSGroupedList>
    </div>
  );
}

function MobileProgressJourney({ summary }: { summary: ProgressSummary }) {
  const items = coachTimelineItems(summary);

  return (
    <div className="grid min-w-0 gap-4">
      <IOSGroupedList label="Progress journey">
        {items.map((item, index) => (
          <IOSListRow
            key={`${item.title}-${index}`}
            label={item.title}
            detail={`${item.dateLabel} · ${item.detail}`}
            href={item.clubId ? `/bag/${item.clubId}/analytics` : undefined}
            icon={item.icon}
            status={
              <IOSInlineStatus
                label={`${item.label} · ${item.action}`}
                tone={mobileProgressTone(item.tone)}
              />
            }
          />
        ))}
      </IOSGroupedList>
      <IOSGroupedList label="Progress milestones">
        <IOSListRow
          label="Personal bests and milestones"
          detail="Review the achievements already earned from measured data."
          href="/achievements"
          icon={Trophy}
        />
      </IOSGroupedList>
    </div>
  );
}

function mobileProgressTone(
  tone: Tone,
): "positive" | "attention" | "critical" | "info" | "neutral" {
  if (tone === "green") return "positive";
  if (tone === "amber") return "attention";
  if (tone === "pink") return "critical";
  if (tone === "sky") return "info";
  return "neutral";
}

function mobileProgressToneLabel(tone: Tone) {
  if (tone === "green") return "Positive";
  if (tone === "amber") return "Needs attention";
  if (tone === "pink") return "Priority concern";
  if (tone === "sky") return "Current evidence";
  return "Building evidence";
}

function formatMobileDiagnosisChange(value: number | null, unit: string, precision = 1) {
  if (value === null) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(precision)}${unit ? ` ${unit}` : ""}`;
}

function mobileDiagnosisComparison(diagnosis: MobileDistanceDiagnosis) {
  return diagnosis.baseline && diagnosis.current
    ? `${diagnosis.baseline.label} to ${diagnosis.current.label}`
    : "Need comparable months";
}

function mobileBagMovementFilterHref(filter: BagMovementFilter) {
  return `/progress?bag=${filter}#mobile-bag-movement`;
}

function mobileMovementDetail(row: ProgressClubRow) {
  const items = movementItems(row).slice(0, 2);
  return items.length > 0
    ? items.map((item) => `${item.metric} ${item.value}`).join(" · ")
    : "No meaningful movement yet";
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

function ProgressHeroPanel({
  summary,
  mostImproved,
}: {
  summary: ProgressSummary;
  mostImproved: ProgressClubRow | null;
}) {
  const score = progressScore(summary);
  const momentum = progressScoreMomentum(summary);
  const leadTrend = summary.trends[0];
  const trendPoints =
    leadTrend?.points.map((value, index) => ({
      label:
        index === 0
          ? "Baseline"
          : index === leadTrend.points.length - 1
            ? "Latest"
            : `Check ${index + 1}`,
      value,
    })) ?? [];

  return (
    <section className="grid min-w-0 gap-4" data-progress-hero>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
        <LazyMetricTrendCard
          label="Overall progress"
          value={`${score} / 100`}
          detail={progressScoreReadout(summary, momentum)}
          delta={`${formatSigned(momentum)} vs baseline`}
          direction={momentum > 0 ? "up" : momentum < 0 ? "down" : "neutral"}
          points={trendPoints}
          threshold={75}
          className="border-primary/20"
        />
        <Card className="overflow-hidden border-primary/15 shadow-sm">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Personal baseline</Badge>
                <Badge variant="outline">{progressVerdictLabel(summary)}</Badge>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">Bag progress</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{heroVerdict(summary)}</p>
              <Button asChild variant="outline" className="mt-4" data-primary-action>
                <Link
                  href={mostImproved ? `/bag/${mostImproved.clubId}/analytics` : "/import"}
                  prefetch={false}
                >
                  {mostImproved ? <Brain className="size-4" /> : <Upload className="size-4" />}
                  {mostImproved ? "View supporting shots" : "Import first CSV"}
                </Link>
              </Button>
            </div>
            <PageArtwork
              variant="progress"
              alt=""
              className="hidden h-32 rounded-lg sm:block"
              priority
            />
          </CardContent>
        </Card>
      </div>
      <ConnectedMetricBar
        label="Progress evidence metrics"
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
    <Card className="shadow-sm" data-progress-goal-card>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:p-6">
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
          <h2 className="mt-3 text-2xl font-bold leading-8 tracking-normal text-foreground">
            Technical readiness
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            How strong the current launch-monitor pattern is. This does not predict a score.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(14rem,1fr)_minmax(11rem,18rem)] md:items-center">
          <div className="min-w-0">
            <div className="flex items-end justify-between gap-3">
              <span className="text-4xl font-bold leading-none tracking-normal text-foreground">
                {progress}%
              </span>
              <span className="text-sm font-semibold text-primary">
                {goalProgressLabel(progress)}
              </span>
            </div>
            <Progress value={progress} className="mt-3 h-3" />
            <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
              <span className="font-semibold text-foreground">Coach summary: </span>
              {sentence}
            </p>
          </div>
          <div className="grid min-w-[11rem] gap-3">
            <Item variant="muted" size="sm" className="items-start">
              <ItemContent>
                <ItemTitle>Scoring confidence · {scoringConfidence.label}</ItemTitle>
                <ItemDescription className="overflow-visible whitespace-normal text-clip">
                  {scoringConfidence.detail}
                </ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="muted" size="sm" className="items-start">
              <ItemContent>
                <ItemTitle>Still needed</ItemTitle>
                <ItemDescription className="overflow-visible whitespace-normal text-clip">
                  {needs.join(" · ")}
                </ItemDescription>
              </ItemContent>
            </Item>
          </div>
        </div>
      </CardContent>
    </Card>
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
  const items = [
    ["Largest improvement", review.largestImprovement, TrendingUp],
    ["Largest decline", review.largestDecline, TrendingDown],
    ["Sessions and rounds", { ...review.completedVolume, href: "/sessions" }, ClipboardCheck],
    [
      "Data-quality issues",
      { ...review.dataQuality, href: "/analyse/workspace#data-quality" },
      ShieldCheck,
    ],
    ["New personal bests", { ...review.personalBests, href: "/achievements" }, Trophy],
    ["Data freshness", review.dataFreshness, CalendarDays],
    ["Practice completed", { ...review.practiceCompleted, href: "/practice" }, CheckCircle2],
    [
      "Bag-number change",
      { ...review.bagNumberChange, href: "/bag?tab=history#club-evolution" },
      BarChart3,
    ],
    ["One next action", review.nextAction, Target],
  ] as const;

  return (
    <Card className="h-full shadow-sm" data-weekly-recap-timeline>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Weekly recap</CardTitle>
          <CardDescription className="mt-1">
            {data.weeklyRecap.metric} · {sessionsLabel} · Personal baseline comparison
          </CardDescription>
        </div>
        <form action={saveCurrentWeeklyRecapAction}>
          <Button type="submit" variant="outline" size="sm">
            <Bookmark className="size-4" />
            Save recap
          </Button>
        </form>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">
          <span className="font-semibold">This week&apos;s read: </span>
          {weeklyRead}
        </p>
        <StatusTimeline
          label="Weekly progress recap"
          items={items.map(([label, item, icon], index) => ({
            id: `${label}-${index}`,
            title: label,
            description: item.detail,
            meta: item.value,
            status: item.tone,
            icon,
            kind: item.tone === "amber" ? "warning" : "reviewed",
            href: "href" in item ? item.href : undefined,
          }))}
        />
        <Button asChild className="w-fit">
          <Link href={review.nextAction.href} prefetch={false}>
            <Target className="size-4" />
            Take next action
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ProgressRoadmapPanel({ summary }: { summary: ProgressSummary }) {
  const roadmapItems = buildRoadmapItems(summary);

  return (
    <Card className="overflow-hidden shadow-sm" data-progress-roadmap>
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <div className="min-w-0">
          <Badge variant="secondary" className="gap-2">
            <Sparkles className="size-4" />
            This week
          </Badge>
          <h2 className="mt-4 text-3xl font-bold leading-9 tracking-normal text-foreground">
            {roadmapGoalLabel()}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
        <StatusTimeline
          label="Progress roadmap milestones"
          className="max-h-none"
          items={roadmapItems.map((item, index) => ({
            id: `${item.title}-${index}`,
            timestamp: roadmapStepLabel(index),
            title: item.title,
            description: item.detail,
            meta: item.action,
            status: item.label,
            kind: item.tone === "amber" || item.tone === "pink" ? "warning" : "reviewed",
            href: item.href,
          }))}
        />
      </CardContent>
    </Card>
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
    <Card className="overflow-hidden shadow-sm" data-practice-planner-summary>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <div className="min-w-0">
          <Badge variant="secondary" className="gap-2">
            <ClipboardCheck className="size-4" />
            Structured practice
          </Badge>
          <h2 className="mt-4 text-3xl font-bold leading-9 tracking-normal text-foreground">
            {summary.completedCount > 0
              ? `${summary.completedCount} planned sessions completed`
              : "Plan the next session"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
          <Button asChild className="rounded-lg">
            <Link href="/practice" prefetch={false}>
              Open Practice Planner
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type Tone = "green" | "sky" | "pink" | "amber" | "slate";

const movementPillToneClasses: Record<Tone, string> = {
  green:
    "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]",
  sky: "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]",
  pink: "border-[var(--status-danger-border)] bg-[var(--status-danger-surface)] text-[var(--status-danger-foreground)]",
  amber:
    "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
  slate: "border-border bg-muted/40 text-muted-foreground",
};

function ProgressTrendsPanel({ summary }: { summary: ProgressSummary }) {
  const trendRows = progressTrendChartRows(summary.trends);

  return (
    <section id="trends" className="grid h-full scroll-mt-28 gap-4" data-progress-trends>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LineChart className="size-5 text-primary" aria-hidden />
          Progress trends
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Movement from the first clean baseline to the latest clean baseline.
        </p>
      </div>
      <div className="grid flex-1 auto-rows-fr gap-3 md:grid-cols-2">
        {summary.trends.map((trend) => (
          <LazyMetricTrendCard
            key={trend.label}
            label={trend.label}
            value={trend.value}
            detail={trendVerdict(trend, summary)}
            direction={
              trend.goodDirection === "up"
                ? "up"
                : trend.goodDirection === "down"
                  ? "down"
                  : "neutral"
            }
            points={trend.points.map((value, index) => ({
              label:
                index === 0
                  ? "Baseline"
                  : index === trend.points.length - 1
                    ? "Latest"
                    : `Check ${index + 1}`,
              value,
            }))}
            className="shadow-none"
          />
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
      />
    </section>
  );
}

function Sparkline({
  points,
  tone,
  ariaLabel = "Trend line",
}: {
  points: number[];
  tone: Tone;
  ariaLabel?: string;
}) {
  if (points.length < 2) {
    return (
      <div className="mt-3 grid h-16 place-items-center rounded-lg bg-secondary/50 text-xs text-muted-foreground">
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
        aria-label={ariaLabel}
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

async function BagMovementPanel({
  rows,
  activeFilter,
}: {
  rows: ProgressClubRow[];
  activeFilter: BagMovementFilter;
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const filteredRows = rows.filter((row) => bagMovementFilterMatches(row, activeFilter));
  const filters = buildBagMovementFilters(rows);

  return (
    <DataPanel id="bag-movement" className="scroll-mt-28">
      <SectionHeader
        title="Bag movement"
        description={bagMovementSummary(filteredRows.length > 0 ? filteredRows : rows)}
        action={<Table2 className="size-5 text-primary" aria-hidden />}
      />
      <CardContent>
        <nav aria-label="Filter bag movement" className="mb-4 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const isActive = filter.key === activeFilter;

            return (
              <Button
                key={filter.key}
                asChild
                variant={isActive ? "secondary" : "outline"}
                size="sm"
              >
                <Link
                  href={bagMovementFilterHref(filter.key)}
                  prefetch={false}
                  aria-current={isActive ? "page" : undefined}
                >
                  {filter.label}
                  <Badge variant="outline">{filter.count}</Badge>
                </Link>
              </Button>
            );
          })}
        </nav>

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
          <DataTableFrame label="Progress bag movement table" stickyFirstColumn>
            <Table
              className="min-w-[980px]"
              data-workbench-export-table="progress-bag-movement"
              aria-describedby="progress-bag-movement-summary"
            >
              <TableCaption id="progress-bag-movement-summary" className="sr-only">
                Club progress evidence showing club, trust, clean stock shots, stock carry and
                measured movement.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead data-column="club" className="sticky left-0 z-20 min-w-52 bg-card">
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
                      <TableCell data-column="club" className="sticky left-0 z-10 min-w-52 bg-card">
                        <Link
                          href={`/bag/${row.clubId}/analytics`}
                          prefetch={false}
                          className="font-semibold hover:text-primary"
                        >
                          {formatClubType(row.clubType)}
                        </Link>
                        <p className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">
                          {row.brandModel}
                        </p>
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
                      <TableCell data-column="clean-shots">
                        {integerFormatter.format(row.sampleSize)}
                      </TableCell>
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
                      className="py-8 text-center text-sm text-muted-foreground"
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

  return (
    <div className="flex min-w-[32rem] flex-wrap items-center gap-2">
      <StatusPill tone={status.tone}>{status.label}</StatusPill>
      {movementMetricOrder.map((metric) => {
        const item = itemsByMetric.get(metric);

        return item ? (
          <span
            key={metric}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold",
              movementPillToneClasses[item.tone],
            )}
          >
            <span>{metric}</span>
            <span className="tabular-nums">{item.value}</span>
          </span>
        ) : null;
      })}
      {items.length === 0 ? (
        <span className="text-sm text-muted-foreground">No meaningful movement detected</span>
      ) : null}
    </div>
  );
}

const movementMetricOrder = ["Carry", "Offline", "Ball speed", "Launch"] as const;

function bagMovementFilterHref(filter: BagMovementFilter) {
  return filter === "all" ? "/progress#bag-movement" : `/progress?bag=${filter}#bag-movement`;
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
      ? `${formatClubType(needsWork.clubType)} remains the lowest-trust sampled club`
      : null,
  ].filter(Boolean);

  return parts.length
    ? `${parts.join(", ")}.`
    : "Latest clean baseline versus first clean baseline. Offline going down is good.";
}

function CoachTimelinePanel({ summary }: { summary: ProgressSummary }) {
  const items = coachTimelineItems(summary);

  return (
    <Card className="shadow-sm" data-coach-timeline>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>AI Coach timeline</CardTitle>
          <CardDescription className="mt-1">
            A running coaching narrative from current progress, next focus and recent milestones.
          </CardDescription>
        </div>
        <StatusPill tone="green">Live narrative</StatusPill>
      </CardHeader>
      <CardContent>
        <StatusTimeline
          label="AI Coach timeline"
          className="max-h-none"
          items={items.map((item, index) => ({
            id: `${item.title}-${index}`,
            timestamp: item.dateLabel,
            title: item.title,
            description: item.detail,
            meta: item.action,
            status: item.label,
            icon: item.icon,
            kind: item.tone === "amber" || item.tone === "pink" ? "warning" : "reviewed",
            href: item.clubId ? `/bag/${item.clubId}/analytics` : undefined,
          }))}
        />
      </CardContent>
    </Card>
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

function progressVerdictLabel(summary: ProgressSummary) {
  if (summary.totals.trackedCleanShots === 0) {
    return "Baseline needed";
  }

  const needsWork = summary.rankings.needsWork;
  return needsWork ? `Improving · ${formatClubType(needsWork.clubType)} next` : "Improving";
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
