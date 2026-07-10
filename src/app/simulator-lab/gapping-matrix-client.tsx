"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";

import {
  ChartAccessibleFallback,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import { Badge } from "@/components/ui/badge";
import type { GappingMatrixRow, SimulatorLabTone } from "@/lib/simulator-lab";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");

export function GappingMatrixClient({ rows }: { rows: GappingMatrixRow[] }) {
  const [selectedClubId, setSelectedClubId] = useState(rows[0]?.clubId ?? "");
  const selected = rows.find((row) => row.clubId === selectedClubId) ?? rows[0] ?? null;
  const maxCarry = useMemo(
    () => Math.max(1, ...rows.map((row) => row.recommendedCarryYd ?? row.bestStockCarryYd ?? 0)),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
          Import simulator shots to build the WITB carry matrix.
        </div>
        <ChartAccessibleFallback
          title="Simulator gapping matrix"
          summary="No simulator gapping rows are available yet; import launch-monitor stock shots to build the WITB carry matrix."
          columns={gappingMatrixColumns}
          rows={[]}
          className="bg-white/70"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {selected ? (
        <aside className="apple-panel-strong grid gap-4 rounded-lg p-4 xl:grid-cols-[minmax(12rem,0.65fr)_minmax(28rem,1.25fr)_minmax(16rem,0.8fr)] xl:items-center">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Selected club
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-normal">{selected.clubLabel}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{selected.brandModel}</p>
            </div>
            {selected.gapStatus === "danger" || selected.gapStatus === "overlap" ? (
              <AlertTriangle className="size-5 text-amber-600" />
            ) : selected.gapStatus === "ok" || selected.gapStatus === "top-ok" ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <CircleDot className="size-5 text-slate-500" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Recommended" value={formatYards(selected.recommendedCarryYd)} />
            <Metric label="Best stock" value={formatYards(selected.bestStockCarryYd)} />
            <Metric label="Latest reliable" value={formatYards(selected.latestReliableCarryYd)} />
            <Metric label="Confidence" value={`${selected.confidenceScore}%`} />
          </div>
          <div className="rounded-lg border border-emerald-950/10 bg-white/70 p-3 text-sm">
            <p className="font-medium">{selected.gapLabel}</p>
            <p className="mt-1 leading-5 text-muted-foreground">{selected.gapDetail}</p>
            {selected.latestReliableCarryP25Yd !== null &&
            selected.latestReliableCarryP75Yd !== null ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Latest reliable range: {formatYards(selected.latestReliableCarryP25Yd)}-
                {formatYards(selected.latestReliableCarryP75Yd)}
              </p>
            ) : null}
          </div>
        </aside>
      ) : null}

      <div className="space-y-2">
        {rows.map((row) => {
          const carry = row.recommendedCarryYd ?? row.bestStockCarryYd;
          const width = carry === null ? 8 : Math.max(8, (carry / maxCarry) * 100);
          const isSelected = row.clubId === selected?.clubId;

          return (
            <button
              key={row.clubId}
              type="button"
              onClick={() => setSelectedClubId(row.clubId)}
              className={cn(
                "grid w-full grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-lg border bg-white/80 p-2 text-left transition hover:border-emerald-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                isSelected ? "border-emerald-500 shadow-sm" : "border-emerald-950/10",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.clubLabel}</p>
                <p className="truncate text-[11px] text-muted-foreground">{row.confidenceLabel}</p>
              </div>
              <div className="min-w-0">
                <div className="h-7 rounded-full bg-[#E9EEE8] p-1">
                  <div
                    className={cn("h-full rounded-full", toneBarClass(row.tone))}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{row.sampleSize} shots</span>
                  <span>{gapCopy(row)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{formatYards(carry)}</p>
                <Badge className={cn("mt-1", toneBadgeClass(row.tone))}>{row.gapLabel}</Badge>
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <ChartAccessibleFallback
          title="Simulator gapping matrix"
          summary={gappingMatrixSummary(rows)}
          columns={gappingMatrixColumns}
          rows={gappingMatrixRows(rows)}
          className="bg-white/70"
        />
      </div>
    </div>
  );
}

const gappingMatrixColumns = [
  { key: "club", label: "Club" },
  { key: "recommended", label: "Recommended" },
  { key: "bestStock", label: "Best stock" },
  { key: "latest", label: "Latest reliable" },
  { key: "gap", label: "Gap" },
  { key: "confidence", label: "Confidence" },
];

function gappingMatrixSummary(rows: GappingMatrixRow[]) {
  const flagged = rows.filter((row) => row.gapStatus === "danger" || row.gapStatus === "overlap");
  const bestSupported = [...rows].sort(
    (left, right) => right.confidenceScore - left.confidenceScore,
  )[0];

  return `${integerFormatter.format(rows.length)} active clubs are shown in the simulator gapping matrix. ${integerFormatter.format(flagged.length)} clubs have overlap or missing-window flags${bestSupported ? `; strongest confidence is ${bestSupported.clubLabel} at ${bestSupported.confidenceScore}%` : ""}.`;
}

function gappingMatrixRows(rows: GappingMatrixRow[]): ChartFallbackRow[] {
  return rows.map((row) => ({
    _key: row.clubId,
    club: row.clubLabel,
    recommended: formatYards(row.recommendedCarryYd),
    bestStock: formatYards(row.bestStockCarryYd),
    latest: formatYards(row.latestReliableCarryYd),
    gap: row.nextClubType ? `${row.gapLabel} / ${gapCopy(row)}` : row.gapLabel,
    confidence: `${row.confidenceScore}% / ${row.confidenceLabel}`,
  }));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-emerald-950/10 bg-white/75 p-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatYards(value: number | null | undefined) {
  return typeof value === "number" ? `${numberFormatter.format(value)} yd` : "--";
}

function gapCopy(row: GappingMatrixRow) {
  if (row.gapToNextYd === null || row.nextClubType === null) {
    return "No lower club";
  }

  return `${numberFormatter.format(row.gapToNextYd)} yd to next`;
}

function toneBarClass(tone: SimulatorLabTone) {
  if (tone === "green") return "bg-[#0B7A3B]";
  if (tone === "sky") return "bg-sky-500";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "pink") return "bg-rose-500";
  return "bg-slate-400";
}

function toneBadgeClass(tone: SimulatorLabTone) {
  if (tone === "green") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (tone === "sky") return "bg-sky-50 text-sky-700 hover:bg-sky-50";
  if (tone === "amber") return "bg-amber-50 text-amber-700 hover:bg-amber-50";
  if (tone === "pink") return "bg-rose-50 text-rose-700 hover:bg-rose-50";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
}
