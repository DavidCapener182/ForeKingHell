"use client";

import { useMemo, useState } from "react";
import { GitCompareArrows, Radar } from "lucide-react";

import {
  ChartAccessibleFallback,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import {
  ComparisonWorkspace,
  type ComparisonTableRow,
  type SavedWorkspaceComparison,
} from "@/app/compare/comparison-workspace";
import { ChartFrame, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { Item, ItemContent } from "@/components/ui/item";
import type {
  ClubCompareData,
  ClubCompareSide,
  CompareDelta,
  DispersionPoint,
} from "@/lib/compare-data";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function ClubCompareClient({
  data,
  savedComparisons = [],
}: {
  data: ClubCompareData;
  savedComparisons?: SavedWorkspaceComparison[];
}) {
  const [draftClubAId, setDraftClubAId] = useState(data.filters.clubAId);
  const [draftClubBId, setDraftClubBId] = useState(data.filters.clubBId);
  const [selectedClubAId, setSelectedClubAId] = useState(data.filters.clubAId);
  const [selectedClubBId, setSelectedClubBId] = useState(data.filters.clubBId);
  const sideByClubId = useMemo(
    () => new Map(data.clubSides.map((club) => [club.clubId, club])),
    [data.clubSides],
  );
  const clubA = sideByClubId.get(selectedClubAId) ?? data.clubSides[0] ?? null;
  const clubB =
    sideByClubId.get(selectedClubBId) ??
    data.clubSides.find((club) => club.clubId !== clubA?.clubId) ??
    null;
  const delta = clubA && clubB ? buildDelta(clubA, clubB) : emptyDelta();
  const rows = clubA && clubB ? clubComparisonTableRows(clubA, clubB, delta) : [];

  function applySelection() {
    const nextClubAId = draftClubAId || data.clubs[0]?.id || "";
    const nextClubBId =
      draftClubBId && draftClubBId !== nextClubAId
        ? draftClubBId
        : (data.clubs.find((club) => club.id !== nextClubAId)?.id ?? "");

    setSelectedClubAId(nextClubAId);
    setSelectedClubBId(nextClubBId);
    setDraftClubBId(nextClubBId);
  }

  function resetSelection() {
    const fallbackAId = data.clubs[0]?.id ?? "";
    const fallbackBId = data.clubs.find((club) => club.id !== fallbackAId)?.id ?? "";

    setDraftClubAId(fallbackAId);
    setDraftClubBId(fallbackBId);
    setSelectedClubAId(fallbackAId);
    setSelectedClubBId(fallbackBId);
  }

  return (
    <ComparisonWorkspace
      view="clubs"
      focusValue={draftClubAId}
      baselineValue={draftClubBId}
      appliedFocusValue={selectedClubAId}
      appliedBaselineValue={selectedClubBId}
      onFocusValueChange={setDraftClubAId}
      onBaselineValueChange={setDraftClubBId}
      onCompare={applySelection}
      onReset={resetSelection}
      focusLabel={clubA?.label ?? "Club focus"}
      baselineLabel={clubB?.label ?? "Club baseline"}
      focusOptions={data.clubs.map((club) => ({
        value: club.id,
        label: club.label,
        description: `${integerFormatter.format(club.shotCount)} shots${club.active ? "" : " · retired"}`,
      }))}
      baselineOptions={data.clubs.map((club) => ({
        value: club.id,
        label: club.label,
        description: `${integerFormatter.format(club.shotCount)} shots${club.active ? "" : " · retired"}`,
        disabled: club.id === draftClubAId,
      }))}
      rows={rows}
      sampleReady={Boolean(clubA && clubB && clubA.stockShots >= 10 && clubB.stockShots >= 10)}
      sampleTitle={
        clubA && clubB && clubA.stockShots >= 10 && clubB.stockShots >= 10
          ? "Decision-ready club samples"
          : "Early club comparison"
      }
      sampleDescription={
        clubA && clubB
          ? `${clubA.label} has ${integerFormatter.format(clubA.stockShots)} stock shots and ${clubB.label} has ${integerFormatter.format(clubB.stockShots)}. Use at least 10 comparable stock shots on both sides before changing the bag.`
          : "Choose two clubs with tracked stock shots."
      }
      evidenceTitle="Club comparison evidence"
      evidenceDescription="Side summaries, the performance radar and measured dispersion support the single metric table."
      evidence={
        clubA && clubB ? (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              <ClubSummaryCard side="Focus" club={clubA} tone="emerald" />
              <ClubSummaryCard side="Baseline" club={clubB} tone="sky" />
            </div>
            <CompareRadarChart clubA={clubA} clubB={clubB} />
            <ClubDispersionPlot clubA={clubA} clubB={clubB} />
          </>
        ) : null
      }
      savedComparisons={savedComparisons}
      exportFileName="forekinghell-club-comparison-metrics.csv"
      empty={
        <AppEmptyState
          icon={<GitCompareArrows className="size-5" />}
          title="Choose two clubs"
          description="Imported and retired clubs are available for one side-by-side comparison."
          primaryAction={
            <Button type="button" variant="outline" onClick={resetSelection}>
              Use available clubs
            </Button>
          }
        />
      }
    />
  );
}

function clubComparisonTableRows(
  clubA: ClubCompareSide,
  clubB: ClubCompareSide,
  delta: CompareDelta,
): ComparisonTableRow[] {
  const confidence = comparisonConfidence(clubA.stockShots, clubB.stockShots);
  return compareMetricRows(clubA, clubB, delta).map((row) => {
    const rowConfidence =
      row.outcome.winner === "none" ? { label: "No data", tone: "slate" as const } : confidence;
    return {
      id: row.label,
      metric: row.label,
      focus: row.a,
      baseline: row.b,
      delta: row.diff,
      direction: directionLabel(row.outcome.winner),
      directionTone: row.outcome.tone,
      confidence: rowConfidence.label,
      confidenceTone: rowConfidence.tone,
    };
  });
}

function ClubSummaryCard({
  side,
  club,
  tone,
}: {
  side: string;
  club: ClubCompareSide;
  tone: "emerald" | "sky";
}) {
  const dotClass =
    tone === "emerald"
      ? "bg-[var(--status-success-foreground)]"
      : "bg-[var(--status-information-foreground)]";

  return (
    <Item variant="outline" className="items-start p-4">
      <ItemContent className="space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <span className={`size-2 rounded-full ${dotClass}`} />
              {side}
            </p>
            <p className="mt-2 truncate text-xl font-semibold tracking-normal">{club.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{club.dateRange}</p>
          </div>
          {!club.active ? <StatusPill tone="amber">Retired</StatusPill> : null}
        </div>

        <dl className="mt-4 grid gap-x-3 gap-y-4 sm:grid-cols-2">
          <MiniStat
            label="Usable shots"
            value={`${integerFormatter.format(club.stockShots)} / ${integerFormatter.format(club.rawShots)}`}
          />
          <MiniStat label="Sessions" value={integerFormatter.format(club.sessions)} />
          <MiniStat label="Carry" value={formatYards(club.carryMedianYd)} />
          <MiniStat label="Total" value={formatYards(club.totalMedianYd)} />
          <MiniStat label="Ball speed" value={formatMph(club.ballSpeedAverageMph)} />
          <MiniStat label="Launch" value={formatDegrees(club.launchAverageDeg)} />
          <MiniStat label="Offline avg" value={formatYards(club.absoluteOfflineAverageYd)} />
          <MiniStat label="Shot cone" value={formatYards(club.shotConeWidthYd)} />
          <MiniStat label="Playable" value={formatRate(club.playableRate)} />
          <MiniStat label="Big misses" value={formatRate(club.bigMissRate)} />
        </dl>
      </ItemContent>
    </Item>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-border pl-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-semibold">{value}</dd>
    </div>
  );
}

function compareMetricRows(clubA: ClubCompareSide, clubB: ClubCompareSide, delta: CompareDelta) {
  const totalDelta = diff(clubA.totalMedianYd, clubB.totalMedianYd);

  return [
    {
      label: "Carry",
      a: formatYards(clubA.carryMedianYd),
      b: formatYards(clubB.carryMedianYd),
      aValue: clubA.carryMedianYd,
      bValue: clubB.carryMedianYd,
      maxValue: maxMetric(clubA.carryMedianYd, clubB.carryMedianYd),
      diff: formatSignedYards(delta.carryDeltaYd),
      outcome: metricOutcome(delta.carryDeltaYd, "higher", "yd"),
    },
    {
      label: "Total",
      a: formatYards(clubA.totalMedianYd),
      b: formatYards(clubB.totalMedianYd),
      aValue: clubA.totalMedianYd,
      bValue: clubB.totalMedianYd,
      maxValue: maxMetric(clubA.totalMedianYd, clubB.totalMedianYd),
      diff: formatSignedYards(totalDelta),
      outcome: metricOutcome(totalDelta, "higher", "yd"),
    },
    {
      label: "Ball speed",
      a: formatMph(clubA.ballSpeedAverageMph),
      b: formatMph(clubB.ballSpeedAverageMph),
      aValue: clubA.ballSpeedAverageMph,
      bValue: clubB.ballSpeedAverageMph,
      maxValue: maxMetric(clubA.ballSpeedAverageMph, clubB.ballSpeedAverageMph),
      diff: formatSignedMph(delta.ballSpeedDeltaMph),
      outcome: metricOutcome(delta.ballSpeedDeltaMph, "higher", "mph"),
    },
    {
      label: "Offline avg",
      a: formatYards(clubA.absoluteOfflineAverageYd),
      b: formatYards(clubB.absoluteOfflineAverageYd),
      aValue: clubA.absoluteOfflineAverageYd,
      bValue: clubB.absoluteOfflineAverageYd,
      maxValue: maxMetric(clubA.absoluteOfflineAverageYd, clubB.absoluteOfflineAverageYd),
      diff: formatSignedYards(delta.offlineDeltaYd),
      outcome: metricOutcome(delta.offlineDeltaYd, "lower", "yd"),
    },
    {
      label: "Shot cone",
      a: formatYards(clubA.shotConeWidthYd),
      b: formatYards(clubB.shotConeWidthYd),
      aValue: clubA.shotConeWidthYd,
      bValue: clubB.shotConeWidthYd,
      maxValue: maxMetric(clubA.shotConeWidthYd, clubB.shotConeWidthYd),
      diff: formatSignedYards(delta.coneDeltaYd),
      outcome: metricOutcome(delta.coneDeltaYd, "lower", "yd"),
    },
    {
      label: "Playable",
      a: formatRate(clubA.playableRate),
      b: formatRate(clubB.playableRate),
      aValue: clubA.playableRate,
      bValue: clubB.playableRate,
      maxValue: 100,
      diff: formatSignedRate(delta.playableRateDelta),
      outcome: metricOutcome(delta.playableRateDelta, "higher", "pts"),
    },
    {
      label: "Big misses",
      a: formatRate(clubA.bigMissRate),
      b: formatRate(clubB.bigMissRate),
      aValue: clubA.bigMissRate,
      bValue: clubB.bigMissRate,
      maxValue: 100,
      diff: formatSignedRate(delta.bigMissRateDelta),
      outcome: metricOutcome(delta.bigMissRateDelta, "lower", "pts"),
    },
    {
      label: "Launch",
      a: formatDegrees(clubA.launchAverageDeg),
      b: formatDegrees(clubB.launchAverageDeg),
      aValue: clubA.launchAverageDeg,
      bValue: clubB.launchAverageDeg,
      maxValue: maxMetric(clubA.launchAverageDeg, clubB.launchAverageDeg),
      diff: formatSignedDegrees(delta.launchDeltaDeg),
      outcome: contextOutcome(),
    },
  ];
}

export function CompareRadarChart({
  clubA,
  clubB,
}: {
  clubA: ClubCompareSide;
  clubB: ClubCompareSide;
}) {
  const metrics = radarMetrics(clubA, clubB);
  const centre = 150;
  const radius = 108;
  const rings = [0.25, 0.5, 0.75, 1];
  const pointsFor = (side: "a" | "b") =>
    metrics.map((metric, index) => radarPoint(index, metrics.length, centre, radius, metric[side]));
  const polygonFor = (side: "a" | "b") =>
    pointsFor(side)
      .map((point) => `${point.x},${point.y}`)
      .join(" ");

  return (
    <div className="rounded-lg border border-border bg-card/85 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Performance radar</p>
          <p className="text-xs text-muted-foreground">
            Carry, speed, control, playable rate and launch context.
          </p>
        </div>
        <Radar className="size-5 text-[var(--status-information-foreground)]" />
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center">
        <svg
          viewBox="0 0 300 300"
          role="img"
          aria-label={`${clubA.label} and ${clubB.label} radar comparison`}
          className="mx-auto aspect-square w-full max-w-[20rem]"
        >
          <rect width="300" height="300" rx="12" fill="#ffffff" />
          {rings.map((ring) => (
            <polygon
              key={ring}
              points={metrics
                .map((_, index) => radarPoint(index, metrics.length, centre, radius * ring, 100))
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              fill="none"
              stroke="#e2e8f0"
            />
          ))}
          {metrics.map((metric, index) => {
            const outer = radarPoint(index, metrics.length, centre, radius, 100);
            const label = radarPoint(index, metrics.length, centre, radius + 24, 100);

            return (
              <g key={metric.label}>
                <line x1={centre} y1={centre} x2={outer.x} y2={outer.y} stroke="#e2e8f0" />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-600 text-[11px] font-semibold"
                >
                  {metric.label}
                </text>
              </g>
            );
          })}
          <polygon
            points={polygonFor("b")}
            fill="#0284c7"
            fillOpacity="0.16"
            stroke="#0284c7"
            strokeWidth="2"
          />
          <polygon
            points={polygonFor("a")}
            fill="#059669"
            fillOpacity="0.18"
            stroke="#059669"
            strokeWidth="2.2"
          />
          {pointsFor("b").map((point, index) => (
            <circle
              key={`b-${metrics[index].label}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="#0284c7"
            />
          ))}
          {pointsFor("a").map((point, index) => (
            <circle
              key={`a-${metrics[index].label}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#059669"
            />
          ))}
        </svg>
        <div className="grid gap-2 text-xs">
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="size-2.5 rounded-full bg-emerald-600" />
            Club A: {clubA.label}
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="size-2.5 rounded-full bg-sky-600" />
            Club B: {clubB.label}
          </span>
          <p className="leading-5 text-muted-foreground">Exact values sit in the metric rows.</p>
        </div>
      </div>
      <ChartAccessibleFallback
        title="Compare radar"
        summary={radarChartSummary(clubA, clubB)}
        columns={[
          { key: "metric", label: "Metric" },
          { key: "clubA", label: "Club A" },
          { key: "clubB", label: "Club B" },
          { key: "difference", label: "Difference" },
          { key: "better", label: "Better" },
        ]}
        rows={radarChartRows(clubA, clubB)}
        className="mt-3 bg-card/70"
      />
    </div>
  );
}

export function ClubDispersionPlot({
  clubA,
  clubB,
}: {
  clubA: ClubCompareSide;
  clubB: ClubCompareSide;
}) {
  const points = [...clubA.dispersion, ...clubB.dispersion];

  if (points.length === 0) {
    return (
      <div className="space-y-3">
        <div className="apple-panel grid aspect-[2/1] place-items-center text-sm text-muted-foreground">
          No dispersion points for these clubs.
        </div>
        <ChartAccessibleFallback
          title="Club dispersion"
          summary="No club dispersion chart points are available for the selected comparison."
          columns={[
            { key: "side", label: "Side" },
            { key: "club", label: "Club" },
            { key: "points", label: "Points" },
            { key: "carry", label: "Carry range" },
            { key: "offline", label: "Offline avg" },
          ]}
          rows={dispersionChartRows(clubA, clubB)}
          className="bg-card/70"
        />
      </div>
    );
  }

  const maxSide = Math.max(20, ...points.map((point) => Math.abs(point.sideCarryYd)));
  const carryValues = points.map((point) => point.carryYd);
  const minCarry = Math.max(0, Math.min(...carryValues) - 10);
  const maxCarry = Math.max(...carryValues) + 10;
  const plot = (point: DispersionPoint) => ({
    x: 48 + ((point.sideCarryYd + maxSide) / (maxSide * 2 || 1)) * 624,
    y: 312 - ((point.carryYd - minCarry) / (maxCarry - minCarry || 1)) * 264,
  });

  return (
    <ChartFrame className="p-3">
      <svg
        viewBox="0 0 720 360"
        role="img"
        aria-label="Club shot dispersion comparison"
        className="aspect-[2/1] w-full"
      >
        <rect x="0" y="0" width="720" height="360" rx="12" fill="#ffffff" />
        <line x1="360" x2="360" y1="36" y2="320" stroke="#94a3b8" strokeDasharray="5 5" />
        <line x1="48" x2="672" y1="312" y2="312" stroke="#cbd5e1" />
        <line x1="48" x2="48" y1="36" y2="312" stroke="#cbd5e1" />
        <text x="360" y="28" textAnchor="middle" className="fill-slate-500 text-[12px]">
          Target line
        </text>
        <text x="48" y="338" textAnchor="start" className="fill-slate-500 text-[12px]">
          Left
        </text>
        <text x="672" y="338" textAnchor="end" className="fill-slate-500 text-[12px]">
          Right
        </text>
        <text x="56" y="50" className="fill-slate-500 text-[12px]">
          Carry
        </text>
        {clubB.dispersion.map((point) => {
          const position = plot(point);
          return (
            <circle
              key={`club-b-${point.id}`}
              cx={position.x}
              cy={position.y}
              r="4"
              fill="#0284c7"
              opacity="0.58"
            />
          );
        })}
        {clubA.dispersion.map((point) => {
          const position = plot(point);
          return (
            <circle
              key={`club-a-${point.id}`}
              cx={position.x}
              cy={position.y}
              r="5"
              fill="#059669"
              opacity="0.78"
            />
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-600" /> Club A
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-600" /> Club B
        </span>
      </div>
      <ChartAccessibleFallback
        title="Club dispersion"
        summary={dispersionChartSummary(clubA, clubB)}
        columns={[
          { key: "side", label: "Side" },
          { key: "club", label: "Club" },
          { key: "points", label: "Points" },
          { key: "carry", label: "Carry range" },
          { key: "offline", label: "Offline avg" },
        ]}
        rows={dispersionChartRows(clubA, clubB)}
        className="mt-3 bg-card/70"
      />
    </ChartFrame>
  );
}

function radarChartSummary(clubA: ClubCompareSide, clubB: ClubCompareSide) {
  return `${clubA.label} vs ${clubB.label}: carry ${formatYards(clubA.carryMedianYd)} vs ${formatYards(clubB.carryMedianYd)}, playable ${formatRate(clubA.playableRate)} vs ${formatRate(clubB.playableRate)}, and offline average ${formatYards(clubA.absoluteOfflineAverageYd)} vs ${formatYards(clubB.absoluteOfflineAverageYd)}.`;
}

function radarChartRows(clubA: ClubCompareSide, clubB: ClubCompareSide): ChartFallbackRow[] {
  const delta = buildDelta(clubA, clubB);
  const radarLabels = new Set(["Carry", "Ball speed", "Offline avg", "Playable", "Launch"]);

  return compareMetricRows(clubA, clubB, delta)
    .filter((row) => radarLabels.has(row.label))
    .map((row) => ({
      _key: row.label,
      metric: row.label,
      clubA: row.a,
      clubB: row.b,
      difference: row.diff,
      better: row.outcome.label,
    }));
}

function dispersionChartSummary(clubA: ClubCompareSide, clubB: ClubCompareSide) {
  return `${clubA.label} has ${integerFormatter.format(clubA.dispersion.length)} plotted shots and ${clubB.label} has ${integerFormatter.format(clubB.dispersion.length)} plotted shots. Offline averages are ${formatYards(clubA.absoluteOfflineAverageYd)} and ${formatYards(clubB.absoluteOfflineAverageYd)}; shot cones are ${formatYards(clubA.shotConeWidthYd)} and ${formatYards(clubB.shotConeWidthYd)}.`;
}

function dispersionChartRows(clubA: ClubCompareSide, clubB: ClubCompareSide): ChartFallbackRow[] {
  return [dispersionChartRow("Club A", clubA), dispersionChartRow("Club B", clubB)];
}

function dispersionChartRow(side: string, club: ClubCompareSide): ChartFallbackRow {
  return {
    _key: side,
    side,
    club: club.label,
    points: integerFormatter.format(club.dispersion.length),
    carry: dispersionCarryRange(club.dispersion),
    offline: formatYards(club.absoluteOfflineAverageYd),
  };
}

function dispersionCarryRange(points: DispersionPoint[]) {
  if (points.length === 0) {
    return "--";
  }

  const carryValues = points.map((point) => point.carryYd);
  return `${formatYards(Math.min(...carryValues))} to ${formatYards(Math.max(...carryValues))}`;
}

function radarMetrics(clubA: ClubCompareSide, clubB: ClubCompareSide) {
  const carryMax = maxMetric(clubA.carryMedianYd, clubB.carryMedianYd);
  const speedMax = maxMetric(clubA.ballSpeedAverageMph, clubB.ballSpeedAverageMph);
  const offlineMax = maxMetric(clubA.absoluteOfflineAverageYd, clubB.absoluteOfflineAverageYd);
  const launchMax = maxMetric(clubA.launchAverageDeg, clubB.launchAverageDeg);

  return [
    {
      label: "Carry",
      a: normalizeHigher(clubA.carryMedianYd, carryMax),
      b: normalizeHigher(clubB.carryMedianYd, carryMax),
    },
    {
      label: "Ball speed",
      a: normalizeHigher(clubA.ballSpeedAverageMph, speedMax),
      b: normalizeHigher(clubB.ballSpeedAverageMph, speedMax),
    },
    {
      label: "Offline",
      a: normalizeLower(clubA.absoluteOfflineAverageYd, offlineMax),
      b: normalizeLower(clubB.absoluteOfflineAverageYd, offlineMax),
    },
    {
      label: "Playable",
      a: normalizeHigher(clubA.playableRate, 100),
      b: normalizeHigher(clubB.playableRate, 100),
    },
    {
      label: "Launch",
      a: normalizeHigher(clubA.launchAverageDeg, launchMax),
      b: normalizeHigher(clubB.launchAverageDeg, launchMax),
    },
  ];
}

function radarPoint(index: number, total: number, centre: number, radius: number, value: number) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  const scaledRadius = radius * (value / 100);

  return {
    x: centre + Math.cos(angle) * scaledRadius,
    y: centre + Math.sin(angle) * scaledRadius,
  };
}

function normalizeHigher(value: number | null, maxValue: number) {
  if (value === null || maxValue <= 0) {
    return 0;
  }

  return clamp((value / maxValue) * 100, 0, 100);
}

function normalizeLower(value: number | null, maxValue: number) {
  if (value === null) {
    return 0;
  }

  if (maxValue <= 0) {
    return 100;
  }

  return clamp(100 - (value / maxValue) * 100, 0, 100);
}

function maxMetric(left: number | null, right: number | null) {
  return Math.max(1, left ?? 0, right ?? 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildDelta(focus: ClubCompareSide, baseline: ClubCompareSide): CompareDelta {
  return {
    carryDeltaYd: diff(focus.carryMedianYd, baseline.carryMedianYd),
    ballSpeedDeltaMph: diff(focus.ballSpeedAverageMph, baseline.ballSpeedAverageMph),
    launchDeltaDeg: diff(focus.launchAverageDeg, baseline.launchAverageDeg),
    offlineDeltaYd: diff(focus.absoluteOfflineAverageYd, baseline.absoluteOfflineAverageYd),
    coneDeltaYd: diff(focus.shotConeWidthYd, baseline.shotConeWidthYd),
    playableRateDelta: diff(focus.playableRate, baseline.playableRate),
    bigMissRateDelta: diff(focus.bigMissRate, baseline.bigMissRate),
  };
}

function emptyDelta(): CompareDelta {
  return {
    carryDeltaYd: null,
    ballSpeedDeltaMph: null,
    launchDeltaDeg: null,
    offlineDeltaYd: null,
    coneDeltaYd: null,
    playableRateDelta: null,
    bigMissRateDelta: null,
  };
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

type MetricWinner = "a" | "b" | "tie" | "context" | "none";

function metricOutcome(
  value: number | null,
  direction: "higher" | "lower",
  unit: "yd" | "mph" | "pts",
): {
  winner: MetricWinner;
  label: string;
  detail: string;
  tone: "green" | "sky" | "slate" | "amber";
} {
  if (value === null) {
    return { winner: "none", label: "No data", detail: "--", tone: "slate" };
  }

  const rounded = Math.round(value * 10) / 10;

  if (rounded === 0) {
    return { winner: "tie", label: "Tie", detail: "No gap", tone: "slate" };
  }

  const clubAWins = direction === "higher" ? rounded > 0 : rounded < 0;

  return {
    winner: clubAWins ? "a" : "b",
    label: clubAWins ? "Club A" : "Club B",
    detail: `by ${formatAbsoluteDelta(rounded, unit)}`,
    tone: clubAWins ? "green" : "sky",
  };
}

function contextOutcome() {
  return {
    winner: "context" as const,
    label: "Context",
    detail: "Fit dependent",
    tone: "amber" as const,
  };
}

function formatAbsoluteDelta(value: number, unit: "yd" | "mph" | "pts") {
  return `${numberFormatter.format(Math.abs(value))} ${unit}`;
}

function directionLabel(winner: MetricWinner) {
  if (winner === "a") return "Focus";
  if (winner === "b") return "Baseline";
  if (winner === "tie") return "Even";
  if (winner === "context") return "Context";
  return "No data";
}

function comparisonConfidence(focusShots: number, baselineShots: number) {
  const smallestSample = Math.min(focusShots, baselineShots);
  if (smallestSample >= 10) return { label: "Decision-ready", tone: "green" as const };
  if (smallestSample >= 3) return { label: "Early", tone: "amber" as const };
  return { label: "Low sample", tone: "slate" as const };
}

function diff(left: number | null, right: number | null) {
  return typeof left === "number" && typeof right === "number"
    ? Math.round((left - right) * 10) / 10
    : null;
}
