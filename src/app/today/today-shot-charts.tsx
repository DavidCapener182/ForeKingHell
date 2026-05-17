"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, Eye } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartFrame } from "@/components/premium";
import { cn } from "@/lib/utils";

export type TodayChartShot = {
  id: string;
  clubType: string;
  clubLabel: string;
  shotNumber: number | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  apexFt: number | null;
  launchAngleDeg: number | null;
  ballSpeedMph: number | null;
};

type ClubChartGroup = {
  clubType: string;
  clubLabel: string;
  color: string;
  shotCount: number;
};

export type TodayChartClubStatus = {
  clubType: string;
  verdict: "better" | "worse" | "mixed" | "new";
  summary: string;
};

type ChartPoint = TodayChartShot & {
  color: string;
};

type TrajectoryView = "averages" | "shots";

type AverageTrajectory = {
  clubType: string;
  clubLabel: string;
  color: string;
  shotCount: number;
  carryYd: number;
  apexFt: number;
};

type AverageDispersion = {
  clubType: string;
  clubLabel: string;
  color: string;
  sideYd: number;
  carryYd: number;
};

const chartWidth = 760;
const chartHeight = 370;
const padding = {
  top: 22,
  right: 36,
  bottom: 46,
  left: 54,
};
const plotWidth = chartWidth - padding.left - padding.right;
const plotHeight = chartHeight - padding.top - padding.bottom;

const clubColors: Record<string, string> = {
  driver: "#2563eb",
  "3w": "#9333ea",
  "5w": "#c026d3",
  "7w": "#e11d48",
  "3h": "#0891b2",
  "4h": "#0f766e",
  "5h": "#0d9488",
  "4i": "#16a34a",
  "5i": "#65a30d",
  "6i": "#ca8a04",
  "7i": "#f97316",
  "8i": "#dc2626",
  "9i": "#be123c",
  pw: "#7c3aed",
  gw: "#4f46e5",
  aw: "#0284c7",
  sw: "#059669",
  lw: "#64748b",
};

