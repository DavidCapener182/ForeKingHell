"use client";

import { useEffect, useMemo, useState } from "react";

import { SegmentedControl } from "@/components/app/segmented-control";
import {
  defaultShotPatternClub,
  deterministicShotSample,
  filterShotPatternPoints,
  shotPatternClubs,
  shotPatternConfidence,
  summarizeShotPattern,
  type ShotPatternPoint,
} from "@/lib/shot-pattern-chart-data";
import { cn } from "@/lib/utils";

type ChartMode = "dispersion" | "flight";
type FlightMode = "shots" | "average";

const clubColours = ["#0b7a3b", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

export function MobileShotPatternCharts({
  points,
  preferredClub,
  compact = false,
}: {
  points: ShotPatternPoint[];
  preferredClub?: string | null;
  compact?: boolean;
}) {
  const clubs = useMemo(() => shotPatternClubs(points), [points]);
  const [mode, setMode] = useState<ChartMode>("dispersion");
  const [flightMode, setFlightMode] = useState<FlightMode>("shots");
  const [club, setClub] = useState(() => defaultShotPatternClub(clubs, preferredClub));
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selected = useMemo(
    () => filterShotPatternPoints({ points, club, trustedOnly }),
    [club, points, trustedOnly],
  );
  const hasFlight = selected.some((point) => point.carryYd !== null && point.apexFt !== null);
  const summary = useMemo(() => summarizeShotPattern(selected), [selected]);
  const confidence = useMemo(() => shotPatternConfidence(selected), [selected]);
  const colours = useMemo(
    () => new Map(clubs.map((item, index) => [item.type, clubColours[index % clubColours.length]])),
    [clubs],
  );

  if (clubs.length === 0) {
    return (
      <div className="ios-grouped-list grid min-h-36 place-items-center p-5 text-center text-sm text-muted-foreground">
        No measured landing data are available for this session.
      </div>
    );
  }

  return (
    <section
      className="ios-grouped-list grid gap-3 overflow-hidden p-3"
      data-mobile-shot-pattern
      data-mobile-shot-pattern-hydrated={hydrated ? "true" : "false"}
    >
      {!compact ? (
        <SegmentedControl
          label="Shot pattern view"
          value={mode}
          options={[
            { value: "dispersion", label: "Dispersion" },
            { value: "flight", label: "Flight", disabled: !hasFlight },
          ]}
          onChange={(value) => setMode(value as ChartMode)}
        />
      ) : null}
      {!compact && !hasFlight ? (
        <p className="rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Flight is unavailable because this session has no measured apex data.
        </p>
      ) : null}

      {!compact && mode === "flight" && hasFlight ? (
        <SegmentedControl
          label="Flight detail"
          value={flightMode}
          options={[
            { value: "shots", label: "Individual shots" },
            { value: "average", label: "Club average" },
          ]}
          onChange={(value) => setFlightMode(value as FlightMode)}
        />
      ) : null}

      <div
        className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
        role="toolbar"
        aria-label="Chart club"
      >
        {clubs.map((item) => (
          <button
            key={item.type}
            type="button"
            aria-pressed={club === item.type}
            onClick={() => setClub(item.type)}
            className={cn(
              "focus-aaa min-h-11 shrink-0 snap-start rounded-full border px-3 text-sm font-semibold",
              club === item.type ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {item.label}
          </button>
        ))}
        {clubs.length > 1 && !compact ? (
          <button
            type="button"
            aria-pressed={club === "all"}
            onClick={() => setClub("all")}
            className={cn(
              "focus-aaa min-h-11 shrink-0 snap-start rounded-full border px-3 text-sm font-semibold",
              club === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            All clubs
          </button>
        ) : null}
      </div>

      {!compact ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {confidence.sampleSize} measured landing points · {confidence.label} confidence
          </p>
          <button
            type="button"
            aria-pressed={trustedOnly}
            onClick={() => setTrustedOnly((value) => !value)}
            className="focus-aaa min-h-11 rounded-full border bg-card px-3 text-xs font-semibold"
          >
            {trustedOnly ? "Trusted shots" : "All shots"}
          </button>
        </div>
      ) : null}

      {mode === "dispersion" || compact ? (
        <DispersionChart points={selected} colours={colours} compact={compact} />
      ) : hasFlight ? (
        <FlightChart points={selected} colours={colours} flightMode={flightMode} />
      ) : (
        <p className="rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          Flight is unavailable because this session has no measured apex data.
        </p>
      )}

      <p className="text-sm font-medium leading-5" aria-live="polite">
        {patternReadout(summary)}
      </p>

      {!compact ? <AccessibleShotTable points={selected} /> : null}
    </section>
  );
}

function DispersionChart({
  points,
  colours,
  compact,
}: {
  points: ShotPatternPoint[];
  colours: Map<string, string>;
  compact: boolean;
}) {
  const landing = points.filter(
    (point): point is ShotPatternPoint & { carryYd: number; sideCarryYd: number } =>
      point.carryYd !== null && point.sideCarryYd !== null,
  );
  const sampled = deterministicShotSample(landing, compact ? 70 : 160);
  const summary = summarizeShotPattern(landing);
  const maxCarry = Math.max(1, ...landing.map((point) => point.carryYd));
  const minCarry = Math.min(...landing.map((point) => point.carryYd), 0);
  const carrySpan = Math.max(20, maxCarry - minCarry);
  const maxSide = Math.max(15, ...landing.map((point) => Math.abs(point.sideCarryYd)));
  const x = (side: number) => 160 + (side / maxSide) * 126;
  const y = (carry: number) => 174 - ((carry - minCarry) / carrySpan) * 148;
  const region =
    summary.sideLowYd !== null &&
    summary.sideHighYd !== null &&
    summary.carryLowYd !== null &&
    summary.carryHighYd !== null
      ? {
          x: x(summary.sideLowYd),
          y: y(summary.carryHighYd),
          width: Math.max(2, x(summary.sideHighYd) - x(summary.sideLowYd)),
          height: Math.max(2, y(summary.carryLowYd) - y(summary.carryHighYd)),
        }
      : null;

  return (
    <div>
      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label={`Dispersion chart. ${patternReadout(summary)}`}
        className={cn("h-auto w-full", compact && "max-h-44")}
      >
        <desc>
          The shaded rectangle marks the central 10th-to-90th-percentile carry and lateral region.
          The dashed vertical line is the target line and the dashed horizontal line is the trusted
          carry reference.
        </desc>
        <rect width="320" height="200" rx="16" className="fill-secondary/60" />
        <text x="14" y="194" className="fill-muted-foreground text-[10px]">
          Left
        </text>
        <text x="282" y="194" textAnchor="end" className="fill-muted-foreground text-[10px]">
          Right
        </text>
        <text x="160" y="194" textAnchor="middle" className="fill-muted-foreground text-[10px]">
          Target line
        </text>
        <text x="8" y="16" className="fill-muted-foreground text-[10px]">
          {Math.round(maxCarry)} yd
        </text>
        <text x="8" y="178" className="fill-muted-foreground text-[10px]">
          {Math.round(minCarry)} yd
        </text>
        <path d="M160 182 L160 12" className="stroke-foreground/40" strokeDasharray="4 4" />
        {summary.medianCarryYd !== null ? (
          <path
            d={`M24 ${y(summary.medianCarryYd)} H296`}
            className="stroke-primary/50"
            strokeDasharray="3 5"
            aria-label={`Trusted carry reference ${Math.round(summary.medianCarryYd)} yards`}
          />
        ) : null}
        {region ? (
          <g>
            <rect
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              rx="12"
              className="fill-primary/10 stroke-primary/40"
              strokeDasharray="5 4"
            />
            <text
              x={Math.max(28, Math.min(region.x + 4, 240))}
              y={Math.max(24, region.y - 4)}
              className="fill-muted-foreground text-[9px]"
            >
              Central 10–90% region
            </text>
          </g>
        ) : null}
        {sampled.points.map((point, index) => (
          <g key={point.id}>
            <circle
              cx={x(point.sideCarryYd)}
              cy={y(point.carryYd)}
              r="4"
              fill={colours.get(point.clubType) ?? clubColours[0]}
              opacity="0.78"
            />
            {index % 2 === 0 ? (
              <path
                d={`M ${x(point.sideCarryYd) - 2} ${y(point.carryYd)} h 4`}
                className="stroke-background"
                strokeWidth="1"
              />
            ) : null}
          </g>
        ))}
        {summary.medianSideYd !== null && summary.medianCarryYd !== null ? (
          <g aria-label="Median landing point">
            <circle
              cx={x(summary.medianSideYd)}
              cy={y(summary.medianCarryYd)}
              r="7"
              className="fill-background stroke-foreground"
              strokeWidth="2"
            />
            <circle
              cx={x(summary.medianSideYd)}
              cy={y(summary.medianCarryYd)}
              r="2.5"
              className="fill-foreground"
            />
          </g>
        ) : null}
      </svg>
      {sampled.downsampled ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Showing a deterministic {sampled.points.length}-point sample of {sampled.total},
          preserving extremes and chronological spread.
        </p>
      ) : null}
    </div>
  );
}

function FlightChart({
  points,
  colours,
  flightMode,
}: {
  points: ShotPatternPoint[];
  colours: Map<string, string>;
  flightMode: FlightMode;
}) {
  const flights = points.filter(
    (point): point is ShotPatternPoint & { carryYd: number; apexFt: number } =>
      point.carryYd !== null && point.apexFt !== null,
  );
  const sampled = deterministicShotSample(flights, 120);
  const visibleFlights =
    flightMode === "average"
      ? [...new Set(flights.map((point) => point.clubType))].map((clubType) => {
          const clubShots = flights.filter((point) => point.clubType === clubType);
          const template = clubShots[0]!;
          return {
            ...template,
            id: `average-${clubType}`,
            carryYd:
              clubShots.reduce((total, point) => total + point.carryYd, 0) / clubShots.length,
            apexFt: clubShots.reduce((total, point) => total + point.apexFt, 0) / clubShots.length,
          };
        })
      : sampled.points;
  const maxCarry = Math.max(1, ...flights.map((point) => point.carryYd));
  const maxApex = Math.max(1, ...flights.map((point) => point.apexFt));

  return (
    <div>
      <svg
        viewBox="0 0 320 190"
        role="img"
        aria-label={`Flight chart showing ${flightMode === "average" ? `${visibleFlights.length} club averages from` : ""} ${flights.length} measured shots. Maximum apex ${Math.round(maxApex)} feet and longest carry ${Math.round(maxCarry)} yards.`}
        className="h-auto w-full"
      >
        <rect width="320" height="190" rx="16" className="fill-secondary/60" />
        <path d="M20 164 H304" className="stroke-foreground/40" />
        <text x="10" y="18" className="fill-muted-foreground text-[10px]">
          {Math.round(maxApex)} ft apex
        </text>
        <text x="302" y="181" textAnchor="end" className="fill-muted-foreground text-[10px]">
          {Math.round(maxCarry)} yd carry
        </text>
        {visibleFlights.map((point) => {
          const endX = 20 + (point.carryYd / maxCarry) * 282;
          const apexY = 154 - (point.apexFt / maxApex) * 126;
          return (
            <g key={point.id}>
              <path
                d={`M20 164 Q ${20 + (endX - 20) * 0.52} ${apexY} ${endX} 164`}
                fill="none"
                stroke={colours.get(point.clubType) ?? clubColours[0]}
                strokeWidth={flightMode === "average" ? "3" : "1.75"}
                opacity={flightMode === "average" ? "0.9" : "0.42"}
              />
              <circle
                cx={endX}
                cy="164"
                r="2.5"
                fill={colours.get(point.clubType) ?? clubColours[0]}
              />
            </g>
          );
        })}
      </svg>
      {flightMode === "shots" && sampled.downsampled ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Showing {sampled.points.length} of {sampled.total} flights with extremes and chronological
          spread preserved.
        </p>
      ) : null}
    </div>
  );
}

function AccessibleShotTable({ points }: { points: ShotPatternPoint[] }) {
  return (
    <details className="rounded-xl border bg-card px-3 py-2">
      <summary className="focus-aaa min-h-11 cursor-pointer py-3 text-sm font-semibold">
        Accessible shot data ({points.length})
      </summary>
      <div className="max-h-72 overflow-auto pb-2">
        <table className="w-full min-w-[30rem] text-left text-xs">
          <caption className="sr-only">Measured shot data used by this chart</caption>
          <thead>
            <tr className="border-b">
              <th className="p-2">Shot</th>
              <th className="p-2">Club</th>
              <th className="p-2">Carry</th>
              <th className="p-2">Lateral</th>
              <th className="p-2">Apex</th>
              <th className="p-2">Trust</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={point.id} className="border-b last:border-0">
                <td className="p-2">{point.shotNumber ?? index + 1}</td>
                <td className="p-2">{point.clubLabel}</td>
                <td className="p-2">{formatMeasure(point.carryYd, "yd")}</td>
                <td className="p-2">{formatSigned(point.sideCarryYd)}</td>
                <td className="p-2">{formatMeasure(point.apexFt, "ft")}</td>
                <td className="p-2">{point.trusted ? "Trusted" : "Unusual"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
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
