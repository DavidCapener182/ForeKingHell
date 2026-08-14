"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  defaultShotPatternClub,
  filterShotPatternPoints,
  shotPatternClubs,
  shotPatternConfidence,
  summarizeShotPattern,
  type ShotPatternPoint,
} from "@/lib/shot-pattern-chart-data";
import { cn } from "@/lib/utils";

type ChartMode = "dispersion" | "flight";
type FlightMode = "shots" | "average";

const SharedShotPatternVisual = dynamic(
  () => import("@/app/today/today-shot-charts").then((module) => module.SharedShotPatternVisual),
  {
    loading: () => (
      <Skeleton
        className="aspect-[82/43] w-full rounded-xl"
        aria-label="Drawing measured shot pattern"
      />
    ),
  },
);

export function MobileShotPatternCharts({
  points,
  preferredClub,
  compact = false,
  layout = "mobile",
}: {
  points: ShotPatternPoint[];
  preferredClub?: string | null;
  compact?: boolean;
  layout?: "mobile" | "desktop";
}) {
  const clubs = useMemo(() => shotPatternClubs(points), [points]);
  const [mode, setMode] = useState<ChartMode>("dispersion");
  const [flightMode, setFlightMode] = useState<FlightMode>("shots");
  const [club, setClub] = useState(() => defaultShotPatternClub(clubs, preferredClub));
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [selectedShot, setSelectedShot] = useState<ShotPatternPoint | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selected = useMemo(
    () => filterShotPatternPoints({ points, club, trustedOnly }),
    [club, points, trustedOnly],
  );
  const trustedSelection = useMemo(
    () => filterShotPatternPoints({ points, club, trustedOnly: true }),
    [club, points],
  );
  const hasFlight = selected.some((point) => point.carryYd !== null && point.apexFt !== null);
  const summary = useMemo(() => summarizeShotPattern(selected), [selected]);
  const confidence = useMemo(() => shotPatternConfidence(selected), [selected]);

  if (clubs.length === 0) {
    return (
      <AppEmptyState
        title="No measured landing data"
        description="Import a measured session with carry and lateral coordinates to unlock the shot pattern."
        primaryAction={
          <Button asChild size="sm">
            <Link href="/import">Import a session</Link>
          </Button>
        }
      />
    );
  }

  return (
    <section
      className={cn("grid min-w-0 overflow-hidden", layout === "desktop" ? "gap-4" : "gap-3")}
      data-mobile-shot-pattern
      data-chart-layout={layout}
      data-mobile-shot-pattern-hydrated={hydrated ? "true" : "false"}
    >
      {!compact ? (
        <Tabs value={mode} onValueChange={(value) => setMode(value as ChartMode)}>
          <TabsList className="grid w-full grid-cols-2" aria-label="Shot pattern view">
            <TabsTrigger value="dispersion">Dispersion</TabsTrigger>
            <TabsTrigger value="flight" disabled={!hasFlight}>
              Flight
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}
      {!compact && !hasFlight ? (
        <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Flight is unavailable because this session has no measured apex data.
        </p>
      ) : null}

      {!compact && mode === "flight" && hasFlight ? (
        <ToggleGroup
          type="single"
          value={flightMode}
          onValueChange={(value) => value && setFlightMode(value as FlightMode)}
          variant="outline"
          className="grid w-full grid-cols-2"
          aria-label="Flight detail"
        >
          <ToggleGroupItem value="shots" className="w-full">
            Individual shots
          </ToggleGroupItem>
          <ToggleGroupItem value="average" className="w-full">
            Club average
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}

      <ToggleGroup
        type="single"
        value={club}
        onValueChange={(value) => value && setClub(value)}
        className="-mx-1 w-auto snap-x justify-start gap-2 overflow-x-auto px-1 pb-1"
        aria-label="Chart club"
      >
        {clubs.map((item) => (
          <ToggleGroupItem
            key={item.type}
            value={item.type}
            variant="outline"
            size="lg"
            className="focus-aaa min-h-11 shrink-0 snap-start rounded-full px-3 text-sm font-semibold"
          >
            {item.label}
          </ToggleGroupItem>
        ))}
        {clubs.length > 1 && !compact ? (
          <ToggleGroupItem
            value="all"
            variant="outline"
            size="lg"
            className="focus-aaa min-h-11 shrink-0 snap-start rounded-full px-3 text-sm font-semibold"
          >
            All clubs
          </ToggleGroupItem>
        ) : null}
      </ToggleGroup>

      {!compact ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {confidence.sampleSize} measured landing points · {confidence.label} confidence
          </p>
          <ToggleGroup
            type="single"
            value={trustedOnly ? "trusted" : "all"}
            onValueChange={(value) => value && setTrustedOnly(value === "trusted")}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Evidence trust"
          >
            <ToggleGroupItem value="trusted">Trusted shots</ToggleGroupItem>
            <ToggleGroupItem value="all">All shots</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ) : null}

      {mode === "dispersion" || compact ? (
        <div
          className={cn(
            "overflow-hidden rounded-xl bg-background",
            compact && "max-h-52",
            layout === "desktop" && "border bg-slate-50/70 p-2 shadow-inner xl:p-4",
          )}
        >
          {layout === "mobile" ? (
            <MobileShotPatternVisual
              points={selected}
              trustedPoints={trustedSelection}
              mode="dispersion"
              onSelect={setSelectedShot}
            />
          ) : (
            <SharedShotPatternVisual shots={selected} mode="dispersion" />
          )}
        </div>
      ) : hasFlight ? (
        <div
          className={cn(
            "overflow-hidden rounded-xl bg-background",
            layout === "desktop" && "border bg-slate-50/70 p-2 shadow-inner xl:p-4",
          )}
        >
          {layout === "mobile" ? (
            <MobileShotPatternVisual
              points={selected}
              trustedPoints={trustedSelection}
              mode="flight"
              flightMode={flightMode}
              onSelect={setSelectedShot}
            />
          ) : (
            <SharedShotPatternVisual
              shots={selected}
              mode="trajectory"
              trajectoryView={flightMode === "average" ? "averages" : "shots"}
            />
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          Flight is unavailable because this session has no measured apex data.
        </p>
      )}

      <p className="text-sm font-medium leading-5" aria-live="polite">
        {patternReadout(summary)}
      </p>

      {!compact && layout === "desktop" ? (
        <AccessibleShotTable points={selected} onSelect={setSelectedShot} />
      ) : null}

      <ShotDetailDrawer
        shot={selectedShot}
        onOpenChange={(open) => !open && setSelectedShot(null)}
      />
    </section>
  );
}

function MobileShotPatternVisual({
  points,
  trustedPoints,
  mode,
  flightMode = "shots",
  onSelect,
}: {
  points: ShotPatternPoint[];
  trustedPoints: ShotPatternPoint[];
  mode: "dispersion" | "flight";
  flightMode?: FlightMode;
  onSelect: (point: ShotPatternPoint) => void;
}) {
  return mode === "dispersion" ? (
    <MobileDispersionVisual points={points} trustedPoints={trustedPoints} onSelect={onSelect} />
  ) : (
    <MobileFlightVisual points={points} flightMode={flightMode} onSelect={onSelect} />
  );
}

function MobileDispersionVisual({
  points,
  trustedPoints,
  onSelect,
}: {
  points: ShotPatternPoint[];
  trustedPoints: ShotPatternPoint[];
  onSelect: (point: ShotPatternPoint) => void;
}) {
  const landing = points.filter(hasLandingPoint);
  const trustedSummary = summarizeShotPattern(trustedPoints);
  const width = 360;
  const height = 420;
  const frame = { top: 28, right: 18, bottom: 48, left: 42 };
  const plotWidth = width - frame.left - frame.right;
  const plotHeight = height - frame.top - frame.bottom;
  const maxCarry = niceCeiling(Math.max(25, ...landing.map((point) => point.carryYd ?? 0)), 25);
  const maxSide = niceCeiling(
    Math.max(20, ...landing.map((point) => Math.abs(point.sideCarryYd ?? 0))),
    10,
  );
  const x = (value: number) => frame.left + ((value + maxSide) / (maxSide * 2)) * plotWidth;
  const y = (value: number) => frame.top + plotHeight - (value / maxCarry) * plotHeight;
  const carryTicks = [0, maxCarry / 4, maxCarry / 2, (maxCarry * 3) / 4, maxCarry];
  const corridor = Math.min(maxSide, trustedSummary.corridorYd || 10);
  const hasTrustedZone =
    trustedSummary.sampleSize >= 4 &&
    trustedSummary.sideLowYd !== null &&
    trustedSummary.sideHighYd !== null &&
    trustedSummary.carryLowYd !== null &&
    trustedSummary.carryHighYd !== null;

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-slate-50 shadow-inner"
      data-mobile-dispersion-layout
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        role="img"
        aria-label="Mobile dispersion chart. Tap any shot to inspect its measurements."
      >
        <rect width={width} height={height} fill="#f8fafc" />
        <rect
          x={x(-corridor)}
          y={frame.top}
          width={x(corridor) - x(-corridor)}
          height={plotHeight}
          fill="#dcfce7"
          opacity={0.72}
        />
        {hasTrustedZone ? (
          <rect
            x={x(trustedSummary.sideLowYd!)}
            y={y(trustedSummary.carryHighYd!)}
            width={Math.max(4, x(trustedSummary.sideHighYd!) - x(trustedSummary.sideLowYd!))}
            height={Math.max(4, y(trustedSummary.carryLowYd!) - y(trustedSummary.carryHighYd!))}
            rx={12}
            fill="#0f766e"
            fillOpacity={0.1}
            stroke="#0f766e"
            strokeDasharray="6 5"
            strokeWidth={1.5}
          />
        ) : null}
        {carryTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={frame.left}
              x2={width - frame.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#cbd5e1"
              strokeDasharray={tick === 0 ? undefined : "3 5"}
            />
            <text
              x={frame.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-slate-500 text-[11px]"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <line
          x1={x(0)}
          x2={x(0)}
          y1={frame.top}
          y2={height - frame.bottom}
          stroke="#0f172a"
          strokeWidth={1.75}
        />
        <text
          x={x(0)}
          y={frame.top - 9}
          textAnchor="middle"
          className="fill-slate-700 text-[10px] font-semibold uppercase tracking-[0.08em]"
        >
          target line
        </text>
        <text x={frame.left} y={15} className="fill-slate-500 text-[10px] font-medium">
          carry yd
        </text>
        <text x={frame.left} y={height - 16} className="fill-slate-500 text-[11px]">
          {maxSide} L
        </text>
        <text
          x={width - frame.right}
          y={height - 16}
          textAnchor="end"
          className="fill-slate-500 text-[11px]"
        >
          {maxSide} R
        </text>
        {landing.map((point) => (
          <circle
            key={point.id}
            cx={x(point.sideCarryYd ?? 0)}
            cy={y(point.carryYd ?? 0)}
            r={6.5}
            fill={mobileClubColor(point.clubType)}
            fillOpacity={point.trusted ? 0.88 : 0.38}
            stroke="white"
            strokeWidth={2}
            role="button"
            tabIndex={0}
            aria-label={`${point.clubLabel} shot ${point.shotNumber ?? "detail"}`}
            className="cursor-pointer outline-none focus-visible:stroke-slate-950 focus-visible:stroke-[4px]"
            onClick={() => onSelect(point)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(point);
            }}
          >
            <title>{`${point.clubLabel}: ${formatMeasure(point.carryYd, "yd")} carry, ${formatSigned(point.sideCarryYd)}`}</title>
          </circle>
        ))}
        {trustedSummary.medianSideYd !== null && trustedSummary.medianCarryYd !== null ? (
          <g aria-label="Median landing">
            <circle
              cx={x(trustedSummary.medianSideYd)}
              cy={y(trustedSummary.medianCarryYd)}
              r={10}
              fill="#0f172a"
              stroke="white"
              strokeWidth={2}
            />
            <text
              x={x(trustedSummary.medianSideYd)}
              y={y(trustedSummary.medianCarryYd) + 3.5}
              textAnchor="middle"
              className="fill-white text-[9px] font-bold"
            >
              M
            </text>
          </g>
        ) : null}
      </svg>
      <div className="grid grid-cols-3 border-t bg-white text-[10px] font-medium text-slate-600">
        <ChartKey tone="bg-emerald-100 ring-emerald-300" label="Playable corridor" />
        <ChartKey tone="border border-dashed border-teal-700 bg-teal-50" label="Trusted zone" />
        <ChartKey tone="bg-slate-900 text-white" label="M median" />
      </div>
    </div>
  );
}

function MobileFlightVisual({
  points,
  flightMode,
  onSelect,
}: {
  points: ShotPatternPoint[];
  flightMode: FlightMode;
  onSelect: (point: ShotPatternPoint) => void;
}) {
  const flight = points.filter(hasFlightPoint);
  const visible = flightMode === "average" ? averageFlightPoints(flight) : flight;
  const width = 360;
  const height = 300;
  const frame = { top: 24, right: 16, bottom: 42, left: 42 };
  const plotWidth = width - frame.left - frame.right;
  const plotHeight = height - frame.top - frame.bottom;
  const maxCarry = niceCeiling(Math.max(25, ...visible.map((point) => point.carryYd ?? 0)), 25);
  const maxApex = niceCeiling(Math.max(30, ...visible.map((point) => point.apexFt ?? 0)), 20);
  const x = (value: number) => frame.left + (value / maxCarry) * plotWidth;
  const y = (value: number) => frame.top + plotHeight - (value / maxApex) * plotHeight;

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-slate-50 shadow-inner"
      data-mobile-flight-layout
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        role="img"
        aria-label="Mobile flight chart"
      >
        <rect width={width} height={height} fill="#f8fafc" />
        {[0, maxApex / 2, maxApex].map((tick) => (
          <g key={tick}>
            <line
              x1={frame.left}
              x2={width - frame.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#cbd5e1"
              strokeDasharray={tick === 0 ? undefined : "3 5"}
            />
            <text
              x={frame.left - 7}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-slate-500 text-[10px]"
            >
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <text x={frame.left} y={14} className="fill-slate-500 text-[10px] font-medium">
          apex ft
        </text>
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          className="fill-slate-500 text-[10px] font-medium"
        >
          carry yd
        </text>
        {visible.map((point) => {
          const carry = point.carryYd ?? 0;
          const apex = point.apexFt ?? 0;
          return (
            <g key={point.id}>
              <path
                d={`M ${x(0)} ${y(0)} Q ${x(carry / 2)} ${y(apex)} ${x(carry)} ${y(0)}`}
                fill="none"
                stroke={mobileClubColor(point.clubType)}
                strokeWidth={flightMode === "average" ? 4 : 2}
                strokeOpacity={flightMode === "average" ? 0.88 : 0.42}
                strokeLinecap="round"
              />
              <circle
                cx={x(carry)}
                cy={y(0)}
                r={flightMode === "average" ? 6 : 5}
                fill={mobileClubColor(point.clubType)}
                stroke="white"
                strokeWidth={2}
                role="button"
                tabIndex={0}
                className="cursor-pointer outline-none focus-visible:stroke-slate-950 focus-visible:stroke-[4px]"
                aria-label={`${point.clubLabel} flight ${formatMeasure(point.carryYd, "yd")}`}
                onClick={() => onSelect(point)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelect(point);
                }}
              />
            </g>
          );
        })}
        <text x={frame.left} y={height - 25} className="fill-slate-500 text-[10px]">
          0
        </text>
        <text
          x={width - frame.right}
          y={height - 25}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          {maxCarry}
        </text>
      </svg>
    </div>
  );
}

function ChartKey({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex min-w-0 items-center justify-center gap-1.5 px-1.5 py-2">
      <span className={cn("size-2.5 shrink-0 rounded-full ring-1", tone)} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function hasLandingPoint(
  point: ShotPatternPoint,
): point is ShotPatternPoint & { carryYd: number; sideCarryYd: number } {
  return point.carryYd !== null && point.sideCarryYd !== null;
}

function hasFlightPoint(
  point: ShotPatternPoint,
): point is ShotPatternPoint & { carryYd: number; apexFt: number } {
  return point.carryYd !== null && point.apexFt !== null;
}

function averageFlightPoints(points: ShotPatternPoint[]) {
  const grouped = new Map<string, ShotPatternPoint[]>();
  for (const point of points) {
    grouped.set(point.clubType, [...(grouped.get(point.clubType) ?? []), point]);
  }
  return [...grouped.values()].map((clubPoints) => {
    const first = clubPoints[0]!;
    return {
      ...first,
      id: `average-${first.clubType}`,
      shotNumber: null,
      carryYd: mean(clubPoints.map((point) => point.carryYd)),
      apexFt: mean(clubPoints.map((point) => point.apexFt)),
    };
  });
}

function mean(values: Array<number | null>) {
  const measured = values.filter((value): value is number => value !== null);
  return measured.length
    ? measured.reduce((total, value) => total + value, 0) / measured.length
    : null;
}

function niceCeiling(value: number, step: number) {
  return Math.max(step, Math.ceil(value / step) * step);
}

function mobileClubColor(clubType: string) {
  const colors: Record<string, string> = {
    driver: "#2563eb",
    "3w": "#7c3aed",
    "5w": "#a21caf",
    "4h": "#0891b2",
    "5h": "#0f766e",
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
  return colors[clubType] ?? "#334155";
}

function AccessibleShotTable({
  points,
  onSelect,
}: {
  points: ShotPatternPoint[];
  onSelect: (point: ShotPatternPoint) => void;
}) {
  return (
    <Collapsible className="rounded-xl border bg-card px-3 py-2">
      <CollapsibleTrigger className="focus-aaa min-h-11 w-full cursor-pointer py-3 text-left text-sm font-semibold outline-none">
        Accessible shot data ({points.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-72 overflow-auto pb-2">
          <Table className="min-w-[34rem] text-xs">
            <caption className="sr-only">Measured shot data used by this chart</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Shot</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Carry</TableHead>
                <TableHead>Lateral</TableHead>
                <TableHead>Apex</TableHead>
                <TableHead>Trust</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point, index) => (
                <TableRow key={point.id}>
                  <TableCell>{point.shotNumber ?? index + 1}</TableCell>
                  <TableCell>{point.clubLabel}</TableCell>
                  <TableCell>{formatMeasure(point.carryYd, "yd")}</TableCell>
                  <TableCell>{formatSigned(point.sideCarryYd)}</TableCell>
                  <TableCell>{formatMeasure(point.apexFt, "ft")}</TableCell>
                  <TableCell>{point.trusted ? "Trusted" : "Unusual"}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(point)}>
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ShotDetailDrawer({
  shot,
  onOpenChange,
}: {
  shot: ShotPatternPoint | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={Boolean(shot)} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="pb-[env(safe-area-inset-bottom)]" data-shot-detail-drawer>
        <DrawerHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <span>
              <DrawerTitle>
                {shot ? `${shot.clubLabel} · shot ${shot.shotNumber ?? "detail"}` : "Shot detail"}
              </DrawerTitle>
              <DrawerDescription>Measured values used by this session chart.</DrawerDescription>
            </span>
            {shot ? (
              <Badge variant={shot.trusted ? "secondary" : "outline"}>
                {shot.trusted ? "Trusted" : "Unusual"}
              </Badge>
            ) : null}
          </div>
        </DrawerHeader>
        {shot ? (
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <ShotMetric label="Carry" value={formatMeasure(shot.carryYd, "yd")} />
            <ShotMetric label="Total" value={formatMeasure(shot.totalYd ?? null, "yd")} />
            <ShotMetric label="Lateral" value={formatSigned(shot.sideCarryYd)} />
            <ShotMetric label="Apex" value={formatMeasure(shot.apexFt, "ft")} />
            <ShotMetric label="Launch" value={formatMeasure(shot.launchAngleDeg, "°")} />
            <ShotMetric
              label="Ball speed"
              value={formatMeasure(shot.ballSpeedMph ?? null, "mph")}
            />
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function ShotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-semibold text-foreground">{value}</p>
    </div>
  );
}

function patternReadout(summary: ReturnType<typeof summarizeShotPattern>) {
  if (summary.sampleSize === 0 || summary.medianSideYd === null) {
    return "No measured carry and lateral coordinates are available for this selection.";
  }
  const direction =
    Math.abs(summary.medianSideYd) < 1
      ? "on the centre line"
      : `${Math.abs(Math.round(summary.medianSideYd))} yd ${summary.medianSideYd < 0 ? "left" : "right"}`;
  const miss = summary.typicalMiss
    ? typicalMissReadout(summary)
    : summary.widerSide
      ? ` Wider side: ${summary.widerSide.toLowerCase()}.`
      : "";
  return `${summary.insideCorridor} of ${summary.sampleSize} shots finished inside the playable corridor. The pattern centres ${direction}.${miss}`;
}

function typicalMissReadout(summary: ReturnType<typeof summarizeShotPattern>) {
  const typical = summary.typicalMiss?.toLowerCase();
  if (!typical) return "";
  const extent =
    summary.typicalMiss === "Left"
      ? summary.sideLowYd === null
        ? null
        : Math.abs(summary.sideLowYd)
      : summary.typicalMiss === "Right"
        ? summary.sideHighYd === null
          ? null
          : Math.abs(summary.sideHighYd)
        : null;
  return extent === null
    ? ` Typical pattern: ${typical}.`
    : ` Typical pattern: ${typical}; the ${typical}-side miss reaches ${Math.round(extent)} yd.`;
}

function formatMeasure(value: number | null, unit: string) {
  return value === null ? "Unavailable" : `${Math.round(value)} ${unit}`;
}

function formatSigned(value: number | null) {
  if (value === null) return "Unavailable";
  if (Math.abs(value) < 0.5) return "Centre";
  return `${Math.abs(Math.round(value))} yd ${value < 0 ? "left" : "right"}`;
}
