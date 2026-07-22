import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, FlaskConical, Save, ShieldAlert } from "lucide-react";

import { saveSessionComparisonAction } from "@/app/analyse/compare/actions";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    sessionId: params?.sessionId ?? "",
    baselineSessionId: params?.baselineSessionId ?? "",
    clubId: params?.clubId ?? "",
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
      <form
        action="/equipment/experiments"
        className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-3"
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
          <select
            name="clubId"
            defaultValue={data.filters.clubId}
            className="min-h-11 rounded-xl border bg-background px-3"
          >
            <option value="">All clubs</option>
            {data.clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.label} · {club.shotCount} shots
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-11 md:w-fit">
          <FlaskConical className="size-4" aria-hidden />
          Compare setups
        </Button>
      </form>
      {differentDays ? (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Check whether the test is fair</p>
            <p className="mt-1">
              These samples were recorded as separate sessions. If ball, location, target, warm-up
              or conditions changed, treat the result as lower confidence and record that below.
            </p>
          </div>
        </div>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.key} className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-semibold">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {metric.value === null
                ? "—"
                : `${metric.value > 0 ? "+" : ""}${Math.round(metric.value * 10) / 10} ${metric.unit}`}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {metric.confidenceLabel} · {metric.caveat}
            </p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form action={saveSessionComparisonAction} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="sessionId" value={data.filters.sessionId} />
          <input type="hidden" name="baselineSessionId" value={data.filters.baselineSessionId} />
          <input type="hidden" name="clubId" value={data.filters.clubId} />
          <input type="hidden" name="condition" value="same" />
          <label className="grid gap-1 text-sm font-semibold">
            Decision name
            <Input name="name" placeholder="New driver versus current driver" required />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Experiment type
            <select
              name="experimentType"
              defaultValue="equipment_change"
              className="min-h-10 rounded-md border bg-background px-3"
            >
              <option value="equipment_change">Club change</option>
              <option value="ball_change">Golf ball</option>
              <option value="club_setting">Club setting</option>
            </select>
          </label>
          <Field name="ball" label="Keep constant: ball" placeholder="Pro V1" />
          <Field name="location" label="Keep constant: location" placeholder="Bay 4" />
          <Field name="target" label="Keep constant: target" placeholder="250 yd centre line" />
          <Field name="warmup" label="Keep constant: warm-up" placeholder="10 shots" />
          <Field name="loft" label="Loft / setting" placeholder="10.5° neutral" />
          <Field name="shaft" label="Shaft" placeholder="Model and flex" />
          <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
            Notes and saved equipment decision
            <textarea
              name="notes"
              rows={4}
              maxLength={4000}
              className="rounded-xl border bg-background p-3"
              placeholder="Decision, caveats, and what must be retested"
              required
            />
          </label>
          <Button type="submit" className="min-h-11 sm:w-fit">
            <Save className="size-4" aria-hidden />
            Save decision
          </Button>
        </form>
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
    </PageShell>
  );
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
      <select
        name={name}
        defaultValue={value}
        className="min-h-11 rounded-xl border bg-background px-3"
      >
        <option value="">Automatic</option>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.dateLabel} · {session.label} · {session.shotCount} shots
          </option>
        ))}
      </select>
    </label>
  );
}
function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <Input name={name} placeholder={placeholder} maxLength={180} />
    </label>
  );
}
