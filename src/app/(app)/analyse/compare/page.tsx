import Link from "next/link";
import { ArrowLeft, Crosshair, Share2, Target, TriangleAlert } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import { ComparisonProvenancePanel } from "@/app/analyse/compare/comparison-provenance-panel";
import { DeleteComparisonButton } from "@/app/analyse/compare/delete-comparison-button";
import { SaveComparisonDialog } from "@/app/analyse/compare/save-comparison-dialog";
import { SessionComparisonStage } from "@/app/analyse/compare/session-comparison-stage";
import { SessionComparisonToolbar } from "@/app/analyse/compare/session-comparison-toolbar";
import { PageShell, StatusPill, type Tone } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  type CompareData,
  type CompareFilters,
  type CompareSampleSummary,
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

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
  const saveFilters = {
    focusSessionId: data.filters.sessionId,
    baselineSessionId: data.filters.baselineSessionId,
    clubId: data.filters.clubId,
    condition: data.filters.condition,
    period: params.period ?? "",
  };

  return (
    <PageShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" className="min-h-11 px-0">
          <Link href="/analyse" prefetch={false}>
            <ArrowLeft className="size-4" />
            Analyse
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/compare" prefetch={false}>
            Club and player compare
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Evidence workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Compare sessions
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Put two launch-monitor samples under the same filters and inspect the shot pattern,
            deltas and confidence.
          </p>
        </div>
      </header>

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

      <section
        className="grid gap-3 border-l-4 border-l-primary bg-card px-4 py-4 shadow-sm ring-1 ring-foreground/10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        aria-labelledby="comparison-verdict"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={comparisonVerdictTone(data, confidence?.confidence)}>
              {comparisonVerdictLabel(data, confidence?.confidence)}
            </StatusPill>
            <span className="text-xs font-medium text-muted-foreground">
              {data.focus.stockShots} focus vs {data.baseline.stockShots} baseline shots
            </span>
          </div>
          <h2
            id="comparison-verdict"
            className="mt-2 max-w-5xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl"
          >
            {comparisonVerdict(data)}
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
            {comparisonVerdictSummary(data, confidence?.caveat)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-medium text-muted-foreground">Overall confidence</p>
          <p className="mt-0.5 font-semibold">{confidence?.confidenceLabel ?? "No evidence"}</p>
        </div>
      </section>

      <SessionComparisonStage
        focus={data.focus}
        baseline={data.baseline}
        delta={data.delta}
        metrics={provenance.map((metric) => ({
          key: metric.key,
          label: metric.label,
          value: metric.value,
          unit: metric.unit,
          direction: metric.direction,
          confidence: metric.confidenceLabel,
        }))}
        confidenceLabel={confidence?.confidenceLabel ?? "No evidence"}
      />

      <section aria-labelledby="changed-metrics-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Exact comparison
            </p>
            <h2 id="changed-metrics-title" className="mt-0.5 text-2xl font-semibold">
              Metric deltas
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
        <Card className="mt-3 overflow-hidden py-0 shadow-sm">
          <div className="overflow-x-auto">
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
                      <StatusPill tone={metricTone(metric)}>{directionLabel(metric)}</StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {metric.confidenceLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </section>

      {data.focus.stockShots < 10 || data.baseline.stockShots < 10 ? (
        <Alert className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)]">
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>Early signal — collect more shots</AlertTitle>
          <AlertDescription>
            Use at least 10 comparable stock shots on each side before treating the result as a
            decision. Current samples: {data.focus.stockShots} and {data.baseline.stockShots}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border/70 py-3">
        <p className="text-sm text-muted-foreground">
          Keep this exact evidence set, share it, or turn the result into a practice job.
        </p>
        <div className="flex flex-wrap gap-2">
          <SaveComparisonDialog
            filters={saveFilters}
            defaultName={`${data.focus.label} vs ${data.baseline.label}`}
          />
          <Button asChild variant="outline">
            <Link href="/coach/reports?include=comparisons">
              <Share2 className="size-4" aria-hidden />
              Share with coach
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/practice" prefetch={false}>
              <Target className="size-4" aria-hidden />
              Build practice plan
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3" aria-labelledby="saved-comparisons-title">
        <div>
          <h2 id="saved-comparisons-title" className="text-lg font-semibold">
            Saved comparisons
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Frozen filters and interpretation notes from earlier reviews.
          </p>
        </div>
        {savedComparisons.length ? (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-card">
            {savedComparisons.map((snapshot) => (
              <li
                key={snapshot.id}
                className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate font-semibold">{snapshot.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {dateTimeFormatter.format(snapshot.capturedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {String(
                      snapshot.summaryJson.summary ??
                        snapshot.summaryJson.verdict ??
                        "Saved evidence comparison",
                    )}
                  </p>
                  {snapshot.notes ? (
                    <p className="mt-1 truncate text-xs font-medium">{snapshot.notes}</p>
                  ) : null}
                </div>
                <DeleteComparisonButton id={snapshot.id} name={snapshot.name} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
            <p className="text-sm text-muted-foreground">No saved comparison yet.</p>
            <SaveComparisonDialog
              filters={saveFilters}
              defaultName={`${data.focus.label} vs ${data.baseline.label}`}
            />
          </div>
        )}
      </section>
    </PageShell>
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

function comparisonVerdict(data: CompareData) {
  const subject =
    data.clubs.find((club) => club.id === data.filters.clubId)?.label ?? "Focus sample";
  const rightMissDelta =
    data.focus.rightMissRate !== null && data.baseline.rightMissRate !== null
      ? data.focus.rightMissRate - data.baseline.rightMissRate
      : null;
  const useful = data.benefit.verdict === "Beneficial" || data.benefit.verdict === "Useful";

  if (data.focus.stockShots === 0 || data.baseline.stockShots === 0) {
    return "Choose two samples with trusted stock shots to produce a comparison verdict.";
  }
  if (!hasMeaningfulChange(data)) {
    return `${subject} shows no useful change against the baseline.`;
  }
  if (
    useful &&
    data.baseline.primaryMiss === "Right" &&
    rightMissDelta !== null &&
    rightMissDelta <= -5
  ) {
    return `${subject} improved mainly through ${formatAbs(rightMissDelta)} points fewer right misses.`;
  }
  if (useful && data.delta.coneDeltaYd !== null && data.delta.coneDeltaYd <= -4) {
    return `${subject} improved mainly through a ${formatAbs(data.delta.coneDeltaYd)} yd tighter shot cone.`;
  }
  if (useful && data.delta.offlineDeltaYd !== null && data.delta.offlineDeltaYd <= -2) {
    return `${subject} improved mainly through ${formatAbs(data.delta.offlineDeltaYd)} yd tighter average dispersion.`;
  }
  if (useful && data.delta.playableRateDelta !== null && data.delta.playableRateDelta >= 5) {
    return `${subject} improved mainly through ${formatAbs(data.delta.playableRateDelta)} points more playable shots.`;
  }
  if (data.delta.coneDeltaYd !== null && data.delta.coneDeltaYd >= 4) {
    return `${subject} regressed mainly through a ${formatAbs(data.delta.coneDeltaYd)} yd wider shot cone.`;
  }
  if (data.delta.offlineDeltaYd !== null && data.delta.offlineDeltaYd >= 2) {
    return `${subject} regressed mainly through ${formatAbs(data.delta.offlineDeltaYd)} yd wider average dispersion.`;
  }
  if (data.delta.bigMissRateDelta !== null && data.delta.bigMissRateDelta >= 4) {
    return `${subject} regressed mainly through ${formatAbs(data.delta.bigMissRateDelta)} points more big misses.`;
  }
  return `${subject} is mixed: no single control change is strong enough to lead the verdict.`;
}

function formatDelta(value: number | null, unit: string) {
  if (value === null) return "Not available";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} ${unit === "points" ? "pts" : unit}`;
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

function directionLabel(metric: ComparisonMetricProvenance) {
  if (metric.direction === "unavailable") return "No data";
  if (metric.direction === "mixed") return "No useful change";
  if (metric.confidence === "early" || metric.confidence === "developing") return "Uncertain";
  return metric.direction === "better" ? "Improvement" : "Regression";
}

function metricTone(metric: ComparisonMetricProvenance): Tone {
  if (metric.direction === "unavailable" || metric.direction === "mixed") return "slate";
  if (metric.confidence === "early" || metric.confidence === "developing") return "amber";
  return metric.direction === "better" ? "green" : "pink";
}

function comparisonVerdictTone(
  data: CompareData,
  confidence?: ComparisonMetricProvenance["confidence"],
): Tone {
  if (!hasMeaningfulChange(data)) return "slate";
  if (confidence === "early" || confidence === "developing") return "amber";
  if (data.benefit.verdict === "Beneficial" || data.benefit.verdict === "Useful") return "green";
  if (data.benefit.verdict === "Mixed") return "amber";
  return "pink";
}

function comparisonVerdictLabel(
  data: CompareData,
  confidence?: ComparisonMetricProvenance["confidence"],
) {
  if (!hasMeaningfulChange(data)) return "No useful change";
  if (confidence === "early" || confidence === "developing") return "Uncertain";
  if (data.benefit.verdict === "Beneficial" || data.benefit.verdict === "Useful") {
    return "Improvement";
  }
  if (data.benefit.verdict === "Review") return "Regression";
  return "Mixed";
}

function comparisonVerdictSummary(data: CompareData, caveat?: string) {
  const summary = hasMeaningfulChange(data)
    ? data.benefit.summary
    : "Measured deltas stay below the useful-change thresholds.";
  return caveat ? `${summary} ${caveat}` : summary;
}

function hasMeaningfulChange(data: CompareData) {
  const delta = data.delta;
  return (
    (delta.carryDeltaYd !== null && Math.abs(delta.carryDeltaYd) >= 2) ||
    (delta.ballSpeedDeltaMph !== null && Math.abs(delta.ballSpeedDeltaMph) >= 1) ||
    (delta.offlineDeltaYd !== null && Math.abs(delta.offlineDeltaYd) >= 2) ||
    (delta.coneDeltaYd !== null && Math.abs(delta.coneDeltaYd) >= 4) ||
    (delta.playableRateDelta !== null && Math.abs(delta.playableRateDelta) >= 5) ||
    (delta.bigMissRateDelta !== null && Math.abs(delta.bigMissRateDelta) >= 4)
  );
}

function formatAbs(value: number) {
  return Math.abs(Math.round(value * 10) / 10);
}