const fallbackColors = [
  "#2563eb",
  "#c026d3",
  "#16a34a",
  "#f97316",
  "#0891b2",
  "#dc2626",
  "#7c3aed",
  "#65a30d",
  "#be123c",
  "#0f766e",
];

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function TodayShotCharts({
  shots,
  clubStatuses = [],
  patternInsight = "Dispersion is the main diagnostic; trajectory adds ball-flight context.",
}: {
  shots: TodayChartShot[];
  clubStatuses?: TodayChartClubStatus[];
  patternInsight?: string;
}) {
  const clubGroups = useMemo(() => buildClubGroups(shots), [shots]);
  const statusByClub = useMemo(
    () =>
      new Map(
        clubStatuses.map((status) => [status.clubType, status] as const),
      ),
    [clubStatuses],
  );
  const [selectedClub, setSelectedClub] = useState("all");
  const [trajectoryView, setTrajectoryView] =
    useState<TrajectoryView>("shots");
  const visibleShots = useMemo(
    () =>
      shots
        .filter(
          (shot) => selectedClub === "all" || shot.clubType === selectedClub,
        )
        .map((shot) => ({
          ...shot,
          color: colorForClub(shot.clubType),
        })),
    [selectedClub, shots],
  );
  const visibleClubCount =
    selectedClub === "all" ? clubGroups.length : visibleShots.length > 0 ? 1 : 0;

  return (
    <Card className="premium-card">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Shot patterns</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{visibleShots.length} shots</span>
            <span>/</span>
            <span>{visibleClubCount} clubs</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/55 px-3 py-2 text-sm font-medium leading-5 text-emerald-950">
          Pattern detected: {patternInsight}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <button
            type="button"
            aria-pressed={selectedClub === "all"}
            onClick={() => setSelectedClub("all")}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
              selectedClub === "all"
                ? "border-emerald-700 bg-emerald-800 text-white shadow-sm"
                : "bg-white text-muted-foreground hover:bg-slate-50",
            )}
          >
            {selectedClub === "all" ? <Check className="size-3.5" /> : null}
            All clubs
            <span className={cn("text-xs", selectedClub === "all" ? "text-white/75" : "text-muted-foreground")}>{shots.length}</span>
          </button>
          {clubGroups.map((club) => {
            const selected = selectedClub === club.clubType;
            const status = statusByClub.get(club.clubType);

            return (
              <button
                key={club.clubType}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedClub(club.clubType)}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
                  selected
                    ? "border-emerald-700 bg-emerald-800 text-white shadow-sm"
                    : "bg-white text-muted-foreground hover:bg-slate-50",
                )}
              >
                {selected ? <Check className="size-3.5" /> : null}
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: club.color }}
                  aria-hidden
                />
                <span>{club.clubLabel}</span>
                <span className={cn("text-xs", selected ? "text-white/75" : "text-muted-foreground")}>{club.shotCount}</span>
                {status ? (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", selected ? "bg-white/15 text-white" : statusPillClass(status.verdict))}>
                    {verdictLabel(status.verdict)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Trajectory</span>
          <button
            type="button"
            aria-pressed={trajectoryView === "averages"}
            onClick={() => setTrajectoryView("averages")}
            className={cn(
              "inline-flex h-8 items-center rounded-lg border px-2.5 font-medium transition-colors",
              trajectoryView === "averages"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "bg-white text-muted-foreground hover:bg-slate-50",
            )}
          >
            Club averages
          </button>
          <button
            type="button"
            aria-pressed={trajectoryView === "shots"}
            onClick={() => setTrajectoryView("shots")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 font-medium transition-colors",
              trajectoryView === "shots"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "bg-white text-muted-foreground hover:bg-slate-50",
            )}
          >
            <Eye className="size-3.5" />
            Individual shots
          </button>
          {selectedClub !== "all" ? (
            <button
              type="button"
              onClick={() => setSelectedClub("all")}
              className="inline-flex h-8 items-center gap-2 rounded-lg border bg-white px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[#f3f4f6]"
            >
              Show all clubs
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
          <ChartPanel
            title="Dispersion"
            detail="Primary diagnostic: carry landing by left-right miss."
            empty={!visibleShots.some(hasDispersionData)}
            footer={<DispersionMarkerLegend />}
          >
            <DispersionChart shots={visibleShots} />
          </ChartPanel>
          <ChartPanel
            title="Trajectory"
            detail={
              trajectoryView === "averages"
                ? "Club average ball flights with dynamic apex scale."
                : "Individual shot flights with dynamic apex scale."
            }
            empty={!visibleShots.some(hasTrajectoryData)}
            footer={<TrajectoryInsightCards shots={visibleShots} />}
          >
            <TrajectoryChart shots={visibleShots} view={trajectoryView} />
          </ChartPanel>
        </div>
        <ClubLegend clubs={clubGroups} />
      </CardContent>
    </Card>
  );
}

function ChartPanel({
  title,
  detail,
  empty,
  footer,
  children,
}: {
  title: string;
  detail: string;
  empty: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="apple-panel min-w-0 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {empty ? (
        <div className="apple-panel-strong grid min-h-36 place-items-center text-sm text-muted-foreground sm:min-h-[18rem]">
          No chartable shots for the visible clubs.
        </div>
      ) : (
        <div className="grid gap-3">
          <ChartFrame>
            {children}
          </ChartFrame>
          {footer}
        </div>
      )}
    </div>
  );
}

function DispersionMarkerLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <MarkerLegendItem marker="1" label="Average landing" tone="slate" />
      <MarkerLegendItem marker="2" label="Worst miss" tone="pink" />
      <MarkerLegendItem marker="3" label="Best shot" tone="green" />
    </div>
  );
}

function MarkerLegendItem({
  marker,
  label,
  tone,
}: {
  marker: string;
  label: string;
  tone: "green" | "pink" | "slate";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1">
      <span className={cn(
        "grid size-4 place-items-center rounded-full text-[10px] font-bold text-white",
        tone === "green" ? "bg-emerald-600" : tone === "pink" ? "bg-pink-600" : "bg-slate-800",
      )}>
        {marker}
      </span>
      {label}
    </span>
  );
}

