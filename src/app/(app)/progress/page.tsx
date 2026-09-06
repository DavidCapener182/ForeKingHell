import { TimelineStory, type TimelineStoryItem } from "@/app/progress/progress-timeline";
import { progressRecommendation } from "@/app/progress/progress-recommendation";
import { ProgressComparison } from "@/app/progress/progress-comparison";
import { weeklyControlChanges, type ComparisonClub } from "@/app/progress/progress-comparison-data";
import { ProgressCompanion } from "@/app/progress/progress-companion";
import { getUserHandicapProfile } from "@/lib/handicap-data";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Activity, Flag, Dumbbell, ArrowRight, Focus, Target, Trophy, Upload } from "lucide-react";

import { ProgressLoadHistory } from "@/app/progress/progress-load-history";
import { PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProgressTabs } from "@/app/progress/progress-tabs";
import { ProgressSnapshot } from "@/app/progress/progress-snapshot";
import { UntitledPageHeader } from "@/components/untitled-ui/headers";
import { getDb } from "@/db/client";
import { equipmentSnapshots, sessions } from "@/db/schema";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
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

type BagSnapshot = {
  id: string;
  label: string;
  capturedAt: Date;
};

export default async function ProgressPage() {
  const userId = await requireCurrentUserId();
  const surface = await getRequestAppSurface();
  const [
    data,
    scoringEvidence,
    practicePlannerSummary,
    weeklyEvidence,
    preferences,
    trainingData,
    bagSnapshots,
  ] = await Promise.all([
    getProgressData(userId),
    getProgressScoringEvidence(userId),
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

  ]);
  const summary = buildProgressSummary(data.clubs);
  const activeGoals = preferences.goals;
  const timeline = buildTimelineStory({
    summary,
    trainingData,
    goals: preferences.goals,
    bagSnapshots,
  });

  if (surface === "companion") {
    const [handicap, reviews] = await Promise.all([
      getUserHandicapProfile(userId),
      getDb()
        .select({ id: sessions.id, date: sessions.date, fileName: sessions.fileName })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.type, "range")))
        .orderBy(desc(sessions.date))
        .limit(1),
    ]);
    return (
      <PageShell>
        <ProgressCompanion
          clubs={data.clubs}
          summary={summary}
          score={progressScore(summary)}
          goals={preferences.goals}
          training={trainingData}
          handicap={handicap}
          latestReview={reviews[0] ?? null}
          timeline={<TimelineStory items={timeline} />}
          comparisons={data.comparisons}
          weekly={
            <WeeklyEvidenceStrip
              weeklyEvidence={weeklyEvidence}
              comparisons={data.comparisons}
              blocker={progressRecommendation(summary)}
            />
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div
        className="grid min-w-0 gap-5 pb-8 lg:gap-7"
        data-progress-story
        data-progress-surface={surface}
      >
        <UntitledPageHeader
          title="Progress"
          description="Your current evidence, goals and training history."
          actions={
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
          }
        />

        <ProgressTabs
          panels={{
            performance: (
              <PerformanceStory
                summary={summary}
                scoringEvidence={scoringEvidence}
                weeklyEvidence={weeklyEvidence}
                comparisons={data.comparisons}
              />
            ),
            goals: <GoalsStory goals={activeGoals} totalGoalCount={preferences.goals.length} />,
            load: (
              <TrainingLoadStory data={trainingData} practiceSummary={practicePlannerSummary} />
            ),
            timeline: <TimelineStory items={timeline} />,
          }}
        />
      </div>
    </PageShell>
  );
}

type WeeklyEvidence = Awaited<ReturnType<typeof getWeeklyChangeEvidence>>;

function PerformanceStory({
  summary,
  scoringEvidence,
  weeklyEvidence,
  comparisons,
}: {
  summary: ProgressSummary;
  scoringEvidence: ProgressScoringEvidence;
  weeklyEvidence: WeeklyEvidence;
  comparisons: ComparisonClub[];
}) {
  const score = progressScore(summary);
  const confidence = progressConfidence(summary, scoringEvidence);
  const strongest = summary.rankings.mostImproved ?? summary.rankings.mostTrusted;
  const blocker = progressRecommendation(summary);

  return (
    <div className="grid min-w-0 gap-5 lg:gap-7" data-performance-story>
      <ProgressSnapshot score={score} cleanShots={summary.totals.trackedCleanShots} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusPill tone={confidence.tone}>{confidence.label} confidence</StatusPill>
        <p className="leading-6 text-muted-foreground">{confidence.detail}</p>
      </div>

      <ProgressComparison clubs={comparisons} />

      <WeeklyEvidenceStrip
        weeklyEvidence={weeklyEvidence}
        comparisons={comparisons}
        blocker={blocker}
      />

      <section
        aria-label="Club evidence and current practice priority"
        className="grid overflow-hidden rounded-[1.75rem] border border-border bg-card lg:grid-cols-2 lg:divide-x lg:divide-border"
        data-performance-editorial-calls
      >
        <EditorialCallout
          eyebrow="Club evidence to review"
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
          evidence={blocker?.evidence ?? "A comparable sample is needed before choosing a club."}
          href={blocker?.href ?? "/practice"}
          action={blocker ? "Work the blocker" : "Plan the next session"}
        />
      </section>
    </div>
  );
}

