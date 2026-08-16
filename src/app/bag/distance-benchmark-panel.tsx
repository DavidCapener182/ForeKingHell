"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Users } from "lucide-react";

import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  MobileDataCard,
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

type MobileBenchmarkSlide = {
  key: string;
  label: string;
  content: ReactNode;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const METRICS: MetricDefinition[] = [
  {
    key: "carryYd",
    label: "Best-30 carry average",
    shortLabel: "Best 30 avg",
    unit: "yd",
    precision: 1,
    description:
      "Mean carry from your longest 30 clean full swings against broad reference levels.",
    comparisonMode: "higher",
  },
  {
    key: "clubSpeedMph",
    label: "Club speed",
    shortLabel: "Club speed",
    unit: "mph",
    precision: 1,
    description: "Average speed from the same best-30 clean full swings.",
    comparisonMode: "higher",
  },
  {
    key: "ballSpeedMph",
    label: "Ball speed",
    shortLabel: "Ball speed",
    unit: "mph",
    precision: 1,
    description: "Ball speed from the same best-30 clean full swings.",
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
const BENCHMARK_TABLE_CLASS = "min-w-[1400px] table-fixed";
const BENCHMARK_TABLE_COLUMN_WIDTHS = ["6%", "13%", "9%", "9%", "18%", "27%", "10%", "8%"];
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
  { id: "your-carry", label: "Best 30 avg" },
  { id: "level", label: "Level" },
  { id: "next", label: "Next" },
  { id: "benchmark-band", label: "Benchmark band" },
  { id: "tour-anchor", label: "Tour anchor" },
  { id: "sample", label: "Evidence" },
];

const benchmarkMetricColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "model", label: "Model" },
  { id: "current-value", label: "Current value" },
  { id: "metric-level", label: "Level" },
  { id: "metric-target", label: "Target" },
  { id: "metric-band", label: "Benchmark band" },
  { id: "tour-anchor", label: "Tour anchor" },
  { id: "sample", label: "Evidence" },
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
    href: "/bag?tab=distances#bag-gapping-table",
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
        action={<BarChart3 className="size-5 text-primary" aria-hidden="true" />}
      />
      <CardContent className="space-y-4">
        <BenchmarkOverview
          rows={rows}
          peerSummary={peerSummary}
          peerBenchmarksLoaded={peerBenchmarksLoaded}
        />
        <Tabs defaultValue="carryYd" className="gap-4">
          <div
            data-benchmark-metric-tabs
            className="-mx-4 snap-x snap-proximity overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <TabsList className="h-auto w-max gap-1 justify-start rounded-lg border bg-muted p-1 shadow-sm">
              {METRICS.map((metric) => (
                <TabsTrigger
                  key={metric.key}
                  value={metric.key}
                  className="min-h-11 shrink-0 flex-none snap-start min-w-max px-3 text-sm sm:min-h-8"
                >
                  {metric.shortLabel}
                </TabsTrigger>
              ))}
              <TabsTrigger
                value={PEER_TAB_VALUE}
                className="min-h-11 shrink-0 flex-none snap-start min-w-max px-3 text-sm sm:min-h-8"
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

function MobileBenchmarkCarousel({
  title,
  slides,
}: {
  title: string;
  slides: MobileBenchmarkSlide[];
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!api) return;

    const updateSelectedIndex = () => setSelectedIndex(api.selectedScrollSnap());
    queueMicrotask(updateSelectedIndex);
    api.on("select", updateSelectedIndex);
    api.on("reInit", updateSelectedIndex);

    return () => {
      api.off("select", updateSelectedIndex);
      api.off("reInit", updateSelectedIndex);
    };
  }, [api]);

  if (slides.length === 0) return null;

  const selectedSlide = slides[selectedIndex] ?? slides[0];

  return (
    <section
      data-mobile-benchmark-carousel
      className="grid min-w-0 gap-3 sm:hidden"
      aria-label={title}
    >
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">Swipe between clubs</p>
        </div>
        <span className="shrink-0 text-sm font-medium text-muted-foreground">
          {slides.length} clubs
        </span>
      </div>

      <Carousel
        opts={{ align: "start", containScroll: "trimSnaps", dragFree: false }}
        setApi={setApi}
        className="w-full min-w-0 max-w-full"
        aria-label={`${title} carousel`}
      >
        <CarouselContent className="-ml-3 touch-pan-y">
          {slides.map((slide, index) => (
            <CarouselItem
              key={slide.key}
              className="basis-[calc(100%-1.5rem)] pl-3"
              aria-label={`${slide.label}, club ${index + 1} of ${slides.length}`}
            >
              {slide.content}
            </CarouselItem>
          ))}
        </CarouselContent>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p
            className="min-w-0 truncate text-sm font-medium text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {selectedIndex + 1} of {slides.length} · {selectedSlide.label}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <CarouselPrevious className="static size-11 translate-y-0" />
            <CarouselNext className="static size-11 translate-y-0" />
          </div>
        </div>
      </Carousel>
    </section>
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
            ? `${closestCarry.comparison.nextLevel?.label}: ${benchmarkAdvanceText(closestCarry)}`
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
              ? `${strongest.comparison.levelLabel} at ${formatMetric(strongest.carryYd)} yd best-30 avg`
              : "Need stock carry samples",
            tone: benchmarkTone(strongest?.comparison.levelKey ?? "no-data"),
            href: strongest ? `/bag/${strongest.clubId}` : undefined,
          },
          {
            label: "Closest next level",
            value: closestNext ? formatClubType(closestNext.clubType) : "--",
            detail: closestNext
              ? `${closestNext.comparison.nextLevel?.label}: ${benchmarkAdvanceText(closestNext)}`
              : "No next target yet",
            tone: closestNext ? "amber" : "slate",
            href: closestNext ? `/bag/${closestNext.clubId}` : undefined,
          },
        ]}
      />

      <Alert className="border-[var(--status-information-border)] bg-[var(--status-information-surface)]">
        <BarChart3
          className="size-4 text-[var(--status-information-foreground)]"
          aria-hidden="true"
        />
        <AlertTitle className="text-[var(--status-information-foreground)]">
          What the benchmark sample means
        </AlertTitle>
        <AlertDescription className="leading-5 text-[var(--status-information-foreground)]">
          Best 30 avg is the mean carry from up to 30 of your longest clean full swings for each
          club. The evidence count is deliberately capped at 30; it does not mean only 30 saved
          shots exist. Chips, pitches, tagged mishits and rows without carry stay outside this
          comparison. Saved totals are shown per club, rather than as one whole-bag total.
        </AlertDescription>
      </Alert>

      <MobileBenchmarkCarousel
        title="Club carry benchmarks"
        slides={rows.map((row) => ({
          key: row.clubId,
          label: formatClubType(row.clubType),
          content: (
            <MobileDataCard
              href={`/bag/${row.clubId}`}
              title={formatClubType(row.clubType)}
              subtitle={row.brandModel}
              action={<BenchmarkBadge row={row} />}
              className="h-full rounded-[var(--mobile-radius-lg)] border border-border bg-card px-4 py-4 shadow-sm"
            >
              <DataPair
                label="Best 30 avg"
                value={`${formatMetric(row.carryYd)}${row.carryYd === null ? "" : " yd"}`}
              />
              <DataPair label="Evidence" value={benchmarkEvidenceText(row)} />
              <DataPair label="Next" value={benchmarkNextText(row)} />
              <DataPair label="Shot plan" value={benchmarkAdvanceText(row)} />
              <DataPair label="Reference" value={benchmarkReferenceText(row)} />
              <BenchmarkMeter row={row} />
            </MobileDataCard>
          ),
        }))}
      />

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
              band, tour anchor and best-30 evidence.
            </TableCaption>
            <BenchmarkTableColumns />
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead
                  data-column="club"
                  className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
                >
                  Club
                </TableHead>
                <TableHead data-column="model">Model</TableHead>
                <TableHead data-column="your-carry" className="text-right">
                  Best 30 avg
                </TableHead>
                <TableHead data-column="level">Level</TableHead>
                <TableHead data-column="next">Next</TableHead>
                <TableHead data-column="benchmark-band">Benchmark band</TableHead>
                <TableHead data-column="tour-anchor">Tour anchor</TableHead>
                <TableHead data-column="sample" className="text-right">
                  Evidence
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.clubId} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="club"
                    className="sticky left-0 z-10 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                    <span className="block text-xs">{benchmarkAdvanceText(row)}</span>
                  </TableCell>
                  <TableCell data-column="benchmark-band">
                    <BenchmarkMeter row={row} />
                  </TableCell>
                  <TableCell data-column="tour-anchor" className="text-sm text-muted-foreground">
                    {tourAnchorText(row, CARRY_METRIC)}
                  </TableCell>
                  <TableCell data-column="sample" className="text-right">
                    <span className="block font-medium">{row.sampleSize} used</span>
                    <span className="block text-xs text-muted-foreground">
                      {benchmarkSavedEvidenceText(row)}
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

      <MobileBenchmarkCarousel
        title={`${metric.label} by club`}
        slides={comparisons.map((comparison) => ({
          key: comparison.row.clubId,
          label: formatClubType(comparison.row.clubType),
          content: (
            <MobileDataCard
              href={`/bag/${comparison.row.clubId}`}
              title={formatClubType(comparison.row.clubType)}
              subtitle={comparison.row.brandModel}
              action={<MetricLevelBadge comparison={comparison} metric={metric} />}
              className="h-full rounded-[var(--mobile-radius-lg)] border border-border bg-card px-4 py-4 shadow-sm"
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
              <DataPair label="Evidence" value={benchmarkEvidenceText(comparison.row)} />
              <MetricLevelMeter comparison={comparison} metric={metric} />
            </MobileDataCard>
          ),
        }))}
      />

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
              target, benchmark band, tour anchor and best-30 evidence.
            </TableCaption>
            <BenchmarkTableColumns />
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead
                  data-column="club"
                  className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                  Evidence
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
                    className="sticky left-0 z-10 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                    <span className="block font-medium">{comparison.row.sampleSize} used</span>
                    <span className="block text-xs text-muted-foreground">
                      {benchmarkSavedEvidenceText(comparison.row)}
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
      <Alert className="border-[var(--status-information-border)] bg-[var(--status-information-surface)] p-4">
        <Users className="size-4 text-[var(--status-information-foreground)]" aria-hidden="true" />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="max-w-2xl">
            <AlertTitle className="text-[var(--status-information-foreground)]">
              Peer benchmarks are on demand
            </AlertTitle>
            <AlertDescription className="mt-2 leading-6 text-[var(--status-information-foreground)]">
              Carry, speed and flight benchmarks are loaded. Peer percentiles use social visibility
              checks and recent public or friend-visible stock shots, so they are loaded only when
              you ask for comparison context.
            </AlertDescription>
          </div>
          <Button asChild variant="outline" className="w-fit bg-card/70">
            <Link href="/bag?tab=evidence&peers=1#distance-benchmarks" prefetch={false}>
              Load peer benchmarks
            </Link>
          </Button>
        </div>
      </Alert>
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

      <MobileBenchmarkCarousel
        title="Peer comparisons by club"
        slides={rows.map((row) => {
          const clubPeerRows = peerRows.filter((peerRow) => peerRow.row.clubId === row.clubId);
          const bestClubRank = bestPeerRankRow(
            clubPeerRows.filter((peerRow) => peerRow.peer?.percentile !== null),
          );

          return {
            key: row.clubId,
            label: formatClubType(row.clubType),
            content: (
              <MobileDataCard
                href={`/bag/${row.clubId}`}
                title={formatClubType(row.clubType)}
                subtitle={row.brandModel}
                action={<PeerPercentileBadge percentile={bestClubRank?.peer?.percentile ?? null} />}
                className="h-full rounded-[var(--mobile-radius-lg)] border border-border bg-card px-4 py-4 shadow-sm"
              >
                {clubPeerRows.map((peerRow) => (
                  <PeerMobileMetricRow key={peerRow.metric.key} peerRow={peerRow} />
                ))}
              </MobileDataCard>
            ),
          };
        })}
      />

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
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead
                  data-column="club"
                  className="sticky left-0 z-20 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
                    className="sticky left-0 z-10 bg-card shadow-[1px_0_0_hsl(var(--border))]"
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
      <div className="relative h-3 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${marker ?? 0}%` }} />
        {marker === null ? null : (
          <span
            className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow-sm"
            style={{ left: `calc(${marker}% - 0.5rem)` }}
            aria-hidden
          />
        )}
      </div>
      <BenchmarkScaleLabels
        labels={row.comparison.benchmark.levels.map(
          (level) => `${level.shortLabel} ${level.yards}`,
        )}
      />
    </div>
  );
}

