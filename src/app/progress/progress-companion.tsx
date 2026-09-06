import Link from "next/link";
import { MobilePageTabs } from "@/components/app/mobile-controls";
import { MobileLargeTitle, MobileMetric, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import { Button } from "@/components/ui/button";
import { MobileTrainingChart } from "@/components/training/mobile-training-chart";
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
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import { roundHistoryScore } from "@/lib/round-history-evidence";
import { MobilePerformanceComparisonView } from "./mobile-performance-comparison";

type Props = {
  clubs: ProgressClub[];
  summary: ProgressSummary;
  score: number;
  goals: SeasonGoal[];
  training: TrainingOverTimeData;
  handicap: Awaited<ReturnType<typeof getUserHandicapProfile>>;
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
}: Props) {
  const story = mobilePerformanceStory(clubs);
  const scoring = mobileScoringStory(
    handicap.rounds.map((round) => ({ ...round, scorecardJson: round.scorecardJson ?? [] })),
  );
  const consistency = mobileTrainingConsistency(training.sessionMarkers, training.today);
  const load = selectTrainingRangeData(training, "3m");
  const signal = story.signal;
  const next = summary.practicePlan[0];
  return (
    <div className="mobile-progress-screen" data-mobile-progress-story>
      <MobileLargeTitle title="Progress" eyebrow="Your game, over time" />
      <MobilePageTabs
        className="companion-review-tabs"
        initialValue="performance"
        mode="local"
        ariaLabel="Progress sections"
        tabs={[
          {
            value: "performance",
            label: "Performance",
            content: (
              <div className="grid gap-5">
                {" "}
                <section className="mobile-progress-overview" aria-label="Progress overview">
                  <p className="mobile-type-title2">{story.label}</p>
                  {summary.totals.trackedCleanShots ? (
                    <>
                      <MobileMetric value={score} unit="/ 100" label="progress score" />
                      <MobileStatus
                        label={`${story.confidence} · session comparison`}
                        tone={story.tone}
                      />
                      <details>
                        <summary className="mobile-progress-disclosure">
                          What this score means
                        </summary>
                        <p className="mobile-type-footnote text-muted-foreground">
                          The existing score combines club trust, playable shots, sample depth and
                          baseline movement. Direction above compares the last two measured sessions
                          for each club. A higher score alone does not prove improvement.
                        </p>
                        <p className="mobile-type-footnote text-muted-foreground">
                          {summary.totals.trackedCleanShots} clean shots ·{" "}
                          {summary.totals.averageTrust}% average club trust.
                        </p>
                      </details>
                    </>
                  ) : (
                    <>
                      <p className="mobile-type-callout text-muted-foreground">
                        Import a measured session to establish your starting point.
                      </p>
                      <Button asChild className="min-h-12">
                        <Link href="/import">Add your first session</Link>
                      </Button>
                    </>
                  )}
                </section>
                <MobileSection title="Performance">
                  {signal ? (
                    <MobilePerformanceComparisonView
                      comparisons={story.comparisons}
                      initialClubId={signal.clubId}
                      initialMeasure={story.metric}
                    />
                  ) : null}
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
                      label={
                        story.blocker
                          ? `${formatClubType(story.blocker.clubType)} · control to work on`
                          : (next?.title ?? "Your next practice")
                      }
                      detail={
                        story.blocker
                          ? `${story.blocker.change.offlineDeltaYd!.toFixed(1)} yd more average lateral miss. Review the evidence before changing your swing.`
                          : (next?.reason ?? "Build another measured sample.")
                      }
                      href="/practice"
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
                      {scoring.context} · {scoring.latest.scorecardJson.length} holes · recent
                      completed rounds
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
                      <p className="mobile-type-callout text-muted-foreground">
                        {scoring.leak.detail}
                      </p>
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
                        <MobileMetric
                          value={Math.round(training.summary.form.value)}
                          label="golf form"
                        />
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
                      <MobileTrainingChart data={load.series} />
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
        ]}
      />
    </div>
  );
}

export function MobileProgressGoals({ goals }: { goals: SeasonGoal[] }) {
  return (
    <MobileSection title="Goals">
      {goals.slice(0, 4).map((goal) => (
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
