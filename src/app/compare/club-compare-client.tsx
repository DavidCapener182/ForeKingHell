"use client";

import { useMemo, useState } from "react";
import { Crosshair, GitCompareArrows, Radar, Target, Trophy } from "lucide-react";

import { ChartFrame, DataPanel, SectionHeader, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ClubCompareData,
  ClubCompareSide,
  CompareDelta,
  DispersionPoint,
} from "@/lib/compare-data";
import { cn } from "@/lib/utils";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function ClubCompareClient({ data }: { data: ClubCompareData }) {
  const [draftClubAId, setDraftClubAId] = useState(data.filters.clubAId);
  const [draftClubBId, setDraftClubBId] = useState(data.filters.clubBId);
  const [selectedClubAId, setSelectedClubAId] = useState(data.filters.clubAId);
  const [selectedClubBId, setSelectedClubBId] = useState(data.filters.clubBId);
  const sideByClubId = useMemo(
    () => new Map(data.clubSides.map((club) => [club.clubId, club])),
    [data.clubSides],
  );
  const clubA = sideByClubId.get(selectedClubAId) ?? data.clubSides[0] ?? null;
  const clubB =
    sideByClubId.get(selectedClubBId) ??
    data.clubSides.find((club) => club.clubId !== clubA?.clubId) ??
    null;
  const delta = clubA && clubB ? buildDelta(clubA, clubB) : emptyDelta();

  function applySelection() {
    const nextClubAId = draftClubAId || data.clubs[0]?.id || "";
    const nextClubBId =
      draftClubBId && draftClubBId !== nextClubAId
        ? draftClubBId
        : (data.clubs.find((club) => club.id !== nextClubAId)?.id ?? "");

    setSelectedClubAId(nextClubAId);
    setSelectedClubBId(nextClubBId);
    setDraftClubBId(nextClubBId);
  }

  function resetSelection() {
    const fallbackAId = data.clubs[0]?.id ?? "";
    const fallbackBId = data.clubs.find((club) => club.id !== fallbackAId)?.id ?? "";

    setDraftClubAId(fallbackAId);
    setDraftClubBId(fallbackBId);
    setSelectedClubAId(fallbackAId);
    setSelectedClubBId(fallbackBId);
  }

  return (
    <>
      <DataPanel>
        <SectionHeader
          title="Choose clubs"
          description="Pick exactly what you want compared. No session or baseline setup required."
          action={<GitCompareArrows className="size-5 text-muted-foreground" />}
        />
        <CardContent>
          <form
            className="apple-panel grid items-end gap-3 p-3 md:grid-cols-[1fr_auto_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              applySelection();
            }}
          >
            <SelectField label="Club A" value={draftClubAId} onChange={setDraftClubAId}>
              {data.clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.label} ({integerFormatter.format(club.shotCount)})
                </option>
              ))}
            </SelectField>
            <div className="hidden pb-2 text-center text-sm font-semibold text-muted-foreground md:block">
              vs
            </div>
            <SelectField label="Club B" value={draftClubBId} onChange={setDraftClubBId}>
              {data.clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.label} ({integerFormatter.format(club.shotCount)})
                </option>
              ))}
            </SelectField>
            <div className="flex gap-2">
              <Button type="submit" className="bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                Compare
              </Button>
              <Button type="button" variant="outline" onClick={resetSelection}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </DataPanel>

      {!clubA || !clubB ? (
        <DataPanel>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <GitCompareArrows className="size-9 text-muted-foreground" />
            <div>
              <p className="text-xl font-semibold">Choose two clubs</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                The comparison page only needs a Club A and Club B now. Imported and retired clubs
                are both available.
              </p>
            </div>
          </CardContent>
        </DataPanel>
      ) : (
        <>
          <WinnerCard clubA={clubA} clubB={clubB} delta={delta} />

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <DataPanel>
              <SectionHeader
                title="Side by side"
                description="Stock shots exclude chips, recovery shots, and obvious mishits."
                action={<GitCompareArrows className="size-5 text-sky-500" />}
              />
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <ClubSummaryCard side="Club A" club={clubA} tone="emerald" />
                <ClubSummaryCard side="Club B" club={clubB} tone="sky" />
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Differences"
                description="Winner uses higher carry, total, ball speed, and playable rate; lower miss numbers are better."
                action={<Target className="size-5 text-emerald-500" />}
              />
              <CardContent className="grid gap-4">
                <CompareRadarChart clubA={clubA} clubB={clubB} />
                <DeltaTable clubA={clubA} clubB={clubB} delta={delta} />
              </CardContent>
            </DataPanel>
          </section>

          <DataPanel>
            <SectionHeader
              title="Shot pattern"
              description={`${clubA.label} in green, ${clubB.label} in blue.`}
              action={<Crosshair className="size-5 text-pink-500" />}
            />
            <CardContent>
              <ClubDispersionPlot clubA={clubA} clubB={clubB} />
            </CardContent>
          </DataPanel>
        </>
      )}
    </>
  );
}

