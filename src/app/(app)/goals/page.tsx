import Link from "next/link";
import { getGoalImprovementProjectData } from "@/lib/goal-improvement-project";
import { GoalProjectPanel } from "@/app/goals/goal-project-panel";
import { and, countDistinct, eq, gte, lte, inArray, or, sql } from "drizzle-orm";
import { GoalCreateDialog, GoalDeleteDialog, GoalEditSheet } from "@/app/goals/goal-form-panels";
import { SeasonPlanEditor } from "@/app/goals/season-plan-editor";
import { GoalEvidenceSheet } from "@/app/goals/goal-evidence-sheet";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getProductPreferences,
  goalProgress,
  goalTypeLabel,
  type SeasonGoal,
} from "@/lib/product-preferences";
export const dynamic = "force-dynamic";
export default async function GoalsPage() {
  const userId = await requireCurrentUserId();
  const [preferences, [week]] = await Promise.all([
    getProductPreferences(userId),
    getDb()
      .select({ sessions: countDistinct(sessions.id), shots: countDistinct(shots.id) })
      .from(sessions)
      .innerJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
      .where(
        and(
          eq(sessions.userId, userId),
          gte(sessions.date, sql<Date>`now() - interval '7 days'`),
          lte(sessions.date, sql<Date>`now()`),
          shotEvidenceSqlPredicate(),
          sql`(
            (${shots.carryYd} > 0 and ${shots.carryYd} < 'Infinity'::double precision)
            or (${shots.totalYd} > 0 and ${shots.totalYd} < 'Infinity'::double precision)
            or (${shots.ballSpeedMph} > 0 and ${shots.ballSpeedMph} < 'Infinity'::double precision)
          )`,
        ),
      ),
  ]);
  const projectData = await getGoalImprovementProjectData(userId);
  const plan = preferences.seasonPlan;
  const weeklySessions = week?.sessions ?? 0;
  const weeklyShots = week?.shots ?? 0;
  const rhythmMet = weeklySessions >= plan.weeklySessions;
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5" data-goals-ui>
        <PageHeader
          title="Goals"
          description="Keep your season plan and numerical targets together. Saved values and verified evidence remain distinct."
          actions={<GoalCreateDialog label="Add goal" />}
        />
        <section
          className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5"
          data-season-outcome-card
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Season outcome</p>
              <h2 className="mt-1 break-words text-xl font-semibold">{plan.outcome}</h2>
            </div>
            <StatusPill tone="slate">Saved plan</StatusPill>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {plan.focus} · {plan.successMeasure}
          </p>
          <p className="text-sm">
            {plan.targetDate ? `Target date ${formatDate(plan.targetDate)}` : "No target date set"}{" "}
            · {plan.weeklySessions} measured sessions per week
          </p>
          <SeasonPlanEditor plan={plan} />
        </section>
        <GoalProjectPanel data={projectData} />
        <section
          className="grid gap-3 rounded-xl border bg-card p-4 sm:p-5"
          aria-label="Plan steps"
        >
          <h2 className="text-xl font-semibold">This week’s commitment</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {weeklySessions} qualifying sessions · {weeklyShots} eligible measured shots · Last 7
            days. Future activities and saved plans without measurements are excluded.
          </p>
          <ol className="divide-y">
            <li className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <h3 className="font-medium">1. Set the season plan</h3>
                <p className="text-sm text-muted-foreground">
                  {plan.weeklySessions} sessions per week focused on {plan.focus}.
                </p>
              </div>
              <StatusPill tone="slate">Current saved plan</StatusPill>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <h3 className="font-medium">2. Record measured sessions</h3>
                <p className="text-sm text-muted-foreground">
                  {weeklySessions} of {plan.weeklySessions} sessions this week.
                </p>
              </div>
              <StatusPill tone={rhythmMet ? "green" : "amber"}>
                {rhythmMet ? "Weekly count reached" : "Current commitment"}
              </StatusPill>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <h3 className="font-medium">3. Review the evidence</h3>
                <p className="text-sm text-muted-foreground">
                  Check changes and update saved goal values. Review completion is not recorded
                  automatically.
                </p>
              </div>
              <StatusPill tone="slate">Review needed</StatusPill>
            </li>
          </ol>
          <Button asChild className="min-h-11 justify-self-start">
            <Link
              href={
                rhythmMet
                  ? "/progress"
                  : `/practice/quick-range?focus=${encodeURIComponent(plan.focus)}`
              }
            >
              {rhythmMet ? "Review weekly progress" : "Start focused practice"}
            </Link>
          </Button>
        </section>
        <section className="grid gap-3" aria-label="Measured targets">
          <h2 className="text-xl font-semibold">Numerical targets</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Current values are explicitly saved, matching the Goals tab in Progress. A source label
            alone does not prove an imported measurement.
          </p>
          {preferences.goals.length ? (
            <div className="grid min-w-0 gap-3 xl:grid-cols-2">
              {preferences.goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          ) : (
            <AppEmptyState
              title="No numerical targets yet"
              description="Set a starting value, current value, target and unit; keep the source description accurate."
              primaryAction={<GoalCreateDialog label="Add first goal" />}
            />
          )}
        </section>
      </div>
    </PageShell>
  );
}
function shotEvidenceSqlPredicate() {
  return and(
    inArray(shots.reviewStatus, ["included", "restored"]),
    or(
      eq(shots.reviewStatus, "restored"),
      and(
        eq(shots.reviewStatus, "included"),
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'`,
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not in ('exclude', 'excluded', 'delete', 'deleted', 'calibration', 'warm-up', 'warmup', 'warm_up', 'bad-data', 'bad_data', 'invalid', 'launch-monitor-error', 'misread', 'fat', 'mishit', 'thin', 'top')`,
        sql`lower(trim(coalesce(${shots.shotCategory}, ''))) not in ('warm-up', 'warmup', 'warm_up')`,
      ),
    ),
  );
}

function GoalCard({ goal }: { goal: SeasonGoal }) {
  const progress = goalProgress(goal);
  const movement = Math.round((goal.currentValue - goal.startingValue) * 10) / 10;
  const confidence = "Measurement verification not recorded";
  return (
    <Card className="shadow-sm" data-goal-target-card>
      <CardContent className="grid gap-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {goalTypeLabel(goal.type)} · {goal.club}
            </p>
            <h3 className="mt-1 break-words text-xl font-semibold">{goal.title}</h3>
          </div>
          <StatusPill tone={progress >= 100 ? "green" : progress > 0 ? "sky" : "amber"}>
            {progress}% saved-value progress
          </StatusPill>
        </div>
        <ConnectedMetricBar
          embedded
          label={`${goal.title} target values`}
          className="sm:grid-cols-3 xl:grid-cols-3"
          metrics={[
            { label: "Starting", value: `${goal.startingValue} ${goal.unit}` },
            { label: "Current", value: `${goal.currentValue} ${goal.unit}` },
            { label: "Target", value: `${goal.targetValue} ${goal.unit}` },
          ]}
        />
        <div>
          <Progress value={progress} aria-label={`${progress}% progress`} />
          <p className="mt-2 text-xs text-muted-foreground">
            {movement > 0 ? "+" : ""}
            {movement} {goal.unit} from baseline · {confidence} · {goal.evidenceSource}
          </p>
        </div>
        <div className="rounded-2xl bg-secondary/55 p-3 text-sm">
          <p className="font-semibold">Next action</p>
          <p className="mt-1 text-muted-foreground">{goal.nextAction}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : "No deadline set"}
          </p>
          <div className="flex flex-wrap gap-2">
            <GoalEvidenceSheet goal={goal} />
            <GoalEditSheet goal={goal} />
            <GoalDeleteDialog goal={goal} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}