function BenchmarkBadge({ row }: { row: ClubBenchmarkRow }) {
  return (
    <Badge
      variant="outline"
      className={`h-auto min-w-24 justify-center px-2 py-1 ${benchmarkBadgeClass(row.comparison.levelKey)}`}
    >
      {row.comparison.levelLabel}
    </Badge>
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
    <Badge
      variant="outline"
      className={`h-auto min-w-24 justify-center px-2 py-1 ${benchmarkBadgeClass(comparison.levelKey)}`}
    >
      {metricBadgeLabel(comparison, metric)}
    </Badge>
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
      <div className="relative h-3 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${marker ?? 0}%` }} />
        {marker === null ? null : (
          <span
            className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow-sm"
            style={{ left: `calc(${marker}% - 0.5rem)` }}
            aria-hidden
          />
        )}
      </div>
      <BenchmarkScaleLabels
        labels={levels.map(
          (level) => `${level.shortLabel} ${formatMetricValue(level.value, metric)}`,
        )}
      />
    </div>
  );
}

function BenchmarkScaleLabels({ labels }: { labels: string[] }) {
  return (
    <>
      <div className="flex items-center justify-between gap-1 text-[10px] leading-4 text-muted-foreground sm:hidden">
        {labels.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="min-w-0 flex-1 truncate text-center first:text-left last:text-right"
            title={label}
          >
            {benchmarkScaleShortLabel(label)}
          </span>
        ))}
      </div>
      <div className="relative hidden h-4 text-[10px] leading-4 text-muted-foreground sm:block">
        {labels.map((label, index) => {
          const position = (index / Math.max(1, labels.length - 1)) * 100;
          const alignmentClass =
            index === 0
              ? "translate-x-0"
              : index === labels.length - 1
                ? "-translate-x-full"
                : "-translate-x-1/2";

          return (
            <span
              key={`${label}-${index}`}
              className={`absolute top-0 whitespace-nowrap ${alignmentClass}`}
              style={{ left: `${position}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </>
  );
}

function benchmarkScaleShortLabel(label: string) {
  return label.split(" ")[0] ?? label;
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

function PeerMobileMetricRow({ peerRow }: { peerRow: PeerComparisonDisplayRow }) {
  return (
    <div className="min-w-0 rounded-[var(--mobile-radius-md)] bg-secondary px-3 py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {peerRow.metric.shortLabel}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {formatMetricValue(peerRow.actual, peerRow.metric)}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Median {formatMetricValue(peerRow.peer?.peerMedian ?? null, peerRow.metric)} · Top 25%{" "}
        {formatMetricValue(peerRow.peer?.topQuartile ?? null, peerRow.metric)} ·{" "}
        {peerRow.peer?.percentile === null || peerRow.peer?.percentile === undefined
          ? "No rank"
          : formatPercentile(peerRow.peer.percentile)}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">{peerSampleText(peerRow.peer)}</p>
    </div>
  );
}

function PeerPercentileBadge({ percentile }: { percentile: number | null }) {
  if (percentile === null) {
    return <span className="text-muted-foreground">--</span>;
  }

  return (
    <Badge
      variant="outline"
      className={`h-auto min-w-20 justify-center px-2 py-1 ${peerBadgeClass(percentile)}`}
    >
      {formatPercentile(percentile)}
    </Badge>
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
    return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
  }

  if (tone === "sky") {
    return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
  }

  return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
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

function benchmarkAdvanceText(row: ClubBenchmarkRow) {
  if (row.comparison.carryYd === null) {
    return "Build a clean full-swing sample";
  }

  if (row.comparison.nextLevel === null) {
    return "No higher reference marker";
  }

  if (row.nextLevelPlan === null) {
    return "Add clean full swings to build the plan";
  }

  const targetText = `${formatMetric(row.nextLevelPlan.targetCarryYd)} yd+ → ${formatMetric(
    row.nextLevelPlan.projectedAverageYd,
  )} yd avg`;

  return row.nextLevelPlan.shotsNeeded === 1
    ? `1 shot at ${targetText}`
    : `${row.nextLevelPlan.shotsNeeded} shots at ${targetText}`;
}

function benchmarkEvidenceText(row: ClubBenchmarkRow) {
  return `${row.sampleSize} used · ${benchmarkSavedEvidenceText(row)}`;
}

function benchmarkSavedEvidenceText(row: ClubBenchmarkRow) {
  if (row.savedShotCount === undefined) {
    return "saved count unavailable";
  }

  if (row.reviewedShotCount !== undefined && row.reviewedShotCount < row.savedShotCount) {
    return `${row.reviewedShotCount.toLocaleString("en-GB")} reviewed · ${row.savedShotCount.toLocaleString(
      "en-GB",
    )} saved for this club`;
  }

  return `${row.savedShotCount.toLocaleString("en-GB")} saved for this club`;
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
    return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
  }

  if (levelKey === "advanced" || levelKey === "good") {
    return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
  }

  if (levelKey === "average") {
    return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
  }

  if (levelKey === "beginner" || levelKey === "building") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
  }

  return "border-border bg-muted text-muted-foreground";
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
