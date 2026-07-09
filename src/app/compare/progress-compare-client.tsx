"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, CalendarDays, CalendarRange, TrendingUp } from "lucide-react";

import {
  ChartAccessibleFallback,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  DataPanel,
  DataTableFrame,
  SectionHeader,
  StatusPill,
  type Tone,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CompareClubRow,
  CompareDelta,
  ProgressCompareData,
  ProgressPeriod,
  ProgressPeriodMode,
} from "@/lib/compare-data";

type BaselineView = "previousWeek" | "previousMonth";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const compareFocusClubColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "current", label: "Last 7 days" },
  { id: "baseline", label: "Baseline" },
  { id: "carry", label: "Carry" },
  { id: "playable", label: "Playable" },
  { id: "big-misses", label: "Big misses" },
  { id: "shot-cone", label: "Shot cone" },
  { id: "signal", label: "Overall signal" },
];

const comparePeriodColumns: DesktopWorkbenchColumn[] = [
  { id: "period", label: "Period", locked: true },
  { id: "shots", label: "Shots" },
  { id: "clubs", label: "Clubs" },
  { id: "carry", label: "Carry" },
  { id: "playable", label: "Playable" },
  { id: "big-misses", label: "Big misses" },
  { id: "shot-cone", label: "Shot cone" },
  { id: "previous", label: "Vs previous" },
];

const compareProgressSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Control movement",
    href: "/compare#compare-focus-clubs",
    detail: "Review playable, big-miss and shot-cone deltas for the latest period.",
  },
  {
    title: "Distance movement",
    href: "/compare#compare-focus-clubs",
    detail: "Keep carry and current/baseline sample columns visible.",
  },
  {
    title: "Report export",
    href: "/compare#compare-period-history",
    detail: "Export focus-club and period rows for a comparison report.",
  },
];

export function ProgressCompareClient({ data }: { data: ProgressCompareData }) {
  const [baselineView, setBaselineView] = useState<BaselineView>("previousWeek");
  const [periodMode, setPeriodMode] = useState<ProgressPeriodMode>("week");
  const comparison = baselineView === "previousWeek" ? data.previousWeek : data.previousMonth;
  const periods = periodMode === "week" ? data.weeklyPeriods : data.monthlyPeriods;

  return (
    <DataPanel id="progress-over-time">
      <SectionHeader
        title="Progress over time"
        description={
          data.latestSession
            ? `${comparison.focus.label} against ${comparison.label.toLowerCase()}, with ${periodMode === "week" ? "weekly" : "monthly"} trend rows below.`
            : "Import sessions to compare progress over time."
        }
        action={<TrendingUp className="size-5 text-emerald-600" />}
      />
      <CardContent className="grid gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <SegmentButton
              active={baselineView === "previousWeek"}
              icon={<CalendarDays className="size-4" />}
              label="7 days"
              onClick={() => setBaselineView("previousWeek")}
            />
            <SegmentButton
              active={baselineView === "previousMonth"}
              icon={<CalendarRange className="size-4" />}
              label="30 days"
              onClick={() => setBaselineView("previousMonth")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentButton
              active={periodMode === "week"}
              icon={<BarChart3 className="size-4" />}
              label="Weeks"
              onClick={() => setPeriodMode("week")}
            />
            <SegmentButton
              active={periodMode === "month"}
              icon={<CalendarRange className="size-4" />}
              label="Months"
              onClick={() => setPeriodMode("month")}
            />
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ProgressMetric
            label="Last 7 days"
            value={formatShotCount(comparison.focus.stockShots)}
            detail={comparison.focus.detail}
            badge="Current"
            tone="green"
          />
          <ProgressMetric
            label={comparison.label}
            value={formatShotCount(comparison.baseline.stockShots)}
            detail={comparison.detail}
            badge="Baseline"
            tone="sky"
          />
          <ProgressMetric
            label="Control signal"
            value={controlSignalValue(comparison.delta)}
            detail={controlSignalDetail(comparison.delta)}
            badge={controlSignalBadge(comparison.delta)}
            tone={controlSignalTone(comparison.delta)}
          />
          <ProgressMetric
            label="Shot cone"
            value={formatSignedYards(comparison.delta.coneDeltaYd)}
            detail="Dispersion width; lower is tighter"
            badge={movementLabel(comparison.delta.coneDeltaYd, "lower")}
            tone={movementTone(comparison.delta.coneDeltaYd, "lower")}
          />
          <ProgressMetric
            label="Carry context"
            value={formatSignedYards(comparison.delta.carryDeltaYd)}
            detail="Median stock carry; not the verdict"
            badge={movementLabel(comparison.delta.carryDeltaYd, "higher")}
            tone={movementTone(comparison.delta.carryDeltaYd, "higher")}
          />
        </section>

        {comparison.clubRows.length > 0 ? (
          <FocusClubTable rows={comparison.clubRows} />
        ) : (
          <div className="apple-panel grid place-items-center rounded-lg px-4 py-10 text-center">
            <div>
              <p className="font-semibold">No 7-day club rows yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Progress appears once the latest week has tracked full-shot clubs.
              </p>
            </div>
          </div>
        )}

        <section className="grid gap-4 min-[1900px]:grid-cols-[0.8fr_1.2fr]">
          <PeriodTrendStrip periods={periods} />
          <PeriodTable periods={periods} mode={periodMode} />
        </section>
      </CardContent>
    </DataPanel>
  );
}

function SegmentButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      aria-pressed={active}
      variant={active ? "default" : "outline"}
      size="sm"
      className={
        active ? "rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]" : "rounded-lg bg-white/85"
      }
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}

