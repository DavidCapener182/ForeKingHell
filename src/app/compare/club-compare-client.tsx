"use client";

import { useMemo, useState } from "react";
import { Crosshair, GitCompareArrows, Target } from "lucide-react";

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
              <CardContent>
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
  const rows = [
    {
      label: "Carry",
      a: formatYards(clubA.carryMedianYd),
      b: formatYards(clubB.carryMedianYd),
      diff: formatSignedYards(delta.carryDeltaYd),
      outcome: metricOutcome(delta.carryDeltaYd, "higher", "yd"),
    },
    {
      label: "Total",
      a: formatYards(clubA.totalMedianYd),
      b: formatYards(clubB.totalMedianYd),
      diff: formatSignedYards(diff(clubA.totalMedianYd, clubB.totalMedianYd)),
      outcome: metricOutcome(diff(clubA.totalMedianYd, clubB.totalMedianYd), "higher", "yd"),
    },
    {
      label: "Ball speed",
      a: formatMph(clubA.ballSpeedAverageMph),
      b: formatMph(clubB.ballSpeedAverageMph),
      diff: formatSignedMph(delta.ballSpeedDeltaMph),
      outcome: metricOutcome(delta.ballSpeedDeltaMph, "higher", "mph"),
    },
    {
      label: "Offline avg",
      a: formatYards(clubA.absoluteOfflineAverageYd),
      b: formatYards(clubB.absoluteOfflineAverageYd),
      diff: formatSignedYards(delta.offlineDeltaYd),
      outcome: metricOutcome(delta.offlineDeltaYd, "lower", "yd"),
    },
    {
      label: "Shot cone",
      a: formatYards(clubA.shotConeWidthYd),
      b: formatYards(clubB.shotConeWidthYd),
      diff: formatSignedYards(delta.coneDeltaYd),
      outcome: metricOutcome(delta.coneDeltaYd, "lower", "yd"),
    },
    {
      label: "Playable",
      a: formatRate(clubA.playableRate),
      b: formatRate(clubB.playableRate),
      diff: formatSignedRate(delta.playableRateDelta),
      outcome: metricOutcome(delta.playableRateDelta, "higher", "pts"),
    },
    {
      label: "Big misses",
      a: formatRate(clubA.bigMissRate),
      b: formatRate(clubB.bigMissRate),
      diff: formatSignedRate(delta.bigMissRateDelta),
      outcome: metricOutcome(delta.bigMissRateDelta, "lower", "pts"),
    },
    {
      label: "Launch",
      a: formatDegrees(clubA.launchAverageDeg),
      b: formatDegrees(clubB.launchAverageDeg),
      diff: formatSignedDegrees(delta.launchDeltaDeg),
      outcome: contextOutcome(),
    },
  ];

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
              <TableCell className="text-right">{row.a}</TableCell>
              <TableCell className="text-right">{row.b}</TableCell>
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
