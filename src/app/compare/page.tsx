import Link from "next/link";
import { ArrowLeft, Crosshair, Upload } from "lucide-react";

import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import {
  defaultClubCompareFilters,
  defaultPlayerCompareFilters,
  getClubCompareData,
  getPlayerCompareData,
  type ClubCompareFilters,
  type PlayerCompareFilters,
  type PlayerCompareSide,
} from "@/lib/compare-data";
import { ClubCompareClient } from "./club-compare-client";
import { PlayerCompareClient } from "./player-compare-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={<StatusPill tone="amber">Configuration</StatusPill>}
          title="Compare clubs"
          description="DATABASE_URL is required before club comparisons can be calculated."
        />
      </PageShell>
    );
  }

  const params = await searchParams;
  const [playerData, data] = await Promise.all([
    getPlayerCompareData(parsePlayerFilters(params)),
    getClubCompareData(parseFilters(params)),
  ]);
  const { playerA, playerB, delta: playerDelta } = playerData;
  const playersReady = Boolean(playerA && playerB);

  return (
    <PageShell>
      <MobileRouteHeader title="Analyse" group="analyse" activeKey="compare" />

      <div className="hidden items-center justify-between gap-4 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import data
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="sky">Player and club comparisons</StatusPill>}
        title="Compare"
        description={
          playersReady
            ? `${playerA?.displayName} against ${playerB?.displayName}. Player gaps are Player A minus Player B.`
            : "Compare player profiles, handicap, scoring, stock yardages, tournament scores, then drill into club-vs-club data."
        }
        actions={
          <Button
            asChild
            size="lg"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <Link href="/shots" prefetch={false}>
              <Crosshair className="size-4" />
              Open shots
            </Link>
          </Button>
        }
        metrics={[
          {
            label: "Player A best",
            value: playerA ? formatScore(playerA.bestScore) : "--",
            detail: playerA ? playerStatusLabel(playerA) : "Choose a player",
          },
          {
            label: "Player B best",
            value: playerB ? formatScore(playerB.bestScore) : "--",
            detail: playerB ? playerStatusLabel(playerB) : "Choose a player",
          },
          {
            label: "Latest gap",
            value: playersReady ? formatSignedStrokes(playerDelta.latestScoreDelta) : "--",
            detail: "Latest 18-hole score equivalent",
          },
          {
            label: "Tournament gap",
            value: formatSignedStrokes(playerDelta.tournamentGrossDelta),
            detail: "Lower total is better",
          },
        ]}
      />

      <PlayerCompareClient data={playerData} />

      <ClubCompareClient data={data} />
    </PageShell>
  );
}

function parseFilters(searchParams: Awaited<SearchParams>): ClubCompareFilters {
  const defaults = defaultClubCompareFilters();

  return {
    clubAId:
      stringParam(searchParams.clubAId) || stringParam(searchParams.clubId) || defaults.clubAId,
    clubBId: stringParam(searchParams.clubBId) || defaults.clubBId,
  };
}

function parsePlayerFilters(searchParams: Awaited<SearchParams>): PlayerCompareFilters {
  const defaults = defaultPlayerCompareFilters();

  return {
    playerAId: stringParam(searchParams.playerAId) || defaults.playerAId,
    playerBId: stringParam(searchParams.playerBId) || defaults.playerBId,
  };
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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

function formatScore(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatSignedStrokes(value: number | null) {
  return value === null ? "--" : `${signed(value)} shots`;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}
