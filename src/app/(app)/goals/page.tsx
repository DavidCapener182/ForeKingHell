import Link from "next/link";
import type { ReactNode } from "react";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { ArrowRight, CalendarDays, CheckCircle2, Flag, Target, Trash2 } from "lucide-react";

import { addGoalAction, deleteGoalAction, saveSeasonPlanAction } from "@/app/goals/actions";
import {
  AnswerCard,
  MetricEvidenceDrawer,
  RecommendedAction,
} from "@/components/app/evidence-status";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getProductPreferences,
  goalProgress,
  goalTypeLabel,
  goalTypes,
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
  const [preferences, sessionRows, shotRows] = await Promise.all([
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

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Season plan</StatusPill>}
        title="Goals"
        description="Turn one season outcome into a measurable weekly rhythm, then let imported sessions prove the progress."
        actions={
          <Button asChild className="premium-action min-h-11 rounded-xl">
            <Link href="/practice/quick-range">
              Start quick range
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      {params?.saved === "1" ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-100"
          role="status"
        >
          <CheckCircle2 className="size-5" aria-hidden />
          Season plan saved.
        </div>
      ) : null}

      {params?.saved === "goal" ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-100"
          role="status"
        >
          <CheckCircle2 className="size-5" aria-hidden />
          Goal added to the season plan.
        </div>
      ) : null}

      <AnswerCard
        eyebrow="Season outcome"
        answer={plan.outcome}
        detail={`${plan.focus} is the current focus. ${plan.successMeasure}.`}
        confidence={weeklySessions > 0 ? "Moderate confidence" : "Insufficient evidence"}
        action={
          plan.targetDate ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              Target date {formatDate(plan.targetDate)}
            </p>
          ) : null
        }
      />

      <div className="grid gap-5 lg:hidden">
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
                      ? "text-xs font-medium text-emerald-700 dark:text-emerald-300"
                      : "text-xs font-medium text-amber-700 dark:text-amber-300"
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
                content: <AddGoalForm idPrefix="mobile-goal" />,
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

      <section className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <Card className="premium-card">
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
                <Input id="focus" name="focus" defaultValue={plan.focus} maxLength={80} required />
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
              <Button type="submit" className="premium-action min-h-11 sm:col-span-2">
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
          <Card className="premium-card">
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

      <section aria-labelledby="measured-goals-title" className="hidden gap-4 lg:grid">
        <div>
          <p className="text-sm font-semibold text-primary">Measured targets</p>
          <h2 id="measured-goals-title" className="mt-1 font-display text-2xl font-semibold">
            Goals linked to evidence
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Track handicap, carry, dispersion, speed, practice frequency, course records and
            tournament outcomes. Current values remain explicit so an imported result can be checked
            before it replaces the baseline.
          </p>
        </div>

        {preferences.goals.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {preferences.goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            No measured target yet. Add one below; the season outcome above can stay broad while
            these targets remain numerical.
          </div>
        )}

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Add a measured goal</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addGoalAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Goal type" htmlFor="type">
                <select
                  id="type"
                  name="type"
                  className="min-h-10 w-full rounded-md border bg-background px-3"
                  defaultValue="carry"
                >
                  {goalTypes.map((type) => (
                    <option key={type} value={type}>
                      {goalTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Goal title" htmlFor="title" className="xl:col-span-2">
                <Input
                  id="title"
                  name="title"
                  placeholder="Driver carry 250 yards"
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Club or context" htmlFor="club">
                <Input id="club" name="club" placeholder="Driver" maxLength={40} />
              </Field>
              <Field label="Starting value" htmlFor="startingValue">
                <Input id="startingValue" name="startingValue" type="number" step="0.1" required />
              </Field>
              <Field label="Current value" htmlFor="currentValue">
                <Input id="currentValue" name="currentValue" type="number" step="0.1" required />
              </Field>
              <Field label="Target value" htmlFor="targetValue">
                <Input id="targetValue" name="targetValue" type="number" step="0.1" required />
              </Field>
              <Field label="Unit" htmlFor="unit">
                <Input id="unit" name="unit" placeholder="yd" maxLength={20} required />
              </Field>
              <Field label="Target date" htmlFor="goalTargetDate">
                <Input id="goalTargetDate" name="goalTargetDate" type="date" />
              </Field>
              <Field label="Evidence source" htmlFor="evidenceSource" className="xl:col-span-2">
                <Input
                  id="evidenceSource"
                  name="evidenceSource"
                  defaultValue="Imported session evidence"
                  maxLength={120}
                  required
                />
              </Field>
              <Field
                label="Recommended next action"
                htmlFor="nextAction"
                className="md:col-span-2 xl:col-span-3"
              >
                <Input
                  id="nextAction"
                  name="nextAction"
                  placeholder="Run a 15-shot measured driver set"
                  maxLength={180}
                  required
                />
              </Field>
              <Button type="submit" className="premium-action min-h-11 self-end">
                Add goal
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <RecommendedAction
        title={`Run a short ${plan.focus.toLowerCase()} session`}
        detail="Quick Range keeps the session focused. The result is only scored after the measured shots are imported."
        href={`/practice/quick-range?focus=${encodeURIComponent(plan.focus)}`}
        actionLabel="Open Quick Range"
      />
    </PageShell>
  );
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
          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            aria-label={`${progress}% progress`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">Next: {goal.nextAction}</p>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/70 pt-3">
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : "No deadline set"}
          </p>
          <form action={deleteGoalAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <Button type="submit" variant="ghost" className="min-h-11 text-destructive">
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          </form>
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
      <Button type="submit" className="premium-action min-h-11 sm:col-span-2">
        Save season plan
      </Button>
    </form>
  );
}

function AddGoalForm({ idPrefix }: { idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form action={addGoalAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Goal type" htmlFor={id("type")}>
        <select
          id={id("type")}
          name="type"
          className="min-h-11 w-full rounded-md border bg-background px-3"
          defaultValue="carry"
        >
          {goalTypes.map((type) => (
            <option key={type} value={type}>
              {goalTypeLabel(type)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Goal title" htmlFor={id("title")} className="xl:col-span-2">
        <Input
          id={id("title")}
          name="title"
          placeholder="Driver carry 250 yards"
          maxLength={100}
          required
        />
      </Field>
      <Field label="Club or context" htmlFor={id("club")}>
        <Input id={id("club")} name="club" placeholder="Driver" maxLength={40} />
      </Field>
      <Field label="Starting value" htmlFor={id("starting-value")}>
        <Input
          id={id("starting-value")}
          name="startingValue"
          type="number"
          inputMode="decimal"
          step="0.1"
          required
        />
      </Field>
      <Field label="Current value" htmlFor={id("current-value")}>
        <Input
          id={id("current-value")}
          name="currentValue"
          type="number"
          inputMode="decimal"
          step="0.1"
          required
        />
      </Field>
      <Field label="Target value" htmlFor={id("target-value")}>
        <Input
          id={id("target-value")}
          name="targetValue"
          type="number"
          inputMode="decimal"
          step="0.1"
          required
        />
      </Field>
      <Field label="Unit" htmlFor={id("unit")}>
        <Input id={id("unit")} name="unit" placeholder="yd" maxLength={20} required />
      </Field>
      <Field label="Target date" htmlFor={id("target-date")}>
        <Input id={id("target-date")} name="goalTargetDate" type="date" />
      </Field>
      <Field label="Evidence source" htmlFor={id("evidence-source")} className="xl:col-span-2">
        <Input
          id={id("evidence-source")}
          name="evidenceSource"
          defaultValue="Imported session evidence"
          maxLength={120}
          required
        />
      </Field>
      <Field
        label="Recommended next action"
        htmlFor={id("next-action")}
        className="md:col-span-2 xl:col-span-3"
      >
        <Input
          id={id("next-action")}
          name="nextAction"
          placeholder="Run a 15-shot measured driver set"
          maxLength={180}
          required
        />
      </Field>
      <Button type="submit" className="premium-action min-h-11 self-end">
        Add goal
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
    <Card className="premium-card">
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
        <div className="grid grid-cols-3 gap-2 text-sm">
          <GoalMetric label="Starting" value={`${goal.startingValue} ${goal.unit}`} />
          <GoalMetric label="Current" value={`${goal.currentValue} ${goal.unit}`} />
          <GoalMetric label="Target" value={`${goal.targetValue} ${goal.unit}`} />
        </div>
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            aria-label={`${progress}% progress`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
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
          <form action={deleteGoalAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <Button type="submit" variant="ghost" size="sm">
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/45 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
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
