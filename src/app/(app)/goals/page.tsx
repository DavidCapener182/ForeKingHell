import Link from "next/link";
import type { ReactNode } from "react";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, CalendarDays, Flag, Target } from "lucide-react";

import { saveSeasonPlanAction } from "@/app/goals/actions";
import { GoalCreateDialog, GoalDeleteDialog, GoalEditSheet } from "@/app/goals/goal-form-panels";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { MetricEvidenceDrawer, RecommendedAction } from "@/components/app/evidence-status";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getProductPreferences,
  goalProgress,
  goalTypeLabel,
  type SeasonGoal,
  type SeasonPlan,
} from "@/lib/product-preferences";

export const dynamic = "force-dynamic";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const since = sql<Date>`now() - interval '7 days'`;
  const [surface, preferences, sessionRows, shotRows] = await Promise.all([
    getRequestAppSurface(),
    getProductPreferences(userId),
    getDb()
      .select({ total: count(sessions.id) })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.date, since))),
    getDb()
      .select({ total: count(shots.id) })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(and(eq(shots.userId, userId), eq(sessions.userId, userId), gte(sessions.date, since))),
  ]);
  const plan = preferences.seasonPlan;
  const weeklySessions = Number(sessionRows[0]?.total ?? 0);
  const weeklyShots = Number(shotRows[0]?.total ?? 0);
  const rhythmMet = weeklySessions >= plan.weeklySessions;
  const goalError = goalErrorMessage(params?.error);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Season plan</StatusPill>}
        title="Goals"
        description="Turn one season outcome into a measurable weekly rhythm, then let imported sessions prove the progress."
        actions={
          <Button asChild className="min-h-11 rounded-xl">
            <Link href="/practice/quick-range">
              Start quick range
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {goalError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>Goal not saved</AlertTitle>
          <AlertDescription>{goalError}</AlertDescription>
        </Alert>
      ) : null}

      {params?.saved === "1" ? (
        <Alert>
          <AlertDescription>Season plan saved.</AlertDescription>
        </Alert>
      ) : null}

      {params?.saved === "goal" ? (
        <Alert>
          <AlertDescription>Goal saved in the season plan.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-primary/20 shadow-sm" data-season-outcome-card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Season outcome
            </p>
            <CardTitle className="mt-2 text-3xl tracking-tight">{plan.outcome}</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              {plan.focus} is the current focus. {plan.successMeasure}.
            </CardDescription>
          </div>
          <StatusPill tone={weeklySessions > 0 ? "sky" : "slate"}>
            {weeklySessions > 0 ? "Moderate confidence" : "Insufficient evidence"}
          </StatusPill>
        </CardHeader>
        {plan.targetDate ? (
          <CardContent>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              Target date {formatDate(plan.targetDate)}
            </p>
          </CardContent>
        ) : null}
      </Card>

      {surface === "companion" ? (
        <div className="grid gap-5" data-goals-companion>
          <section className="grid gap-2" aria-label="This week">
            <IOSSectionHeader title="This week" />
            <IOSGroupedList label="Weekly goal status">
              <IOSListRow
                label="Measured rhythm"
                value={`${weeklySessions} / ${plan.weeklySessions}`}
                detail={`${weeklyShots} imported shots in the last 7 days`}
                status={
                  <span
                    className={
                      rhythmMet
                        ? "text-xs font-medium text-[var(--status-success-foreground)]"
                        : "text-xs font-medium text-[var(--status-warning-foreground)]"
                    }
                  >
                    {rhythmMet ? "On track" : "Needs another measured session"}
                  </span>
                }
              />
              <IOSListRow
                label="Practice focus"
                value={plan.focus}
                detail={`Complete ${plan.weeklySessions} measured sessions`}
              />
              <IOSListRow
                label="Weekly game review"
                detail="Strongest change, weakest signal and next evidence"
                href="/progress"
              />
            </IOSGroupedList>
          </section>

          <section className="grid gap-2" aria-label="Current targets">
            <IOSSectionHeader
              title="Current targets"
              description={
                preferences.goals.length > 0
                  ? `${preferences.goals.length} evidence-linked ${preferences.goals.length === 1 ? "goal" : "goals"}`
                  : "No measured target yet"
              }
            />
            {preferences.goals.length > 0 ? (
              <IOSDisclosureGroup
                label="Measured goals"
                items={preferences.goals.map((goal) => mobileGoalDisclosure(goal))}
              />
            ) : (
              <IOSGroupedList label="Measured goals">
                <IOSListRow
                  label="Add your first measured target"
                  detail="Keep the season outcome broad and make this target numerical."
                />
              </IOSGroupedList>
            )}
          </section>

          <section className="grid gap-2" aria-label="Plan controls">
            <IOSSectionHeader
              title="Plan controls"
              description="Edit only when the season outcome or evidence target changes."
            />
            <IOSDisclosureGroup
              label="Goal controls"
              items={[
                {
                  value: "edit-plan",
                  title: "Edit season plan",
                  summary: `${plan.weeklySessions} / week`,
                  description: plan.targetDate
                    ? `Target ${formatDate(plan.targetDate)}`
                    : "No target date",
                  content: <SeasonPlanForm plan={plan} idPrefix="mobile-plan" />,
                },
                {
                  value: "add-goal",
                  title: "Add a measured goal",
                  summary: "New",
                  description: "Handicap, distance, speed, practice or competition",
                  content: <GoalCreateDialog label="Add measured goal" />,
                },
                {
                  value: "evidence-method",
                  title: "How progress is proved",
                  summary: `${weeklyShots} shots`,
                  content: (
                    <p className="text-sm leading-6 text-muted-foreground">
                      Only imported sessions count towards the weekly rhythm. Planned work or a
                      manually ticked task does not replace measured shot evidence.
                    </p>
                  ),
                },
              ]}
            />
          </section>
        </div>
      ) : (
        <>
          <section
            className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
            data-goals-workbench
          >
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="size-5 text-primary" aria-hidden />
                  Set the plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={saveSeasonPlanAction} className="grid gap-4 sm:grid-cols-2">
                  <Field label="Season outcome" htmlFor="outcome" className="sm:col-span-2">
                    <Input
                      id="outcome"
                      name="outcome"
                      defaultValue={plan.outcome}
                      maxLength={160}
                      required
                    />
                  </Field>
                  <Field label="Target date" htmlFor="targetDate">
                    <Input
                      id="targetDate"
                      name="targetDate"
                      type="date"
                      defaultValue={plan.targetDate}
                    />
                  </Field>
                  <Field label="Primary focus" htmlFor="focus">
                    <Input
                      id="focus"
                      name="focus"
                      defaultValue={plan.focus}
                      maxLength={80}
                      required
                    />
                  </Field>
                  <Field label="Measured sessions per week" htmlFor="weeklySessions">
                    <Input
                      id="weeklySessions"
                      name="weeklySessions"
                      type="number"
                      min={1}
                      max={7}
                      defaultValue={plan.weeklySessions}
                      required
                    />
                  </Field>
                  <Field label="What success looks like" htmlFor="successMeasure">
                    <Input
                      id="successMeasure"
                      name="successMeasure"
                      defaultValue={plan.successMeasure}
                      maxLength={180}
                      required
                    />
                  </Field>
                  <Button type="submit" className="min-h-11 sm:col-span-2">
                    Save season plan
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              <MetricEvidenceDrawer
                label="Weekly rhythm"
                value={`${weeklySessions} / ${plan.weeklySessions} sessions`}
                confidence={
                  rhythmMet
                    ? "High confidence"
                    : weeklySessions > 0
                      ? "Low confidence"
                      : "Insufficient evidence"
                }
                evidence={{
                  measuredShots: weeklyShots,
                  sessions: weeklySessions,
                  dateRange: "Last 7 days",
                  source: "Imported session evidence",
                  explanation: rhythmMet
                    ? "The planned measured-session rhythm has been reached this week."
                    : "Only imported sessions count; planned or manually ticked practice does not prove completion.",
                }}
              />
              <Card className="shadow-sm">
                <CardContent className="grid gap-3 pt-5">
                  <PlanStep
                    icon={Target}
                    title="This week"
                    detail={`Complete ${plan.weeklySessions} measured sessions focused on ${plan.focus.toLowerCase()}.`}
                  />
                  <PlanStep
                    icon={CalendarDays}
                    title="Weekly review"
                    detail="Review the strongest change, weakest signal and next evidence requirement in Progress."
                  />
                  <Button asChild variant="outline" className="min-h-11 rounded-xl">
                    <Link href="/progress">Open weekly game review</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <section aria-labelledby="measured-goals-title" className="grid gap-4">
            <div>
              <p className="text-sm font-semibold text-primary">Measured targets</p>
              <h2 id="measured-goals-title" className="mt-1 font-display text-2xl font-semibold">
                Goals linked to evidence
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Track handicap, carry, dispersion, speed, practice frequency, course records and
                tournament outcomes. Current values remain explicit so an imported result can be
                checked before it replaces the baseline.
              </p>
            </div>

            {preferences.goals.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {preferences.goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            ) : (
              <AppEmptyState
                title="No active measured goals"
                description="Keep the season outcome broad and add one numerical target backed by imported evidence."
                primaryAction={<GoalCreateDialog label="Add first goal" />}
              />
            )}

            <div className="flex justify-end">
              <GoalCreateDialog label="Add measured goal" />
            </div>
          </section>
        </>
      )}

      <RecommendedAction
        title={`Run a short ${plan.focus.toLowerCase()} session`}
        detail="Quick Range keeps the session focused. The result is only scored after the measured shots are imported."
        href={`/practice/quick-range?focus=${encodeURIComponent(plan.focus)}`}
        actionLabel="Open Quick Range"
      />
    </PageShell>
  );
}