function TrajectoryInsightCards({ shots }: { shots: ChartPoint[] }) {
  const points = shots.filter(hasTrajectoryData);
  const apexes = points.map((shot) => shot.apexFt ?? fallbackApex(shot)).filter(isNumber);
  const carries = points.map((shot) => shot.carryYd ?? shot.totalYd).filter(isNumber);
  const averageApex = meanNumber(apexes);
  const highestApex = max(apexes);
  const longest = [...points]
    .filter((shot) => isNumber(shot.carryYd) || isNumber(shot.totalYd))
    .sort((left, right) => (right.carryYd ?? right.totalYd ?? 0) - (left.carryYd ?? left.totalYd ?? 0))[0];
  const penetrating = [...points]
    .filter((shot) => isNumber(shot.apexFt ?? fallbackApex(shot)))
    .sort(
      (left, right) =>
        (left.apexFt ?? fallbackApex(left) ?? 999) -
          (right.apexFt ?? fallbackApex(right) ?? 999) ||
        (right.carryYd ?? right.totalYd ?? 0) -
          (left.carryYd ?? left.totalYd ?? 0),
    )[0];

  if (points.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <TrajectoryInsight label="Avg apex" value={formatFeet(averageApex)} />
      <TrajectoryInsight label="Highest" value={formatFeet(highestApex || null)} />
      <TrajectoryInsight label="Longest carry" value={formatNullable(longest?.carryYd ?? longest?.totalYd ?? null)} />
      <TrajectoryInsight label="Most penetrating" value={penetrating ? compactShotLabel(penetrating) : "--"} />
      {carries.length > 0 ? (
        <p className="col-span-2 text-[11px] text-muted-foreground">
          Axis max: {formatFeet(niceTrajectoryMax(highestApex || 0))}
        </p>
      ) : null}
    </div>
  );
}

function TrajectoryInsight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ClubLegend({ clubs }: { clubs: ClubChartGroup[] }) {
  if (clubs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs text-muted-foreground">
      {clubs.map((club) => (
        <span key={club.clubType} className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: club.color }}
            aria-hidden
          />
          {club.clubLabel}
        </span>
      ))}
    </div>
  );
}

