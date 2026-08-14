"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import {
  ComparisonWorkspace,
  type ComparisonTableRow,
  type SavedWorkspaceComparison,
} from "@/app/compare/comparison-workspace";
import { StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { Item, ItemContent } from "@/components/ui/item";
import type { PlayerCompareData, PlayerCompareDelta, PlayerCompareSide } from "@/lib/compare-data";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function PlayerCompareClient({
  data,
  savedComparisons = [],
}: {
  data: PlayerCompareData;
  savedComparisons?: SavedWorkspaceComparison[];
}) {
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
  const rows = playerA && playerB ? playerComparisonRows(playerA, playerB, delta) : [];

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
    <ComparisonWorkspace
      view="players"
      focusValue={draftPlayerAId}
      baselineValue={draftPlayerBId}
      appliedFocusValue={selectedPlayerAId}
      appliedBaselineValue={selectedPlayerBId}
      onFocusValueChange={setDraftPlayerAId}
      onBaselineValueChange={setDraftPlayerBId}
      onCompare={applySelection}
      onReset={resetSelection}
      focusLabel={playerA?.displayName ?? "Player focus"}
      baselineLabel={playerB?.displayName ?? "Player baseline"}
      focusOptions={data.players.map((player) => ({
        value: player.userId,
        label: player.displayName,
        description: playerOptionLabel(player),
      }))}
      baselineOptions={data.players.map((player) => ({
        value: player.userId,
        label: player.displayName,
        description: playerOptionLabel(player),
        disabled: player.userId === draftPlayerAId,
      }))}
      rows={rows}
      sampleReady={Boolean(playerA && playerB && playerA.rounds >= 5 && playerB.rounds >= 5)}
      sampleTitle={
        playerA && playerB && playerA.rounds >= 5 && playerB.rounds >= 5
          ? "Established player samples"
          : "Mixed player evidence depth"
      }
      sampleDescription={
        playerA && playerB
          ? `${playerA.displayName} has ${integerFormatter.format(playerA.rounds)} rounds and ${playerB.displayName} has ${integerFormatter.format(playerB.rounds)}. Shot metrics use visible stock-shot evidence and remain provisional when either side is sparse.`
          : "Choose two visible profiles to compare."
      }
      evidenceTitle="Player comparison evidence"
      evidenceDescription="Profiles and recent tournament submissions support the single metric table."
      evidence={
        playerA && playerB ? (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              <PlayerSummaryCard side="Focus" player={playerA} tone="emerald" />
              <PlayerSummaryCard side="Baseline" player={playerB} tone="sky" />
            </div>
            <RecentTournamentScores playerA={playerA} playerB={playerB} />
          </>
        ) : null
      }
      savedComparisons={savedComparisons}
      exportFileName="forekinghell-player-comparison-metrics.csv"
      empty={
        <AppEmptyState
          icon={<Users className="size-5" />}
          title="Choose two players"
          description="Public profiles and your own profile are available for one comparison."
          primaryAction={
            <Button type="button" variant="outline" onClick={resetSelection}>
              Use available players
            </Button>
          }
        />
      }
    />
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
  const dotClass =
    tone === "emerald"
      ? "bg-[var(--status-success-foreground)]"
      : "bg-[var(--status-information-foreground)]";

  return (
    <Item variant="outline" className="items-start p-4">
      <ItemContent className="space-y-0">
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

        <dl className="mt-4 grid gap-x-3 gap-y-4 sm:grid-cols-2">
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
        </dl>
      </ItemContent>
    </Item>
  );
}

function playerComparisonRows(
  playerA: PlayerCompareSide,
  playerB: PlayerCompareSide,
  delta: PlayerCompareDelta,
): ComparisonTableRow[] {
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

  const confidence = playerComparisonConfidence(playerA, playerB);
  return rows.map((row) => {
    const rowConfidence =
      row.outcome.winner === "none" ? { label: "No data", tone: "slate" as const } : confidence;
    return {
      id: row.label,
      metric: row.label,
      focus: row.a,
      baseline: row.b,
      delta: row.diff,
      direction: playerDirectionLabel(row.outcome.winner),
      directionTone: row.outcome.tone,
      confidence: rowConfidence.label,
      confidenceTone: rowConfidence.tone,
    };
  });
}

function RecentTournamentScores({
  playerA,
  playerB,
}: {
  playerA: PlayerCompareSide;
  playerB: PlayerCompareSide;
}) {
  return (
    <section className="grid gap-3" data-player-tournament-comparison>
      <div>
        <h3 className="font-semibold">Recent tournament scores</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Most recent submitted tournament rounds for each selected player.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecentScoresList player={playerA} tone="emerald" />
        <RecentScoresList player={playerB} tone="sky" />
      </div>
    </section>
  );
}

function RecentScoresList({
  player,
  tone,
}: {
  player: PlayerCompareSide;
  tone: "emerald" | "sky";
}) {
  const dotClass =
    tone === "emerald"
      ? "bg-[var(--status-success-foreground)]"
      : "bg-[var(--status-information-foreground)]";

  return (
    <Item variant="outline" className="items-start p-4">
      <ItemContent className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className={`size-2 rounded-full ${dotClass}`} />
          <Link href={`/profile/${player.username}`} prefetch={false} className="hover:underline">
            {player.displayName}
          </Link>
        </p>
        <div className="divide-y divide-border rounded-lg border">
          {player.recentTournamentScores.length > 0 ? (
            player.recentTournamentScores.map((score) => (
              <div
                key={`${player.userId}-${score.tournamentTitle}-${score.roundNumber}`}
                className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-2 text-sm"
              >
                <span>Round {score.roundNumber}</span>
                <span className="font-medium tabular-nums">Gross {score.grossScore}</span>
                <span className="text-muted-foreground tabular-nums">
                  Net {score.netScore ?? "--"}
                </span>
              </div>
            ))
          ) : (
            <p className="px-3 py-5 text-sm text-muted-foreground">
              No tournament submissions yet.
            </p>
          )}
        </div>
      </ItemContent>
    </Item>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-border pl-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-semibold">{value}</dd>
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

function playerDirectionLabel(winner: MetricWinner) {
  if (winner === "a") return "Focus";
  if (winner === "b") return "Baseline";
  if (winner === "tie") return "Even";
  if (winner === "context") return "Context";
  return "No data";
}

function playerComparisonConfidence(playerA: PlayerCompareSide, playerB: PlayerCompareSide) {
  const smallestRoundSample = Math.min(playerA.rounds, playerB.rounds);
  const smallestShotSample = Math.min(playerA.stockShots, playerB.stockShots);
  if (smallestRoundSample >= 5 && smallestShotSample >= 10) {
    return { label: "Decision-ready", tone: "green" as const };
  }
  if (smallestRoundSample >= 2 || smallestShotSample >= 3) {
    return { label: "Early", tone: "amber" as const };
  }
  return { label: "Low sample", tone: "slate" as const };
}

function diff(left: number | null, right: number | null) {
  return typeof left === "number" && typeof right === "number"
    ? Math.round((left - right) * 10) / 10
    : null;
}
