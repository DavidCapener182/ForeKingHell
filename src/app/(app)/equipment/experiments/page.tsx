import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, FlaskConical, Save, ShieldAlert } from "lucide-react";

import { saveSessionComparisonAction } from "@/app/analyse/compare/actions";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  return (
    <PageShell>
      <div className="grid gap-4" data-equipment-experiment-desktop>
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

function FairTestWarning() {
  return (
    <Alert className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]">
      <ShieldAlert className="size-4" aria-hidden />
      <AlertTitle>Check whether the test is fair</AlertTitle>
      <AlertDescription>
        These samples came from separate sessions. If ball, location, target, warm-up or conditions
        changed, lower the confidence and record it in the decision.
      </AlertDescription>
    </Alert>
  );
}

function formatMetric(metric: ReturnType<typeof buildComparisonProvenance>[number]) {
  if (metric.value === null) return "—";
  const value = Math.round(metric.value * 10) / 10;
  return `${value > 0 ? "+" : ""}${value} ${metric.unit}`;
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