function DispersionChart({ shots }: { shots: ChartPoint[] }) {
  const points = shots.filter(hasDispersionData);
  const maxCarry = niceMax(max(points.map((shot) => shot.carryYd ?? shot.totalYd ?? 0)), 25);
  const maxSide = Math.max(20, niceMax(max(points.map((shot) => Math.abs(shot.sideCarryYd ?? 0))), 10));
  const centerZone = Math.min(10, maxSide);
  const yTicks = ticks(maxCarry, 4);
  const xTicks = [-maxSide, -maxSide / 2, 0, maxSide / 2, maxSide];
  const xScale = (value: number) => padding.left + ((value + maxSide) / (maxSide * 2)) * plotWidth;
  const yScale = (value: number) => padding.top + plotHeight - (value / maxCarry) * plotHeight;
  const averageSide = meanNumber(points.map((shot) => shot.sideCarryYd ?? null));
  const averageCarry = meanNumber(points.map((shot) => shot.carryYd ?? shot.totalYd ?? null));
  const clubAverages = averageDispersionPoints(points);
  const bestShot = bestDispersionShot(points);
  const worstShot = worstDispersionShot(points);

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Dispersion chart"
    >
      <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="white" />
      <rect
        x={xScale(-centerZone)}
        y={padding.top}
        width={xScale(centerZone) - xScale(-centerZone)}
        height={plotHeight}
        fill="#ecfdf5"
        opacity={0.72}
      />
      <text x={xScale(-maxSide * 0.72)} y={padding.top + 16} textAnchor="middle" className="fill-slate-500 text-[11px]">
        left miss
      </text>
      <text x={xScale(maxSide * 0.72)} y={padding.top + 16} textAnchor="middle" className="fill-slate-500 text-[11px]">
        right miss
      </text>
      <text x={xScale(0)} y={padding.top + 14} textAnchor="middle" className="fill-emerald-700 text-[10px] font-semibold uppercase tracking-[0.08em]">
        Target corridor
      </text>
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#e5e7eb"
          />
          <text x={padding.left - 10} y={yScale(tick) + 4} textAnchor="end" className="fill-slate-600 text-[12px]">
            {tick}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={padding.top}
            y2={chartHeight - padding.bottom}
            stroke={tick === 0 ? "#111827" : "#e5e7eb"}
            strokeDasharray={tick === 0 ? undefined : "4 4"}
            opacity={tick === 0 ? 0.5 : 1}
          />
          <text x={xScale(tick)} y={chartHeight - 18} textAnchor="middle" className="fill-slate-600 text-[12px]">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      <text x={padding.left} y={18} className="fill-slate-600 text-[12px]">
        carry yd
      </text>
      <text x={chartWidth / 2} y={chartHeight - 5} textAnchor="middle" className="fill-slate-600 text-[12px]">
        left / right yd
      </text>
      {points.map((shot) => {
        const carry = shot.carryYd ?? shot.totalYd ?? 0;
        const side = shot.sideCarryYd ?? 0;

        return (
          <circle
            key={shot.id}
            data-dispersion-club={shot.clubType}
            cx={xScale(side)}
            cy={yScale(carry)}
            r={4.8}
            fill={shot.color}
            fillOpacity={0.84}
            stroke="white"
            strokeWidth={1.5}
          >
            <title>{shotTitle(shot)}</title>
          </circle>
        );
      })}
      {clubAverages.map((average) => {
        const x = xScale(average.sideYd);
        const y = yScale(average.carryYd);

        return (
          <path
            key={`avg-${average.clubType}`}
            data-dispersion-club={average.clubType}
            d={`M ${x} ${y - 8} L ${x + 8} ${y} L ${x} ${y + 8} L ${x - 8} ${y} Z`}
            fill={average.color}
            stroke="white"
            strokeWidth={1.5}
          >
            <title>{`${average.clubLabel} average: ${formatNullable(average.carryYd)} carry, ${formatSigned(average.sideYd)} side`}</title>
          </path>
        );
      })}
      {bestShot ? (
        <DispersionMarker
          shot={bestShot}
          x={xScale(bestShot.sideCarryYd ?? 0)}
          y={yScale(bestShot.carryYd ?? bestShot.totalYd ?? 0)}
          label="Best shot"
          marker="3"
          tone="green"
        />
      ) : null}
      {worstShot && worstShot.id !== bestShot?.id ? (
        <DispersionMarker
          shot={worstShot}
          x={xScale(worstShot.sideCarryYd ?? 0)}
          y={yScale(worstShot.carryYd ?? worstShot.totalYd ?? 0)}
          label="Worst miss"
          marker="2"
          tone="pink"
        />
      ) : null}
      {isNumber(averageSide) && isNumber(averageCarry) ? (
        <g>
          <circle
            cx={xScale(averageSide)}
            cy={yScale(averageCarry)}
            r={9}
            fill="none"
            stroke="#0f172a"
            strokeWidth={2}
          />
          <line
            x1={xScale(averageSide) - 13}
            x2={xScale(averageSide) + 13}
            y1={yScale(averageCarry)}
            y2={yScale(averageCarry)}
            stroke="#0f172a"
            strokeWidth={2}
          />
          <line
            x1={xScale(averageSide)}
            x2={xScale(averageSide)}
            y1={yScale(averageCarry) - 13}
            y2={yScale(averageCarry) + 13}
            stroke="#0f172a"
            strokeWidth={2}
          />
          <circle
            cx={xScale(averageSide) + 15}
            cy={yScale(averageCarry) - 15}
            r={9}
            fill="#0f172a"
            stroke="white"
            strokeWidth={1.5}
          />
          <text
            x={xScale(averageSide) + 15}
            y={yScale(averageCarry) - 11}
            textAnchor="middle"
            className="fill-white text-[10px] font-bold"
          >
            1
          </text>
          <title>{`Average miss: ${formatNullable(averageCarry)} carry, ${formatSigned(averageSide)} side`}</title>
        </g>
      ) : null}
    </svg>
  );
}

