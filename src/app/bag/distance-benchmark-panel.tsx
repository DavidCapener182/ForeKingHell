"use client";

import Link from "next/link";
import { BarChart3, Users } from "lucide-react";

import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  MobileAccordionSection,
  MobileDataCard,
  MobileDataList,
  SectionHeader,
} from "@/components/premium";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  benchmarkDisplayProgressPercent,
  getClubBenchmarkMetricLevels,
  getClubBenchmarkTourReference,
  type ClubBenchmarkMetricKey,
  type ClubBenchmarkPeerComparison,
  type ClubBenchmarkPeerSummary,
  type ClubBenchmarkRow,
  type InferredClubBenchmarkMetricLevel,
} from "@/lib/club-benchmarks";
import { formatClubType } from "@/lib/club-format";

type MetricComparisonMode = "higher" | "closest";

type MetricDefinition = {
  key: ClubBenchmarkMetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  precision: number;
  description: string;
  comparisonMode: MetricComparisonMode;
};

type MetricLevelComparison = {
  row: ClubBenchmarkRow;
  levels: InferredClubBenchmarkMetricLevel[];
  actual: number | null;
  levelLabel: string;
  levelKey: ClubBenchmarkRow["comparison"]["levelKey"];
  levelIndex: number | null;
  nextLevel: InferredClubBenchmarkMetricLevel | null;
  gapToNext: number | null;
  progressPercent: number;
  tourAnchorLabel: string;
};

type PeerComparisonDisplayRow = {
  row: ClubBenchmarkRow;
  metric: MetricDefinition;
  actual: number | null;
  peer: ClubBenchmarkPeerComparison | null;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const METRICS: MetricDefinition[] = [
  {
    key: "carryYd",
    label: "Best stock carry",
    shortLabel: "Best stock",
    unit: "yd",
    precision: 1,
    description: "Best-stock carry against broad club-distance reference levels.",
    comparisonMode: "higher",
  },
  {
    key: "clubSpeedMph",
    label: "Club speed",
    shortLabel: "Club speed",
    unit: "mph",
    precision: 1,
    description: "Average speed from your best-20 stock shots against estimated ability levels.",
    comparisonMode: "higher",
  },
  {
    key: "ballSpeedMph",
    label: "Ball speed",
    shortLabel: "Ball speed",
    unit: "mph",
    precision: 1,
    description: "Ball speed from the same stock-shot set against estimated ability levels.",
    comparisonMode: "higher",
  },
  {
    key: "smashFactor",
    label: "Smash factor",
    shortLabel: "Smash",
    unit: "",
    precision: 2,
    description: "Strike efficiency estimated from the tour smash-factor anchor.",
    comparisonMode: "higher",
  },
  {
    key: "maxHeightYd",
    label: "Max height",
    shortLabel: "Height",
    unit: "yd",
    precision: 1,
    description: "Peak height converted from imported apex feet into yards for TrackMan parity.",
    comparisonMode: "higher",
  },
  {
    key: "landAngleDeg",
    label: "Land angle",
    shortLabel: "Land",
    unit: "deg",
    precision: 1,
    description: "Descent angle estimated from the tour landing-angle anchor.",
    comparisonMode: "higher",
  },
];

const COMPARISON_METRICS = METRICS.filter((metric) => metric.key !== "carryYd");
const PEER_TAB_VALUE = "peers";
const BENCHMARK_TABLE_CLASS = "min-w-[1280px] table-fixed";
const BENCHMARK_TABLE_COLUMN_WIDTHS = ["6%", "15%", "9%", "9%", "14%", "30%", "11%", "6%"];
const PEER_METRIC_KEYS: ClubBenchmarkMetricKey[] = [
  "carryYd",
  "clubSpeedMph",
  "ballSpeedMph",
  "smashFactor",
  "maxHeightYd",
  "landAngleDeg",
];
const METRIC_BY_KEY = new Map(METRICS.map((metric) => [metric.key, metric]));
const CARRY_METRIC = metricByKey("carryYd");
const FLIGHT_METRIC_KEYS = new Set<ClubBenchmarkMetricKey>(["maxHeightYd", "landAngleDeg"]);

const benchmarkCarryColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "model", label: "Model" },
  { id: "your-carry", label: "Your carry" },
  { id: "level", label: "Level" },
  { id: "next", label: "Next" },
  { id: "benchmark-band", label: "Benchmark band" },
  { id: "tour-anchor", label: "Tour anchor" },
  { id: "sample", label: "Sample" },
];

const benchmarkMetricColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "model", label: "Model" },
  { id: "current-value", label: "Current value" },
  { id: "metric-level", label: "Level" },
  { id: "metric-target", label: "Target" },
  { id: "metric-band", label: "Benchmark band" },
  { id: "tour-anchor", label: "Tour anchor" },
  { id: "sample", label: "Sample" },
];

const benchmarkPeerColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "metric", label: "Metric" },
  { id: "you", label: "You" },
  { id: "peer-median", label: "Peer median" },
  { id: "top-quartile", label: "Top 25%" },
  { id: "percentile", label: "Percentile" },
  { id: "peer-sample", label: "Peer sample" },
];

const benchmarkSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Full bag gapping",
    href: "/bag#bag-gapping-table",
    detail: "Compare benchmark context with playable stock distances.",
  },
  {
    title: "PB evidence",
    href: "/bag/longest#longest-shot-pb-table",
    detail: "Audit the longest-shot records behind the bag ceiling.",
  },
  {
    title: "Shot explorer",
    href: "/shots",
    detail: "Filter and export the launch-monitor rows that feed these benchmarks.",
  },
];

