"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { SegmentedControl } from "@/components/app/segmented-control";
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
      <div
        className="grid aspect-[82/43] w-full place-items-center bg-slate-50 text-xs font-medium text-slate-500"
        role="status"
      >
        Drawing measured shot pattern…
      </div>
    ),
  },
);

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
        <div className={cn("overflow-hidden rounded-xl bg-white", compact && "max-h-52")}>
          <SharedShotPatternVisual shots={selected} mode="dispersion" />
        </div>
      ) : hasFlight ? (
        <div className="overflow-hidden rounded-xl bg-white">
          <SharedShotPatternVisual
            shots={selected}
            mode="trajectory"
            trajectoryView={flightMode === "average" ? "averages" : "shots"}
          />
        </div>
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