function DispersionMarker({
  shot,
  x,
  y,
  label,
  marker,
  tone,
}: {
  shot: ChartPoint;
  x: number;
  y: number;
  label: string;
  marker: string;
  tone: "green" | "pink";
}) {
  const color = tone === "green" ? "#059669" : "#db2777";

  return (
    <g data-dispersion-club={shot.clubType}>
      <circle
        cx={x}
        cy={y}
        r={10}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
      />
      <circle cx={x} cy={y} r={3.4} fill={color} />
      <circle
        cx={x + 14}
        cy={y - 14}
        r={9}
        fill={color}
        stroke="white"
        strokeWidth={1.5}
      />
      <text
        x={x + 14}
        y={y - 10}
        textAnchor="middle"
        className="fill-white text-[10px] font-bold"
      >
        {marker}
      </text>
      <title>{`${label}: ${shotTitle(shot)}`}</title>
    </g>
  );
}

function TrajectoryChart({
  shots,
  view,
}: {
  shots: ChartPoint[];
  view: TrajectoryView;
}) {
  const points = shots.filter(hasTrajectoryData);
  const maxCarry = niceMax(max(points.map((shot) => shot.carryYd ?? shot.totalYd ?? 0)), 25);
  const maxApex = niceTrajectoryMax(max(points.map((shot) => shot.apexFt ?? fallbackApex(shot) ?? 0)));
  const yTicks = ticks(maxApex, 4);
  const xTicks = ticks(maxCarry, 5);
  const xScale = (value: number) => padding.left + (value / maxCarry) * plotWidth;
  const yScale = (value: number) => padding.top + plotHeight - (value / maxApex) * plotHeight;
  const averageTrajectories = averageTrajectoryPoints(points);

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Trajectory chart"
    >
      <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="white" />
      {yTicks.map((tick) => (
        <g key={`apex-${tick}`}>
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#e5e7eb"
          />
          <text x={padding.left - 10} y={yScale(tick) + 4} textAnchor="end" className="fill-slate-600 text-[12px]">
            {tick}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`carry-${tick}`}>
          <line
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={padding.top}
            y2={chartHeight - padding.bottom}
            stroke="#eef2f7"
          />
          <text x={xScale(tick)} y={chartHeight - 18} textAnchor="middle" className="fill-slate-600 text-[12px]">
            {tick}
          </text>
        </g>
      ))}
      <line
        x1={padding.left}
        x2={chartWidth - padding.right}
        y1={yScale(0)}
        y2={yScale(0)}
        stroke="#111827"
        opacity={0.55}
      />
      <text x={padding.left} y={18} className="fill-slate-600 text-[12px]">
        apex ft
      </text>
      <text x={chartWidth / 2} y={chartHeight - 5} textAnchor="middle" className="fill-slate-600 text-[12px]">
        carry yd
      </text>
      {points.map((shot) => {
        const carry = shot.carryYd ?? shot.totalYd ?? 0;
        const apex = shot.apexFt ?? fallbackApex(shot) ?? 0;
        const startX = xScale(0);
        const startY = yScale(0);
        const endX = xScale(carry);
        const endY = yScale(0);
        const controlX = xScale(carry / 2);
        const controlY = yScale(apex);

        return (
          <path
            key={shot.id}
            data-chart-club={shot.clubType}
            d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
            fill="none"
            stroke={shot.color}
            strokeWidth={view === "averages" ? 1.25 : 1.8}
            strokeOpacity={view === "averages" ? 0.16 : 0.34}
            strokeLinecap="round"
          >
            <title>{shotTitle(shot)}</title>
          </path>
        );
      })}
      {view === "averages"
        ? averageTrajectories.map((trajectory) => {
            const startX = xScale(0);
            const startY = yScale(0);
            const endX = xScale(trajectory.carryYd);
            const endY = yScale(0);
            const controlX = xScale(trajectory.carryYd / 2);
            const controlY = yScale(trajectory.apexFt);

            return (
              <g key={`trajectory-${trajectory.clubType}`}>
                <path
                  data-chart-club={trajectory.clubType}
                  d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
                  fill="none"
                  stroke={trajectory.color}
                  strokeWidth={4}
                  strokeOpacity={0.88}
                  strokeLinecap="round"
                >
                  <title>{`${trajectory.clubLabel} average (${trajectory.shotCount} shots): ${formatNullable(trajectory.carryYd)} carry, ${formatFeet(trajectory.apexFt)} apex`}</title>
                </path>
                <circle
                  cx={endX}
                  cy={endY}
                  r={4}
                  fill={trajectory.color}
                  stroke="white"
                  strokeWidth={1.5}
                />
              </g>
            );
          })
        : null}
    </svg>
  );
}

