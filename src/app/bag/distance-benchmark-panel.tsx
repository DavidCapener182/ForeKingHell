"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";

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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  benchmarkDisplayProgressPercent,
  type ClubBenchmarkLevelKey,
  type ClubBenchmarkMetricKey,
  type ClubBenchmarkPeerComparison,
  type ClubBenchmarkPeerSummary,
  type ClubBenchmarkRow,
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

type TourMetricValues = Partial<Record<ClubBenchmarkMetricKey, number>>;

type TourReference = {
  pga?: TourMetricValues;
  lpga?: TourMetricValues;
  pgaLabel?: string;
  lpgaLabel?: string;
};

type InferredMetricLevel = {
  key: ClubBenchmarkLevelKey;
  label: string;
  shortLabel: string;
  value: number;
};

type MetricLevelComparison = {
  row: ClubBenchmarkRow;
  levels: InferredMetricLevel[];
  actual: number | null;
  levelLabel: string;
  levelKey: ClubBenchmarkRow["comparison"]["levelKey"];
  levelIndex: number | null;
  nextLevel: InferredMetricLevel | null;
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
    label: "Carry distance",
    shortLabel: "Carry",
    unit: "yd",
    precision: 1,
    description: "Best-20 stock carry against broad club-distance reference levels.",
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

const TOUR_REFERENCES: Record<string, TourReference> = {
  driver: {
    pgaLabel: "Driver",
    lpgaLabel: "Driver",
    pga: tourValues(113, -1.3, 167, 1.48, 10.9, 2686, 32, 38, 275),
    lpga: tourValues(94, 3.0, 140, 1.48, 13.2, 2611, 25, 37, 218),
  },
  "3w": {
    pgaLabel: "3-wood",
    lpgaLabel: "3-wood",
    pga: tourValues(107, -2.9, 158, 1.48, 9.2, 3655, 30, 43, 243),
    lpga: tourValues(90, -0.9, 132, 1.48, 11.2, 2704, 23, 39, 195),
  },
  "5w": {
    pgaLabel: "5-wood",
    lpgaLabel: "5-wood",
    pga: tourValues(103, -3.3, 152, 1.47, 9.4, 4350, 31, 47, 230),
    lpga: tourValues(88, -1.8, 128, 1.47, 12.1, 4501, 26, 43, 185),
  },
  hybrid: {
    pgaLabel: "Hybrid 15-18",
    lpgaLabel: "7-wood",
    pga: tourValues(100, -3.5, 146, 1.46, 10.2, 4437, 29, 47, 225),
    lpga: tourValues(85, -3.0, 123, 1.46, 12.7, 4693, 25, 46, 174),
  },
  "3i": {
    pgaLabel: "3 iron",
    pga: tourValues(98, -3.1, 142, 1.45, 10.4, 4630, 27, 46, 212),
  },
  "4i": {
    pgaLabel: "4 iron",
    lpgaLabel: "4 iron",
    pga: tourValues(96, -3.4, 137, 1.43, 11.0, 4836, 28, 48, 203),
    lpga: tourValues(80, -1.7, 116, 1.45, 14.3, 4801, 24, 43, 169),
  },
  "5i": {
    pgaLabel: "5 iron",
    lpgaLabel: "5 iron",
    pga: tourValues(94, -3.7, 132, 1.41, 12.1, 5361, 31, 49, 194),
    lpga: tourValues(79, -1.9, 112, 1.43, 14.8, 5081, 23, 45, 161),
  },
  "6i": {
    pgaLabel: "6 iron",
    lpgaLabel: "6 iron",
    pga: tourValues(92, -4.1, 127, 1.38, 14.1, 6231, 30, 50, 183),
    lpga: tourValues(78, -2.3, 109, 1.41, 17.1, 5943, 25, 46, 152),
  },
  "7i": {
    pgaLabel: "7 iron",
    lpgaLabel: "7 iron",
    pga: tourValues(90, -4.3, 120, 1.33, 16.3, 7097, 32, 50, 172),
    lpga: tourValues(76, -2.3, 104, 1.38, 19.0, 6699, 26, 47, 141),
  },
  "8i": {
    pgaLabel: "8 iron",
    lpgaLabel: "8 iron",
    pga: tourValues(87, -4.5, 115, 1.32, 18.1, 7998, 31, 50, 160),
    lpga: tourValues(74, -3.1, 100, 1.33, 20.8, 7494, 25, 47, 130),
  },
  "9i": {
    pgaLabel: "9 iron",
    lpgaLabel: "9 iron",
    pga: tourValues(85, -4.7, 109, 1.28, 20.4, 8647, 30, 51, 148),
    lpga: tourValues(72, -3.1, 93, 1.32, 23.9, 7589, 26, 47, 119),
  },
  pw: {
    pgaLabel: "PW",
    lpgaLabel: "PW",
    pga: tourValues(83, -5.0, 102, 1.23, 24.2, 9304, 29, 52, 136),
    lpga: tourValues(70, -2.8, 86, 1.28, 25.7, 8403, 23, 48, 107),
  },
};

const COMPARISON_METRICS = METRICS.filter((metric) => metric.key !== "carryYd");
const PEER_TAB_VALUE = "peers";
const PEER_METRIC_KEYS: ClubBenchmarkMetricKey[] = [
  "carryYd",
  "clubSpeedMph",
  "ballSpeedMph",
  "smashFactor",
  "maxHeightYd",
  "landAngleDeg",
];
const METRIC_BY_KEY = new Map(METRICS.map((metric) => [metric.key, metric]));

export function DistanceBenchmarkPanel({
  rows,
  peerSummary,
}: {
  rows: ClubBenchmarkRow[];
  peerSummary: ClubBenchmarkPeerSummary;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Distance benchmarks"
        description="Tabbed carry, speed and flight levels. Tour is anchored to the pro PDF; the lower bands are estimated from the carry ladder."
        action={<BarChart3 className="size-5 text-emerald-500" />}
      />
      <CardContent>
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
            <PeerComparisonContent rows={rows} peerSummary={peerSummary} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </DataPanel>
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
                label="Carry"
                value={`${formatMetric(row.carryYd)}${row.carryYd === null ? "" : " yd"}`}
              />
              <DataPair label="Sample" value={row.sampleSize.toString()} />
              <DataPair label="Next" value={benchmarkNextText(row)} />
              <DataPair label="Best-20 floor" value={benchmarkFloorText(row)} />
              <DataPair label="Reference" value={benchmarkReferenceText(row)} />
              <BenchmarkMeter row={row} />
            </MobileDataCard>
          ))}
        </MobileDataList>
      </MobileAccordionSection>

      <div className="hidden sm:block">
        <DataTableFrame>
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Your carry</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Next</TableHead>
                <TableHead className="min-w-[280px]">Benchmark band</TableHead>
                <TableHead className="text-right">Sample</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.clubId}>
                  <TableCell>
                    <Link
                      href={`/bag/${row.clubId}`}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {formatClubType(row.clubType)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground">
                    {row.brandModel}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMetric(row.carryYd)}
                    {row.carryYd === null ? "" : " yd"}
                  </TableCell>
                  <TableCell>
                    <BenchmarkBadge row={row} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="block">{benchmarkNextText(row)}</span>
                    <span className="block text-xs">{benchmarkFloorText(row)}</span>
                  </TableCell>
                  <TableCell>
                    <BenchmarkMeter row={row} />
                  </TableCell>
                  <TableCell className="text-right">
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
              action={<MetricLevelBadge comparison={comparison} />}
            >
              <DataPair label="You" value={formatMetricValue(comparison.actual, metric)} />
              <DataPair label={metricLevelLabel()} value={comparison.levelLabel} />
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
        <DataTableFrame>
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Your {metric.shortLabel.toLowerCase()}</TableHead>
                <TableHead>{metricLevelLabel()}</TableHead>
                <TableHead>{metricTargetLabel(metric)}</TableHead>
                <TableHead className="min-w-[280px]">Benchmark band</TableHead>
                <TableHead>Tour anchor</TableHead>
                <TableHead className="text-right">Sample</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisons.map((comparison) => (
                <TableRow key={comparison.row.clubId}>
                  <TableCell>
                    <Link
                      href={`/bag/${comparison.row.clubId}`}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {formatClubType(comparison.row.clubType)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px] overflow-hidden text-ellipsis text-muted-foreground">
                    {comparison.row.brandModel}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMetricValue(comparison.actual, metric)}
                  </TableCell>
                  <TableCell>
                    <MetricLevelBadge comparison={comparison} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {metricNextText(comparison, metric)}
                  </TableCell>
                  <TableCell>
                    <MetricLevelMeter comparison={comparison} metric={metric} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {comparison.tourAnchorLabel}
                  </TableCell>
                  <TableCell className="text-right">
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

function PeerComparisonContent({
  rows,
  peerSummary,
}: {
  rows: ClubBenchmarkRow[];
  peerSummary: ClubBenchmarkPeerSummary;
}) {
  const peerRows = buildPeerDisplayRows(rows, peerSummary);
  const rowsWithRank = peerRows.filter((row) => row.peer?.percentile !== null);
  const bestRank =
    [...rowsWithRank].sort(
      (left, right) => (right.peer?.percentile ?? -1) - (left.peer?.percentile ?? -1),
    )[0] ?? null;
  const bestRankPercentile = bestRank?.peer?.percentile ?? null;
  const closestTopQuartile =
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
      )[0] ?? null;

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
        <DataTableFrame>
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">You</TableHead>
                <TableHead className="text-right">Peer median</TableHead>
                <TableHead className="text-right">Top 25%</TableHead>
                <TableHead>Percentile</TableHead>
                <TableHead className="text-right">Peer sample</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peerRows.map((peerRow) => (
                <TableRow key={`${peerRow.row.clubId}-${peerRow.metric.key}`}>
                  <TableCell>
                    <Link
                      href={`/bag/${peerRow.row.clubId}`}
                      className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      {formatClubType(peerRow.row.clubType)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {peerRow.metric.shortLabel}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMetricValue(peerRow.actual, peerRow.metric)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMetricValue(peerRow.peer?.peerMedian ?? null, peerRow.metric)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMetricValue(peerRow.peer?.topQuartile ?? null, peerRow.metric)}
                  </TableCell>
                  <TableCell>
                    <PeerPercentileBadge percentile={peerRow.peer?.percentile ?? null} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
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

function MetricLevelBadge({ comparison }: { comparison: MetricLevelComparison }) {
  return (
    <span
      className={`inline-flex min-w-24 justify-center whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${benchmarkBadgeClass(
        comparison.levelKey,
      )}`}
    >
      {comparison.levelLabel}
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
  levels: InferredMetricLevel[],
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
        nextLevel: InferredMetricLevel;
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
  const tourValue = tourReferenceValue(row, metric.key);
  const tourCarry = row.comparison.benchmark.levels.at(-1)?.yards;

  if (!isNumber(tourValue) || !isNumber(tourCarry) || tourCarry <= 0) {
    return null;
  }

  return row.comparison.benchmark.levels.map((level) => ({
    key: level.key,
    label: level.label,
    shortLabel: level.shortLabel,
    value: inferredMetricLevelValue(
      metric,
      row.comparison.benchmark.clubType,
      tourValue,
      level.yards / tourCarry,
    ),
  }));
}

function classifyMetricLevel(
  levels: InferredMetricLevel[],
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

function inferredMetricLevelValue(
  metric: MetricDefinition,
  clubType: string,
  tourValue: number,
  carryRatio: number,
) {
  const ratio = clamp(carryRatio, 0.35, 1);

  switch (metric.key) {
    case "clubSpeedMph":
    case "ballSpeedMph":
      return roundTo(tourValue * Math.sqrt(ratio), metric.precision);
    case "smashFactor":
      return roundTo(1 + (tourValue - 1) * (0.55 + 0.45 * ratio), metric.precision);
    case "attackAngleDeg":
      return roundTo(tourValue + attackAngleOffset(clubType) * (1 - ratio), metric.precision);
    case "launchAngleDeg":
      return roundTo(tourValue + launchAngleOffset(clubType) * (1 - ratio), metric.precision);
    case "spinRate":
      return roundTo(tourValue * Math.pow(ratio, 0.5), metric.precision);
    case "maxHeightYd":
    case "landAngleDeg":
      return roundTo(tourValue * Math.pow(ratio, 0.35), metric.precision);
    default:
      return roundTo(tourValue, metric.precision);
  }
}

function attackAngleOffset(clubType: string) {
  if (clubType === "driver") {
    return 5;
  }

  if (clubType.endsWith("w")) {
    return 3.5;
  }

  if (clubType === "hybrid") {
    return 2.5;
  }

  if (clubType.endsWith("i")) {
    return 2;
  }

  return 1.5;
}

function launchAngleOffset(clubType: string) {
  if (clubType === "driver") {
    return 3.5;
  }

  if (clubType.endsWith("w")) {
    return 2.5;
  }

  if (clubType === "hybrid") {
    return 2;
  }

  if (clubType.endsWith("i")) {
    return 1.5;
  }

  return 1;
}

function metricDisplayProgressPercent(levels: InferredMetricLevel[], actual: number) {
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

function metricNextText(comparison: MetricLevelComparison, metric: MetricDefinition) {
  if (comparison.actual === null) {
    return `Needs ${metric.shortLabel.toLowerCase()} data`;
  }

  if (!comparison.nextLevel || comparison.gapToNext === null) {
    return "At top reference";
  }

  if (metric.comparisonMode === "closest") {
    if (comparison.actual === comparison.nextLevel.value) {
      return `${comparison.nextLevel.label} match`;
    }

    return `${formatMetricValue(comparison.gapToNext, metric)} from ${comparison.nextLevel.label}`;
  }

  return `${formatMetricValue(comparison.gapToNext, metric)} to ${comparison.nextLevel.label}`;
}

function metricLevelLabel() {
  return "Level";
}

function metricTargetLabel(metric: MetricDefinition) {
  return metric.comparisonMode === "closest" ? "Level gap" : "Next";
}

function metricReferenceText(comparison: MetricLevelComparison, metric: MetricDefinition) {
  const first = comparison.levels[0];
  const final = comparison.levels[comparison.levels.length - 1];

  return `${first.shortLabel} ${formatMetricValue(first.value, metric)} · Tour ${formatMetricValue(
    final.value,
    metric,
  )}`;
}

function tourReferenceValue(row: ClubBenchmarkRow, metric: ClubBenchmarkMetricKey) {
  const reference = referenceFor(row);

  return reference?.pga?.[metric] ?? reference?.lpga?.[metric] ?? null;
}

function tourAnchorText(row: ClubBenchmarkRow, metric: MetricDefinition) {
  const reference = referenceFor(row);
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

function referenceFor(row: ClubBenchmarkRow) {
  return TOUR_REFERENCES[row.comparison.benchmark.clubType];
}

function actualMetricValue(row: ClubBenchmarkRow, metric: ClubBenchmarkMetricKey) {
  if (metric === "carryYd") {
    return row.carryYd;
  }

  return row.metrics?.[metric] ?? null;
}

function tourValues(
  clubSpeedMph: number,
  attackAngleDeg: number,
  ballSpeedMph: number,
  smashFactor: number,
  launchAngleDeg: number,
  spinRate: number,
  maxHeightYd: number,
  landAngleDeg: number,
  carryYd: number,
): TourMetricValues {
  return {
    carryYd,
    clubSpeedMph,
    attackAngleDeg,
    ballSpeedMph,
    smashFactor,
    launchAngleDeg,
    spinRate,
    maxHeightYd,
    landAngleDeg,
  };
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

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;

  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
