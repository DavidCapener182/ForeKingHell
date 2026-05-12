"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
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

type ChartPoint = TodayChartShot & {
  color: string;
};

const chartWidth = 760;
const chartHeight = 420;
const padding = {
  top: 24,
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

export function TodayShotCharts({ shots }: { shots: TodayChartShot[] }) {
  const clubGroups = useMemo(() => buildClubGroups(shots), [shots]);
  const [hiddenClubs, setHiddenClubs] = useState<Set<string>>(() => new Set());
  const visibleShots = useMemo(
    () =>
      shots
        .filter((shot) => !hiddenClubs.has(shot.clubType))
        .map((shot) => ({
          ...shot,
          color: colorForClub(shot.clubType),
        })),
    [hiddenClubs, shots],
  );
  const visibleClubCount = clubGroups.filter((club) => !hiddenClubs.has(club.clubType)).length;

  function toggleClub(clubType: string) {
    setHiddenClubs((current) => {
      const next = new Set(current);

      if (next.has(clubType)) {
        next.delete(clubType);
      } else {
        next.add(clubType);
      }

      return next;
    });
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Shot patterns</CardTitle>
            <CardDescription>Dispersion and trajectory from selected shots.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{visibleShots.length} shots</span>
            <span>/</span>
            <span>{visibleClubCount} clubs</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {clubGroups.map((club) => {
            const hidden = hiddenClubs.has(club.clubType);

            return (
              <button
                key={club.clubType}
                type="button"
                aria-pressed={!hidden}
                onClick={() => toggleClub(club.clubType)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition-colors",
                  hidden ? "bg-white text-muted-foreground opacity-55" : "bg-slate-50/90 text-foreground",
                )}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: club.color }}
                  aria-hidden
                />
                {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                <span>{club.clubLabel}</span>
                <span className="text-xs text-muted-foreground">{club.shotCount}</span>
              </button>
            );
          })}
          {hiddenClubs.size > 0 ? (
            <button
              type="button"
              onClick={() => setHiddenClubs(new Set())}
              className="inline-flex h-8 items-center gap-2 rounded-lg border bg-white px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-[#f3f4f6]"
            >
              <RotateCcw className="size-3.5" />
              Show all
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel
            title="Dispersion"
            detail="Carry landing by side-carry miss."
            empty={!visibleShots.some(hasDispersionData)}
          >
            <DispersionChart shots={visibleShots} />
          </ChartPanel>
          <ChartPanel
            title="Trajectory"
            detail="Side profile using carry distance and apex."
            empty={!visibleShots.some(hasTrajectoryData)}
          >
            <TrajectoryChart shots={visibleShots} />
          </ChartPanel>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartPanel({
  title,
  detail,
  empty,
  children,
}: {
  title: string;
  detail: string;
  empty: boolean;
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
        <div className="apple-panel-strong grid min-h-[18rem] place-items-center text-sm text-muted-foreground">
          No chartable shots for the visible clubs.
        </div>
      ) : (
        <ChartFrame>
          {children}
        </ChartFrame>
      )}
    </div>
  );
}

function DispersionChart({ shots }: { shots: ChartPoint[] }) {
  const points = shots.filter(hasDispersionData);
  const maxCarry = niceMax(max(points.map((shot) => shot.carryYd ?? shot.totalYd ?? 0)), 25);
  const maxSide = Math.max(20, niceMax(max(points.map((shot) => Math.abs(shot.sideCarryYd ?? 0))), 10));
  const yTicks = ticks(maxCarry, 4);
  const xTicks = [-maxSide, -maxSide / 2, 0, maxSide / 2, maxSide];
  const xScale = (value: number) => padding.left + ((value + maxSide) / (maxSide * 2)) * plotWidth;
  const yScale = (value: number) => padding.top + plotHeight - (value / maxCarry) * plotHeight;

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Dispersion chart"
    >
      <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="white" />
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#e5e7eb"
          />
          <text x={padding.left - 10} y={yScale(tick) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
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
          <text x={xScale(tick)} y={chartHeight - 18} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      <text x={padding.left} y={18} className="fill-slate-500 text-[11px]">
        carry yd
      </text>
      <text x={chartWidth / 2} y={chartHeight - 5} textAnchor="middle" className="fill-slate-500 text-[11px]">
        left / right yd
      </text>
      {points.map((shot) => {
        const carry = shot.carryYd ?? shot.totalYd ?? 0;
        const side = shot.sideCarryYd ?? 0;

        return (
          <circle
            key={shot.id}
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
    </svg>
  );
}

function TrajectoryChart({ shots }: { shots: ChartPoint[] }) {
  const points = shots.filter(hasTrajectoryData);
  const maxCarry = niceMax(max(points.map((shot) => shot.carryYd ?? shot.totalYd ?? 0)), 25);
  const maxApex = niceMax(max(points.map((shot) => shot.apexFt ?? fallbackApex(shot) ?? 0)), 25);
  const yTicks = ticks(maxApex, 4);
  const xTicks = ticks(maxCarry, 5);
  const xScale = (value: number) => padding.left + (value / maxCarry) * plotWidth;
  const yScale = (value: number) => padding.top + plotHeight - (value / maxApex) * plotHeight;

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
          <text x={padding.left - 10} y={yScale(tick) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
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
          <text x={xScale(tick)} y={chartHeight - 18} textAnchor="middle" className="fill-slate-500 text-[11px]">
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
      <text x={padding.left} y={18} className="fill-slate-500 text-[11px]">
        apex ft
      </text>
      <text x={chartWidth / 2} y={chartHeight - 5} textAnchor="middle" className="fill-slate-500 text-[11px]">
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
            d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
            fill="none"
            stroke={shot.color}
            strokeWidth={2}
            strokeOpacity={0.42}
          >
            <title>{shotTitle(shot)}</title>
          </path>
        );
      })}
    </svg>
  );
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

function max(values: number[]) {
  return values.reduce((current, value) => Math.max(current, value), 0);
}

function niceMax(value: number, step: number) {
  return Math.max(step, Math.ceil(value / step) * step);
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

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