function averageDispersionPoints(points: ChartPoint[]): AverageDispersion[] {
  const groups = new Map<
    string,
    {
      clubLabel: string;
      color: string;
      sides: number[];
      carries: number[];
    }
  >();

  for (const point of points) {
    const carry = point.carryYd ?? point.totalYd;

    if (!isNumber(point.sideCarryYd) || !isNumber(carry)) {
      continue;
    }

    const group = groups.get(point.clubType) ?? {
      clubLabel: point.clubLabel,
      color: point.color,
      sides: [],
      carries: [],
    };
    group.sides.push(point.sideCarryYd);
    group.carries.push(carry);
    groups.set(point.clubType, group);
  }

  return [...groups.entries()]
    .map(([clubType, group]) => ({
      clubType,
      clubLabel: group.clubLabel,
      color: group.color,
      sideYd: meanArray(group.sides),
      carryYd: meanArray(group.carries),
    }))
    .sort((left, right) => sortClub(left.clubType) - sortClub(right.clubType));
}

function averageTrajectoryPoints(points: ChartPoint[]): AverageTrajectory[] {
  const groups = new Map<
    string,
    {
      clubLabel: string;
      color: string;
      carries: number[];
      apexes: number[];
    }
  >();

  for (const point of points) {
    const carry = point.carryYd ?? point.totalYd;
    const apex = point.apexFt ?? fallbackApex(point);

    if (!isNumber(carry) || !isNumber(apex)) {
      continue;
    }

    const group = groups.get(point.clubType) ?? {
      clubLabel: point.clubLabel,
      color: point.color,
      carries: [],
      apexes: [],
    };
    group.carries.push(carry);
    group.apexes.push(apex);
    groups.set(point.clubType, group);
  }

  return [...groups.entries()]
    .map(([clubType, group]) => ({
      clubType,
      clubLabel: group.clubLabel,
      color: group.color,
      shotCount: group.carries.length,
      carryYd: meanArray(group.carries),
      apexFt: meanArray(group.apexes),
    }))
    .sort((left, right) => sortClub(left.clubType) - sortClub(right.clubType));
}

function bestDispersionShot(points: ChartPoint[]) {
  return [...points]
    .filter(hasDispersionData)
    .sort(
      (left, right) =>
        Math.abs(left.sideCarryYd ?? 999) -
          Math.abs(right.sideCarryYd ?? 999) ||
        (right.carryYd ?? right.totalYd ?? 0) -
          (left.carryYd ?? left.totalYd ?? 0),
    )[0] ?? null;
}

function worstDispersionShot(points: ChartPoint[]) {
  return [...points]
    .filter(hasDispersionData)
    .sort(
      (left, right) =>
        Math.abs(right.sideCarryYd ?? 0) -
          Math.abs(left.sideCarryYd ?? 0) ||
        (right.carryYd ?? right.totalYd ?? 0) -
          (left.carryYd ?? left.totalYd ?? 0),
    )[0] ?? null;
}

