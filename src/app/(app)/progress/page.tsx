import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  Activity,
  ArrowRight,
  Check,
  CircleDot,
  Dumbbell,
  Flag,
  Focus,
  Package,
  Sparkles,
  Target,
  Trophy,
  Upload,
} from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { ProgressTrainingLoadChart } from "@/components/progress/progress-training-load-chart";
import { PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDb } from "@/db/client";
import { equipmentSnapshots, userFeaturePreferences } from "@/db/schema";
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
  type ProgressClubRow,
  type ProgressSummary,
} from "@/lib/progress-summary";
import {
  getProductPreferences,
  goalProgress,
  goalTypeLabel,
  type SeasonGoal,
} from "@/lib/product-preferences";
import { calculateScoringConfidence } from "@/lib/progress-readiness";
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import {
  getTrainingOverTimeData,
  type TrainingOverTimeData,
  type TrainingSessionListItem,
} from "@/lib/training/trainingData";
import { cn } from "@/lib/utils";
import { getWeeklyChangeEvidence } from "@/lib/weekly-change-review-data";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const compactDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const progressStoryTabClass = "h-10 min-w-0 rounded-full px-1.5 sm:px-4";

type BagSnapshot = {
  id: string;
  label: string;
  capturedAt: Date;
};

export default async function ProgressPage() {
  const userId = await requireCurrentUserId();
  const [
    surface,
    data,
    scoringEvidence,
    distanceLossDiagnosis,
    practicePlannerSummary,
    weeklyEvidence,
    preferences,
    trainingData,
    bagSnapshots,
    preferenceRow,
  ] = await Promise.all([
    getRequestAppSurface(),
    getProgressData(userId),
    getProgressScoringEvidence(userId),
    getDistanceLossDiagnosisData(userId),
    getPracticePlannerProgressSummary(userId),
    getWeeklyChangeEvidence(userId),
    getProductPreferences(userId),
    getTrainingOverTimeData(userId, "1y"),
    getDb()
      .select({
        id: equipmentSnapshots.id,
        label: equipmentSnapshots.label,
        capturedAt: equipmentSnapshots.capturedAt,
      })
      .from(equipmentSnapshots)
      .where(eq(equipmentSnapshots.userId, userId))
      .orderBy(desc(equipmentSnapshots.capturedAt))
      .limit(6),
    getDb()
      .select({ updatedAt: userFeaturePreferences.updatedAt })
      .from(userFeaturePreferences)
      .where(eq(userFeaturePreferences.userId, userId))
      .limit(1),
  ]);
  const summary = buildProgressSummary(data.clubs);
  const activeGoals = preferences.goals.slice(0, 4);
  const loadView = selectTrainingRangeData(trainingData, "3m");
  const timeline = buildTimelineStory({
    summary,
    trainingData,
    goals: preferences.goals,
    bagSnapshots,
    goalPlanUpdatedAt: preferenceRow[0]?.updatedAt ?? null,
  });

  return (
    <PageShell>
      <main
        className="grid min-w-0 gap-5 pb-8 lg:gap-7"
        data-progress-story
        data-progress-surface={surface}
      >
        <header className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/goals" prefetch={false}>
                <Target className="size-4" aria-hidden="true" />
                Manage goals
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" aria-hidden="true" />
                Add session
              </Link>
            </Button>
          </div>
        </header>

        {data.clubs.length === 0 ? (
          <ProgressEmptyState />
        ) : (
          <Tabs defaultValue="performance" className="min-w-0 gap-5 lg:gap-7">
            <div className="sticky top-[calc(var(--app-header-height,0px)+0.5rem)] z-20 -mx-1 px-1 py-1">
              <TabsList
                variant="line"
                aria-label="Progress story"
                className="grid h-12 w-full min-w-0 grid-cols-4 gap-1 rounded-full border border-border/80 bg-background/95 px-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:w-fit sm:grid-cols-[repeat(4,minmax(6rem,auto))] sm:px-2"
              >
                <TabsTrigger value="performance" className={progressStoryTabClass}>
                  Performance
                </TabsTrigger>
                <TabsTrigger value="goals" className={progressStoryTabClass}>
                  Goals
                </TabsTrigger>
                <TabsTrigger value="load" className={progressStoryTabClass}>
                  Load
                </TabsTrigger>
                <TabsTrigger value="timeline" className={progressStoryTabClass}>
                  Timeline
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="performance" className="grid min-w-0 gap-5 lg:gap-7">
              <PerformanceStory
                summary={summary}
                scoringEvidence={scoringEvidence}
                weeklyEvidence={weeklyEvidence}
                diagnosis={distanceLossDiagnosis}
              />
            </TabsContent>

            <TabsContent value="goals" className="min-w-0">
              <GoalsStory goals={activeGoals} totalGoalCount={preferences.goals.length} />
            </TabsContent>

            <TabsContent value="load" className="min-w-0">
              <TrainingLoadStory data={loadView} practiceSummary={practicePlannerSummary} />
            </TabsContent>

            <TabsContent value="timeline" className="min-w-0">
              <TimelineStory items={timeline} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </PageShell>
  );
}

function ProgressEmptyState() {
  return (
    <AppEmptyState
      icon={<Sparkles className="size-5" aria-hidden="true" />}
      title="Your progress story starts with measured shots"
      description="Import one comparable launch-monitor session. ForeKingHell will establish the first clean baseline without guessing missing numbers."
      primaryAction={
        <Button asChild>
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" aria-hidden="true" />
            Import first session
          </Link>
        </Button>
      }
    />
  );
}

type DistanceDiagnosis = Awaited<ReturnType<typeof getDistanceLossDiagnosisData>>;
type WeeklyEvidence = Awaited<ReturnType<typeof getWeeklyChangeEvidence>>;

function PerformanceStory({
  summary,
  scoringEvidence,
  weeklyEvidence,
  diagnosis,
}: {
  summary: ProgressSummary;
  scoringEvidence: ProgressScoringEvidence;
  weeklyEvidence: WeeklyEvidence;
  diagnosis: DistanceDiagnosis;
}) {
  const score = progressScore(summary);
  const change = progressScoreMomentum(summary);
  const baselineScore = clampNumber(score - change, 0, 100);
  const confidence = progressConfidence(summary, scoringEvidence);
  const strongest = summary.rankings.mostImproved ?? summary.rankings.mostTrusted;
  const blocker = summary.practicePlan[0] ?? null;

  return (
    <div className="grid min-w-0 gap-5 lg:gap-7" data-performance-story>
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-card shadow-[0_24px_70px_-45px_rgba(15,23,42,0.55)]">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" aria-hidden="true" />
        <div className="grid gap-7 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)] lg:items-end lg:px-10 lg:py-11">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Your direction now
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-7xl font-semibold leading-[0.82] tracking-[-0.07em] text-foreground tabular-nums sm:text-8xl">
                {score}
              </p>
              <div className="pb-1.5">
                <p className="text-sm font-semibold text-muted-foreground">Progress score / 100</p>
                <p
                  className={cn(
                    "mt-1 text-base font-semibold tabular-nums",
                    change >= 0
                      ? "text-[var(--status-success-foreground)]"
                      : "text-[var(--status-warning-foreground)]",
                  )}
                >
                  {formatSigned(change)} from first clean baseline
                </p>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-5 border-t border-border/70 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Why it moved
              </p>
              <h1 className="mt-2 max-w-4xl text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-3xl">
                {progressScoreReadout(summary, change)}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusPill tone={confidence.tone}>{confidence.label} confidence</StatusPill>
              <p className="max-w-2xl leading-6 text-muted-foreground">{confidence.detail}</p>
            </div>
          </div>
        </div>
      </section>

      <PerformanceTrend
        currentScore={score}
        baselineScore={baselineScore}
        moments={summary.journey.slice(0, 3)}
        weeklyEvidence={weeklyEvidence}
      />

      <WeeklyEvidenceStrip
        weeklyEvidence={weeklyEvidence}
        strongest={strongest}
        blocker={blocker}
      />

      <section
        aria-label="Strongest improvement and main blocker"
        className="grid overflow-hidden rounded-[1.75rem] border border-border bg-card lg:grid-cols-2 lg:divide-x lg:divide-border"
        data-performance-editorial-calls
      >
        <EditorialCallout
          eyebrow="Strongest improvement"
          icon={Trophy}
          tone="positive"
          title={strongest ? formatClubType(strongest.clubType) : "A reliable mover is forming"}
          body={
            strongest
              ? strongestImprovementDetail(strongest)
              : "Keep the next session comparable so one improvement can separate from normal variation."
          }
          evidence={
            strongest
              ? `${strongest.trustIndex}% trust from ${integerFormatter.format(strongest.sampleSize)} clean shots.`
              : `${integerFormatter.format(summary.totals.trackedCleanShots)} clean shots currently support the score.`
          }
          href={strongest ? `/bag/${strongest.clubId}/analytics` : "/import"}
          action={strongest ? "See the supporting shots" : "Add comparable shots"}
        />
        <EditorialCallout
          eyebrow="Main blocker"
          icon={Focus}
          tone="attention"
          title={blocker ? formatClubType(blocker.clubType) : "The sample is still the blocker"}
          body={
            blocker
              ? blocker.reason
              : "No single club has separated as the limiting pattern yet. Build the weakest clean sample next."
          }
          evidence={
            diagnosis.status === "ready"
              ? `Driver check: ${diagnosis.headline} ${diagnosis.summary}`
              : diagnosis.headline
          }
          href={blocker ? `/bag/${blocker.clubId}/analytics` : "/practice"}
          action={blocker ? "Work the blocker" : "Plan the next session"}
        />
      </section>
    </div>
  );
}

function WeeklyEvidenceStrip({
  weeklyEvidence,
  strongest,
  blocker,
}: {
  weeklyEvidence: WeeklyEvidence;
  strongest: ProgressSummary["rankings"]["mostImproved"];
  blocker: ProgressSummary["practicePlan"][number] | null;
}) {
  const facts = [
    {
      label: "Sessions and rounds",
      value: `${weeklyEvidence.completedSessionCount} / ${weeklyEvidence.completedRoundCount}`,
      detail: "Measured sessions / real rounds",
    },
    {
      label: "Largest improvement",
      value: strongest ? formatClubType(strongest.clubType) : "Not separated",
      detail: strongest ? `${strongest.trustIndex}% evidence trust` : "Needs comparable shots",
    },
    {
      label: "Largest decline",
      value: blocker ? formatClubType(blocker.clubType) : "Not separated",
      detail: blocker?.reason ?? "No reliable blocker yet",
    },
    {
      label: "Practice completed",
      value: integerFormatter.format(weeklyEvidence.completedPracticeCount),
      detail: "Completed or analysed plans",
    },
    {
      label: "Data-quality issues",
      value: integerFormatter.format(weeklyEvidence.dataQualityIssueCount),
      detail: "Rows or syncs needing attention",
    },
    {
      label: "New personal bests",
      value: integerFormatter.format(weeklyEvidence.personalBestCount),
      detail: "Measured PBs in seven days",
    },
    {
      label: "One next action",
      value: blocker ? `Work ${formatClubType(blocker.clubType)}` : "Build a clean sample",
      detail: blocker?.drill ?? "Keep the next session comparable",
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-[1.5rem] border border-border bg-card"
      aria-labelledby="weekly-evidence-title"
      data-weekly-evidence-strip
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            Weekly evidence
          </p>
          <h2 id="weekly-evidence-title" className="mt-1 text-xl font-semibold tracking-tight">
            What changed in the last seven days
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-5 text-muted-foreground">
          Activity adds context; only comparable measured evidence moves the progress score.
        </p>
      </div>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="min-w-0 border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(even)]:border-r-0 lg:[&:nth-child(even)]:border-r lg:[&:nth-child(4n)]:border-r-0 2xl:border-b-0 2xl:[&:nth-child(4n)]:border-r 2xl:last:border-r-0"
          >
            <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {fact.label}
            </dt>
            <dd className="mt-2 truncate text-lg font-semibold text-foreground" title={fact.value}>
              {fact.value}
            </dd>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {fact.detail}
            </p>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PerformanceTrend({
  currentScore,
  baselineScore,
  moments,
  weeklyEvidence,
}: {
  currentScore: number;
  baselineScore: number;
  moments: ProgressSummary["journey"];
  weeklyEvidence: WeeklyEvidence;
}) {
  const y = (value: number) => 236 - value * 1.86;
  const baselineY = y(baselineScore);
  const currentY = y(currentScore);
  const path = `M 58 ${baselineY} C 260 ${baselineY}, 690 ${currentY}, 942 ${currentY}`;
  const annotationMoments = moments.length
    ? moments
    : [
        {
          clubId: "baseline",
          clubType: "",
          dateLabel: "Latest data",
          title: "Comparable baseline established",
          detail: "The next measured session will add the first milestone annotation.",
          tone: "slate" as const,
        },
      ];

  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card"
      aria-labelledby="performance-trend-title"
      data-performance-primary-trend
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Performance trend
          </p>
          <h2 id="performance-trend-title" className="mt-1 text-2xl font-semibold tracking-tight">
            The bag is moving {currentScore >= baselineScore ? "forward" : "back toward baseline"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            First comparable clean baseline to the latest clean baseline. No forecast is added.
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-muted-foreground">
          {baselineScore} → <span className="text-foreground">{currentScore}</span>
        </p>
      </div>

      <div className="px-4 pb-2 pt-5 sm:px-7">
        <svg
          viewBox="0 0 1000 270"
          className="h-56 w-full overflow-visible sm:h-64"
          role="img"
          aria-label={`Progress score moved from ${baselineScore} at the first clean baseline to ${currentScore} at the latest clean baseline.`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="progress-story-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[25, 50, 75, 100].map((line) => (
            <g key={line}>
              <line
                x1="58"
                x2="942"
                y1={y(line)}
                y2={y(line)}
                stroke="var(--border)"
                strokeDasharray="4 8"
              />
              <text
                x="12"
                y={y(line) + 4}
                fill="var(--muted-foreground)"
                fontSize="13"
                fontWeight="600"
              >
                {line}
              </text>
            </g>
          ))}
          <path d={`${path} L 942 246 L 58 246 Z`} fill="url(#progress-story-fill)" />
          <path
            d={path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx="58"
            cy={baselineY}
            r="8"
            fill="var(--background)"
            stroke="var(--primary)"
            strokeWidth="4"
          />
          <circle
            cx="942"
            cy={currentY}
            r="10"
            fill="var(--primary)"
            stroke="var(--background)"
            strokeWidth="4"
          />
          <text
            x="58"
            y="263"
            textAnchor="start"
            fill="var(--muted-foreground)"
            fontSize="14"
            fontWeight="600"
          >
            First baseline
          </text>
          <text
            x="942"
            y="263"
            textAnchor="end"
            fill="var(--foreground)"
            fontSize="14"
            fontWeight="700"
          >
            Latest
          </text>
        </svg>
      </div>

      <div className="grid border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
        {annotationMoments.slice(0, 3).map((moment, index) => (
          <div key={`${moment.clubId}-${moment.title}`} className="relative px-5 py-4 sm:px-6">
            <span className="absolute left-0 top-0 h-1 w-full bg-primary/15" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {index === 0 && weeklyEvidence.personalBestCount > 0
                ? `${weeklyEvidence.personalBestCount} PB${weeklyEvidence.personalBestCount === 1 ? "" : "s"} this week`
                : moment.dateLabel}
            </p>
            <p className="mt-1 font-semibold text-foreground">{moment.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{moment.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EditorialCallout({
  eyebrow,
  icon: Icon,
  tone,
  title,
  body,
  evidence,
  href,
  action,
}: {
  eyebrow: string;
  icon: typeof Trophy;
  tone: "positive" | "attention";
  title: string;
  body: string;
  evidence: string;
  href: string;
  action: string;
}) {
  return (
    <article className="grid min-w-0 content-between gap-8 px-6 py-7 sm:px-8 sm:py-9">
      <div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-full",
              tone === "positive"
                ? "bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]"
                : "bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {eyebrow}
          </p>
        </div>
        <h3 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-foreground">{title}</h3>
        <p className="mt-3 max-w-2xl text-base leading-7 text-foreground/90">{body}</p>
        <p className="mt-4 border-l-2 border-border pl-4 text-sm leading-6 text-muted-foreground">
          {evidence}
        </p>
      </div>
      <Button asChild variant="ghost" className="w-fit rounded-full px-0 hover:bg-transparent">
        <Link href={href} prefetch={false}>
          {action}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </article>
  );
}

function GoalsStory({ goals, totalGoalCount }: { goals: SeasonGoal[]; totalGoalCount: number }) {
  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card"
      aria-labelledby="active-goals-title"
      data-progress-goals-story
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-6 sm:px-8 sm:py-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Active goals
          </p>
          <h1 id="active-goals-title" className="mt-1 text-3xl font-semibold tracking-tight">
            What you are moving towards
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Up to four current targets, shown as distance still to travel rather than another
            scorecard.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/goals" prefetch={false}>
            Edit goals
          </Link>
        </Button>
      </div>

      {goals.length > 0 ? (
        <div className="divide-y divide-border">
          {goals.map((goal, index) => (
            <GoalRow key={goal.id} goal={goal} index={index} />
          ))}
        </div>
      ) : (
        <div className="px-5 py-12 text-center sm:px-8">
          <Flag className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold">No active measured goals</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Add a numerical goal with a target, deadline, and next action. Progress will stay
            explicit until measured evidence updates it.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link href="/goals" prefetch={false}>
              Add first goal
            </Link>
          </Button>
        </div>
      )}

      {totalGoalCount > 4 ? (
        <div className="border-t border-border bg-muted/25 px-5 py-3 text-sm text-muted-foreground sm:px-8">
          Showing the four highest-priority saved goals.{" "}
          <Link
            href="/goals"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Review all {totalGoalCount}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function GoalRow({ goal, index }: { goal: SeasonGoal; index: number }) {
  const progress = goalProgress(goal);

  return (
    <article className="grid gap-5 px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-10">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-muted/40 text-xs font-bold tabular-nums text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {goalTypeLabel(goal.type)} · {goal.club}
          </p>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{goal.title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Next: <span className="font-medium text-foreground">{goal.nextAction}</span>
        </p>
      </div>

      <div className="min-w-0">
        <dl className="grid grid-cols-3 gap-3">
          <GoalDatum label="Current" value={`${goal.currentValue} ${goal.unit}`} />
          <GoalDatum label="Target" value={`${goal.targetValue} ${goal.unit}`} />
          <GoalDatum
            label="Deadline"
            value={goal.targetDate ? formatGoalDate(goal.targetDate) : "Not set"}
          />
        </dl>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-muted-foreground">Progress</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{progress}%</span>
          </div>
          <Progress
            value={progress}
            aria-label={`${goal.title}: ${progress}% progress`}
            className="h-4"
          />
        </div>
      </div>
    </article>
  );
}

function GoalDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-foreground sm:text-base">
        {value}
      </dd>
    </div>
  );
}

function TrainingLoadStory({
  data,
  practiceSummary,
}: {
  data: TrainingOverTimeData;
  practiceSummary: Awaited<ReturnType<typeof getPracticePlannerProgressSummary>>;
}) {
  const latest = data.latest;
  const nextDecision = loadNextDecision(data, practiceSummary);

  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card"
      aria-labelledby="training-load-story-title"
      data-progress-load-story
    >
      <div className="grid gap-6 border-b border-border px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Training load · 90 days
            </p>
            <StatusPill tone={data.status.tone}>{data.status.label}</StatusPill>
          </div>
          <h1
            id="training-load-story-title"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {data.status.detail}
          </h1>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{data.trend.detail}</p>
      </div>

      <dl className="grid divide-y divide-border border-b border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <LoadMetric
          label="Golf Form"
          value={formatLoadMetric(data.summary.form.value)}
          detail="Comparable golf trend"
        />
        <LoadMetric
          label="Training Fitness"
          value={formatLoadMetric(data.summary.fitness.value)}
          detail="Long-term workload capacity"
        />
        <LoadMetric
          label="Recent Load"
          value={formatLoadMetric(data.summary.fatigue.value)}
          detail={latest && latest.fatigue >= 120 ? "High: manage volume" : "Seven-day workload"}
        />
      </dl>

      <div className="px-3 py-5 sm:px-7 sm:py-7">
        {data.hasTrainingData ? (
          <ProgressTrainingLoadChart data={data.series} sessionMarkers={data.sessionMarkers} />
        ) : (
          <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <div>
              <Activity className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 font-semibold">Training Load is still conditioning</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Log or import golf activity to build the first useful load curve.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 border-t border-border bg-muted/20 px-5 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Dumbbell className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-foreground">What this means next</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{nextDecision}</p>
          </div>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/stats/training-over-time" prefetch={false}>
            Open full Training Load
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function LoadMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="px-5 py-5 sm:px-7">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </dd>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

type TimelineCategory = "Practice" | "Round" | "PB" | "Goal change" | "Bag change" | "Confidence";

type TimelineStoryItem = {
  id: string;
  category: TimelineCategory;
  dateLabel: string;
  sortTime: number;
  title: string;
  detail: string;
  href: string;
};

function TimelineStory({ items }: { items: TimelineStoryItem[] }) {
  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card"
      aria-labelledby="progress-timeline-title"
      data-progress-timeline-story
    >
      <div className="border-b border-border px-5 py-6 sm:px-8 sm:py-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Your golf story
        </p>
        <h1 id="progress-timeline-title" className="mt-1 text-3xl font-semibold tracking-tight">
          What changed, in order
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Practice, rounds, personal bests, goals, bag decisions, and confidence changes share one
          chronology.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Timeline event types">
          {(["Practice", "Round", "PB", "Goal change", "Bag change", "Confidence"] as const).map(
            (category) => (
              <span
                key={category}
                className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {category}
              </span>
            ),
          )}
        </div>
      </div>

      <ol className="divide-y divide-border">
        {items.map((item, index) => {
          const Icon = timelineIcon(item.category);
          return (
            <li
              key={item.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-5 py-5 sm:grid-cols-[8rem_auto_minmax(0,1fr)_auto] sm:items-center sm:px-8"
            >
              <time className="col-start-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:col-start-1">
                {item.dateLabel}
              </time>
              <span className="relative row-span-3 grid size-10 place-items-center rounded-full border border-border bg-background text-primary sm:row-span-1">
                <Icon className="size-4" aria-hidden="true" />
                {index < items.length - 1 ? (
                  <span
                    className="absolute left-1/2 top-full h-5 w-px -translate-x-1/2 bg-border sm:hidden"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <div className="col-start-2 min-w-0 sm:col-start-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                    {item.category}
                  </span>
                  <CircleDot className="size-2 text-border" aria-hidden="true" />
                  <h2 className="font-semibold text-foreground">{item.title}</h2>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="col-start-2 w-fit rounded-full px-0 sm:col-start-4 sm:px-3"
              >
                <Link href={item.href} prefetch={false}>
                  Review
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function buildTimelineStory({
  summary,
  trainingData,
  goals,
  bagSnapshots,
  goalPlanUpdatedAt,
}: {
  summary: ProgressSummary;
  trainingData: TrainingOverTimeData;
  goals: SeasonGoal[];
  bagSnapshots: BagSnapshot[];
  goalPlanUpdatedAt: Date | null;
}) {
  const items: TimelineStoryItem[] = [];

  for (const session of trainingData.sessions.slice(0, 8)) {
    const isRound = isRoundTrainingSession(session);
    items.push({
      id: `training-${session.id}`,
      category: isRound ? "Round" : "Practice",
      dateLabel: formatDateKey(session.sessionDate),
      sortTime: Date.parse(`${session.sessionDate}T12:00:00Z`),
      title: session.title,
      detail: isRound
        ? `${session.holesPlayed ?? "Recorded"} holes · load ${integerFormatter.format(session.sessionLoad)}${session.competition ? " · competition" : ""}`
        : `${session.totalSwings ?? "Measured"} swings · load ${integerFormatter.format(session.sessionLoad)}`,
      href: session.sourceId ? `/sessions/${session.sourceId}` : "/sessions",
    });
  }

  for (const event of summary.journey) {
    const personalBest = /carry high|personal best|\bpb\b/i.test(event.title);
    items.push({
      id: `journey-${event.clubId}-${event.title}`,
      category: personalBest ? "PB" : "Confidence",
      dateLabel: event.dateLabel,
      sortTime: parseJourneyDate(event.dateLabel),
      title: event.title,
      detail: event.detail,
      href: `/bag/${event.clubId}/analytics`,
    });
  }

  for (const snapshot of bagSnapshots) {
    items.push({
      id: `bag-${snapshot.id}`,
      category: "Bag change",
      dateLabel: compactDateFormatter.format(snapshot.capturedAt),
      sortTime: snapshot.capturedAt.getTime(),
      title: snapshot.label,
      detail: "A saved bag snapshot marks the setup used for future performance comparisons.",
      href: "/equipment",
    });
  }

  if (goals.length > 0) {
    items.push({
      id: "current-goal-plan",
      category: "Goal change",
      dateLabel: goalPlanUpdatedAt
        ? compactDateFormatter.format(goalPlanUpdatedAt)
        : "Current plan",
      sortTime: goalPlanUpdatedAt?.getTime() ?? 0,
      title: `${goals.length} measured goal${goals.length === 1 ? "" : "s"} in the current plan`,
      detail: goals
        .slice(0, 3)
        .map((goal) => goal.title)
        .join(" · "),
      href: "/goals",
    });
  }

  const deduped = new Map<string, TimelineStoryItem>();
  for (const item of items.sort((left, right) => right.sortTime - left.sortTime)) {
    const key = `${item.category}-${item.title.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }

  const story = [...deduped.values()].slice(0, 16);
  if (story.length > 0) return story;

  return [
    {
      id: "timeline-baseline",
      category: "Practice" as const,
      dateLabel: "Next session",
      sortTime: 0,
      title: "Start the chronology",
      detail: "Import a measured session and the first practice event will appear here.",
      href: "/import",
    },
  ];
}

function timelineIcon(category: TimelineCategory) {
  if (category === "Practice") return Dumbbell;
  if (category === "Round") return Flag;
  if (category === "PB") return Trophy;
  if (category === "Goal change") return Target;
  if (category === "Bag change") return Package;
  return Check;
}

function isRoundTrainingSession(session: TrainingSessionListItem) {
  return (
    session.sourceType === "round" ||
    Boolean(session.holesPlayed) ||
    /round|course/i.test(session.title)
  );
}

function progressConfidence(summary: ProgressSummary, evidence: ProgressScoringEvidence) {
  const scoreConfidence = calculateScoringConfidence(evidence.comparableRoundCount);
  const averageTrust = summary.totals.averageTrust;
  const sampleDepth = summary.totals.trackedCleanShots;
  const label =
    averageTrust >= 75 && sampleDepth >= 80
      ? "High"
      : averageTrust >= 60 && sampleDepth >= 35
        ? "Moderate"
        : "Low";
  const tone = label === "High" ? "green" : label === "Moderate" ? "sky" : "amber";

  return {
    label,
    tone: tone as "green" | "sky" | "amber",
    detail: `${averageTrust}% average club trust from ${integerFormatter.format(sampleDepth)} clean shots. Range-to-score confidence is ${scoreConfidence.label.toLowerCase()} from ${integerFormatter.format(evidence.comparableRoundCount)} comparable real ${evidence.comparableRoundCount === 1 ? "round" : "rounds"}.`,
  };
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
  const best = summary.rankings.mostImproved ?? summary.rankings.mostTrusted;
  const drag = summary.rankings.needsWork;

  if (momentum >= 4 && best)
    return `${formatClubType(best.clubType)} is leading a clear move above your first clean baseline.`;
  if (momentum <= -3 && drag)
    return `${formatClubType(drag.clubType)} is pulling the overall direction back toward your baseline.`;
  if (best && drag && best.clubId !== drag.clubId) {
    return `${formatClubType(best.clubType)} is moving forward; ${formatClubType(drag.clubType)} is stopping that progress spreading through the bag.`;
  }
  return "The score is holding close to baseline while more comparable sessions separate real movement from noise.";
}

function progressClubMomentum(row: ProgressClubRow) {
  let score = 0;
  if (row.carryDeltaYd !== null) score += clampNumber(row.carryDeltaYd, -8, 8) * 0.45;
  if (row.offlineDeltaYd !== null) score += clampNumber(-row.offlineDeltaYd, -8, 8) * 0.8;
  if (row.ballSpeedDeltaMph !== null) score += clampNumber(row.ballSpeedDeltaMph, -4, 4);
  if (row.trustIndex >= 75) score += 2;
  else if (row.trustIndex < 60) score -= 1.5;
  if (row.sampleSize < 6) score -= 1;
  return Math.round(score);
}

function strongestImprovementDetail(row: ProgressClubRow) {
  const evidence = [
    row.offlineDeltaYd !== null && Math.abs(row.offlineDeltaYd) >= 0.5
      ? `${numberFormatter.format(Math.abs(row.offlineDeltaYd))} yd ${row.offlineDeltaYd <= 0 ? "tighter" : "wider"}`
      : null,
    row.carryDeltaYd !== null && Math.abs(row.carryDeltaYd) >= 1
      ? `${formatSigned(row.carryDeltaYd)} yd carry`
      : null,
    row.ballSpeedDeltaMph !== null && Math.abs(row.ballSpeedDeltaMph) >= 0.3
      ? `${formatSigned(row.ballSpeedDeltaMph)} mph ball speed`
      : null,
  ].filter(Boolean);

  return evidence.length > 0
    ? `${evidence.join(" · ")} versus the first clean baseline.`
    : "It currently has the strongest combination of trust, sample depth, and playable pattern.";
}

function loadNextDecision(
  data: TrainingOverTimeData,
  practiceSummary: Awaited<ReturnType<typeof getPracticePlannerProgressSummary>>,
) {
  const focus = practiceSummary.topFocus?.label;
  if ((data.latest?.fatigue ?? 0) >= 120) {
    return `Recent Load is high. Keep the next ${focus ? `${focus.toLowerCase()} ` : ""}session technical or recovery-led until the load signal eases.`;
  }
  if (data.status.tone === "amber") {
    return `${data.status.advice}${focus ? ` If you practise, keep ${focus.toLowerCase()} as the single focus.` : ""}`;
  }
  return `${data.status.advice}${focus ? ` The current planner focus is ${focus.toLowerCase()}.` : ""}`;
}

function formatLoadMetric(value: number) {
  return integerFormatter.format(Math.round(value));
}

function formatGoalDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateKey(value: string) {
  return compactDateFormatter.format(new Date(`${value}T12:00:00Z`));
}

function parseJourneyDate(value: string) {
  const parsed = Date.parse(`${value} 12:00:00 UTC`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function averageNumber(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