export function DistanceBenchmarkPanel({
  rows,
  peerSummary,
  peerBenchmarksLoaded,
}: {
  rows: ClubBenchmarkRow[];
  peerSummary: ClubBenchmarkPeerSummary;
  peerBenchmarksLoaded: boolean;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Distance benchmarks"
        description="Carry, speed and flight benchmarks, with peer context when visibility allows."
        action={<BarChart3 className="size-5 text-emerald-500" aria-hidden="true" />}
      />
      <CardContent className="space-y-4">
        <BenchmarkOverview
          rows={rows}
          peerSummary={peerSummary}
          peerBenchmarksLoaded={peerBenchmarksLoaded}
        />
        <Tabs defaultValue="carryYd" className="gap-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="h-auto w-max justify-start rounded-lg border bg-white p-1 shadow-sm">
              {METRICS.map((metric) => (
                <TabsTrigger
                  key={metric.key}
                  value={metric.key}
                  className="min-h-8 px-2 text-xs data-active:bg-[#0B7A3B] data-active:text-white data-active:shadow-sm sm:px-3 sm:text-sm"
                >
                  {metric.shortLabel}
                </TabsTrigger>
              ))}
              <TabsTrigger
                value={PEER_TAB_VALUE}
                className="min-h-8 px-2 text-xs data-active:bg-[#0B7A3B] data-active:text-white data-active:shadow-sm sm:px-3 sm:text-sm"
              >
                Peers
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="carryYd" className="space-y-4">
            <CarryBenchmarkContent rows={rows} />
          </TabsContent>

          {COMPARISON_METRICS.map((metric) => (
            <TabsContent key={metric.key} value={metric.key} className="space-y-4">
              <LevelMetricContent rows={rows} metric={metric} />
            </TabsContent>
          ))}

          <TabsContent value={PEER_TAB_VALUE} className="space-y-4">
            <PeerComparisonContent
              rows={rows}
              peerSummary={peerSummary}
              peerBenchmarksLoaded={peerBenchmarksLoaded}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </DataPanel>
  );
}

function BenchmarkOverview({
  rows,
  peerSummary,
  peerBenchmarksLoaded,
}: {
  rows: ClubBenchmarkRow[];
  peerSummary: ClubBenchmarkPeerSummary;
  peerBenchmarksLoaded: boolean;
}) {
  const rowsWithData = rows.filter((row) => row.comparison.levelIndex !== null);
  const strongestCarry =
    [...rowsWithData].sort(
      (left, right) =>
        (right.comparison.levelIndex ?? -1) - (left.comparison.levelIndex ?? -1) ||
        right.comparison.progressPercent - left.comparison.progressPercent,
    )[0] ?? null;
  const closestCarry =
    [...rows]
      .filter(
        (
          row,
        ): row is ClubBenchmarkRow & {
          comparison: ClubBenchmarkRow["comparison"] & { yardsToNextLevel: number };
        } => row.comparison.yardsToNextLevel !== null,
      )
      .sort(
        (left, right) => left.comparison.yardsToNextLevel - right.comparison.yardsToNextLevel,
      )[0] ?? null;
  const strongestFlight = strongestMetricBenchmark(rows, FLIGHT_METRIC_KEYS);
  const peerChase = closestTopQuartilePeerRow(buildPeerDisplayRows(rows, peerSummary));

  return (
    <CompactReadoutGrid
      columnsClassName="md:grid-cols-2 xl:grid-cols-4"
      items={[
        {
          label: "Benchmark lead",
          value: strongestCarry ? formatClubType(strongestCarry.clubType) : "--",
          detail: strongestCarry
            ? `${strongestCarry.comparison.levelLabel} carry benchmark`
            : "Need stock carry samples",
          tone: benchmarkTone(strongestCarry?.comparison.levelKey ?? "no-data"),
          href: strongestCarry ? `/bag/${strongestCarry.clubId}` : undefined,
        },
        {
          label: "Carry step",
          value: closestCarry ? formatClubType(closestCarry.clubType) : "--",
          detail: closestCarry
            ? `${formatMetric(closestCarry.comparison.yardsToNextLevel)} yd to ${closestCarry.comparison.nextLevel?.label}`
            : "No carry chase yet",
          tone: closestCarry ? "amber" : "slate",
          href: closestCarry ? `/bag/${closestCarry.clubId}` : undefined,
        },
        {
          label: "Flight benchmark",
          value: strongestFlight
            ? `${formatClubType(strongestFlight.comparison.row.clubType)} · ${
                strongestFlight.metric.shortLabel
              }`
            : "--",
          detail: strongestFlight
            ? `${strongestFlight.comparison.levelLabel} at ${formatMetricValue(
                strongestFlight.comparison.actual,
                strongestFlight.metric,
              )}`
            : "Need flight data",
          tone: benchmarkTone(strongestFlight?.comparison.levelKey ?? "no-data"),
          href: strongestFlight ? `/bag/${strongestFlight.comparison.row.clubId}` : undefined,
        },
        {
          label: "Peer chase",
          value: !peerBenchmarksLoaded
            ? "Optional"
            : peerChase
              ? `${formatClubType(peerChase.row.clubType)} · ${peerChase.metric.shortLabel}`
              : "--",
          detail: !peerBenchmarksLoaded
            ? "Load peer percentiles when you need comparison context"
            : peerChase
              ? `${formatMetricValue(
                  peerChase.peer.topQuartile - peerChase.actual,
                  peerChase.metric,
                )} to top-25%`
              : "No visible peer chase yet",
          tone: peerBenchmarksLoaded && peerChase ? "amber" : "slate",
          href: peerChase ? `/bag/${peerChase.row.clubId}` : undefined,
        },
      ]}
    />
  );
}