function buildClubGroups(shots: TodayChartShot[]): ClubChartGroup[] {
  const groups = new Map<string, ClubChartGroup>();

  for (const shot of shots) {
    const current = groups.get(shot.clubType) ?? {
      clubType: shot.clubType,
      clubLabel: shot.clubLabel,
      color: colorForClub(shot.clubType),
      shotCount: 0,
    };
    current.shotCount += 1;
    groups.set(shot.clubType, current);
  }

  return [...groups.values()].sort((left, right) => sortClub(left.clubType) - sortClub(right.clubType));
}

function colorForClub(clubType: string) {
  return clubColors[clubType] ?? fallbackColors[Math.abs(hashText(clubType)) % fallbackColors.length];
}

function sortClub(clubType: string) {
  if (clubType === "driver") return 10;

  const wood = clubType.match(/^([1-9])w$/);
  if (wood) return 20 + Number(wood[1]);

  const hybrid = clubType.match(/^([1-9])h$/);
  if (hybrid) return 35 + Number(hybrid[1]);

  const iron = clubType.match(/^([1-9])i$/);
  if (iron) return 50 + Number(iron[1]);

  const wedgeOrder: Record<string, number> = {
    pw: 90,
    gw: 91,
    aw: 92,
    sw: 93,
    lw: 94,
  };

  return wedgeOrder[clubType] ?? 120;
}

function hasDispersionData(shot: TodayChartShot) {
  return isNumber(shot.sideCarryYd) && (isNumber(shot.carryYd) || isNumber(shot.totalYd));
}

function hasTrajectoryData(shot: TodayChartShot) {
  return (isNumber(shot.carryYd) || isNumber(shot.totalYd)) && (isNumber(shot.apexFt) || isNumber(shot.launchAngleDeg));
}

function fallbackApex(shot: TodayChartShot) {
  if (!isNumber(shot.launchAngleDeg) || !isNumber(shot.carryYd)) {
    return null;
  }

  return Math.max(8, Math.tan((shot.launchAngleDeg * Math.PI) / 180) * shot.carryYd * 3 * 0.18);
}

function shotTitle(shot: TodayChartShot) {
  const shotNumber = shot.shotNumber ? ` #${shot.shotNumber}` : "";
  return `${shot.clubLabel}${shotNumber}: ${formatNullable(shot.carryYd)} carry, ${formatSigned(shot.sideCarryYd)} side`;
}

function compactShotLabel(shot: TodayChartShot) {
  return `${shot.clubLabel}${shot.shotNumber ? ` #${shot.shotNumber}` : ""}`;
}

function max(values: number[]) {
  return values.reduce((current, value) => Math.max(current, value), 0);
}

function meanNumber(values: Array<number | null | undefined>) {
  const numbers = values.filter(isNumber);
  return numbers.length > 0 ? meanArray(numbers) : null;
}

function meanArray(values: number[]) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function niceMax(value: number, step: number) {
  return Math.max(step, Math.ceil(value / step) * step);
}

function niceTrajectoryMax(value: number) {
  return Math.min(150, Math.max(60, niceMax(value + 10, 10)));
}

function ticks(maxValue: number, count: number) {
  const step = niceMax(maxValue / count, 10);
  const values: number[] = [];

  for (let value = 0; value <= maxValue; value += step) {
    values.push(value);
  }

  if (values[values.length - 1] !== maxValue) {
    values.push(maxValue);
  }

  return [...new Set(values)];
}

function formatTick(value: number) {
  if (value === 0) return "0";
  return value > 0 ? `+${numberFormatter.format(value)}` : numberFormatter.format(value);
}

function formatNullable(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatFeet(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} ft`;
}

function formatSigned(value: number | null) {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)} yd`;
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return hash;
}

function verdictLabel(verdict: TodayChartClubStatus["verdict"]) {
  if (verdict === "better") return "Better";
  if (verdict === "worse") return "Worse";
  if (verdict === "mixed") return "Mixed";
  return "New";
}

function statusPillClass(verdict: TodayChartClubStatus["verdict"]) {
  if (verdict === "better") return "bg-emerald-50 text-emerald-700";
  if (verdict === "worse") return "bg-pink-50 text-pink-700";
  if (verdict === "mixed") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
