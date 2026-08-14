import Link from "next/link";
import { ArrowLeft, Crosshair, Share2, Target, TriangleAlert } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { ResultHero } from "@/components/app/result-hero";
import { StatusTimeline } from "@/components/app/status-timeline";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" className="min-h-11 px-0">
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

      <div className="contents">
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

        <ResultHero
          eyebrow={data.benefit.verdict}
          title={data.benefit.summary}
          summary={`${data.focus.label} against ${data.baseline.label}. The same filters are applied to both samples.`}
          confidence={{
            label: confidence?.confidenceLabel ?? "No evidence",
            tone: confidence?.confidence === "early" ? "outline" : "secondary",
          }}
          metrics={[
            { label: "Focus sample", value: `${data.focus.stockShots} stock shots` },
            { label: "Baseline sample", value: `${data.baseline.stockShots} stock shots` },
          ]}
          action={
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">Trust note</p>
              <p className="mt-1 leading-5 text-muted-foreground">
                {confidence?.caveat ?? "Choose two sessions with recorded stock shots."}
              </p>
            </div>
          }
        />

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
          <Card className="mt-3 overflow-hidden py-0 shadow-sm">
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
          </Card>
        </section>

        {data.focus.stockShots < 10 || data.baseline.stockShots < 10 ? (
          <Alert>
            <TriangleAlert className="size-4" aria-hidden />
            <AlertTitle>Minimum sample warning</AlertTitle>
            <AlertDescription>
              Use at least 10 comparable stock shots on each side before treating the result as a
              decision. Current samples: {data.focus.stockShots} and {data.baseline.stockShots}.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card
          className="flex-row flex-wrap items-center justify-between gap-4 p-4 shadow-sm"
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
        </Card>

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
