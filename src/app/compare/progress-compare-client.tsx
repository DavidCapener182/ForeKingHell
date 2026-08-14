"use client";

import { useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

import {
  ComparisonWorkspace,
  type ComparisonTableRow,
  type SavedWorkspaceComparison,
} from "@/app/compare/comparison-workspace";
import {
  ChartAccessibleFallback,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusPill, type Tone } from "@/components/premium";
import { Item, ItemContent } from "@/components/ui/item";
import type {
  CompareClubRow,
  CompareDelta,
  CompareSampleSummary,
  ProgressCompareData,
  ProgressComparison,
  ProgressPeriod,
} from "@/lib/compare-data";

type ProgressWindow = "week" | "month";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function ProgressCompareClient({
  data,
  savedComparisons = [],
}: {
  data: ProgressCompareData;
  savedComparisons?: SavedWorkspaceComparison[];
}) {
  const [draftFocus, setDraftFocus] = useState("last-7");
  const [draftBaseline, setDraftBaseline] = useState("previous-7");
  const [appliedWindow, setAppliedWindow] = useState<ProgressWindow>("week");
  const comparison = appliedWindow === "week" ? data.previousWeek : data.previousMonth;
  const periods = appliedWindow === "week" ? data.weeklyPeriods : data.monthlyPeriods;
  const rows = data.latestSession ? progressComparisonRows(comparison) : [];
  const appliedFocus = appliedWindow === "week" ? "last-7" : "last-30";
  const appliedBaseline = appliedWindow === "week" ? "previous-7" : "previous-30";

  function selectFocus(value: string) {
    const month = value === "last-30";
    setDraftFocus(month ? "last-30" : "last-7");
    setDraftBaseline(month ? "previous-30" : "previous-7");
  }

  function selectBaseline(value: string) {
    const month = value === "previous-30";
    setDraftFocus(month ? "last-30" : "last-7");
    setDraftBaseline(month ? "previous-30" : "previous-7");
  }

  function applySelection() {
    const month = draftFocus === "last-30" || draftBaseline === "previous-30";
    setAppliedWindow(month ? "month" : "week");
    setDraftFocus(month ? "last-30" : "last-7");
    setDraftBaseline(month ? "previous-30" : "previous-7");
  }

  function resetSelection() {
    setDraftFocus("last-7");
    setDraftBaseline("previous-7");
    setAppliedWindow("week");
  }

  return (
    <ComparisonWorkspace
      view="progress"
      focusValue={draftFocus}
      baselineValue={draftBaseline}
      appliedFocusValue={appliedFocus}
      appliedBaselineValue={appliedBaseline}
      onFocusValueChange={selectFocus}
      onBaselineValueChange={selectBaseline}
      onCompare={applySelection}
      onReset={resetSelection}
      focusLabel={comparison.focus.label}
      baselineLabel={comparison.label}
      focusOptions={[
        {
          value: "last-7",
          label: "Last 7 days",
          description: `${integerFormatter.format(data.previousWeek.focus.stockShots)} stock shots`,
        },
        {
          value: "last-30",
          label: "Last 30 days",
          description: `${integerFormatter.format(data.previousMonth.focus.stockShots)} stock shots`,
        },
      ]}
      baselineOptions={[
        {
          value: "previous-7",
          label: "Previous 7 days",
          description: `${integerFormatter.format(data.previousWeek.baseline.stockShots)} stock shots`,
        },
        {
          value: "previous-30",
          label: "Previous 30 days",
          description: `${integerFormatter.format(data.previousMonth.baseline.stockShots)} stock shots`,
        },
      ]}
      rows={rows}
      sampleReady={comparison.focus.stockShots >= 10 && comparison.baseline.stockShots >= 10}
      sampleTitle={
        comparison.focus.stockShots >= 10 && comparison.baseline.stockShots >= 10
          ? "Decision-ready period samples"
          : "Early period comparison"
      }
      sampleDescription={`${comparison.benefit.summary} Current samples: ${integerFormatter.format(comparison.focus.stockShots)} and ${integerFormatter.format(comparison.baseline.stockShots)} stock shots.`}
      evidenceTitle="Progress comparison evidence"
      evidenceDescription="Sample context, club movement and period history support the single metric table."
      evidence={
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <ProgressSampleItem label="Focus" sample={comparison.focus} tone="green" />
            <ProgressSampleItem label="Baseline" sample={comparison.baseline} tone="sky" />
          </div>
          <FocusClubEvidence rows={comparison.clubRows} />
          <PeriodTrendStrip periods={periods} />
          <PeriodHistory periods={periods} />
        </>
      }
      savedComparisons={savedComparisons}
      exportFileName={`forekinghell-compare-${appliedWindow}-history.csv`}
      empty={
        <AppEmptyState
          icon={<TrendingUp className="size-5" />}
          title="No comparison evidence yet"
          description="Import a tracked practice session to compare progress over time."
          primaryAction={null}
        />
      }
    />
  );
}

function progressComparisonRows(comparison: ProgressComparison): ComparisonTableRow[] {
  const confidence = comparisonConfidence(
    comparison.focus.stockShots,
    comparison.baseline.stockShots,
  );
  const metrics = [
    metricRow(
      "Carry",
      comparison.focus.carryMedianYd,
      comparison.baseline.carryMedianYd,
      comparison.delta.carryDeltaYd,
      "higher",
      formatYards,
      formatSignedYards,
    ),
    metricRow(
      "Ball speed",
      comparison.focus.ballSpeedAverageMph,
      comparison.baseline.ballSpeedAverageMph,
      comparison.delta.ballSpeedDeltaMph,
      "higher",
      formatMph,
      formatSignedMph,
    ),
    metricRow(
      "Launch",
      comparison.focus.launchAverageDeg,
      comparison.baseline.launchAverageDeg,
      comparison.delta.launchDeltaDeg,
      "context",
      formatDegrees,
      formatSignedDegrees,
    ),
    metricRow(
      "Offline average",
      comparison.focus.absoluteOfflineAverageYd,
      comparison.baseline.absoluteOfflineAverageYd,
      comparison.delta.offlineDeltaYd,
      "lower",
      formatYards,
      formatSignedYards,
    ),
    metricRow(
      "Shot cone",
      comparison.focus.shotConeWidthYd,
      comparison.baseline.shotConeWidthYd,
      comparison.delta.coneDeltaYd,
      "lower",
      formatYards,
      formatSignedYards,
    ),
    metricRow(
      "Playable",
      comparison.focus.playableRate,
      comparison.baseline.playableRate,
      comparison.delta.playableRateDelta,
      "higher",
      formatRate,
      formatSignedRate,
    ),
    metricRow(
      "Big misses",
      comparison.focus.bigMissRate,
      comparison.baseline.bigMissRate,
      comparison.delta.bigMissRateDelta,
      "lower",
      formatRate,
      formatSignedRate,
    ),
  ];

  return metrics.map((metric) => {
    const rowConfidence =
      metric.direction === "No data" ? { label: "No data", tone: "slate" as const } : confidence;
    return {
      ...metric,
      confidence: rowConfidence.label,
      confidenceTone: rowConfidence.tone,
    };
  });
}

function metricRow(
  metric: string,
  focus: number | null,
  baseline: number | null,
  delta: number | null,
  direction: "higher" | "lower" | "context",
  formatValue: (value: number | null) => string,
  formatDelta: (value: number | null) => string,
): Omit<ComparisonTableRow, "confidence" | "confidenceTone"> {
  const movement = metricDirection(delta, direction);
  return {
    id: metric,
    metric,
    focus: formatValue(focus),
    baseline: formatValue(baseline),
    delta: formatDelta(delta),
    direction: movement.label,
    directionTone: movement.tone,
  };
}

function ProgressSampleItem({
  label,
  sample,
  tone,
}: {
  label: string;
  sample: CompareSampleSummary;
  tone: Tone;
}) {
  return (
    <Item variant="outline" className="items-start p-4">
      <ItemContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-semibold">{sample.label}</p>
          </div>
          <StatusPill tone={tone}>{integerFormatter.format(sample.stockShots)} shots</StatusPill>
        </div>
        <p className="text-sm leading-5 text-muted-foreground">{sample.detail}</p>
        <dl className="grid grid-cols-3 gap-3 border-t pt-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Carry</dt>
            <dd className="mt-1 font-semibold">{formatYards(sample.carryMedianYd)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Playable</dt>
            <dd className="mt-1 font-semibold">{formatRate(sample.playableRate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Shot cone</dt>
            <dd className="mt-1 font-semibold">{formatYards(sample.shotConeWidthYd)}</dd>
          </div>
        </dl>
      </ItemContent>
    </Item>
  );
}

function FocusClubEvidence({ rows }: { rows: CompareClubRow[] }) {
  return (
    <section className="grid gap-3" aria-labelledby="progress-club-evidence-title">
      <div>
        <h3 id="progress-club-evidence-title" className="font-semibold">
          Club movement
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Each club keeps its carry, control and sample evidence without creating another table.
        </p>
      </div>
      {rows.length ? (
        <div className="divide-y divide-border rounded-xl border">
          {rows.map((row) => (
            <div
              key={row.clubId}
              className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(8rem,0.8fr)_repeat(4,minmax(7rem,1fr))] lg:items-center"
            >
              <div>
                <p className="font-semibold">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {integerFormatter.format(row.focus.stockShots)} vs{" "}
                  {integerFormatter.format(row.baseline.stockShots)} shots
                </p>
              </div>
              <EvidenceDelta label="Carry" value={formatSignedYards(row.delta.carryDeltaYd)} />
              <EvidenceDelta
                label="Playable"
                value={formatSignedRate(row.delta.playableRateDelta)}
              />
              <EvidenceDelta label="Cone" value={formatSignedYards(row.delta.coneDeltaYd)} />
              <StatusPill tone={scoreTone(row)}>{scoreLabel(row)}</StatusPill>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No focus-club rows are available for this period.
        </p>
      )}
    </section>
  );
}

function EvidenceDelta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PeriodTrendStrip({ periods }: { periods: ProgressPeriod[] }) {
  const chronological = [...periods].reverse();
  const maxShots = Math.max(1, ...chronological.map((period) => period.summary.stockShots));

  return (
    <section className="min-w-0 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Trend shape</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Playable rate, sample size, carry and shot cone by period.
          </p>
        </div>
        <BarChart3 className="size-5 text-[var(--status-information-foreground)]" aria-hidden />
      </div>
      <div className="mt-4 grid gap-3">
        {chronological.map((period) => {
          const playable = period.summary.playableRate ?? 0;
          const shotWidth = Math.max(8, (period.summary.stockShots / maxShots) * 100);
          return (
            <div key={period.key} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{period.label}</span>
                <span className="text-muted-foreground">
                  {formatYards(period.summary.carryMedianYd)} ·{" "}
                  {formatYards(period.summary.shotConeWidthYd)} cone
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2">
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--status-success-foreground)]"
                    style={{ width: `${Math.max(5, Math.min(100, playable))}%` }}
                  />
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--status-information-foreground)]"
                    style={{ width: `${Math.min(100, shotWidth)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ChartAccessibleFallback
        title="Compare period trend"
        summary={periodTrendChartSummary(chronological)}
        columns={[
          { key: "period", label: "Period" },
          { key: "shots", label: "Shots" },
          { key: "carry", label: "Carry" },
          { key: "playable", label: "Playable" },
          { key: "cone", label: "Shot cone" },
        ]}
        rows={periodTrendChartRows(chronological)}
        className="mt-4 bg-card/70"
      />
    </section>
  );
}

function PeriodHistory({ periods }: { periods: ProgressPeriod[] }) {
  return (
    <section className="grid gap-3" aria-labelledby="progress-period-history-title">
      <div>
        <h3 id="progress-period-history-title" className="font-semibold">
          Period history
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Samples and movement against the previous period.
        </p>
      </div>
      <div className="divide-y divide-border rounded-xl border">
        {periods.length ? (
          periods.map((period) => (
            <div
              key={period.key}
              className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(9rem,1fr)_repeat(5,minmax(6.5rem,auto))] lg:items-center"
            >
              <div>
                <p className="font-semibold">{period.label}</p>
                <p className="text-xs text-muted-foreground">{period.detail}</p>
              </div>
              <EvidenceDelta
                label="Shots"
                value={integerFormatter.format(period.summary.stockShots)}
              />
              <EvidenceDelta label="Carry" value={formatYards(period.summary.carryMedianYd)} />
              <EvidenceDelta label="Playable" value={formatRate(period.summary.playableRate)} />
              <EvidenceDelta label="Cone" value={formatYards(period.summary.shotConeWidthYd)} />
              <StatusPill tone={periodBenefitTone(period.benefit.verdict)}>
                {period.benefit.verdict}
              </StatusPill>
            </div>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No period history yet.</p>
        )}
      </div>
    </section>
  );
}

function periodTrendChartSummary(periods: ProgressPeriod[]) {
  const latest = periods.at(-1);
  if (!latest) return "No compare period trend rows are available yet.";
  return `Latest shown period is ${latest.label}: ${integerFormatter.format(latest.summary.stockShots)} stock shots, ${formatYards(latest.summary.carryMedianYd)} carry, ${formatRate(latest.summary.playableRate)} playable and ${formatYards(latest.summary.shotConeWidthYd)} shot cone.`;
}

function periodTrendChartRows(periods: ProgressPeriod[]): ChartFallbackRow[] {
  return periods.map((period) => ({
    _key: period.key,
    period: period.label,
    shots: integerFormatter.format(period.summary.stockShots),
    carry: formatYards(period.summary.carryMedianYd),
    playable: formatRate(period.summary.playableRate),
    cone: formatYards(period.summary.shotConeWidthYd),
  }));
}

function metricDirection(value: number | null, direction: "higher" | "lower" | "context") {
  if (value === null) return { label: "No data", tone: "slate" as const };
  if (direction === "context") return { label: "Context", tone: "amber" as const };
  if (Math.round(value * 10) / 10 === 0) return { label: "Even", tone: "slate" as const };
  const focusWins = direction === "higher" ? value > 0 : value < 0;
  return focusWins
    ? { label: "Focus", tone: "green" as const }
    : { label: "Baseline", tone: "sky" as const };
}

function comparisonConfidence(focusShots: number, baselineShots: number) {
  const smallestSample = Math.min(focusShots, baselineShots);
  if (smallestSample >= 10) return { label: "Decision-ready", tone: "green" as const };
  if (smallestSample >= 3) return { label: "Early", tone: "amber" as const };
  return { label: "Low sample", tone: "slate" as const };
}

function scoreTone(row: CompareClubRow): Tone {
  if (hasLowSample(row)) return "slate";
  if (hasStrongImprovement(row.delta)) return "green";
  const controlScore = controlDeltaScore(row.delta);
  if (controlScore >= 1) return "green";
  if (controlScore <= -2) return "amber";
  if (row.benefitScore >= 60) return "green";
  if (row.benefitScore >= 45) return "amber";
  return "slate";
}

function scoreLabel(row: CompareClubRow) {
  if (hasLowSample(row)) return "Low sample";
  if (hasStrongImprovement(row.delta)) return "Strong improvement";
  const controlScore = controlDeltaScore(row.delta);
  if (controlScore >= 2) return "More consistent";
  if (controlScore >= 1) return "More playable";
  if (controlScore <= -2) return "Less controlled";
  if (row.benefitScore >= 60) return "Improved";
  if (row.benefitScore >= 45) return "Mixed";
  return "Needs work";
}

function controlDeltaScore(delta: CompareDelta) {
  let score = 0;
  if (isNumber(delta.playableRateDelta)) {
    if (delta.playableRateDelta >= 5) score += 1;
    else if (delta.playableRateDelta <= -5) score -= 1;
  }
  if (isNumber(delta.bigMissRateDelta)) {
    if (delta.bigMissRateDelta <= -4) score += 1;
    else if (delta.bigMissRateDelta >= 4) score -= 1;
  }
  if (isNumber(delta.coneDeltaYd)) {
    if (delta.coneDeltaYd <= -4) score += 1;
    else if (delta.coneDeltaYd >= 4) score -= 1;
  }
  if (isNumber(delta.offlineDeltaYd)) {
    if (delta.offlineDeltaYd <= -2) score += 1;
    else if (delta.offlineDeltaYd >= 2) score -= 1;
  }
  return score;
}

function hasLowSample(row: CompareClubRow) {
  return row.focus.stockShots < 3 || row.baseline.stockShots < 3;
}

function hasStrongImprovement(delta: CompareDelta) {
  const carryGain = isNumber(delta.carryDeltaYd) && delta.carryDeltaYd >= 8;
  const usefulCarryGain = isNumber(delta.carryDeltaYd) && delta.carryDeltaYd >= 3;
  const coneTighter = isNumber(delta.coneDeltaYd) && delta.coneDeltaYd <= -6;
  const usefulConeTighter = isNumber(delta.coneDeltaYd) && delta.coneDeltaYd <= -3;
  const playableGain = isNumber(delta.playableRateDelta) && delta.playableRateDelta >= 5;
  const bigMissDrop = isNumber(delta.bigMissRateDelta) && delta.bigMissRateDelta <= -8;
  const severePlayableDrop = isNumber(delta.playableRateDelta) && delta.playableRateDelta <= -10;
  const severeConeWidening = isNumber(delta.coneDeltaYd) && delta.coneDeltaYd >= 10;

  if ((carryGain && coneTighter) || (usefulCarryGain && coneTighter && playableGain)) {
    return !severePlayableDrop && !severeConeWidening;
  }
  const weightedSignals = [
    playableGain,
    bigMissDrop,
    usefulConeTighter,
    usefulCarryGain && (playableGain || bigMissDrop || usefulConeTighter),
  ].filter(Boolean).length;
  return weightedSignals >= 3 && !severePlayableDrop && !severeConeWidening;
}

function periodBenefitTone(verdict: string): Tone {
  if (verdict === "Beneficial") return "green";
  if (verdict === "Useful") return "sky";
  if (verdict === "Mixed") return "amber";
  return "slate";
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatMph(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}

function formatDegrees(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} deg`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}%`;
}

function formatSignedYards(value: number | null) {
  return value === null ? "--" : `${signed(value)} yd`;
}

function formatSignedMph(value: number | null) {
  return value === null ? "--" : `${signed(value)} mph`;
}

function formatSignedDegrees(value: number | null) {
  return value === null ? "--" : `${signed(value)} deg`;
}

function formatSignedRate(value: number | null) {
  return value === null ? "--" : `${signed(value)} pts`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
