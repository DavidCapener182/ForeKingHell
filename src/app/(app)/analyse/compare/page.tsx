import Link from "next/link";
import { ArrowLeft, Crosshair, GitCompareArrows, Save, Share2, Target, Trash2 } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  deleteSessionComparisonAction,
  saveSessionComparisonAction,
} from "@/app/analyse/compare/actions";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDb } from "@/db/client";
import { analysisSnapshots } from "@/db/schema";
import { buildComparisonProvenance } from "@/lib/comparison-provenance";
import {
  defaultCompareFilters,
  getCompareData,
  type CompareConditionMode,
  type CompareFilters,
} from "@/lib/compare-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  sessionId?: string;
  baselineSessionId?: string;
  clubId?: string;
  condition?: string;
  period?: string;
}>;

export default async function SessionComparePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const userId = await requireCurrentUserId();
  const [data, savedComparisons] = await Promise.all([
    getCompareData(filters),
    getDb()
      .select()
      .from(analysisSnapshots)
      .where(
        and(
          eq(analysisSnapshots.userId, userId),
          sql`${analysisSnapshots.chartStateJson}->>'view' = 'session_comparison'`,
        ),
      )
      .orderBy(desc(analysisSnapshots.capturedAt))
      .limit(12),
  ]);
  const provenance = buildComparisonProvenance(data);
  const confidence = provenance[0];

  return (
    <PageShell>
      <MobileRouteHeader title="Session compare" group="analyse" activeKey="compare" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/analyse" prefetch={false}>
            <ArrowLeft className="size-4" />
            Analyse
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/compare" prefetch={false}>
            Club and player compare
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="sky">Evidence comparison</StatusPill>}
        title="Session vs session"
        description="Compare two launch-monitor samples, see what changed, and inspect the source and confidence behind every metric."
        actions={
          <Button asChild>
            <Link href="/practice" prefetch={false}>
              <Target className="size-4" />
              Build practice plan
            </Link>
          </Button>
        }
      />

      <form
        action="/analyse/compare"
        className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(160px,0.6fr)_minmax(170px,0.65fr)_auto] xl:items-end"
      >
        <SessionSelect
          label="Focus session"
          name="sessionId"
          value={data.filters.sessionId}
          sessions={data.sessions}
        />
        <SessionSelect
          label="Baseline session"
          name="baselineSessionId"
          value={data.filters.baselineSessionId}
          sessions={data.sessions}
        />
        <label className="grid gap-1 text-sm font-medium">
          Club
          <select
            name="clubId"
            defaultValue={data.filters.clubId}
            className="min-h-11 rounded-md border bg-background px-3"
          >
            <option value="">All clubs</option>
            {data.clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.label} · {club.shotCount} shots
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Comparison mode
          <select
            name="condition"
            defaultValue={data.filters.condition}
            className="min-h-11 rounded-md border bg-background px-3"
          >
            <option value="same">Selected sessions</option>
            <option value="indoor-outdoor">Outdoor vs indoor</option>
            <option value="practice-round">Round vs practice</option>
          </select>
        </label>
        <Button type="submit" className="min-h-11">
          <GitCompareArrows className="size-4" />
          Compare
        </Button>
      </form>

      <div
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Comparison experiment presets"
      >
        {[
          ["Before and after a lesson", "lesson"],
          ["Before and after equipment", "equipment_change"],
          ["This month versus last", "month"],
          ["Golf ball or club setting", "equipment_setup"],
        ].map(([label, preset]) => (
          <Link
            key={preset}
            href={preset === "month" ? "/analyse/compare?period=month" : "/analyse/compare"}
            className="rounded-xl border bg-card p-3 text-sm font-semibold hover:border-primary"
          >
            {label}
            <span className="mt-1 block font-normal text-muted-foreground">
              {preset === "month"
                ? "Uses two 30-day windows"
                : "Select matched sessions, then save the context and notes"}
            </span>
          </Link>
        ))}
      </div>

      <section className="grid gap-4 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={benefitTone(data.benefit.verdict)}>{data.benefit.verdict}</StatusPill>
            <StatusPill tone={confidence?.confidence === "early" ? "amber" : "green"}>
              {confidence?.confidenceLabel ?? "No evidence"}
            </StatusPill>
          </div>
          <h2 className="mt-3 text-2xl font-semibold">{data.benefit.summary}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {data.focus.label} ({data.focus.stockShots} stock shots) against {data.baseline.label} (
            {data.baseline.stockShots} stock shots).
          </p>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-semibold">Trust note</p>
          <p className="mt-1 leading-5 text-muted-foreground">
            {confidence?.caveat ?? "Choose two sessions with recorded stock shots."}
          </p>
        </div>
      </section>

      <section aria-labelledby="changed-metrics-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">What changed</p>
            <h2 id="changed-metrics-title" className="text-2xl font-semibold">
              Metric deltas
            </h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/shots" prefetch={false}>
              <Crosshair className="size-4" />
              Inspect raw shots
            </Link>
          </Button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {provenance.map((metric) => (
            <article key={metric.key} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{metric.label}</p>
                <StatusPill tone={directionTone(metric.direction)}>{metric.direction}</StatusPill>
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {formatDelta(metric.value, metric.unit)}
              </p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium">Source and method</summary>
                <dl className="mt-2 grid gap-2 text-muted-foreground">
                  <div>
                    <dt className="font-medium text-foreground">Source</dt>
                    <dd>{metric.source}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Method</dt>
                    <dd>{metric.method}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Confidence</dt>
                    <dd>{metric.confidenceLabel}</dd>
                  </div>
                </dl>
              </details>
            </article>
          ))}
        </div>
      </section>

      {data.focus.stockShots < 10 || data.baseline.stockShots < 10 ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Minimum sample warning</p>
          <p className="mt-1">
            Use at least 10 comparable stock shots on each side before treating the result as a
            decision. Current samples: {data.focus.stockShots} and {data.baseline.stockShots}.
          </p>
        </div>
      ) : null}

      <section
        className="grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
        aria-labelledby="save-comparison-title"
      >
        <form action={saveSessionComparisonAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <h2 id="save-comparison-title" className="text-xl font-semibold">
              Save the experiment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the exact filters, evidence summary and your interpretation for later review or
              coach sharing.
            </p>
          </div>
          <input type="hidden" name="sessionId" value={data.filters.sessionId} />
          <input type="hidden" name="baselineSessionId" value={data.filters.baselineSessionId} />
          <input type="hidden" name="clubId" value={data.filters.clubId} />
          <input type="hidden" name="condition" value={data.filters.condition} />
          <input type="hidden" name="period" value={params.period ?? ""} />
          <label className="grid gap-1 text-sm font-medium">
            <span>Name</span>
            <Input
              name="name"
              defaultValue={`${data.focus.label} vs ${data.baseline.label}`}
              maxLength={180}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            <span>Experiment type</span>
            <select name="experimentType" className="min-h-10 rounded-md border bg-background px-3">
              <option value="session_vs_session">Session vs session</option>
              <option value="lesson">Before/after lesson</option>
              <option value="equipment_change">Equipment change</option>
              <option value="ball_change">Golf ball</option>
              <option value="club_setting">Club setting</option>
              <option value="practice_round">Practice vs round</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            <span>Your notes</span>
            <textarea
              name="notes"
              rows={3}
              maxLength={4000}
              className="rounded-md border bg-background p-3"
              placeholder="What stayed constant, what changed, and what decision will this inform?"
            />
          </label>
          <Button type="submit" className="min-h-11 md:w-fit">
            <Save className="size-4" aria-hidden />
            Save comparison
          </Button>
        </form>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/coach/reports?include=comparisons">
            <Share2 className="size-4" aria-hidden />
            Share with coach
          </Link>
        </Button>
      </section>

      <section className="grid gap-3" aria-labelledby="saved-comparisons-title">
        <div>
          <h2 id="saved-comparisons-title" className="text-2xl font-semibold">
            Saved comparisons
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Frozen filters, notes and deterministic metric deltas.
          </p>
        </div>
        {savedComparisons.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {savedComparisons.map((snapshot) => (
              <article key={snapshot.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{snapshot.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved{" "}
                      {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                        snapshot.capturedAt,
                      )}
                    </p>
                  </div>
                  <form action={deleteSessionComparisonAction}>
                    <input type="hidden" name="snapshotId" value={snapshot.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${snapshot.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </form>
                </div>
                {snapshot.notes ? (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{snapshot.notes}</p>
                ) : null}
                <p className="mt-3 text-sm font-semibold text-primary">
                  {String(
                    snapshot.summaryJson.summary ??
                      snapshot.summaryJson.verdict ??
                      "Saved evidence comparison",
                  )}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No saved comparison yet.
          </div>
        )}
      </section>
    </PageShell>
  );
}

function SessionSelect({
  label,
  name,
  value,
  sessions,
}: {
  label: string;
  name: "sessionId" | "baselineSessionId";
  value: string;
  sessions: Awaited<ReturnType<typeof getCompareData>>["sessions"];
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="min-h-11 rounded-md border bg-background px-3"
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

function filtersFromParams(params: Awaited<SearchParams>): CompareFilters {
  const condition: CompareConditionMode =
    params.condition === "indoor-outdoor" || params.condition === "practice-round"
      ? params.condition
      : "same";
  const period = params.period === "month";
  return {
    ...defaultCompareFilters(),
    focus: period ? "last-30" : "session",
    baseline: period ? "previous-30" : "previous-session",
    sessionId: params.sessionId ?? "",
    baselineSessionId: params.baselineSessionId ?? "",
    clubId: params.clubId ?? "",
    condition,
  };
}

function formatDelta(value: number | null, unit: string) {
  if (value === null) return "Not available";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} ${unit}`;
}

function directionTone(direction: string) {
  if (direction === "better") return "green" as const;
  if (direction === "worse") return "amber" as const;
  return "slate" as const;
}

function benefitTone(verdict: string) {
  if (verdict === "Beneficial") return "green" as const;
  if (verdict === "Useful") return "sky" as const;
  if (verdict === "Mixed") return "amber" as const;
  return "slate" as const;
}
