import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Save,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";

import { saveSessionComparisonAction } from "@/app/analyse/compare/actions";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { BottomSheet, MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db/client";
import { analysisSnapshots } from "@/db/schema";
import { buildComparisonProvenance } from "@/lib/comparison-provenance";
import { defaultCompareFilters, getCompareData } from "@/lib/compare-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function EquipmentExperimentPage({
  searchParams,
}: {
  searchParams?: Promise<{ sessionId?: string; baselineSessionId?: string; clubId?: string }>;
}) {
  const params = await searchParams;
  const filters = {
    ...defaultCompareFilters(),
    focus: "session" as const,
    baseline: "previous-session" as const,
    sessionId: normalizeOptionalQuery(params?.sessionId),
    baselineSessionId: normalizeOptionalQuery(params?.baselineSessionId),
    clubId: normalizeOptionalQuery(params?.clubId),
  };
  const userId = await requireCurrentUserId();
  const [data, saved] = await Promise.all([
    getCompareData(filters),
    getDb()
      .select()
      .from(analysisSnapshots)
      .where(
        and(
          eq(analysisSnapshots.userId, userId),
          sql`${analysisSnapshots.chartStateJson}->>'view' = 'session_comparison'`,
          sql`${analysisSnapshots.chartStateJson}->>'experimentType' in ('equipment_change','ball_change','club_setting')`,
        ),
      )
      .orderBy(desc(analysisSnapshots.capturedAt))
      .limit(12),
  ]);
  const metrics = buildComparisonProvenance(data);
  const differentDays = data.focus.detail !== data.baseline.detail;
  const mobileVerdict = experimentVerdict(metrics);
  const keyMetrics = experimentKeyMetrics(metrics);
  return (
    <PageShell>
      <MobileEquipmentExperiment
        data={data}
        differentDays={differentDays}
        keyMetrics={keyMetrics}
        metrics={metrics}
        saved={saved}
        verdict={mobileVerdict}
      />

      <div className="hidden gap-4 lg:grid" data-equipment-experiment-desktop>
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/equipment">
            <ArrowLeft className="size-4" aria-hidden />
            Equipment
          </Link>
        </Button>
        <PageHeader
          eyebrow={<StatusPill tone="sky">Controlled testing</StatusPill>}
          title="Equipment Experiment Lab"
          description="Define what changed, keep the test conditions explicit, compare measured outcomes and save the equipment decision with its confidence."
        />
        <ExperimentSelectionForm data={data} className="md:grid-cols-3" />
        {differentDays ? <FairTestWarning /> : null}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.key} className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-semibold">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold">{formatMetric(metric)}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {metric.confidenceLabel} · {metric.caveat}
              </p>
            </article>
          ))}
        </section>
        <section className="grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ExperimentDecisionForm data={data} className="sm:grid-cols-2" />
          <aside>
            <h2 className="text-xl font-semibold">Saved decisions</h2>
            <div className="mt-3 grid gap-2">
              {saved.length ? (
                saved.map((snapshot) => (
                  <div key={snapshot.id} className="rounded-xl bg-secondary/55 p-3">
                    <p className="font-semibold">{snapshot.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {snapshot.notes ?? "No decision note"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No equipment decision saved yet.</p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </PageShell>
  );
}

function MobileEquipmentExperiment({
  data,
  differentDays,
  keyMetrics,
  metrics,
  saved,
  verdict,
}: {
  data: Awaited<ReturnType<typeof getCompareData>>;
  differentDays: boolean;
  keyMetrics: ReturnType<typeof experimentKeyMetrics>;
  metrics: ReturnType<typeof buildComparisonProvenance>;
  saved: Array<typeof analysisSnapshots.$inferSelect>;
  verdict: ReturnType<typeof experimentVerdict>;
}) {
  return (
    <MobileAppShell className="gap-4">
      <MobileTopBar title="Experiment lab" />

      <section
        className="ios-grouped-list overflow-hidden px-4 py-4"
        aria-labelledby="experiment-answer"
      >
        <div className="flex items-center justify-between gap-3">
          <IOSInlineStatus label={verdict.label} tone={verdict.tone} />
          <ExperimentSelectionSheet data={data} />
        </div>
        <h2
          id="experiment-answer"
          className="mt-2 text-[1.75rem] font-semibold leading-8 tracking-tight text-foreground"
        >
          {verdict.headline}
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Test setup against current setup · {data.focus.stockShots} vs {data.baseline.stockShots}
          stock shots. {verdict.detail}
        </p>
        <ExperimentDecisionSheet data={data} />
      </section>

      {differentDays ? <FairTestWarning compact /> : null}

      <section className="grid gap-2" aria-labelledby="experiment-key-signals">
        <IOSSectionHeader
          title="Decision signals"
          description="The three most useful measured changes"
        />
        <IOSGroupedList label="Key equipment experiment metrics">
          {keyMetrics.map((metric) => (
            <IOSListRow
              key={metric.key}
              label={metric.label}
              value={formatMetric(metric)}
              detail={metric.confidenceLabel}
              status={
                <IOSInlineStatus
                  label={metricSignalLabel(metric)}
                  tone={directionTone(metric.direction)}
                />
              }
            />
          ))}
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-labelledby="experiment-saved-decisions">
        <IOSSectionHeader
          title="Saved decisions"
          description="Your latest frozen equipment calls"
        />
        <IOSGroupedList label="Recent saved equipment decisions">
          {saved.length > 0 ? (
            saved
              .slice(0, 3)
              .map((snapshot) => (
                <IOSListRow
                  key={snapshot.id}
                  label={snapshot.name}
                  detail={snapshot.notes ?? "No decision note"}
                  leading={<CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />}
                />
              ))
          ) : (
            <IOSListRow
              label="No saved decision yet"
              detail="Record the result only after reviewing sample confidence and test conditions."
            />
          )}
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-labelledby="experiment-depth">
        <IOSSectionHeader title="Evidence" />
        <IOSDisclosureGroup
          label="Equipment experiment evidence"
          items={[
            {
              value: "all-metrics",
              title: "All measured changes",
              summary: `${metrics.length}`,
              description: "Distance, speed, control and launch",
              content: (
                <IOSGroupedList label="All equipment experiment metrics">
                  {metrics.map((metric) => (
                    <IOSListRow
                      key={metric.key}
                      label={metric.label}
                      value={formatMetric(metric)}
                      detail={metric.method}
                      status={
                        <IOSInlineStatus
                          label={metricSignalLabel(metric)}
                          tone={directionTone(metric.direction)}
                        />
                      }
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
            {
              value: "confidence",
              title: "Confidence and methodology",
              summary: metrics[0]?.confidenceLabel ?? "No data",
              description: "What this result can and cannot prove",
              content: (
                <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                  <p>{metrics[0]?.source ?? "No comparable stock-shot samples are available."}</p>
                  <p>
                    {metrics[0]?.caveat ??
                      "Import comparable sessions before making an equipment decision."}
                  </p>
                </div>
              ),
            },
            ...(saved.length > 3
              ? [
                  {
                    value: "older-decisions",
                    title: "Older saved decisions",
                    summary: `${saved.length - 3}`,
                    content: (
                      <IOSGroupedList label="Older equipment decisions">
                        {saved.slice(3).map((snapshot) => (
                          <IOSListRow
                            key={snapshot.id}
                            label={snapshot.name}
                            detail={snapshot.notes ?? "No decision note"}
                          />
                        ))}
                      </IOSGroupedList>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>
    </MobileAppShell>
  );
}

function ExperimentSelectionSheet({ data }: { data: Awaited<ReturnType<typeof getCompareData>> }) {
  return (
    <BottomSheet
      label={
        <>
          <SlidersHorizontal className="size-4" aria-hidden />
          Setups
        </>
      }
      title="Choose measured setups"
      triggerClassName="min-h-11 rounded-xl border border-border bg-secondary px-3 text-foreground"
    >
      <ExperimentSelectionForm
        data={data}
        className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      />
    </BottomSheet>
  );
}

function ExperimentDecisionSheet({ data }: { data: Awaited<ReturnType<typeof getCompareData>> }) {
  return (
    <BottomSheet
      label={
        <>
          <Save className="size-4" aria-hidden />
          Record decision
        </>
      }
      title="Record equipment decision"
      triggerClassName="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 text-primary-foreground"
    >
      <ExperimentDecisionForm
        data={data}
        className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      />
    </BottomSheet>
  );
}

function ExperimentSelectionForm({
  data,
  className,
}: {
  data: Awaited<ReturnType<typeof getCompareData>>;
  className?: string;
}) {
  return (
    <form
      action="/equipment/experiments"
      className={`grid gap-3 rounded-2xl border bg-card p-4 ${className ?? ""}`}
    >
      <SessionSelect
        label="Test setup session"
        name="sessionId"
        sessions={data.sessions}
        value={data.filters.sessionId}
      />
      <SessionSelect
        label="Current setup session"
        name="baselineSessionId"
        sessions={data.sessions}
        value={data.filters.baselineSessionId}
      />
      <label className="grid gap-1 text-sm font-semibold">
        Club
        <Select name="clubId" defaultValue={data.filters.clubId || "__all__"}>
          <SelectTrigger className="min-h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All clubs</SelectItem>
            {data.clubs.map((club) => (
              <SelectItem key={club.id} value={club.id}>
                {club.label} · {club.shotCount} shots
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <Button type="submit" className="min-h-11 md:w-fit">
        <FlaskConical className="size-4" aria-hidden />
        Compare setups
      </Button>
    </form>
  );
}

function ExperimentDecisionForm({
  data,
  className,
}: {
  data: Awaited<ReturnType<typeof getCompareData>>;
  className?: string;
}) {
  return (
    <form action={saveSessionComparisonAction} className={`grid gap-3 ${className ?? ""}`}>
      <input type="hidden" name="sessionId" value={data.filters.sessionId} />
      <input type="hidden" name="baselineSessionId" value={data.filters.baselineSessionId} />
      <input type="hidden" name="clubId" value={data.filters.clubId} />
      <input type="hidden" name="condition" value="same" />
      <label className="grid gap-1 text-sm font-semibold">
        Decision name
        <Input
          name="name"
          placeholder="New driver versus current driver"
          className="min-h-11 text-base"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Experiment type
        <Select name="experimentType" defaultValue="equipment_change">
          <SelectTrigger className="min-h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equipment_change">Club change</SelectItem>
            <SelectItem value="ball_change">Golf ball</SelectItem>
            <SelectItem value="club_setting">Club setting</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <Field name="ball" label="Keep constant: ball" placeholder="Pro V1" />
      <Field name="location" label="Keep constant: location" placeholder="Bay 4" />
      <Field name="target" label="Keep constant: target" placeholder="250 yd centre line" />
      <Field name="warmup" label="Keep constant: warm-up" placeholder="10 shots" />
      <Field name="loft" label="Loft / setting" placeholder="10.5° neutral" />
      <Field name="shaft" label="Shaft" placeholder="Model and flex" />
      <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
        Notes and saved equipment decision
        <Textarea
          name="notes"
          rows={4}
          maxLength={4000}
          className="min-h-28 rounded-xl border bg-background p-3 text-base"
          placeholder="Decision, caveats, and what must be retested"
          required
        />
      </label>
      <Button type="submit" className="min-h-11 sm:w-fit">
        <Save className="size-4" aria-hidden />
        Save decision
      </Button>
    </form>
  );
}

function FairTestWarning({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="alert"
      className={`flex gap-3 border border-amber-300 bg-amber-50 text-sm text-amber-950 dark:border-amber-500/45 dark:bg-amber-500/10 dark:text-amber-100 ${compact ? "ios-grouped-list p-4" : "rounded-2xl p-4"}`}
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">Check whether the test is fair</p>
        <p className="mt-1 leading-5">
          These samples came from separate sessions. If ball, location, target, warm-up or
          conditions changed, lower the confidence and record it in the decision.
        </p>
      </div>
    </div>
  );
}

function experimentVerdict(metrics: ReturnType<typeof buildComparisonProvenance>) {
  const improved = metrics.filter((metric) => metric.direction === "better").length;
  const worse = metrics.filter((metric) => metric.direction === "worse").length;
  const available = metrics.filter((metric) => metric.direction !== "unavailable").length;

  if (available === 0) {
    return {
      label: "No comparison yet",
      headline: "Choose two measured sessions",
      detail:
        "Comparable stock-shot evidence is required before the experiment can answer anything.",
      tone: "neutral" as const,
    };
  }
  if (improved >= worse + 2) {
    return {
      label: "Test setup leads",
      headline: "The test setup looks better",
      detail: `${improved} measured signals improved and ${worse} moved backwards.`,
      tone: "positive" as const,
    };
  }
  if (worse >= improved + 2) {
    return {
      label: "Current setup leads",
      headline: "The current setup remains stronger",
      detail: `${worse} measured signals moved backwards and ${improved} improved.`,
      tone: "attention" as const,
    };
  }
  if (improved === 0 && worse === 0) {
    return {
      label: "Steady result",
      headline: "No measurable equipment difference",
      detail: "No measured signal moved beyond the current rounding threshold.",
      tone: "neutral" as const,
    };
  }
  return {
    label: "Mixed result",
    headline: "The equipment decision is not clear yet",
    detail: `${improved} measured signals improved and ${worse} moved backwards.`,
    tone: "attention" as const,
  };
}

function experimentKeyMetrics(metrics: ReturnType<typeof buildComparisonProvenance>) {
  const preferred = ["playableRateDelta", "coneDeltaYd", "carryDeltaYd"];
  return preferred
    .map((key) => metrics.find((metric) => metric.key === key))
    .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));
}

function formatMetric(metric: ReturnType<typeof buildComparisonProvenance>[number]) {
  if (metric.value === null) return "—";
  const value = Math.round(metric.value * 10) / 10;
  return `${value > 0 ? "+" : ""}${value} ${metric.unit}`;
}

function metricSignalLabel(metric: ReturnType<typeof buildComparisonProvenance>[number]) {
  if (metric.direction === "better") return "Improved";
  if (metric.direction === "worse") return "Moved backwards";
  if (metric.direction === "mixed") {
    return metric.key === "launchDeltaDeg" ? "Context only" : "Steady";
  }
  return "No data";
}

function directionTone(
  direction: ReturnType<typeof buildComparisonProvenance>[number]["direction"],
) {
  if (direction === "better") return "positive" as const;
  if (direction === "worse") return "attention" as const;
  return "neutral" as const;
}

function SessionSelect({
  label,
  name,
  sessions,
  value,
}: {
  label: string;
  name: string;
  sessions: Awaited<ReturnType<typeof getCompareData>>["sessions"];
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <Select name={name} defaultValue={value || "__auto__"}>
        <SelectTrigger className="min-h-11 w-full text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__auto__">Automatic</SelectItem>
          {sessions.map((session) => (
            <SelectItem key={session.id} value={session.id}>
              {session.dateLabel} · {session.label} · {session.shotCount} shots
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function normalizeOptionalQuery(value: string | undefined) {
  return value && value !== "__auto__" && value !== "__all__" ? value : "";
}
function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <Input name={name} placeholder={placeholder} maxLength={180} className="min-h-11 text-base" />
    </label>
  );
}