function ProgressMetric({
  label,
  value,
  detail,
  badge,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  badge: string;
  tone: Tone;
}) {
  return (
    <div className="apple-panel-strong min-w-0 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <StatusPill tone={tone}>{badge}</StatusPill>
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tracking-normal">{value}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function FocusClubTable({ rows }: { rows: CompareClubRow[] }) {
  return (
    <section id="compare-focus-clubs" data-workbench-scope="compare-focus-clubs">
      <DesktopTableWorkbenchControls
        viewKey="compare-focus-clubs"
        scope="compare-focus-clubs"
        currentViewLabel="Compare focus clubs"
        resultLabel={`${rows.length} clubs`}
        columns={compareFocusClubColumns}
        suggestedViews={compareProgressSuggestedViews}
        exportTableId="compare-focus-clubs"
        exportFileName="forekinghell-compare-focus-clubs.csv"
        className="mb-3"
      />
      <DataTableFrame label="Compare focus-club movement table" stickyFirstColumn>
        <Table
          className="min-w-[980px]"
          data-workbench-export-table="compare-focus-clubs"
          aria-describedby="compare-focus-clubs-summary"
        >
          <TableCaption id="compare-focus-clubs-summary" className="sr-only">
            Compare focus-club movement table showing club, latest sample, baseline, carry,
            playable, big misses, shot cone and overall signal.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="club"
                className="sticky left-0 z-20 min-w-40 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Club
              </TableHead>
              <TableHead data-column="current" className="text-right">
                Last 7 days
              </TableHead>
              <TableHead data-column="baseline" className="text-right">
                Baseline
              </TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="playable" className="text-right">
                Playable
              </TableHead>
              <TableHead data-column="big-misses" className="text-right">
                Big misses
              </TableHead>
              <TableHead data-column="shot-cone" className="text-right">
                Shot cone
              </TableHead>
              <TableHead data-column="signal" className="text-right">
                Overall signal
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.clubId} tabIndex={0} className="focus-aaa outline-none">
                <TableCell
                  data-column="club"
                  className="sticky left-0 z-10 min-w-40 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  {row.label}
                </TableCell>
                <TableCell data-column="current" className="text-right">
                  <StackedValue
                    value={formatYards(row.focus.carryMedianYd)}
                    detail={formatShotCount(row.focus.stockShots)}
                  />
                </TableCell>
                <TableCell data-column="baseline" className="text-right">
                  <StackedValue
                    value={formatYards(row.baseline.carryMedianYd)}
                    detail={formatShotCount(row.baseline.stockShots)}
                  />
                </TableCell>
                <DeltaCell
                  columnId="carry"
                  value={row.delta.carryDeltaYd}
                  direction="higher"
                  unit="yd"
                />
                <DeltaCell
                  columnId="playable"
                  value={row.delta.playableRateDelta}
                  direction="higher"
                  unit="pts"
                />
                <DeltaCell
                  columnId="big-misses"
                  value={row.delta.bigMissRateDelta}
                  direction="lower"
                  unit="pts"
                />
                <StackedDeltaCell
                  columnId="shot-cone"
                  value={row.delta.coneDeltaYd}
                  direction="lower"
                  unit="yd"
                  detail={`${formatYards(row.baseline.shotConeWidthYd)} -> ${formatYards(row.focus.shotConeWidthYd)}`}
                />
                <TableCell data-column="signal" className="text-right">
                  <StatusPill tone={scoreTone(row)}>{scoreLabel(row)}</StatusPill>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function PeriodTrendStrip({ periods }: { periods: ProgressPeriod[] }) {
  const chronological = [...periods].reverse();
  const maxShots = Math.max(1, ...chronological.map((period) => period.summary.stockShots));

  return (
    <div className="apple-panel-strong min-w-0 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Trend shape</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Carry, playable rate, shot cone and sample size.
          </p>
        </div>
        <BarChart3 className="size-5 shrink-0 text-sky-600" />
      </div>
      <div className="mt-4 grid gap-3">
        {chronological.length > 0 ? (
          chronological.map((period) => {
            const playable = period.summary.playableRate ?? 0;
            const shotWidth = Math.max(8, (period.summary.stockShots / maxShots) * 100);

            return (
              <div key={period.key} className="grid gap-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{period.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatYards(period.summary.carryMedianYd)}
                  </span>
                </div>
                <div className="grid h-8 grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2">
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${Math.max(5, Math.min(100, playable))}%` }}
                    />
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: `${Math.min(100, shotWidth)}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{formatRate(period.summary.playableRate)} playable</span>
                  <span>{formatYards(period.summary.shotConeWidthYd)} cone</span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">No periods available yet.</p>
        )}
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
        className="mt-4 bg-white/70"
      />
    </div>
  );
}

function periodTrendChartSummary(periods: ProgressPeriod[]) {
  const latest = periods.at(-1);

  if (!latest) {
    return "No compare period trend rows are available yet; import more tracked stock shots before asking for trend explanations.";
  }

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

function PeriodTable({ periods, mode }: { periods: ProgressPeriod[]; mode: ProgressPeriodMode }) {
  return (
    <section id="compare-period-history" data-workbench-scope="compare-period-history">
      <DesktopTableWorkbenchControls
        viewKey="compare-period-history"
        scope="compare-period-history"
        currentViewLabel={`${mode === "week" ? "Weekly" : "Monthly"} compare history`}
        resultLabel={`${periods.length} ${mode === "week" ? "weeks" : "months"}`}
        columns={comparePeriodColumns}
        suggestedViews={compareProgressSuggestedViews}
        exportTableId="compare-period-history"
        exportFileName={`forekinghell-compare-${mode}-history.csv`}
        className="mb-3"
      />
      <DataTableFrame label="Compare period history table" stickyFirstColumn>
        <Table
          className="min-w-[980px]"
          data-workbench-export-table="compare-period-history"
          aria-describedby="compare-period-history-summary"
        >
          <TableCaption id="compare-period-history-summary" className="sr-only">
            Compare period history table showing period, shots, clubs, carry, playable rate, big
            misses, shot cone and movement against the previous period.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="period"
                className="sticky left-0 z-20 min-w-36 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                {mode === "week" ? "Week" : "Month"}
              </TableHead>
              <TableHead data-column="shots" className="text-right">
                Shots
              </TableHead>
              <TableHead data-column="clubs" className="text-right">
                Clubs
              </TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="playable" className="text-right">
                Playable
              </TableHead>
              <TableHead data-column="big-misses" className="text-right">
                Big misses
              </TableHead>
              <TableHead data-column="shot-cone" className="text-right">
                Shot cone
              </TableHead>
              <TableHead data-column="previous" className="min-w-36 text-right">
                Vs previous
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length > 0 ? (
              periods.map((period) => (
                <TableRow key={period.key} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="period"
                    className="sticky left-0 z-10 min-w-36 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <StackedValue value={period.label} detail={period.detail} />
                  </TableCell>
                  <TableCell data-column="shots" className="text-right">
                    {integerFormatter.format(period.summary.stockShots)}
                  </TableCell>
                  <TableCell data-column="clubs" className="text-right">
                    {integerFormatter.format(period.summary.clubs)}
                  </TableCell>
                  <TableCell data-column="carry" className="text-right">
                    {formatYards(period.summary.carryMedianYd)}
                  </TableCell>
                  <TableCell data-column="playable" className="text-right">
                    {formatRate(period.summary.playableRate)}
                  </TableCell>
                  <TableCell data-column="big-misses" className="text-right">
                    {formatRate(period.summary.bigMissRate)}
                  </TableCell>
                  <TableCell data-column="shot-cone" className="text-right">
                    {formatYards(period.summary.shotConeWidthYd)}
                  </TableCell>
                  <TableCell data-column="previous" className="min-w-36 text-right">
                    <StackedDelta delta={period.deltaFromPrevious} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No period history yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function StackedValue({ value, detail }: { value: string; detail: string }) {
  return (
    <span className="inline-flex min-w-0 flex-col items-end">
      <span className="max-w-40 truncate font-medium">{value}</span>
      <span className="max-w-40 truncate text-xs text-muted-foreground">{detail}</span>
    </span>
  );
}

function DeltaCell({
  columnId,
  value,
  direction,
  unit,
}: {
  columnId: string;
  value: number | null;
  direction: "higher" | "lower";
  unit: "yd" | "pts";
}) {
  return (
    <TableCell data-column={columnId} className={deltaClass(value, direction)}>
      {unit === "yd" ? formatSignedYards(value) : formatSignedRate(value)}
    </TableCell>
  );
}

function StackedDeltaCell({
  columnId,
  value,
  direction,
  unit,
  detail,
}: {
  columnId: string;
  value: number | null;
  direction: "higher" | "lower";
  unit: "yd" | "pts";
  detail: string;
}) {
  return (
    <TableCell data-column={columnId} className={deltaClass(value, direction)}>
      <span className="inline-flex min-w-0 flex-col items-end">
        <span>{unit === "yd" ? formatSignedYards(value) : formatSignedRate(value)}</span>
        <span className="max-w-40 truncate text-xs font-normal text-muted-foreground">
          {detail}
        </span>
      </span>
    </TableCell>
  );
}

function StackedDelta({ delta }: { delta: CompareDelta }) {
  return (
    <span className="inline-flex flex-col items-end">
      <span className={deltaTextClass(delta.carryDeltaYd, "higher")}>
        {formatSignedYards(delta.carryDeltaYd)}
      </span>
      <span className={deltaTextClass(delta.playableRateDelta, "higher")}>
        {formatSignedRate(delta.playableRateDelta)}
      </span>
      <span className={deltaTextClass(delta.coneDeltaYd, "lower")}>
        {formatSignedYards(delta.coneDeltaYd)}
      </span>
    </span>
  );
}

function formatShotCount(value: number) {
  return `${integerFormatter.format(value)} stock shots`;
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}%`;
}

function formatSignedYards(value: number | null) {
  return value === null ? "--" : `${signed(value)} yd`;
}

function formatSignedRate(value: number | null) {
  return value === null ? "--" : `${signed(value)} pts`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function movementTone(value: number | null, direction: "higher" | "lower"): Tone {
  if (value === null) return "slate";
  if (Math.round(value * 10) / 10 === 0) return "slate";

  const improved = direction === "higher" ? value > 0 : value < 0;
  return improved ? "green" : "amber";
}

function movementLabel(value: number | null, direction: "higher" | "lower") {
  if (value === null) return "No data";
  if (Math.round(value * 10) / 10 === 0) return "Steady";

  const improved = direction === "higher" ? value > 0 : value < 0;
  if (direction === "lower") {
    return improved ? "Tighter" : "Wider";
  }

  return improved ? "Gain" : "Drop";
}

function controlSignalTone(delta: CompareDelta): Tone {
  const score = controlDeltaScore(delta);
  if (score >= 1) return "green";
  if (score <= -1) return "amber";
  return "slate";
}

function controlSignalBadge(delta: CompareDelta) {
  const score = controlDeltaScore(delta);
  if (score >= 2) return "Control";
  if (score >= 1) return "Playable";
  if (score <= -2) return "Risk";
  if (score <= -1) return "Watch";
  return "Neutral";
}

function controlSignalValue(delta: CompareDelta) {
  const score = controlDeltaScore(delta);
  if (score >= 2) return "More consistent";
  if (score >= 1) return "More playable";
  if (score <= -2) return "Less controlled";
  if (score <= -1) return "Needs watching";
  return "No clear move";
}

function controlSignalDetail(delta: CompareDelta) {
  const parts = [
    isNumber(delta.playableRateDelta)
      ? `${formatSignedRate(delta.playableRateDelta)} playable`
      : null,
    isNumber(delta.bigMissRateDelta)
      ? `${formatSignedRate(delta.bigMissRateDelta)} big misses`
      : null,
    isNumber(delta.coneDeltaYd) ? `${formatSignedYards(delta.coneDeltaYd)} cone` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("; ") : "Playable shots, misses and dispersion";
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

function deltaClass(value: number | null, direction: "higher" | "lower") {
  return `text-right font-semibold ${deltaTextClass(value, direction)}`;
}

function deltaTextClass(value: number | null, direction: "higher" | "lower") {
  const tone = movementTone(value, direction);
  if (tone === "green") return "text-emerald-700";
  if (tone === "amber") return "text-amber-700";
  return "text-muted-foreground";
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