function WinnerCard({
  clubA,
  clubB,
  delta,
}: {
  clubA: ClubCompareSide;
  clubB: ClubCompareSide;
  delta: CompareDelta;
}) {
  const rows = compareMetricRows(clubA, clubB, delta);
  const aWins = rows.filter((row) => row.outcome.winner === "a").length;
  const bWins = rows.filter((row) => row.outcome.winner === "b").length;
  const winner = aWins === bWins ? "tie" : aWins > bWins ? "a" : "b";
  const winnerClub = winner === "a" ? clubA : winner === "b" ? clubB : null;
  const winnerTone = winner === "b" ? "sky" : winner === "tie" ? "slate" : "green";
  const winnerRows = rows
    .filter((row) => row.outcome.winner === winner)
    .slice(0, 3)
    .map((row) => `${row.outcome.detail} ${row.label.toLowerCase()}`);

  return (
    <DataPanel className="border-emerald-950/10 bg-[linear-gradient(135deg,rgba(240,250,243,0.96),rgba(255,255,255,0.94))]">
      <CardContent className="grid gap-4 py-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={winnerTone}>
              <Trophy className="mr-1 size-3.5" />
              Winner
            </StatusPill>
            <StatusPill tone="slate">
              {aWins}-{bWins} metric split
            </StatusPill>
          </div>
          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950">
            {winnerClub ? winnerClub.label : "Too close to call"}
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
            {winnerClub
              ? `${winnerClub.label} leads the selected comparison on the clearest performance signals.`
              : "The selected clubs split the headline metrics, so use the detailed rows before changing the bag."}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {(winnerRows.length > 0
            ? winnerRows
            : ["Carry is close", "Playable is close", "Launch is fit dependent"]
          ).map((signal) => (
            <div key={signal} className="rounded-lg border border-slate-200/70 bg-white/85 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Signal
              </p>
              <p className="mt-2 text-lg font-semibold leading-6 text-slate-950">{signal}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border bg-white/90 px-3 text-sm"
      >
        {children}
      </select>
    </label>
  );
}

function ClubSummaryCard({
  side,
  club,
  tone,
}: {
  side: string;
  club: ClubCompareSide;
  tone: "emerald" | "sky";
}) {
  const dotClass = tone === "emerald" ? "bg-emerald-600" : "bg-sky-600";

  return (
    <div className="apple-panel-strong p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className={`size-2 rounded-full ${dotClass}`} />
            {side}
          </p>
          <p className="mt-2 truncate text-xl font-semibold tracking-normal">{club.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{club.dateRange}</p>
        </div>
        {!club.active ? <StatusPill tone="amber">Retired</StatusPill> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniStat
          label="Usable shots"
          value={`${integerFormatter.format(club.stockShots)} / ${integerFormatter.format(club.rawShots)}`}
        />
        <MiniStat label="Sessions" value={integerFormatter.format(club.sessions)} />
        <MiniStat label="Carry" value={formatYards(club.carryMedianYd)} />
        <MiniStat label="Total" value={formatYards(club.totalMedianYd)} />
        <MiniStat label="Ball speed" value={formatMph(club.ballSpeedAverageMph)} />
        <MiniStat label="Launch" value={formatDegrees(club.launchAverageDeg)} />
        <MiniStat label="Offline avg" value={formatYards(club.absoluteOfflineAverageYd)} />
        <MiniStat label="Shot cone" value={formatYards(club.shotConeWidthYd)} />
        <MiniStat label="Playable" value={formatRate(club.playableRate)} />
        <MiniStat label="Big misses" value={formatRate(club.bigMissRate)} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold">{value}</p>
    </div>
  );
}

function DeltaTable({
  clubA,
  clubB,
  delta,
}: {
  clubA: ClubCompareSide;
  clubB: ClubCompareSide;
  delta: CompareDelta;
}) {
  const rows = compareMetricRows(clubA, clubB, delta);

  return (
    <div className="overflow-hidden rounded-[8px] border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead className="text-right">Club A</TableHead>
            <TableHead className="text-right">Club B</TableHead>
            <TableHead className="text-right">Diff</TableHead>
            <TableHead className="text-right">Better</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="min-w-36">
                <MetricValueBar
                  value={row.a}
                  rawValue={row.aValue}
                  maxValue={row.maxValue}
                  tone="green"
                />
              </TableCell>
              <TableCell className="min-w-36">
                <MetricValueBar
                  value={row.b}
                  rawValue={row.bValue}
                  maxValue={row.maxValue}
                  tone="sky"
                />
              </TableCell>
              <TableCell className={deltaClass(row.outcome.winner)}>{row.diff}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-1">
                  <StatusPill tone={row.outcome.tone} className="justify-center">
                    {row.outcome.label}
                  </StatusPill>
                  <span className="text-xs text-muted-foreground">{row.outcome.detail}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function compareMetricRows(clubA: ClubCompareSide, clubB: ClubCompareSide, delta: CompareDelta) {
  const totalDelta = diff(clubA.totalMedianYd, clubB.totalMedianYd);

  return [
    {
      label: "Carry",
      a: formatYards(clubA.carryMedianYd),
      b: formatYards(clubB.carryMedianYd),
      aValue: clubA.carryMedianYd,
      bValue: clubB.carryMedianYd,
      maxValue: maxMetric(clubA.carryMedianYd, clubB.carryMedianYd),
      diff: formatSignedYards(delta.carryDeltaYd),
      outcome: metricOutcome(delta.carryDeltaYd, "higher", "yd"),
    },
    {
      label: "Total",
      a: formatYards(clubA.totalMedianYd),
      b: formatYards(clubB.totalMedianYd),
      aValue: clubA.totalMedianYd,
      bValue: clubB.totalMedianYd,
      maxValue: maxMetric(clubA.totalMedianYd, clubB.totalMedianYd),
      diff: formatSignedYards(totalDelta),
      outcome: metricOutcome(totalDelta, "higher", "yd"),
    },
    {
      label: "Ball speed",
      a: formatMph(clubA.ballSpeedAverageMph),
      b: formatMph(clubB.ballSpeedAverageMph),
      aValue: clubA.ballSpeedAverageMph,
      bValue: clubB.ballSpeedAverageMph,
      maxValue: maxMetric(clubA.ballSpeedAverageMph, clubB.ballSpeedAverageMph),
      diff: formatSignedMph(delta.ballSpeedDeltaMph),
      outcome: metricOutcome(delta.ballSpeedDeltaMph, "higher", "mph"),
    },
    {
      label: "Offline avg",
      a: formatYards(clubA.absoluteOfflineAverageYd),
      b: formatYards(clubB.absoluteOfflineAverageYd),
      aValue: clubA.absoluteOfflineAverageYd,
      bValue: clubB.absoluteOfflineAverageYd,
      maxValue: maxMetric(clubA.absoluteOfflineAverageYd, clubB.absoluteOfflineAverageYd),
      diff: formatSignedYards(delta.offlineDeltaYd),
      outcome: metricOutcome(delta.offlineDeltaYd, "lower", "yd"),
    },
    {
      label: "Shot cone",
      a: formatYards(clubA.shotConeWidthYd),
      b: formatYards(clubB.shotConeWidthYd),
      aValue: clubA.shotConeWidthYd,
      bValue: clubB.shotConeWidthYd,
      maxValue: maxMetric(clubA.shotConeWidthYd, clubB.shotConeWidthYd),
      diff: formatSignedYards(delta.coneDeltaYd),
      outcome: metricOutcome(delta.coneDeltaYd, "lower", "yd"),
    },
    {
      label: "Playable",
      a: formatRate(clubA.playableRate),
      b: formatRate(clubB.playableRate),
      aValue: clubA.playableRate,
      bValue: clubB.playableRate,
      maxValue: 100,
      diff: formatSignedRate(delta.playableRateDelta),
      outcome: metricOutcome(delta.playableRateDelta, "higher", "pts"),
    },
    {
      label: "Big misses",
      a: formatRate(clubA.bigMissRate),
      b: formatRate(clubB.bigMissRate),
      aValue: clubA.bigMissRate,
      bValue: clubB.bigMissRate,
      maxValue: 100,
      diff: formatSignedRate(delta.bigMissRateDelta),
      outcome: metricOutcome(delta.bigMissRateDelta, "lower", "pts"),
    },
    {
      label: "Launch",
      a: formatDegrees(clubA.launchAverageDeg),
      b: formatDegrees(clubB.launchAverageDeg),
      aValue: clubA.launchAverageDeg,
      bValue: clubB.launchAverageDeg,
      maxValue: maxMetric(clubA.launchAverageDeg, clubB.launchAverageDeg),
      diff: formatSignedDegrees(delta.launchDeltaDeg),
      outcome: contextOutcome(),
    },
  ];
}

function MetricValueBar({
  value,
  rawValue,
  maxValue,
  tone,
}: {
  value: string;
  rawValue: number | null;
  maxValue: number;
  tone: "green" | "sky";
}) {
  const width = rawValue === null || maxValue <= 0 ? 0 : clamp((rawValue / maxValue) * 100, 3, 100);

  return (
    <span className="grid gap-1 text-right">
      <span className="font-medium tabular-nums text-slate-950">{value}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "green" ? "bg-emerald-600" : "bg-sky-500",
          )}
          style={{ width: `${width}%` }}
        />
      </span>
    </span>
  );
}

function CompareRadarChart({ clubA, clubB }: { clubA: ClubCompareSide; clubB: ClubCompareSide }) {
  const metrics = radarMetrics(clubA, clubB);
  const centre = 150;
  const radius = 108;
  const rings = [0.25, 0.5, 0.75, 1];
  const pointsFor = (side: "a" | "b") =>
    metrics.map((metric, index) => radarPoint(index, metrics.length, centre, radius, metric[side]));
  const polygonFor = (side: "a" | "b") =>
    pointsFor(side)
      .map((point) => `${point.x},${point.y}`)
      .join(" ");

  return (
    <div className="rounded-lg border border-slate-200 bg-white/85 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Performance radar</p>
          <p className="text-xs text-muted-foreground">
            Carry, speed, control, playable rate and launch context.
          </p>
        </div>
        <Radar className="size-5 text-sky-600" />
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center">
        <svg
          viewBox="0 0 300 300"
          role="img"
          aria-label={`${clubA.label} and ${clubB.label} radar comparison`}
          className="mx-auto aspect-square w-full max-w-[20rem]"
        >
          <rect width="300" height="300" rx="12" fill="#ffffff" />
          {rings.map((ring) => (
            <polygon
              key={ring}
              points={metrics
                .map((_, index) => radarPoint(index, metrics.length, centre, radius * ring, 100))
                .map((point) => `${point.x},${point.y}`)
                .join(" ")}
              fill="none"
              stroke="#e2e8f0"
            />
          ))}
          {metrics.map((metric, index) => {
            const outer = radarPoint(index, metrics.length, centre, radius, 100);
            const label = radarPoint(index, metrics.length, centre, radius + 24, 100);

            return (
              <g key={metric.label}>
                <line x1={centre} y1={centre} x2={outer.x} y2={outer.y} stroke="#e2e8f0" />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-600 text-[11px] font-semibold"
                >
                  {metric.label}
                </text>
              </g>
            );
          })}
          <polygon
            points={polygonFor("b")}
            fill="#0284c7"
            fillOpacity="0.16"
            stroke="#0284c7"
            strokeWidth="2"
          />
          <polygon
            points={polygonFor("a")}
            fill="#059669"
            fillOpacity="0.18"
            stroke="#059669"
            strokeWidth="2.2"
          />
          {pointsFor("b").map((point, index) => (
            <circle
              key={`b-${metrics[index].label}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="#0284c7"
            />
          ))}
          {pointsFor("a").map((point, index) => (
            <circle
              key={`a-${metrics[index].label}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#059669"
            />
          ))}
        </svg>
        <div className="grid gap-2 text-xs">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-950">
            <span className="size-2.5 rounded-full bg-emerald-600" />
            Club A: {clubA.label}
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-slate-950">
            <span className="size-2.5 rounded-full bg-sky-600" />
            Club B: {clubB.label}
          </span>
          <p className="leading-5 text-muted-foreground">Exact values sit in the metric rows.</p>
        </div>
      </div>
    </div>
  );
}

function ClubDispersionPlot({ clubA, clubB }: { clubA: ClubCompareSide; clubB: ClubCompareSide }) {
  const points = [...clubA.dispersion, ...clubB.dispersion];

  if (points.length === 0) {
    return (
      <div className="apple-panel grid aspect-[2/1] place-items-center text-sm text-muted-foreground">
        No dispersion points for these clubs.
      </div>
    );
  }

  const maxSide = Math.max(20, ...points.map((point) => Math.abs(point.sideCarryYd)));
  const carryValues = points.map((point) => point.carryYd);
  const minCarry = Math.max(0, Math.min(...carryValues) - 10);
  const maxCarry = Math.max(...carryValues) + 10;
  const plot = (point: DispersionPoint) => ({
    x: 48 + ((point.sideCarryYd + maxSide) / (maxSide * 2 || 1)) * 624,
    y: 312 - ((point.carryYd - minCarry) / (maxCarry - minCarry || 1)) * 264,
  });

  return (
    <ChartFrame className="p-3">
      <svg
        viewBox="0 0 720 360"
        role="img"
        aria-label="Club shot dispersion comparison"
        className="aspect-[2/1] w-full"
      >
        <rect x="0" y="0" width="720" height="360" rx="12" fill="#ffffff" />
        <line x1="360" x2="360" y1="36" y2="320" stroke="#94a3b8" strokeDasharray="5 5" />
        <line x1="48" x2="672" y1="312" y2="312" stroke="#cbd5e1" />
        <line x1="48" x2="48" y1="36" y2="312" stroke="#cbd5e1" />
        <text x="360" y="28" textAnchor="middle" className="fill-slate-500 text-[12px]">
          Target line
        </text>
        <text x="48" y="338" textAnchor="start" className="fill-slate-500 text-[12px]">
          Left
        </text>
        <text x="672" y="338" textAnchor="end" className="fill-slate-500 text-[12px]">
          Right
        </text>
        <text x="56" y="50" className="fill-slate-500 text-[12px]">
          Carry
        </text>
        {clubB.dispersion.map((point) => {
          const position = plot(point);
          return (
            <circle
              key={`club-b-${point.id}`}
              cx={position.x}
              cy={position.y}
              r="4"
              fill="#0284c7"
              opacity="0.58"
            />
          );
        })}
        {clubA.dispersion.map((point) => {
          const position = plot(point);
          return (
            <circle
              key={`club-a-${point.id}`}
              cx={position.x}
              cy={position.y}
              r="5"
              fill="#059669"
              opacity="0.78"
            />
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-600" /> Club A
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-600" /> Club B
        </span>
      </div>
    </ChartFrame>
  );
}

function radarMetrics(clubA: ClubCompareSide, clubB: ClubCompareSide) {
  const carryMax = maxMetric(clubA.carryMedianYd, clubB.carryMedianYd);
  const speedMax = maxMetric(clubA.ballSpeedAverageMph, clubB.ballSpeedAverageMph);
  const offlineMax = maxMetric(clubA.absoluteOfflineAverageYd, clubB.absoluteOfflineAverageYd);
  const launchMax = maxMetric(clubA.launchAverageDeg, clubB.launchAverageDeg);

  return [
    {
      label: "Carry",
      a: normalizeHigher(clubA.carryMedianYd, carryMax),
      b: normalizeHigher(clubB.carryMedianYd, carryMax),
    },
    {
      label: "Ball speed",
      a: normalizeHigher(clubA.ballSpeedAverageMph, speedMax),
      b: normalizeHigher(clubB.ballSpeedAverageMph, speedMax),
    },
    {
      label: "Offline",
      a: normalizeLower(clubA.absoluteOfflineAverageYd, offlineMax),
      b: normalizeLower(clubB.absoluteOfflineAverageYd, offlineMax),
    },
    {
      label: "Playable",
      a: normalizeHigher(clubA.playableRate, 100),
      b: normalizeHigher(clubB.playableRate, 100),
    },
    {
      label: "Launch",
      a: normalizeHigher(clubA.launchAverageDeg, launchMax),
      b: normalizeHigher(clubB.launchAverageDeg, launchMax),
    },
  ];
}

function radarPoint(index: number, total: number, centre: number, radius: number, value: number) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  const scaledRadius = radius * (value / 100);

  return {
    x: centre + Math.cos(angle) * scaledRadius,
    y: centre + Math.sin(angle) * scaledRadius,
  };
}

function normalizeHigher(value: number | null, maxValue: number) {
  if (value === null || maxValue <= 0) {
    return 0;
  }

  return clamp((value / maxValue) * 100, 0, 100);
}

function normalizeLower(value: number | null, maxValue: number) {
  if (value === null) {
    return 0;
  }

  if (maxValue <= 0) {
    return 100;
  }

  return clamp(100 - (value / maxValue) * 100, 0, 100);
}

function maxMetric(left: number | null, right: number | null) {
  return Math.max(1, left ?? 0, right ?? 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildDelta(focus: ClubCompareSide, baseline: ClubCompareSide): CompareDelta {
  return {
    carryDeltaYd: diff(focus.carryMedianYd, baseline.carryMedianYd),
    ballSpeedDeltaMph: diff(focus.ballSpeedAverageMph, baseline.ballSpeedAverageMph),
    launchDeltaDeg: diff(focus.launchAverageDeg, baseline.launchAverageDeg),
    offlineDeltaYd: diff(focus.absoluteOfflineAverageYd, baseline.absoluteOfflineAverageYd),
    coneDeltaYd: diff(focus.shotConeWidthYd, baseline.shotConeWidthYd),
    playableRateDelta: diff(focus.playableRate, baseline.playableRate),
    bigMissRateDelta: diff(focus.bigMissRate, baseline.bigMissRate),
  };
}

function emptyDelta(): CompareDelta {
  return {
    carryDeltaYd: null,
    ballSpeedDeltaMph: null,
    launchDeltaDeg: null,
    offlineDeltaYd: null,
    coneDeltaYd: null,
    playableRateDelta: null,
    bigMissRateDelta: null,
  };
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatMph(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}

function formatDegrees(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} deg`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}%`;
}

function formatSignedYards(value: number | null) {
  return value === null ? "--" : `${signed(value)} yd`;
}

function formatSignedMph(value: number | null) {
  return value === null ? "--" : `${signed(value)} mph`;
}

function formatSignedDegrees(value: number | null) {
  return value === null ? "--" : `${signed(value)} deg`;
}

function formatSignedRate(value: number | null) {
  return value === null ? "--" : `${signed(value)} pts`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

type MetricWinner = "a" | "b" | "tie" | "context" | "none";

function metricOutcome(
  value: number | null,
  direction: "higher" | "lower",
  unit: "yd" | "mph" | "pts",
): {
  winner: MetricWinner;
  label: string;
  detail: string;
  tone: "green" | "sky" | "slate" | "amber";
} {
  if (value === null) {
    return { winner: "none", label: "No data", detail: "--", tone: "slate" };
  }

  const rounded = Math.round(value * 10) / 10;

  if (rounded === 0) {
    return { winner: "tie", label: "Tie", detail: "No gap", tone: "slate" };
  }

  const clubAWins = direction === "higher" ? rounded > 0 : rounded < 0;

  return {
    winner: clubAWins ? "a" : "b",
    label: clubAWins ? "Club A" : "Club B",
    detail: `by ${formatAbsoluteDelta(rounded, unit)}`,
    tone: clubAWins ? "green" : "sky",
  };
}

function contextOutcome() {
  return {
    winner: "context" as const,
    label: "Context",
    detail: "Fit dependent",
    tone: "amber" as const,
  };
}

function formatAbsoluteDelta(value: number, unit: "yd" | "mph" | "pts") {
  return `${numberFormatter.format(Math.abs(value))} ${unit}`;
}

function deltaClass(winner: MetricWinner) {
  if (winner === "a") return "text-right font-semibold text-emerald-700";
  if (winner === "b") return "text-right font-semibold text-sky-700";
  return "text-right font-semibold text-muted-foreground";
}

function diff(left: number | null, right: number | null) {
  return typeof left === "number" && typeof right === "number"
    ? Math.round((left - right) * 10) / 10
    : null;
}
