"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Activity, BarChart3, Medal, Users } from "lucide-react";

import { DataPanel, SectionHeader, StatusPill } from "@/components/premium";
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
import type { PlayerCompareData, PlayerCompareDelta, PlayerCompareSide } from "@/lib/compare-data";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function PlayerCompareClient({ data }: { data: PlayerCompareData }) {
  const [draftPlayerAId, setDraftPlayerAId] = useState(data.filters.playerAId);
  const [draftPlayerBId, setDraftPlayerBId] = useState(data.filters.playerBId);
  const [selectedPlayerAId, setSelectedPlayerAId] = useState(data.filters.playerAId);
  const [selectedPlayerBId, setSelectedPlayerBId] = useState(data.filters.playerBId);
  const sideByUserId = useMemo(
    () => new Map(data.playerSides.map((player) => [player.userId, player])),
    [data.playerSides],
  );
  const playerA = sideByUserId.get(selectedPlayerAId) ?? data.playerSides[0] ?? null;
  const playerB =
    sideByUserId.get(selectedPlayerBId) ??
    data.playerSides.find((player) => player.userId !== playerA?.userId) ??
    null;
  const delta = playerA && playerB ? buildPlayerDelta(playerA, playerB) : emptyPlayerDelta();

  function applySelection() {
    const nextPlayerAId = draftPlayerAId || data.players[0]?.userId || "";
    const nextPlayerBId =
      draftPlayerBId && draftPlayerBId !== nextPlayerAId
        ? draftPlayerBId
        : (data.players.find((player) => player.userId !== nextPlayerAId)?.userId ?? "");

    setSelectedPlayerAId(nextPlayerAId);
    setSelectedPlayerBId(nextPlayerBId);
    setDraftPlayerBId(nextPlayerBId);
  }

  function resetSelection() {
    const fallbackAId = data.players[0]?.userId ?? "";
    const fallbackBId = data.players.find((player) => player.userId !== fallbackAId)?.userId ?? "";

    setDraftPlayerAId(fallbackAId);
    setDraftPlayerBId(fallbackBId);
    setSelectedPlayerAId(fallbackAId);
    setSelectedPlayerBId(fallbackBId);
  }

  return (
    <>
      <DataPanel>
        <SectionHeader
          title="Choose players"
          description="Compare handicap, scoring, shot patterns, stock yardages and recent tournament submissions."
          action={<Medal className="size-5 text-amber-600" />}
        />
        <CardContent>
          <form
            className="apple-panel grid items-end gap-3 p-3 md:grid-cols-[1fr_auto_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              applySelection();
            }}
          >
            <SelectField label="Player A" value={draftPlayerAId} onChange={setDraftPlayerAId}>
              {data.players.map((player) => (
                <option key={player.userId} value={player.userId}>
                  {playerOptionLabel(player)}
                </option>
              ))}
            </SelectField>
            <div className="hidden pb-2 text-center text-sm font-semibold text-muted-foreground md:block">
              vs
            </div>
            <SelectField label="Player B" value={draftPlayerBId} onChange={setDraftPlayerBId}>
              {data.players.map((player) => (
                <option key={player.userId} value={player.userId}>
                  {playerOptionLabel(player)}
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

      {playerA && playerB ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <DataPanel>
              <SectionHeader
                title="Player side by side"
                description="Handicap, scoring, stock yardages, accuracy and tournament totals."
                action={<Users className="size-5 text-sky-500" />}
              />
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <PlayerSummaryCard side="Player A" player={playerA} tone="emerald" />
                <PlayerSummaryCard side="Player B" player={playerB} tone="sky" />
              </CardContent>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Player gaps"
                description="Score and accuracy rows favour the lower number; distance and playable rate favour the higher number."
                action={<Activity className="size-5 text-emerald-500" />}
              />
              <CardContent>
                <PlayerDeltaTable playerA={playerA} playerB={playerB} delta={delta} />
              </CardContent>
            </DataPanel>
          </section>

          <RecentTournamentScores playerA={playerA} playerB={playerB} />
        </>
      ) : (
        <DataPanel>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Users className="size-9 text-muted-foreground" />
            <div>
              <p className="text-xl font-semibold">Choose two players</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Public profiles and your own profile are available for player comparisons.
              </p>
            </div>
          </CardContent>
        </DataPanel>
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
  children: ReactNode;
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

function PlayerSummaryCard({
  side,
  player,
  tone,
}: {
  side: string;
  player: PlayerCompareSide;
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
          <Link
            href={`/profile/${player.username}`}
            prefetch={false}
            className="mt-2 block truncate text-xl font-semibold tracking-normal hover:underline"
          >
            {player.displayName}
          </Link>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            @{player.username}
            {player.homeCourse ? ` · ${player.homeCourse}` : ""}
          </p>
        </div>
        <StatusPill tone={tone === "emerald" ? "green" : "sky"}>
          {playerStatusLabel(player)}
        </StatusPill>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniStat label="Handicap" value={playerHandicapLabel(player)} />
        <MiniStat label="Best score" value={formatScore(player.bestScore)} />
        <MiniStat label="Scoring avg" value={formatScore(player.scoringAverage)} />
        <MiniStat label="Latest score" value={formatScore(player.latestScore)} />
        <MiniStat label="Tournament total" value={formatTournamentTotal(player)} />
        <MiniStat
          label="Tournament rank"
          value={
            player.tournamentRank ? `#${integerFormatter.format(player.tournamentRank)}` : "--"
          }
        />
        <MiniStat label="Driver carry" value={formatYards(player.driverCarryYd)} />
        <MiniStat label="7i carry" value={formatYards(player.sevenIronCarryYd)} />
        <MiniStat label="Playable" value={formatRate(player.playableRate)} />
        <MiniStat label="Offline avg" value={formatYards(player.absoluteOfflineAverageYd)} />
      </div>
    </div>
  );
}

function PlayerDeltaTable({
  playerA,
  playerB,
  delta,
}: {
  playerA: PlayerCompareSide;
  playerB: PlayerCompareSide;
  delta: PlayerCompareDelta;
}) {
  const playerAHandicap = playerHandicapLabel(playerA);
  const playerBHandicap = playerHandicapLabel(playerB);
  const handicapEstimateDelta = delta.handicapEstimateDelta;
  const handicapDiff =
    handicapEstimateDelta === null
      ? playerAHandicap === playerBHandicap
        ? "Same"
        : "Different"
      : formatSignedStrokes(handicapEstimateDelta);
  const handicapOutcome =
    handicapEstimateDelta === null
      ? contextOutcome()
      : metricOutcome(handicapEstimateDelta, "lower", "shots");
  const rows = [
    {
      label: "Handicap",
      a: playerAHandicap,
      b: playerBHandicap,
      diff: handicapDiff,
      outcome: handicapOutcome,
    },
    {
      label: "Best score",
      a: formatScore(playerA.bestScore),
      b: formatScore(playerB.bestScore),
      diff: formatSignedStrokes(delta.bestScoreDelta),
      outcome: metricOutcome(delta.bestScoreDelta, "lower", "shots"),
    },
    {
      label: "Scoring avg",
      a: formatScore(playerA.scoringAverage),
      b: formatScore(playerB.scoringAverage),
      diff: formatSignedStrokes(delta.scoringAverageDelta),
      outcome: metricOutcome(delta.scoringAverageDelta, "lower", "shots"),
    },
    {
      label: "Latest score",
      a: formatScore(playerA.latestScore),
      b: formatScore(playerB.latestScore),
      diff: formatSignedStrokes(delta.latestScoreDelta),
      outcome: metricOutcome(delta.latestScoreDelta, "lower", "shots"),
    },
    {
      label: "Tournament total",
      a: formatTournamentTotal(playerA),
      b: formatTournamentTotal(playerB),
      diff: formatSignedStrokes(delta.tournamentGrossDelta),
      outcome: metricOutcome(delta.tournamentGrossDelta, "lower", "shots"),
    },
    {
      label: "Driver carry",
      a: formatYards(playerA.driverCarryYd),
      b: formatYards(playerB.driverCarryYd),
      diff: formatSignedYards(delta.driverCarryDeltaYd),
      outcome: metricOutcome(delta.driverCarryDeltaYd, "higher", "yd"),
    },
    {
      label: "7i carry",
      a: formatYards(playerA.sevenIronCarryYd),
      b: formatYards(playerB.sevenIronCarryYd),
      diff: formatSignedYards(delta.sevenIronCarryDeltaYd),
      outcome: metricOutcome(delta.sevenIronCarryDeltaYd, "higher", "yd"),
    },
    {
      label: "Offline avg",
      a: formatYards(playerA.absoluteOfflineAverageYd),
      b: formatYards(playerB.absoluteOfflineAverageYd),
      diff: formatSignedYards(delta.offlineDeltaYd),
      outcome: metricOutcome(delta.offlineDeltaYd, "lower", "yd"),
    },
    {
      label: "Playable",
      a: formatRate(playerA.playableRate),
      b: formatRate(playerB.playableRate),
      diff: formatSignedRate(delta.playableRateDelta),
      outcome: metricOutcome(delta.playableRateDelta, "higher", "pts"),
    },
  ];

  return (
    <div className="overflow-hidden rounded-[8px] border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead className="text-right">Player A</TableHead>
            <TableHead className="text-right">Player B</TableHead>
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

function RecentTournamentScores({
  playerA,
  playerB,
}: {
  playerA: PlayerCompareSide;
  playerB: PlayerCompareSide;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Recent tournament scores"
        description="Most recent submitted tournament rounds for each selected player."
        action={<BarChart3 className="size-5 text-emerald-500" />}
      />
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <RecentScoresList player={playerA} tone="emerald" />
        <RecentScoresList player={playerB} tone="sky" />
      </CardContent>
    </DataPanel>
  );
}

function RecentScoresList({
  player,
  tone,
}: {
  player: PlayerCompareSide;
  tone: "emerald" | "sky";
}) {
  const dotClass = tone === "emerald" ? "bg-emerald-600" : "bg-sky-600";

  return (
    <div className="apple-panel p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className={`size-2 rounded-full ${dotClass}`} />
        <Link href={`/profile/${player.username}`} prefetch={false} className="hover:underline">
          {player.displayName}
        </Link>
      </p>
      <div className="mt-3 overflow-hidden rounded-[8px] border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Round</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {player.recentTournamentScores.length > 0 ? (
              player.recentTournamentScores.map((score) => (
                <TableRow key={`${player.userId}-${score.tournamentTitle}-${score.roundNumber}`}>
                  <TableCell>R{score.roundNumber}</TableCell>
                  <TableCell className="text-right font-medium">{score.grossScore}</TableCell>
                  <TableCell className="text-right">{score.netScore ?? "--"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                  No tournament submissions yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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

function buildPlayerDelta(left: PlayerCompareSide, right: PlayerCompareSide): PlayerCompareDelta {
  return {
    handicapEstimateDelta: diff(left.handicapEstimate, right.handicapEstimate),
    bestScoreDelta: diff(left.bestScore, right.bestScore),
    scoringAverageDelta: diff(left.scoringAverage, right.scoringAverage),
    latestScoreDelta: diff(left.latestScore, right.latestScore),
    driverCarryDeltaYd: diff(left.driverCarryYd, right.driverCarryYd),
    sevenIronCarryDeltaYd: diff(left.sevenIronCarryYd, right.sevenIronCarryYd),
    offlineDeltaYd: diff(left.absoluteOfflineAverageYd, right.absoluteOfflineAverageYd),
    playableRateDelta: diff(left.playableRate, right.playableRate),
    tournamentGrossDelta: diff(left.tournamentGrossTotal, right.tournamentGrossTotal),
  };
}

function emptyPlayerDelta(): PlayerCompareDelta {
  return {
    handicapEstimateDelta: null,
    bestScoreDelta: null,
    scoringAverageDelta: null,
    latestScoreDelta: null,
    driverCarryDeltaYd: null,
    sevenIronCarryDeltaYd: null,
    offlineDeltaYd: null,
    playableRateDelta: null,
    tournamentGrossDelta: null,
  };
}

function playerOptionLabel(player: PlayerCompareData["players"][number]) {
  const rank = player.worldRank
    ? `OWGR #${player.worldRank}`
    : (player.handicapBand ??
      (typeof player.handicapEstimate === "number"
        ? `Hcp ${numberFormatter.format(player.handicapEstimate)}`
        : "Player"));
  return `${player.displayName} (${rank})`;
}

function playerStatusLabel(player: PlayerCompareSide) {
  if (player.worldRank) {
    return `OWGR #${player.worldRank}`;
  }

  const handicap = playerHandicapLabel(player);
  return handicap === "--" ? "Player" : handicap;
}

function playerHandicapLabel(player: PlayerCompareSide) {
  if (player.handicapBand) {
    return player.handicapBand;
  }

  return typeof player.handicapEstimate === "number"
    ? `Hcp ${numberFormatter.format(player.handicapEstimate)}`
    : "--";
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}%`;
}

function formatScore(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatTournamentTotal(player: PlayerCompareSide) {
  if (player.tournamentGrossTotal === null) {
    return "--";
  }

  const rounds = player.tournamentRoundsCompleted ?? 0;
  return `${integerFormatter.format(player.tournamentGrossTotal)}${rounds > 0 ? ` / ${rounds} rd` : ""}`;
}

function formatSignedYards(value: number | null) {
  return value === null ? "--" : `${signed(value)} yd`;
}

function formatSignedRate(value: number | null) {
  return value === null ? "--" : `${signed(value)} pts`;
}

function formatSignedStrokes(value: number | null) {
  return value === null ? "--" : `${signed(value)} shots`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

type MetricWinner = "a" | "b" | "tie" | "context" | "none";

function metricOutcome(
  value: number | null,
  direction: "higher" | "lower",
  unit: "yd" | "pts" | "shots",
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

  const playerAWins = direction === "higher" ? rounded > 0 : rounded < 0;

  return {
    winner: playerAWins ? "a" : "b",
    label: playerAWins ? "Player A" : "Player B",
    detail: `by ${formatAbsoluteDelta(rounded, unit)}`,
    tone: playerAWins ? "green" : "sky",
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

function formatAbsoluteDelta(value: number, unit: "yd" | "pts" | "shots") {
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