function WeeklyEvidenceStrip({
  weeklyEvidence,
  comparisons,
  blocker,
}: {
  weeklyEvidence: WeeklyEvidence;
  comparisons: ComparisonClub[];
  blocker: ProgressSummary["practicePlan"][number] | null;
}) {
  const changes = weeklyControlChanges(
    comparisons,
    weeklyEvidence.windowStart,
    weeklyEvidence.windowEnd,
  );
  const changeDetail = (change: typeof changes.improvement) =>
    change
      ? `${Math.abs(change.delta)} yd ${change.delta < 0 ? "less" : "more"} average lateral miss; ${change.previous.counts.side} → ${change.latest.counts.side} measured shots. ${compactDateFormatter.format(new Date(change.previous.date))} → ${compactDateFormatter.format(new Date(change.latest.date))}.`
      : "No directional change established from comparable sessions in both weeks.";
  const facts = [
    {
      label: "Recorded entries / real rounds",
      value: `${weeklyEvidence.completedSessionCount} / ${weeklyEvidence.completedRoundCount}`,
      detail: "Real rounds are included in the entry count",
    },
    {
      label: "Largest control improvement",
      value: changes.improvement?.club.name ?? "Not established",
      detail: changeDetail(changes.improvement),
    },
    {
      label: "Largest control decline",
      value: changes.decline?.club.name ?? "Not established",
      detail: changeDetail(changes.decline),
    },
    {
      label: "Practice completed",
      value: integerFormatter.format(weeklyEvidence.completedPracticeCount),
      detail: "Completed or analysed plans",
    },
    {
      label: "Current data-quality backlog",
      value: integerFormatter.format(weeklyEvidence.dataQualityIssueCount),
      detail: "All recorded rows or syncs needing attention",
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
          {compactDateFormatter.format(new Date(weeklyEvidence.windowStart))} to{" "}
          {compactDateFormatter.format(new Date(weeklyEvidence.windowEnd))} (UTC). Control compares
          the last measured session in each adjacent seven-day window; at least three lateral
          measurements per session. {changes.comparedClubs} comparable clubs.
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
            <dd
              className="mt-2 break-words text-lg font-semibold text-foreground"
              title={fact.value}
            >
              {fact.value}
            </dd>
            <dd className="mt-1 text-xs leading-5 text-muted-foreground">{fact.detail}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-3 border-t border-border px-5 py-3">
        {[changes.improvement, changes.decline]
          .filter((change) => change !== null)
          .map((change) => (
            <Link
              key={change.club.clubId}
              href={`/sessions/${change.latest.sessionId}`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
            >
              Review {change.club.name} source
            </Link>
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
          <h2 id="active-goals-title" className="mt-1 text-3xl font-semibold tracking-tight">
            What you are moving towards
          </h2>
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
        <h3 className="mt-3 text-xl font-semibold text-foreground">{goal.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Next: <span className="font-medium text-foreground">{goal.nextAction}</span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Saved evidence: {goal.evidenceSource || "Not supplied"}. These saved values are not
          automatically verified against a new session.
        </p>
        <Link
          href="/goals"
          className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          View and update goal
        </Link>
      </div>

      <div className="min-w-0">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              Training load · recorded history
            </p>
            <StatusPill tone={data.status.tone}>{data.status.label}</StatusPill>
          </div>
          <h2
            id="training-load-story-title"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            {data.status.detail}
          </h2>
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
          <ProgressLoadHistory data={data} />
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
      <dd className="mt-1 text-sm text-muted-foreground">{detail}</dd>
    </div>
  );
}

function buildTimelineStory({
  summary,
  trainingData,
  goals,
  bagSnapshots,
}: {
  summary: ProgressSummary;
  trainingData: TrainingOverTimeData;
  goals: SeasonGoal[];
  bagSnapshots: BagSnapshot[];
}) {
  const items: TimelineStoryItem[] = [];

  for (const session of trainingData.sessions) {
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
      href: session.sourceId
        ? `/${session.sourceType === "round" ? "rounds" : "sessions"}/${session.sourceId}`
        : "/stats/training-over-time",
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
      dateLabel: "Change date unavailable",
      sortTime: 0,
      title: `${goals.length} saved goal${goals.length === 1 ? "" : "s"} in the current plan`,
      detail: `Current saved values; a goal-specific change history is not recorded. ${goals.map((goal) => goal.title).join(" · ")}`,
      href: "/goals",
    });
  }

  const deduped = new Map<string, TimelineStoryItem>();
  for (const item of items.sort(
    (left, right) => right.sortTime - left.sortTime || left.id.localeCompare(right.id),
  )) {
    const key = item.id;
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return [...deduped.values()];
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
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${numberFormatter.format(rounded === 0 ? 0 : rounded)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function averageNumber(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
