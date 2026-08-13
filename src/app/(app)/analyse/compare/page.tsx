import Link from "next/link";
import { ArrowLeft, Crosshair, GitCompareArrows, Save, Share2, Target } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import { saveSessionComparisonAction } from "@/app/analyse/compare/actions";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { BottomSheet, MobileTopBar } from "@/components/mobile-sports";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusTimeline } from "@/components/app/status-timeline";
import { MobileFilterSheet, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComparisonProvenancePanel } from "@/app/analyse/compare/comparison-provenance-panel";
import { DeleteComparisonButton } from "@/app/analyse/compare/delete-comparison-button";
import { SaveComparisonDialog } from "@/app/analyse/compare/save-comparison-dialog";
import { SessionComparisonToolbar } from "@/app/analyse/compare/session-comparison-toolbar";
import { getDb } from "@/db/client";
import { analysisSnapshots } from "@/db/schema";
import {
  buildComparisonProvenance,
  type ComparisonMetricProvenance,
} from "@/lib/comparison-provenance";
import {
  defaultCompareFilters,
  getCompareData,
  type CompareConditionMode,
  type CompareFilters,
  type CompareSampleSummary,
} from "@/lib/compare-data";
import { requireCurrentUserId } from "@/lib/current-user";
import { Textarea } from "@/components/ui/textarea";

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
      <MobileTopBar title="Session compare" className="lg:hidden" />

      <div className="hidden flex-wrap items-center justify-between gap-2 lg:flex">
        <Button asChild variant="ghost" className="min-h-11 px-0">
          <Link href="/analyse" prefetch={false}>
            <ArrowLeft className="size-4" />
            Analyse
          </Link>
        </Button>
        <div className="hidden lg:block">
          <Button asChild variant="outline">
            <Link href="/compare" prefetch={false}>
              Club and player compare
            </Link>
          </Button>
        </div>
      </div>

      <div className="hidden lg:block">
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
      </div>

      <MobileSessionCompare
        data={data}
        params={params}
        provenance={provenance}
        confidence={confidence}
        savedComparisons={savedComparisons}
      />

      <div className="hidden lg:contents">
        <SessionComparisonToolbar
          sessions={data.sessions}
          clubs={data.clubs}
          initial={{
            focusSessionId: data.filters.sessionId,
            baselineSessionId: data.filters.baselineSessionId,
            clubId: data.filters.clubId,
            condition: data.filters.condition,
          }}
          period={params.period === "month" ? "month" : "sessions"}
        />

        <section className="grid gap-4 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={benefitTone(data.benefit.verdict)}>
                {data.benefit.verdict}
              </StatusPill>
              <StatusPill tone={confidence?.confidence === "early" ? "amber" : "green"}>
                {confidence?.confidenceLabel ?? "No evidence"}
              </StatusPill>
            </div>
            <h2 className="mt-3 text-2xl font-semibold">{data.benefit.summary}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {data.focus.label} ({data.focus.stockShots} stock shots) against {data.baseline.label}{" "}
              ({data.baseline.stockShots} stock shots).
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">What changed</p>
              <h2 id="changed-metrics-title" className="text-2xl font-semibold">
                Comparison result
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <ComparisonProvenancePanel metrics={provenance} />
              <Button asChild variant="outline" size="sm">
                <Link href="/shots" prefetch={false}>
                  <Crosshair className="size-4" />
                  Inspect raw shots
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/70 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Focus</TableHead>
                  <TableHead className="text-right">Baseline</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provenance.map((metric) => (
                  <TableRow key={metric.key}>
                    <TableCell className="font-semibold">{metric.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {comparisonMetricValue(metric.key, data.focus, metric.unit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {comparisonMetricValue(metric.key, data.baseline, metric.unit)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatDelta(metric.value, metric.unit)}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={directionTone(metric.direction)}>
                        {metric.direction}
                      </StatusPill>
                    </TableCell>
                    <TableCell>{metric.confidenceLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-4"
          aria-labelledby="save-comparison-title"
        >
          <div>
            <h2 id="save-comparison-title" className="text-lg font-semibold">
              Keep this evidence
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Save the exact scope or pass it to a coach without turning the result into another
              dashboard card.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SaveComparisonDialog
              filters={{
                focusSessionId: data.filters.sessionId,
                baselineSessionId: data.filters.baselineSessionId,
                clubId: data.filters.clubId,
                condition: data.filters.condition,
                period: params.period ?? "",
              }}
              defaultName={`${data.focus.label} vs ${data.baseline.label}`}
            />
            <Button asChild variant="outline">
              <Link href="/coach/reports?include=comparisons">
                <Share2 className="size-4" aria-hidden />
                Share with coach
              </Link>
            </Button>
          </div>
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
            <StatusTimeline
              label="Saved comparisons"
              className="rounded-2xl border bg-card p-4"
              items={savedComparisons.map((snapshot) => ({
                id: snapshot.id,
                dateGroup: new Intl.DateTimeFormat("en-GB", {
                  month: "long",
                  year: "numeric",
                }).format(snapshot.capturedAt),
                timestamp: new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(snapshot.capturedAt),
                title: snapshot.name,
                description: String(
                  snapshot.summaryJson.summary ??
                    snapshot.summaryJson.verdict ??
                    "Saved evidence comparison",
                ),
                meta: snapshot.notes || "No interpretation note added.",
                kind: "reviewed" as const,
                action: <DeleteComparisonButton id={snapshot.id} name={snapshot.name} />,
              }))}
            />
          ) : (
            <AppEmptyState
              title="No saved comparison yet"
              description="Save a comparison when its filters, evidence and interpretation are worth revisiting."
              primaryAction={
                <SaveComparisonDialog
                  filters={{
                    focusSessionId: data.filters.sessionId,
                    baselineSessionId: data.filters.baselineSessionId,
                    clubId: data.filters.clubId,
                    condition: data.filters.condition,
                    period: params.period ?? "",
                  }}
                  defaultName={`${data.focus.label} vs ${data.baseline.label}`}
                />
              }
            />
          )}
        </section>
      </div>
    </PageShell>
  );
}

function MobileSessionCompare({
  data,
  params,
  provenance,
  confidence,
  savedComparisons,
}: {
  data: Awaited<ReturnType<typeof getCompareData>>;
  params: Awaited<SearchParams>;
  provenance: ReturnType<typeof buildComparisonProvenance>;
  confidence: ReturnType<typeof buildComparisonProvenance>[number] | undefined;
  savedComparisons: Array<typeof analysisSnapshots.$inferSelect>;
}) {
  const selectedClub = data.clubs.find((club) => club.id === data.filters.clubId);
  const activeFilterCount = [
    data.filters.sessionId,
    data.filters.baselineSessionId,
    data.filters.clubId,
    data.filters.condition !== "same" ? data.filters.condition : "",
    params.period,
  ].filter(Boolean).length;

  return (
    <div className="grid min-w-0 gap-4 lg:hidden">
      <section className="ios-grouped-list min-w-0 overflow-hidden px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <IOSInlineStatus
            label={data.benefit.verdict}
            tone={
              data.benefit.verdict === "Beneficial"
                ? "positive"
                : data.benefit.verdict === "Mixed"
                  ? "attention"
                  : "info"
            }
          />
          <IOSInlineStatus
            label={confidence?.confidenceLabel ?? "No evidence"}
            tone={confidence?.confidence === "early" ? "attention" : "positive"}
          />
        </div>
        <h2 className="mt-2 text-balance text-xl font-semibold tracking-tight">
          {data.benefit.summary}
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {data.focus.label} ({data.focus.stockShots} stock shots) against {data.baseline.label} (
          {data.baseline.stockShots} stock shots).
        </p>
        <p className="mt-2 text-[13px] leading-[1.15rem] text-muted-foreground">
          {confidence?.caveat ?? "Choose two sessions with recorded stock shots."}
        </p>
        <Button asChild className="mt-4 min-h-11 w-full rounded-xl">
          <Link href="/practice" prefetch={false}>
            <Target className="size-4" aria-hidden />
            Build practice plan
          </Link>
        </Button>
      </section>

      <section className="grid gap-2" aria-labelledby="mobile-comparison-scope">
        <IOSSectionHeader
          title={<span id="mobile-comparison-scope">Comparison scope</span>}
          description="The active evidence stays visible while filters live in a sheet."
        />
        <IOSGroupedList>
          <IOSListRow
            label="Focus"
            value={`${data.focus.stockShots} shots`}
            detail={data.focus.label}
          />
          <IOSListRow
            label="Baseline"
            value={`${data.baseline.stockShots} shots`}
            detail={data.baseline.label}
          />
          <IOSListRow
            label="Club"
            value={selectedClub?.label ?? "All clubs"}
            detail={
              data.filters.condition === "same"
                ? "Selected sessions"
                : data.filters.condition === "indoor-outdoor"
                  ? "Outdoor vs indoor"
                  : "Round vs practice"
            }
          />
        </IOSGroupedList>
        <MobileFilterSheet label="Change comparison" activeCount={activeFilterCount}>
          <form action="/analyse/compare" className="grid gap-4 pb-2">
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
              <Select name="clubId" defaultValue={data.filters.clubId || "all"}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clubs</SelectItem>
                  {data.clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.label} · {club.shotCount} shots
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Comparison mode
              <Select name="condition" defaultValue={data.filters.condition}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Selected sessions</SelectItem>
                  <SelectItem value="indoor-outdoor">Outdoor vs indoor</SelectItem>
                  <SelectItem value="practice-round">Round vs practice</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {params.period ? <input type="hidden" name="period" value={params.period} /> : null}
            <Button type="submit" className="min-h-11 rounded-xl">
              <GitCompareArrows className="size-4" aria-hidden />
              Compare evidence
            </Button>
          </form>
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.035em] text-muted-foreground">
              Quick experiment
            </p>
            <IOSGroupedList>
              <IOSListRow
                label="Before and after a lesson"
                detail="Select matched sessions, then save the context"
                href="/analyse/compare"
              />
              <IOSListRow
                label="This month versus last"
                detail="Uses two 30-day evidence windows"
                href="/analyse/compare?period=month"
              />
              <IOSListRow
                label="Equipment or ball change"
                detail="Keep setup notes with the result"
                href="/analyse/compare"
              />
            </IOSGroupedList>
          </div>
        </MobileFilterSheet>
      </section>

      {data.focus.stockShots < 10 || data.baseline.stockShots < 10 ? (
        <aside
          role="alert"
          className="ios-grouped-list grid gap-2 overflow-hidden px-4 py-3 text-sm"
        >
          <IOSInlineStatus label="Minimum sample warning" tone="attention" />
          <p className="leading-5 text-muted-foreground">
            Use at least 10 comparable stock shots on each side. Current samples:{" "}
            {data.focus.stockShots}
            and {data.baseline.stockShots}.
          </p>
        </aside>
      ) : null}

      <section className="grid gap-2" aria-labelledby="mobile-comparison-changes">
        <IOSSectionHeader
          title={<span id="mobile-comparison-changes">What changed</span>}
          description="Open a metric for its source, method and confidence."
          action={
            <Link
              href="/shots"
              className="inline-flex min-h-11 items-center text-[13px] font-semibold text-primary"
            >
              Raw shots
            </Link>
          }
        />
        <IOSDisclosureGroup
          label="Comparison metric evidence"
          items={provenance.map((metric) => ({
            value: metric.key,
            title: metric.label,
            summary: formatDelta(metric.value, metric.unit),
            description: `${metric.direction} · ${metric.confidenceLabel}`,
            content: (
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-medium text-foreground">Source</dt>
                  <dd className="mt-0.5 text-muted-foreground">{metric.source}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Method</dt>
                  <dd className="mt-0.5 text-muted-foreground">{metric.method}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Confidence</dt>
                  <dd className="mt-0.5 text-muted-foreground">{metric.confidenceLabel}</dd>
                </div>
              </dl>
            ),
          }))}
        />
      </section>

      <div className="grid grid-cols-2 gap-2">
        <BottomSheet
          label={
            <>
              <Save className="size-4" aria-hidden />
              Save
            </>
          }
          title="Save comparison"
          triggerClassName="w-full"
        >
          <form action={saveSessionComparisonAction} className="grid gap-4 pb-2">
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
                className="min-h-11"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <span>Experiment type</span>
              <Select name="experimentType" defaultValue="session_vs_session">
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session_vs_session">Session vs session</SelectItem>
                  <SelectItem value="lesson">Before/after lesson</SelectItem>
                  <SelectItem value="equipment_change">Equipment change</SelectItem>
                  <SelectItem value="ball_change">Golf ball</SelectItem>
                  <SelectItem value="club_setting">Club setting</SelectItem>
                  <SelectItem value="practice_round">Practice vs round</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <span>Your notes</span>
              <Textarea
                name="notes"
                rows={4}
                maxLength={4000}
                className="min-h-28"
                placeholder="What stayed constant, what changed, and what decision will this inform?"
              />
            </label>
            <Button type="submit" className="min-h-11 rounded-xl">
              <Save className="size-4" aria-hidden />
              Save comparison
            </Button>
          </form>
        </BottomSheet>
        <Button asChild variant="outline" className="min-h-11 rounded-lg">
          <Link href="/coach/reports?include=comparisons">
            <Share2 className="size-4" aria-hidden />
            Coach
          </Link>
        </Button>
      </div>

      <section className="grid gap-2" aria-labelledby="mobile-saved-comparisons">
        <IOSSectionHeader title={<span id="mobile-saved-comparisons">Saved evidence</span>} />
        <IOSDisclosureGroup
          label="Saved comparisons"
          items={[
            {
              value: "saved-comparisons",
              title: "Saved comparisons",
              summary: savedComparisons.length,
              description: "Frozen filters, notes and deterministic deltas",
              content: savedComparisons.length ? (
                <IOSGroupedList>
                  {savedComparisons.map((snapshot) => (
                    <article key={snapshot.id} className="ios-grouped-row px-4 py-3">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium">{snapshot.name}</h3>
                          <p className="mt-0.5 text-[13px] leading-[1.15rem] text-muted-foreground">
                            {String(
                              snapshot.summaryJson.summary ??
                                snapshot.summaryJson.verdict ??
                                "Saved evidence comparison",
                            )}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                              snapshot.capturedAt,
                            )}
                          </p>
                        </div>
                        <DeleteComparisonButton id={snapshot.id} name={snapshot.name} />
                      </div>
                    </article>
                  ))}
                </IOSGroupedList>
              ) : (
                <p className="text-sm leading-5 text-muted-foreground">
                  Save a useful comparison to preserve its exact filters and interpretation.
                </p>
              ),
            },
          ]}
        />
      </section>

      <IOSGroupedList>
        <IOSListRow
          label="Club and player compare"
          detail="Open the broader comparison workspace"
          href="/compare"
        />
      </IOSGroupedList>
    </div>
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
      <Select name={name} defaultValue={value || "automatic"}>
        <SelectTrigger className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="automatic">Automatic</SelectItem>
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
    sessionId: params.sessionId === "automatic" ? "" : (params.sessionId ?? ""),
    baselineSessionId:
      params.baselineSessionId === "automatic" ? "" : (params.baselineSessionId ?? ""),
    clubId: params.clubId === "all" ? "" : (params.clubId ?? ""),
    condition,
  };
}

function formatDelta(value: number | null, unit: string) {
  if (value === null) return "Not available";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} ${unit}`;
}

function comparisonMetricValue(
  key: ComparisonMetricProvenance["key"],
  sample: CompareSampleSummary,
  unit: ComparisonMetricProvenance["unit"],
) {
  const value =
    key === "carryDeltaYd"
      ? sample.carryMedianYd
      : key === "ballSpeedDeltaMph"
        ? sample.ballSpeedAverageMph
        : key === "launchDeltaDeg"
          ? sample.launchAverageDeg
          : key === "offlineDeltaYd"
            ? sample.absoluteOfflineAverageYd
            : key === "coneDeltaYd"
              ? sample.shotConeWidthYd
              : key === "playableRateDelta"
                ? sample.playableRate
                : sample.bigMissRate;
  if (value === null) return "Not available";
  return `${Math.round(value * 10) / 10} ${unit === "points" ? "%" : unit}`;
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