function goalErrorMessage(error: string | undefined) {
  if (error === "goal_type") {
    return "Choose a valid goal type and complete the required goal details.";
  }

  if (error === "goal_not_found") {
    return "That goal could not be found. Refresh the page and try again.";
  }

  return null;
}

function mobileGoalDisclosure(goal: SeasonGoal) {
  const progress = goalProgress(goal);
  const movement = Math.round((goal.currentValue - goal.startingValue) * 10) / 10;

  return {
    value: `goal-${goal.id}`,
    title: goal.title,
    summary: `${progress}%`,
    description: `${goal.currentValue} ${goal.unit} now · ${goal.targetValue} ${goal.unit} target`,
    content: (
      <div className="grid gap-4">
        <dl className="grid gap-2 text-sm">
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 py-2 last:border-0">
            <dt className="text-muted-foreground">Starting value</dt>
            <dd className="font-semibold tabular-nums">
              {goal.startingValue} {goal.unit}
            </dd>
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 py-2 last:border-0">
            <dt className="text-muted-foreground">Movement</dt>
            <dd className="font-semibold tabular-nums">
              {movement > 0 ? "+" : ""}
              {movement} {goal.unit}
            </dd>
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 py-2 last:border-0">
            <dt className="text-muted-foreground">Evidence</dt>
            <dd className="max-w-[62%] text-right font-medium">{goal.evidenceSource}</dd>
          </div>
        </dl>
        <div>
          <Progress value={progress} aria-label={`${progress}% progress`} />
          <p className="mt-2 text-sm leading-5 text-muted-foreground">Next: {goal.nextAction}</p>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/70 pt-3">
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : "No deadline set"}
          </p>
          <div className="flex gap-2">
            <GoalEditSheet goal={goal} />
            <GoalDeleteDialog goal={goal} />
          </div>
        </div>
      </div>
    ),
  };
}