function CarryBenchmarkContent({ rows }: { rows: ClubBenchmarkRow[] }) {
  const rowsWithData = rows.filter((row) => row.comparison.levelIndex !== null);
  const averageLevel =
    rowsWithData.length === 0
      ? null
      : Math.round(
          rowsWithData.reduce((total, row) => total + (row.comparison.levelIndex ?? 0), 0) /
            rowsWithData.length,
        );
  const strongest =
    [...rowsWithData].sort(
      (left, right) =>
        (right.comparison.levelIndex ?? -1) - (left.comparison.levelIndex ?? -1) ||
        right.comparison.progressPercent - left.comparison.progressPercent,
    )[0] ?? null;
  const closestNext =
    [...rows]
      .filter(
        (
          row,
        ): row is ClubBenchmarkRow & {
          comparison: ClubBenchmarkRow["comparison"] & { yardsToNextLevel: number };
        } => row.comparison.yardsToNextLevel !== null,
      )
      .sort(
        (left, right) => left.comparison.yardsToNextLevel - right.comparison.yardsToNextLevel,
      )[0] ?? null;

  return (
    <>
      <CompactReadoutGrid
        columnsClassName="md:grid-cols-3"
        items={[
          {
            label: "Bag average",
            value: averageLevel === null ? "--" : benchmarkLevelFromIndex(averageLevel),
            detail:
              rowsWithData.length === 0
                ? "Need stock carry samples"
                : `${rowsWithData.length} club${rowsWithData.length === 1 ? "" : "s"} compared`,
            tone: benchmarkTone(
              averageLevel === null ? "no-data" : benchmarkLevelKeyFromIndex(averageLevel),
            ),
          },
          {
            label: "Strongest match",
            value: strongest ? formatClubType(strongest.clubType) : "--",
            detail: strongest
              ? `${strongest.comparison.levelLabel} at ${formatMetric(strongest.carryYd)} yd`
              : "Need stock carry samples",
            tone: benchmarkTone(strongest?.comparison.levelKey ?? "no-data"),
            href: strongest ? `/bag/${strongest.clubId}` : undefined,
          },
          {
            label: "Closest next level",
            value: closestNext ? formatClubType(closestNext.clubType) : "--",
            detail: closestNext
              ? `${formatMetric(closestNext.comparison.yardsToNextLevel)} yd to ${closestNext.comparison.nextLevel?.label}`
              : "No next target yet",
            tone: closestNext ? "amber" : "slate",
            href: closestNext ? `/bag/${closestNext.clubId}` : undefined,
          },
        ]}
      />

      <MobileAccordionSection title="Club level table" count={`${rows.length} clubs`}>
        <MobileDataList>
          {rows.map((row) => (
            <MobileDataCard
              key={row.clubId}
              href={`/bag/${row.clubId}`}
              title={formatClubType(row.clubType)}
              subtitle={row.brandModel}
              action={<BenchmarkBadge row={row} />}
            >
              <DataPair
                label="Best stock"
                value={`${formatMetric(row.carryYd)}${row.carryYd === null ? "" : " yd"}`}
              />
              <DataPair label="Sample" value={row.sampleSize.toString()} />
              <DataPair label="Next" value={benchmarkNextText(row)} />
              <DataPair label="Best-stock floor" value={benchmarkFloorText(row)} />
              <DataPair label="Reference" value={benchmarkReferenceText(row)} />
              <BenchmarkMeter row={row} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      </MobileAccordionSection>

      <div className="hidden sm:block">
        <DesktopTableWorkbenchControls
          viewKey="distance-benchmark-carry"
          scope="distance-benchmark-carry"
          currentViewLabel="Carry benchmark table"
          resultLabel={`${rows.length} clubs`}
          columns={benchmarkCarryColumns}
          suggestedViews={benchmarkSuggestedViews}
          exportTableId="distance-benchmark-carry"
          exportFileName="forekinghell-distance-benchmark-carry.csv"
          className="mb-3"
        />
        <DataTableFrame label="Distance benchmark carry table" stickyFirstColumn>
          <Table
            className={BENCHMARK_TABLE_CLASS}
            data-workbench-scope="distance-benchmark-carry"
            data-workbench-export-table="distance-benchmark-carry"
            aria-describedby="distance-benchmark-carry-summary"
          >
            <TableCaption id="distance-benchmark-carry-summary" className="sr-only">
              Carry benchmark table comparing each club with inferred level, next target, benchmark
              band, tour anchor and sample confidence.
            </TableCaption>
            <BenchmarkTableColumns />
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="club"
                  className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  Club
                </TableHead>
                <TableHead data-column="model">Model</TableHead>
                <TableHead data-column="your-carry" className="text-right">
                  Your carry
                </TableHead>
                <TableHead data-column="level">Level</TableHead>
                <TableHead data-column="next">Next</TableHead>
                <TableHead data-column="benchmark-band">Benchmark band</TableHead>
                <TableHead data-column="tour-anchor">Tour anchor</TableHead>
                <TableHead data-column="sample" className="text-right">
                  Sample
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.clubId} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="club"
                    className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <Link
                      href={`/bag/${row.clubId}`}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {formatClubType(row.clubType)}
                    </Link>
                  </TableCell>
                  <TableCell
                    data-column="model"
                    className="max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground"
                  >
                    {row.brandModel}
                  </TableCell>
                  <TableCell data-column="your-carry" className="text-right font-semibold">
                    {formatMetric(row.carryYd)}
                    {row.carryYd === null ? "" : " yd"}
                  </TableCell>
                  <TableCell data-column="level">
                    <BenchmarkBadge row={row} />
                  </TableCell>
                  <TableCell data-column="next" className="text-sm text-muted-foreground">
                    <span className="block">{benchmarkNextText(row)}</span>
                    <span className="block text-xs">{benchmarkFloorText(row)}</span>
                  </TableCell>
                  <TableCell data-column="benchmark-band">
                    <BenchmarkMeter row={row} />
                  </TableCell>
                  <TableCell data-column="tour-anchor" className="text-sm text-muted-foreground">
                    {tourAnchorText(row, CARRY_METRIC)}
                  </TableCell>
                  <TableCell data-column="sample" className="text-right">
                    <span className="font-medium">{row.sampleSize}</span>
                    <span className="ml-2 text-muted-foreground">{row.confidenceScore}%</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableFrame>
      </div>
    </>
  );
}

function LevelMetricContent({
  rows,
  metric,
}: {
  rows: ClubBenchmarkRow[];
  metric: MetricDefinition;
}) {
  const comparisons = rows
    .map((row) => metricLevelComparison(row, metric))
    .filter((comparison): comparison is MetricLevelComparison => comparison !== null);
  const rowsWithData = comparisons.filter((comparison) => comparison.actual !== null);
  const strongest = strongestMetricMatch(rowsWithData);
  const closestNext = closestNextMetricMatch(rowsWithData);
  const primaryMatch = metric.comparisonMode === "closest" ? closestNext : strongest;

  return (
    <>
      <CompactReadoutGrid
        columnsClassName="md:grid-cols-3"
        items={[
          {
            label: "Estimated levels",
            value:
              rowsWithData.length === 0
                ? "--"
                : `${rowsWithData.length}/${comparisons.length} clubs`,
            detail:
              rowsWithData.length === 0
                ? `Import ${metric.label.toLowerCase()} data`
                : metric.description,
            tone: rowsWithData.length === 0 ? "slate" : "sky",
          },
          {
            label: metric.comparisonMode === "closest" ? "Closest level" : "Strongest level",
            value: primaryMatch ? formatClubType(primaryMatch.row.clubType) : "--",
            detail: primaryMatch
              ? `${primaryMatch.levelLabel} at ${formatMetricValue(primaryMatch.actual, metric)}`
              : "No matching metric yet",
            tone: benchmarkTone(primaryMatch?.levelKey ?? "no-data"),
            href: primaryMatch ? `/bag/${primaryMatch.row.clubId}` : undefined,
          },
          {
            label:
              metric.comparisonMode === "closest" ? "Smallest level gap" : "Closest next level",
            value: closestNext ? formatClubType(closestNext.row.clubType) : "--",
            detail:
              closestNext === null ? "No next target yet" : metricNextText(closestNext, metric),
            tone: closestNext ? "amber" : "slate",
            href: closestNext ? `/bag/${closestNext.row.clubId}` : undefined,
          },
        ]}
      />

      <MobileAccordionSection title={`${metric.label} table`} count={`${comparisons.length} clubs`}>
        <MobileDataList>
          {comparisons.map((comparison) => (
            <MobileDataCard
              key={comparison.row.clubId}
              href={`/bag/${comparison.row.clubId}`}
              title={formatClubType(comparison.row.clubType)}
              subtitle={comparison.row.brandModel}
              action={<MetricLevelBadge comparison={comparison} metric={metric} />}
            >
              <DataPair label="You" value={formatMetricValue(comparison.actual, metric)} />
              <DataPair
                label={metricLevelLabel(metric)}
                value={metricBadgeLabel(comparison, metric)}
              />
              <DataPair
                label={metricTargetLabel(metric)}
                value={metricNextText(comparison, metric)}
              />
              <DataPair label="Tour anchor" value={comparison.tourAnchorLabel} />
              <DataPair label="Band" value={metricReferenceText(comparison, metric)} />
              <MetricLevelMeter comparison={comparison} metric={metric} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      </MobileAccordionSection>

      <div className="hidden sm:block">
        <DesktopTableWorkbenchControls
          viewKey={`distance-benchmark-${metric.key}`}
          scope={`distance-benchmark-${metric.key}`}
          currentViewLabel={`${metric.shortLabel} benchmark table`}
          resultLabel={`${comparisons.length} clubs`}
          columns={benchmarkMetricColumns}
          suggestedViews={benchmarkSuggestedViews}
          exportTableId={`distance-benchmark-${metric.key}`}
          exportFileName={`forekinghell-${metric.key}-benchmark.csv`}
          className="mb-3"
        />
        <DataTableFrame label={`${metric.shortLabel} benchmark table`} stickyFirstColumn>
          <Table
            className={BENCHMARK_TABLE_CLASS}
            data-workbench-scope={`distance-benchmark-${metric.key}`}
            data-workbench-export-table={`distance-benchmark-${metric.key}`}
            aria-describedby={`${metric.key}-benchmark-summary`}
          >
            <TableCaption id={`${metric.key}-benchmark-summary`} className="sr-only">
              {metric.shortLabel} benchmark table comparing each club with the current value, level,
              target, benchmark band, tour anchor and sample confidence.
            </TableCaption>
            <BenchmarkTableColumns />
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="club"
                  className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  Club
                </TableHead>
                <TableHead data-column="model">Model</TableHead>
                <TableHead data-column="current-value" className="text-right">
                  Your {metric.shortLabel.toLowerCase()}
                </TableHead>
                <TableHead data-column="metric-level">{metricLevelLabel(metric)}</TableHead>
                <TableHead data-column="metric-target">{metricTargetLabel(metric)}</TableHead>
                <TableHead data-column="metric-band">{metricBandLabel(metric)}</TableHead>
                <TableHead data-column="tour-anchor">Tour anchor</TableHead>
                <TableHead data-column="sample" className="text-right">
                  Sample
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((comparison) => (
                <TableRow
                  key={comparison.row.clubId}
                  tabIndex={0}
                  className="focus-aaa outline-none"
                >
                  <TableCell
                    data-column="club"
                    className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <Link
                      href={`/bag/${comparison.row.clubId}`}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {formatClubType(comparison.row.clubType)}
                    </Link>
                  </TableCell>
                  <TableCell
                    data-column="model"
                    className="max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground"
                  >
                    {comparison.row.brandModel}
                  </TableCell>
                  <TableCell data-column="current-value" className="text-right font-semibold">
                    {formatMetricValue(comparison.actual, metric)}
                  </TableCell>
                  <TableCell data-column="metric-level">
                    <MetricLevelBadge comparison={comparison} metric={metric} />
                  </TableCell>
                  <TableCell data-column="metric-target" className="text-sm text-muted-foreground">
                    {metricNextText(comparison, metric)}
                  </TableCell>
                  <TableCell data-column="metric-band">
                    <MetricLevelMeter comparison={comparison} metric={metric} />
                  </TableCell>
                  <TableCell data-column="tour-anchor" className="text-sm text-muted-foreground">
                    {comparison.tourAnchorLabel}
                  </TableCell>
                  <TableCell data-column="sample" className="text-right">
                    <span className="font-medium">{comparison.row.sampleSize}</span>
                    <span className="ml-2 text-muted-foreground">
                      {comparison.row.confidenceScore}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableFrame>
      </div>
    </>
  );
}

function BenchmarkTableColumns() {
  return (
    <colgroup>
      {BENCHMARK_TABLE_COLUMN_WIDTHS.map((width, index) => (
        <col key={`${width}-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );
}

function PeerComparisonContent({
  rows,
  peerSummary,
  peerBenchmarksLoaded,
}: {
  rows: ClubBenchmarkRow[];
  peerSummary: ClubBenchmarkPeerSummary;
  peerBenchmarksLoaded: boolean;
}) {
  const peerRows = buildPeerDisplayRows(rows, peerSummary);
  const rowsWithRank = peerRows.filter((row) => row.peer?.percentile !== null);
  const bestRank = bestPeerRankRow(rowsWithRank);
  const bestRankPercentile = bestRank?.peer?.percentile ?? null;
  const closestTopQuartile = closestTopQuartilePeerRow(peerRows);

  if (!peerBenchmarksLoaded) {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/55 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <Users className="size-4" aria-hidden="true" />
              Peer benchmarks are on demand
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Carry, speed and flight benchmarks are loaded. Peer percentiles use social visibility
              checks and recent public or friend-visible stock shots, so they are loaded only when
              you ask for comparison context.
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit border-emerald-700 text-emerald-900">
            <Link href="/bag?peers=1#distance-benchmarks" prefetch={false}>
              Load peer benchmarks
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CompactReadoutGrid
        columnsClassName="md:grid-cols-3"
        items={[
          {
            label: "Peer pool",
            value:
              peerSummary.peerUserCount === 0
                ? "--"
                : `${peerSummary.peerUserCount} user${peerSummary.peerUserCount === 1 ? "" : "s"}`,
            detail:
              peerSummary.peerUserCount === 0
                ? "No visible peer bag data yet"
                : `${peerSummary.cohortLabel} · ${peerSummary.peerShotCount.toLocaleString(
                    "en-GB",
                  )} raw shots`,
            tone: peerSummary.peerUserCount === 0 ? "slate" : "sky",
          },
          {
            label: "Best peer rank",
            value: bestRankPercentile === null ? "--" : formatPercentile(bestRankPercentile),
            detail: bestRank
              ? `${formatClubType(bestRank.row.clubType)} · ${bestRank.metric.label}`
              : "Need matching peer samples",
            tone: peerTone(bestRankPercentile),
            href: bestRank ? `/bag/${bestRank.row.clubId}` : undefined,
          },
          {
            label: "Closest top 25%",
            value: closestTopQuartile ? formatClubType(closestTopQuartile.row.clubType) : "--",
            detail: closestTopQuartile
              ? `${formatMetricValue(
                  closestTopQuartile.peer.topQuartile - closestTopQuartile.actual,
                  closestTopQuartile.metric,
                )} to top-25% ${closestTopQuartile.metric.shortLabel.toLowerCase()}`
              : "No peer chase yet",
            tone: closestTopQuartile ? "amber" : "slate",
            href: closestTopQuartile ? `/bag/${closestTopQuartile.row.clubId}` : undefined,
          },
        ]}
      />

      <MobileAccordionSection title="Peer percentile table" count={`${peerRows.length} rows`}>
        <MobileDataList>
          {peerRows.map((peerRow) => (
            <MobileDataCard
              key={`${peerRow.row.clubId}-${peerRow.metric.key}`}
              href={`/bag/${peerRow.row.clubId}`}
              title={`${formatClubType(peerRow.row.clubType)} · ${peerRow.metric.shortLabel}`}
              subtitle={peerRow.row.brandModel}
              action={<PeerPercentileBadge percentile={peerRow.peer?.percentile ?? null} />}
            >
              <DataPair label="You" value={formatMetricValue(peerRow.actual, peerRow.metric)} />
              <DataPair
                label="Peer median"
                value={formatMetricValue(peerRow.peer?.peerMedian ?? null, peerRow.metric)}
              />
              <DataPair
                label="Top 25%"
                value={formatMetricValue(peerRow.peer?.topQuartile ?? null, peerRow.metric)}
              />
              <DataPair label="Peer sample" value={peerSampleText(peerRow.peer)} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      </MobileAccordionSection>

      <div className="hidden sm:block">
        <DesktopTableWorkbenchControls
          viewKey="distance-benchmark-peers"
          scope="distance-benchmark-peers"
          currentViewLabel="Peer benchmark comparison"
          resultLabel={`${peerRows.length} rows`}
          columns={benchmarkPeerColumns}
          suggestedViews={benchmarkSuggestedViews}
          exportTableId="distance-benchmark-peers"
          exportFileName="forekinghell-distance-benchmark-peers.csv"
          className="mb-3"
        />
        <DataTableFrame label="Peer benchmark comparison table" stickyFirstColumn>
          <Table
            className="min-w-[1080px]"
            data-workbench-scope="distance-benchmark-peers"
            data-workbench-export-table="distance-benchmark-peers"
            aria-describedby="peer-benchmark-comparison-summary"
          >
            <TableCaption id="peer-benchmark-comparison-summary" className="sr-only">
              Peer benchmark comparison table showing each club metric beside peer median, top 25
              percent value, percentile and peer sample.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="club"
                  className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  Club
                </TableHead>
                <TableHead data-column="metric">Metric</TableHead>
                <TableHead data-column="you" className="text-right">
                  You
                </TableHead>
                <TableHead data-column="peer-median" className="text-right">
                  Peer median
                </TableHead>
                <TableHead data-column="top-quartile" className="text-right">
                  Top 25%
                </TableHead>
                <TableHead data-column="percentile">Percentile</TableHead>
                <TableHead data-column="peer-sample" className="text-right">
                  Peer sample
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peerRows.map((peerRow) => (
                <TableRow
                  key={`${peerRow.row.clubId}-${peerRow.metric.key}`}
                  tabIndex={0}
                  className="focus-aaa outline-none"
                >
                  <TableCell
                    data-column="club"
                    className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <Link
                      href={`/bag/${peerRow.row.clubId}`}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {formatClubType(peerRow.row.clubType)}
                    </Link>
                  </TableCell>
                  <TableCell data-column="metric" className="text-muted-foreground">
                    {peerRow.metric.shortLabel}
                  </TableCell>
                  <TableCell data-column="you" className="text-right font-semibold">
                    {formatMetricValue(peerRow.actual, peerRow.metric)}
                  </TableCell>
                  <TableCell data-column="peer-median" className="text-right">
                    {formatMetricValue(peerRow.peer?.peerMedian ?? null, peerRow.metric)}
                  </TableCell>
                  <TableCell data-column="top-quartile" className="text-right">
                    {formatMetricValue(peerRow.peer?.topQuartile ?? null, peerRow.metric)}
                  </TableCell>
                  <TableCell data-column="percentile">
                    <PeerPercentileBadge percentile={peerRow.peer?.percentile ?? null} />
                  </TableCell>
                  <TableCell
                    data-column="peer-sample"
                    className="text-right text-sm text-muted-foreground"
                  >
                    {peerSampleText(peerRow.peer)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableFrame>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Peer rows use aggregate stock-shot data from users with public or friend-visible bag data.
      </p>
    </>
  );
}

function BenchmarkMeter({ row }: { row: ClubBenchmarkRow }) {
  const marker =
    row.comparison.carryYd === null
      ? null
      : benchmarkDisplayProgressPercent(row.comparison.benchmark, row.comparison.carryYd);

  return (
    <div className="min-w-0 space-y-2">
      <div className="relative h-3 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${marker ?? 0}%` }} />
        {marker === null ? null : (
          <span
            className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow-sm"
            style={{ left: `calc(${marker}% - 0.5rem)` }}
            aria-hidden
          />
        )}
      </div>
      <div className="grid grid-cols-5 text-[10px] leading-4 text-muted-foreground">
        {row.comparison.benchmark.levels.map((level, index) => (
          <span
            key={level.key}
            className={
              index === 0
                ? "text-left"
                : index === row.comparison.benchmark.levels.length - 1
                  ? "text-right"
                  : "text-center"
            }
          >
            {level.shortLabel} {level.yards}
          </span>
        ))}
      </div>
    </div>
  );
}

function BenchmarkBadge({ row }: { row: ClubBenchmarkRow }) {
  return (
    <span
      className={`inline-flex min-w-24 justify-center rounded-full border px-2 py-1 text-xs font-semibold ${benchmarkBadgeClass(
        row.comparison.levelKey,
      )}`}
    >
      {row.comparison.levelLabel}
    </span>
  );
}

function MetricLevelBadge({
  comparison,
  metric,
}: {
  comparison: MetricLevelComparison;
  metric: MetricDefinition;
}) {
  return (
    <span
      className={`inline-flex min-w-24 justify-center whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${benchmarkBadgeClass(
        comparison.levelKey,
      )}`}
    >
      {metricBadgeLabel(comparison, metric)}
    </span>
  );
}

function MetricLevelMeter({
  comparison,
  metric,
}: {
  comparison: MetricLevelComparison;
  metric: MetricDefinition;
}) {
  const levels = metricMeterLevels(comparison);
  const marker = metricMeterMarkerPercent(comparison, levels);

  return (
    <div className="min-w-0 space-y-2">
      <div className="relative h-3 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${marker ?? 0}%` }} />
        {marker === null ? null : (
          <span
            className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-950 shadow-sm"
            style={{ left: `calc(${marker}% - 0.5rem)` }}
            aria-hidden
          />
        )}
      </div>
      <div className="grid grid-cols-5 text-[10px] leading-4 text-muted-foreground">
        {levels.map((level, index) => (
          <span
            key={level.key}
            className={
              index === 0 ? "text-left" : index === levels.length - 1 ? "text-right" : "text-center"
            }
          >
            {level.shortLabel} {formatMetricValue(level.value, metric)}
          </span>
        ))}
      </div>
    </div>
  );
}

function metricMeterMarkerPercent(
  comparison: MetricLevelComparison,
  levels: InferredClubBenchmarkMetricLevel[],
) {
  if (comparison.actual === null) {
    return null;
  }

  return metricDisplayProgressPercent(levels, comparison.actual);
}

function metricMeterLevels(comparison: MetricLevelComparison) {
  return comparison.levels;
}

function buildPeerDisplayRows(
  rows: ClubBenchmarkRow[],
  peerSummary: ClubBenchmarkPeerSummary,
): PeerComparisonDisplayRow[] {
  return rows.flatMap((row) =>
    PEER_METRIC_KEYS.map((metricKey) => {
      const metric = METRIC_BY_KEY.get(metricKey);

      if (!metric) {
        return null;
      }

      return {
        row,
        metric,
        actual: actualMetricValue(row, metricKey),
        peer: peerComparisonFor(row, metricKey, peerSummary),
      };
    }).filter((item): item is PeerComparisonDisplayRow => item !== null),
  );
}

function metricByKey(metricKey: ClubBenchmarkMetricKey) {
  const metric = METRIC_BY_KEY.get(metricKey);

  if (!metric) {
    throw new Error(`Unknown benchmark metric: ${metricKey}`);
  }

  return metric;
}

function bestPeerRankRow(peerRows: PeerComparisonDisplayRow[]) {
  return (
    [...peerRows].sort(
      (left, right) => (right.peer?.percentile ?? -1) - (left.peer?.percentile ?? -1),
    )[0] ?? null
  );
}

function closestTopQuartilePeerRow(peerRows: PeerComparisonDisplayRow[]) {
  return (
    [...peerRows]
      .filter(
        (
          row,
        ): row is PeerComparisonDisplayRow & {
          actual: number;
          peer: ClubBenchmarkPeerComparison & { topQuartile: number };
        } =>
          row.actual !== null &&
          row.peer !== null &&
          row.peer.topQuartile !== null &&
          row.peer.topQuartile > row.actual,
      )
      .sort(
        (left, right) =>
          left.peer.topQuartile - left.actual - (right.peer.topQuartile - right.actual),
      )[0] ?? null
  );
}

function peerComparisonFor(
  row: ClubBenchmarkRow,
  metricKey: ClubBenchmarkMetricKey,
  peerSummary: ClubBenchmarkPeerSummary,
) {
  return (
    peerSummary.comparisons.find(
      (comparison) =>
        comparison.clubType === row.comparison.benchmark.clubType &&
        comparison.metricKey === metricKey,
    ) ?? null
  );
}

function PeerPercentileBadge({ percentile }: { percentile: number | null }) {
  if (percentile === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  return (
    <span
      className={`inline-flex min-w-20 justify-center rounded-full border px-2 py-1 text-xs font-semibold ${peerBadgeClass(
        percentile,
      )}`}
    >
      {formatPercentile(percentile)}
    </span>
  );
}

function peerSampleText(peer: ClubBenchmarkPeerComparison | null | undefined) {
  if (!peer || peer.peerCount === 0) {
    return "--";
  }

  return `${peer.peerCount} user${peer.peerCount === 1 ? "" : "s"} · ${peer.sampleSize} shots`;
}

function formatPercentile(percentile: number) {
  const suffix = percentileSuffix(percentile);

  return `${percentile}${suffix}`;
}

function percentileSuffix(percentile: number) {
  const lastTwoDigits = percentile % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return "th";
  }

  if (percentile % 10 === 1) {
    return "st";
  }

  if (percentile % 10 === 2) {
    return "nd";
  }

  if (percentile % 10 === 3) {
    return "rd";
  }

  return "th";
}

function peerTone(percentile: number | null) {
  if (percentile === null) {
    return "slate";
  }

  if (percentile >= 75) {
    return "green";
  }

  if (percentile >= 50) {
    return "sky";
  }

  return "amber";
}

function peerBadgeClass(percentile: number) {
  const tone = peerTone(percentile);

  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function benchmarkNextText(row: ClubBenchmarkRow) {
  if (row.comparison.carryYd === null) {
    return "Needs full-swing stock data";
  }

  if (!row.comparison.nextLevel || row.comparison.yardsToNextLevel === null) {
    return "Above top reference";
  }

  return `${formatMetric(row.comparison.yardsToNextLevel)} yd to ${row.comparison.nextLevel.label}`;
}

function benchmarkFloorText(row: ClubBenchmarkRow) {
  if (row.bestSampleFloorYd === null || row.bestSampleFloorYd === undefined) {
    return "Need stock sample";
  }

  return `Beat ${formatMetric(row.bestSampleFloorYd)} yd to lift set`;
}

function benchmarkReferenceText(row: ClubBenchmarkRow) {
  const first = row.comparison.benchmark.levels[0];
  const last = row.comparison.benchmark.levels[row.comparison.benchmark.levels.length - 1];

  return `${first.yards}-${last.yards} yd ${row.comparison.benchmark.label}`;
}

function benchmarkLevelFromIndex(index: number) {
  return ["Beginner", "Average", "Good", "Advanced", "Tour"][index] ?? "--";
}

function benchmarkLevelKeyFromIndex(index: number) {
  return (["beginner", "average", "good", "advanced", "tour"] as const)[index] ?? "no-data";
}

function benchmarkTone(levelKey: ClubBenchmarkRow["comparison"]["levelKey"]) {
  if (levelKey === "tour" || levelKey === "tour-plus" || levelKey === "advanced") {
    return "green";
  }

  if (levelKey === "good") {
    return "sky";
  }

  if (levelKey === "average" || levelKey === "beginner" || levelKey === "building") {
    return "amber";
  }

  return "slate";
}

function benchmarkBadgeClass(levelKey: ClubBenchmarkRow["comparison"]["levelKey"]) {
  if (levelKey === "tour" || levelKey === "tour-plus") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (levelKey === "advanced" || levelKey === "good") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (levelKey === "average") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (levelKey === "beginner" || levelKey === "building") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function strongestMetricMatch(comparisons: MetricLevelComparison[]) {
  return [...comparisons].sort(
    (left, right) =>
      metricLevelSortValue(right) - metricLevelSortValue(left) ||
      right.progressPercent - left.progressPercent,
  )[0];
}

function closestNextMetricMatch(comparisons: MetricLevelComparison[]) {
  return [...comparisons]
    .filter(
      (
        comparison,
      ): comparison is MetricLevelComparison & {
        nextLevel: InferredClubBenchmarkMetricLevel;
        gapToNext: number;
      } => comparison.nextLevel !== null && comparison.gapToNext !== null,
    )
    .sort((left, right) => left.gapToNext - right.gapToNext)[0];
}

function metricLevelSortValue(comparison: MetricLevelComparison) {
  if (comparison.levelKey === "tour-plus") {
    return 5;
  }

  if (comparison.levelIndex !== null) {
    return comparison.levelIndex;
  }

  if (comparison.levelKey === "building") {
    return -1;
  }

  return -2;
}

function metricLevelComparison(
  row: ClubBenchmarkRow,
  metric: MetricDefinition,
): MetricLevelComparison | null {
  const levels = buildMetricLevels(row, metric);

  if (!levels) {
    return null;
  }

  const actual = actualMetricValue(row, metric.key);
  const classified = classifyMetricLevel(levels, actual, metric);

  return {
    row,
    levels,
    actual,
    ...classified,
    tourAnchorLabel: tourAnchorText(row, metric),
  };
}

function buildMetricLevels(row: ClubBenchmarkRow, metric: MetricDefinition) {
  return getClubBenchmarkMetricLevels(
    row.comparison.benchmark.clubType,
    metric.key,
    metric.precision,
  );
}

function classifyMetricLevel(
  levels: InferredClubBenchmarkMetricLevel[],
  actual: number | null,
  metric: MetricDefinition,
): Omit<MetricLevelComparison, "row" | "levels" | "actual" | "tourAnchorLabel"> {
  const first = levels[0];
  const final = levels[levels.length - 1];

  if (actual === null || !Number.isFinite(actual)) {
    return {
      levelLabel: "Needs data",
      levelKey: "no-data",
      levelIndex: null,
      nextLevel: first,
      gapToNext: null,
      progressPercent: 0,
    };
  }

  const progressPercent = metricDisplayProgressPercent(levels, actual);

  if (metric.comparisonMode === "higher") {
    const achieved = [...levels].reverse().find((level) => actual >= level.value) ?? null;
    const nextLevel = levels.find((level) => actual < level.value) ?? null;

    if (!nextLevel) {
      return {
        levelLabel: actual > final.value ? "Tour+" : final.label,
        levelKey: actual > final.value ? "tour-plus" : final.key,
        levelIndex: levels.length - 1,
        nextLevel: null,
        gapToNext: null,
        progressPercent,
      };
    }

    if (!achieved) {
      return {
        levelLabel: "Building",
        levelKey: "building",
        levelIndex: null,
        nextLevel,
        gapToNext: Math.abs(nextLevel.value - actual),
        progressPercent,
      };
    }

    return {
      levelLabel: achieved.label,
      levelKey: achieved.key,
      levelIndex: levels.findIndex((level) => level.key === achieved.key),
      nextLevel,
      gapToNext: Math.abs(nextLevel.value - actual),
      progressPercent,
    };
  }

  const nearest = [...levels].sort(
    (left, right) => Math.abs(actual - left.value) - Math.abs(actual - right.value),
  )[0];
  const targetIndex = levels.findIndex((level) => level.key === nearest.key);

  return {
    levelLabel: nearest.label,
    levelKey: nearest.key,
    levelIndex: targetIndex,
    nextLevel: nearest,
    gapToNext: Math.abs(nearest.value - actual),
    progressPercent,
  };
}

function metricDisplayProgressPercent(levels: InferredClubBenchmarkMetricLevel[], actual: number) {
  const first = levels[0];
  const final = levels[levels.length - 1];
  const ascending = final.value >= first.value;
  const segmentSize = 100 / (levels.length - 1);
  const nextLevelIndex = levels.findIndex((level) =>
    ascending ? actual < level.value : actual > level.value,
  );

  if (nextLevelIndex === -1) {
    return 100;
  }

  if (nextLevelIndex === 0) {
    return 0;
  }

  const previousLevel = levels[nextLevelIndex - 1];
  const nextLevel = levels[nextLevelIndex];
  const distance = ascending
    ? nextLevel.value - previousLevel.value
    : previousLevel.value - nextLevel.value;
  const segmentProgress =
    distance === 0
      ? 0
      : ascending
        ? (actual - previousLevel.value) / distance
        : (previousLevel.value - actual) / distance;

  return clamp((nextLevelIndex - 1 + segmentProgress) * segmentSize, 0, 100);
}

function strongestMetricBenchmark(
  rows: ClubBenchmarkRow[],
  metricKeys: Set<ClubBenchmarkMetricKey>,
) {
  return (
    METRICS.filter((metric) => metricKeys.has(metric.key))
      .flatMap((metric) =>
        rows.flatMap((row) => {
          const comparison = metricLevelComparison(row, metric);

          if (comparison === null || comparison.actual === null || comparison.gapToNext === null) {
            return [];
          }

          return [{ metric, comparison }];
        }),
      )
      .sort(
        (left, right) =>
          metricLevelSortValue(right.comparison) - metricLevelSortValue(left.comparison) ||
          right.comparison.progressPercent - left.comparison.progressPercent,
      )[0] ?? null
  );
}

function metricNextText(comparison: MetricLevelComparison, metric: MetricDefinition) {
  if (comparison.actual === null) {
    return `Needs ${metric.shortLabel.toLowerCase()} data`;
  }

  if (!comparison.nextLevel || comparison.gapToNext === null) {
    return "At top reference";
  }

  if (metric.comparisonMode === "closest") {
    if (comparison.gapToNext !== null && comparison.gapToNext <= metricPrecisionTolerance(metric)) {
      return `${comparison.nextLevel.label} window`;
    }

    const side = comparison.actual > comparison.nextLevel.value ? "above" : "below";

    return `${formatMetricValue(comparison.gapToNext, metric)} ${side} ${comparison.nextLevel.label.toLowerCase()} window`;
  }

  return `${formatMetricValue(comparison.gapToNext, metric)} to ${comparison.nextLevel.label}`;
}

function metricBadgeLabel(comparison: MetricLevelComparison, metric: MetricDefinition) {
  if (comparison.actual === null) {
    return "Needs data";
  }

  if (metric.comparisonMode !== "closest" || !comparison.nextLevel) {
    return comparison.levelLabel;
  }

  if (comparison.gapToNext !== null && comparison.gapToNext <= metricPrecisionTolerance(metric)) {
    return `${comparison.nextLevel.label} window`;
  }

  return comparison.actual > comparison.nextLevel.value
    ? "Above target window"
    : "Below target window";
}

function metricPrecisionTolerance(metric: MetricDefinition) {
  return metric.precision === 2 ? 0.01 : 0.1;
}

function metricLevelLabel(metric: MetricDefinition) {
  return metric.comparisonMode === "closest" ? "Window" : "Level";
}

function metricTargetLabel(metric: MetricDefinition) {
  return metric.comparisonMode === "closest" ? "Window gap" : "Next";
}

function metricBandLabel(metric: MetricDefinition) {
  return metric.comparisonMode === "closest" ? "Target window" : "Benchmark band";
}

function metricReferenceText(comparison: MetricLevelComparison, metric: MetricDefinition) {
  const first = comparison.levels[0];
  const final = comparison.levels[comparison.levels.length - 1];

  return `${first.shortLabel} ${formatMetricValue(first.value, metric)} · Tour ${formatMetricValue(
    final.value,
    metric,
  )}`;
}

function tourAnchorText(row: ClubBenchmarkRow, metric: MetricDefinition) {
  const reference = getClubBenchmarkTourReference(row.comparison.benchmark.clubType);
  const pgaValue = reference?.pga?.[metric.key];
  const lpgaValue = reference?.lpga?.[metric.key];

  if (isNumber(pgaValue)) {
    return `PGA ${reference?.pgaLabel ?? row.comparison.benchmark.label} ${formatMetricValue(
      pgaValue,
      metric,
    )}`;
  }

  if (isNumber(lpgaValue)) {
    return `LPGA ${reference?.lpgaLabel ?? row.comparison.benchmark.label} ${formatMetricValue(
      lpgaValue,
      metric,
    )}`;
  }

  return "No tour anchor";
}

function actualMetricValue(row: ClubBenchmarkRow, metric: ClubBenchmarkMetricKey) {
  if (metric === "carryYd") {
    return row.carryYd;
  }

  return row.metrics?.[metric] ?? null;
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatMetricValue(value: number | null | undefined, metric: MetricDefinition) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  const formatted = value.toLocaleString("en-GB", {
    maximumFractionDigits: metric.precision,
    minimumFractionDigits: metric.precision === 2 ? 2 : 0,
  });

  return metric.unit ? `${formatted} ${metric.unit}` : formatted;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
