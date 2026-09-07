import { progressRecommendation } from "./progress-recommendation";
import Link from "next/link";
import { ProgressTabs } from "./progress-tabs";
import { ProgressSnapshot } from "./progress-snapshot";
import type { ReactNode } from "react";
import { UntitledPageHeader } from "@/components/untitled-ui/headers";
import { MobileMetric, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import { Button } from "@/components/ui/button";
import { ProgressLoadHistory } from "./progress-load-history";
import {
  mobilePerformanceStory,
  mobileScoringStory,
  mobileTrainingConsistency,
} from "@/lib/mobile-progress-story";
import { formatClubType } from "@/lib/club-format";
import type { ProgressClub, ProgressSummary } from "@/lib/progress-summary";
import type { getUserHandicapProfile } from "@/lib/handicap-data";
import type { TrainingOverTimeData } from "@/lib/training/trainingData";
import { goalProgress, type SeasonGoal } from "@/lib/product-preferences";
import { roundHistoryScore } from "@/lib/round-history-evidence";
import { ProgressComparison } from "./progress-comparison";
import type { ComparisonClub } from "./progress-comparison-data";

type Props = {
  clubs: ProgressClub[];
  summary: ProgressSummary;
  score: number;
  goals: SeasonGoal[];
  training: TrainingOverTimeData;
  handicap: Awaited<ReturnType<typeof getUserHandicapProfile>>;
  timeline: ReactNode;
  weekly: ReactNode;
  comparisons: ComparisonClub[];
  latestReview: { id: string; date: Date; fileName: string | null } | null;
};
export function ProgressCompanion({
  clubs,
  summary,
  score,
  goals,
  training,
  handicap,
  latestReview,
  timeline,
  weekly,
  comparisons,
}: Props) {
  const story = mobilePerformanceStory(clubs);
  const scoring = mobileScoringStory(
    handicap.rounds.map((round) => ({ ...round, scorecardJson: round.scorecardJson ?? [] })),
  );
  const consistency = mobileTrainingConsistency(training.sessionMarkers, training.today);
  const next = progressRecommendation(summary);
  const sections = [
    {
      value: "performance",
      label: "Performance",
      content: (
        <div className="grid gap-5">
          {" "}
          <ProgressSnapshot score={score} cleanShots={summary.totals.trackedCleanShots} />
          <MobileSection title="Performance">
            <ProgressComparison clubs={comparisons} />
            {weekly}
            <MobileGroupedList>
              <MobileListRow
                label={
                  story.improvement
                    ? `${formatClubType(story.improvement.clubType)} · strongest control improvement`
                    : "No clear improvement yet"
                }
                detail={
                  story.improvement
                    ? `${Math.abs(story.improvement.change.offlineDeltaYd!).toFixed(1)} yd less average lateral miss between its last two sessions.`
                    : "Two measured sessions per club help separate change from a single good day."
                }
                href={story.improvement ? `/bag/${story.improvement.clubId}` : "/sessions"}
              />
              <MobileListRow
                label={next?.title ?? "Your next practice"}
                detail={next ? `${next.reason} ${next.evidence}` : "Build another measured sample."}
                href={next?.href ?? "/practice"}
              />
              <MobileListRow
                label={latestReview ? "Latest session review" : "Practice history"}
                detail={
                  latestReview
                    ? `${date(latestReview.date)} · Verdict and shot evidence`
                    : "Review a session and choose your next action."
                }
                href={latestReview ? `/sessions/${latestReview.id}` : "/sessions"}
              />
            </MobileGroupedList>
          </MobileSection>
        </div>
      ),
    },
    {
      value: "scoring",
      label: "Scoring",
      content: (
        <>
          {" "}
          <MobileSection title="Scoring">
            <MobileMetric
              value={handicap.displayValue?.toFixed(1) ?? "—"}
              label="playing estimate"
              detail={handicap.sourceLabel}
            />
            <Link href="/handicap" className="mobile-progress-disclosure">
              How your estimate is calculated
            </Link>
            {scoring.latest ? (
              <p className="mobile-type-footnote text-muted-foreground">
                {scoring.context} · {scoring.latest.scorecardJson.length} holes · recent completed
                rounds
              </p>
            ) : (
              <p className="mobile-type-callout text-muted-foreground">
                Complete a scorecard to start your scoring story.
              </p>
            )}
            <MobileGroupedList>
              {scoring.comparable.map((round) => {
                const result = roundHistoryScore(round.scorecardJson, round.roundStatus);
                return (
                  <MobileListRow
                    key={round.id}
                    label={round.courseName ?? round.fileName ?? "Round"}
                    value={result.totalScore ?? "—"}
                    detail={`${date(round.date)} · ${result.toPar === 0 ? "Level par" : `${(result.toPar ?? 0) > 0 ? "+" : ""}${result.toPar} to par`}`}
                    href={`/rounds/${round.id}`}
                  />
                );
              })}
              <MobileListRow label="All rounds" href="/rounds" />
            </MobileGroupedList>
            {scoring.leak ? (
              <div className="grid gap-2">
                <p className="mobile-type-footnote text-muted-foreground">
                  Main recorded scoring leak
                </p>
                <h3 className="mobile-type-headline">{scoring.leak.title}</h3>
                <p className="mobile-type-callout text-muted-foreground">{scoring.leak.detail}</p>
                <Link className="mobile-progress-disclosure" href={scoring.leak.href}>
                  {scoring.leak.action}
                </Link>
              </div>
            ) : null}
          </MobileSection>
        </>
      ),
    },
    {
      value: "training",
      label: "Training",
      content: (
        <>
          {" "}
          <MobileSection title="Training">
            <div className="mobile-progress-consistency">
              <MobileMetric
                value={consistency.days}
                unit="/ 28"
                label="days with logged training"
                detail={`${consistency.sessions} sessions in the last four weeks`}
              />
            </div>
            {training.hasTrainingData ? (
              <>
                <div className="mobile-metric-strip">
                  <MobileMetric
                    value={Math.round(training.summary.fitness.value)}
                    label="fitness"
                  />
                  <MobileMetric
                    value={Math.round(training.summary.fatigue.value)}
                    label="recent load"
                  />
                  <MobileMetric value={Math.round(training.summary.form.value)} label="golf form" />
                </div>
                <p className="mobile-type-callout">
                  {consistency.daysSince !== null && consistency.daysSince > 7
                    ? "Your recent activity record is quiet. Log any missing practice before using the load trend to plan today."
                    : training.status.advice}
                </p>
                <p className="mobile-type-footnote text-muted-foreground">
                  {consistency.last ? `Last logged ${date(consistency.last)} · ` : ""}
                  {training.confidence.label}.
                </p>
                <ProgressLoadHistory data={training} companion />
              </>
            ) : (
              <p className="mobile-type-callout text-muted-foreground">
                Log practice or a round to build your training history.
              </p>
            )}
            <MobileGroupedList>
              <MobileListRow
                label="Training over time"
                detail="Log activity and review the full history"
                href="/stats/training-over-time"
              />
              <MobileListRow label="Start practice" href="/practice" />
            </MobileGroupedList>
          </MobileSection>
        </>
      ),
    },
    { value: "goals", label: "Goals", content: <MobileProgressGoals goals={goals} /> },
  ];
  const content = (value: string) => sections.find((section) => section.value === value)?.content;
  return (
    <div className="mobile-progress-screen" data-mobile-progress-story>
      <UntitledPageHeader
        title="Progress"
        description="Your current evidence, goals and training history."
        actions={
          <Button asChild>
            <Link href="/import">Add session</Link>
          </Button>
        }
      />
      <ProgressTabs
        panels={{
          performance: (
            <div className="grid gap-5">
              {content("performance")}
              {content("scoring")}
            </div>
          ),
          goals: content("goals"),
          load: content("training"),
          timeline,
        }}
      />
    </div>
  );
}

export function MobileProgressGoals({ goals }: { goals: SeasonGoal[] }) {
  return (
    <MobileSection title="Goals">
      {goals.map((goal) => (
        <article key={goal.id} className="mobile-progress-goal">
          <h3 className="mobile-type-headline">{goal.title}</h3>
          <dl className="mobile-goal-values">
            <div>
              <dt>Current</dt>
              <dd>
                {goal.currentValue} <span>{goal.unit}</span>
              </dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>
                {goal.targetValue} <span>{goal.unit}</span>
              </dd>
            </div>
          </dl>
          <p className="mobile-type-footnote text-muted-foreground">
            {goalProgress(goal)}% progress
          </p>
          <progress max="100" value={goalProgress(goal)} aria-label={`${goal.title} progress`} />
          <p className="mobile-type-callout">{goal.nextAction}</p>
          <details>
            <summary className="mobile-progress-disclosure">Target and evidence</summary>
            <dl className="grid gap-2 mobile-type-footnote">
              <div>
                <dt className="text-muted-foreground">Evidence source saved with this goal</dt>
                <dd>{goal.evidenceSource}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Target date</dt>
                <dd>{goal.targetDate ? date(goal.targetDate) : "Not set"}</dd>
              </div>
            </dl>
            <p className="mobile-type-footnote text-muted-foreground">
              These are your saved goal values. They are not automatically verified against a new
              session.
            </p>
          </details>
          <Link href="/goals" className="mobile-progress-disclosure">
            Update goal
          </Link>
        </article>
      ))}
      <MobileGroupedList>
        <MobileListRow label={goals.length ? "All goals" : "Set your next target"} href="/goals" />
        <MobileListRow label="Achievements" href="/achievements" />
      </MobileGroupedList>
    </MobileSection>
  );
}
function date(value: Date | string) {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Not available";
}