function SeasonPlanForm({ plan, idPrefix }: { plan: SeasonPlan; idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form action={saveSeasonPlanAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Season outcome" htmlFor={id("outcome")} className="sm:col-span-2">
        <Input
          id={id("outcome")}
          name="outcome"
          defaultValue={plan.outcome}
          maxLength={160}
          required
        />
      </Field>
      <Field label="Target date" htmlFor={id("target-date")}>
        <Input
          id={id("target-date")}
          name="targetDate"
          type="date"
          defaultValue={plan.targetDate}
        />
      </Field>
      <Field label="Primary focus" htmlFor={id("focus")}>
        <Input id={id("focus")} name="focus" defaultValue={plan.focus} maxLength={80} required />
      </Field>
      <Field label="Measured sessions per week" htmlFor={id("weekly-sessions")}>
        <Input
          id={id("weekly-sessions")}
          name="weeklySessions"
          type="number"
          inputMode="numeric"
          min={1}
          max={7}
          defaultValue={plan.weeklySessions}
          required
        />
      </Field>
      <Field label="What success looks like" htmlFor={id("success-measure")}>
        <Input
          id={id("success-measure")}
          name="successMeasure"
          defaultValue={plan.successMeasure}
          maxLength={180}
          required
        />
      </Field>
      <Button type="submit" className="min-h-11 sm:col-span-2">
        Save season plan
      </Button>
    </form>
  );
}

function GoalCard({ goal }: { goal: SeasonGoal }) {
  const progress = goalProgress(goal);
  const movement = Math.round((goal.currentValue - goal.startingValue) * 10) / 10;
  const confidence = goal.evidenceSource.toLowerCase().includes("import")
    ? "Moderate confidence"
    : "Low confidence";
  return (
    <Card className="shadow-sm" data-goal-target-card>
      <CardContent className="grid gap-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {goalTypeLabel(goal.type)} · {goal.club}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{goal.title}</h3>
          </div>
          <StatusPill tone={progress >= 100 ? "green" : progress > 0 ? "sky" : "amber"}>
            {progress}%
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : "No deadline set"}
          </p>
          <div className="flex gap-2">
            <GoalEditSheet goal={goal} />
            <GoalDeleteDialog goal={goal} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PlanStep({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Target;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-secondary/55 p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}
