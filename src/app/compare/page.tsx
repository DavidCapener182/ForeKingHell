import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Crosshair,
  GitCompareArrows,
  Medal,
  Target,
  Upload,
  Users,
} from "lucide-react";

import {
  ChartFrame,
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
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
import {
  defaultClubCompareFilters,
  defaultPlayerCompareFilters,
  getClubCompareData,
  getPlayerCompareData,
  type ClubCompareData,
  type ClubCompareFilters,
  type ClubCompareSide,
  type CompareDelta,
  type DispersionPoint,
  type PlayerCompareData,
  type PlayerCompareFilters,
  type PlayerCompareSide,
  type PlayerCompareDelta,
} from "@/lib/compare-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const integerFormatter = new Intl.NumberFormat("en-GB");
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
  const { clubA, clubB, delta } = data;
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

      <PlayerCompareForm data={playerData} />

      {playerA && playerB ? (
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
              <PlayerDeltaTable playerA={playerA} playerB={playerB} delta={playerDelta} />
            </CardContent>
          </DataPanel>
        </section>
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

      {playerA && playerB ? <RecentTournamentScores playerA={playerA} playerB={playerB} /> : null}

      <ClubCompareForm data={data} />

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
    </PageShell>
  );
}

function PlayerCompareForm({ data }: { data: PlayerCompareData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Choose players"
        description="Compare handicap, scoring, shot patterns, stock yardages and recent tournament submissions."
        action={<Medal className="size-5 text-amber-600" />}
      />
      <CardContent>
        <form className="apple-panel grid items-end gap-3 p-3 md:grid-cols-[1fr_auto_1fr_auto]">
          <SelectField label="Player A" name="playerAId" defaultValue={data.filters.playerAId}>
            {data.players.map((player) => (
              <option key={player.userId} value={player.userId}>
                {playerOptionLabel(player)}
              </option>
            ))}
          </SelectField>
          <div className="hidden pb-2 text-center text-sm font-semibold text-muted-foreground md:block">
            vs
          </div>
          <SelectField label="Player B" name="playerBId" defaultValue={data.filters.playerBId}>
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
            <Button asChild variant="outline">
              <Link href="/compare" prefetch={false}>
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </DataPanel>
  );
}

function ClubCompareForm({ data }: { data: ClubCompareData }) {
  return (
    <DataPanel>
      <SectionHeader
        title="Choose clubs"
        description="Pick exactly what you want compared. No session or baseline setup required."
        action={<GitCompareArrows className="size-5 text-muted-foreground" />}
      />
      <CardContent>
        <form className="apple-panel grid items-end gap-3 p-3 md:grid-cols-[1fr_auto_1fr_auto]">
          <SelectField label="Club A" name="clubAId" defaultValue={data.filters.clubAId}>
            {data.clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.label} ({integerFormatter.format(club.shotCount)})
              </option>
            ))}
          </SelectField>
          <div className="hidden pb-2 text-center text-sm font-semibold text-muted-foreground md:block">
            vs
          </div>
          <SelectField label="Club B" name="clubBId" defaultValue={data.filters.clubBId}>
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
            <Button asChild variant="outline">
              <Link href="/compare" prefetch={false}>
                Reset
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </DataPanel>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
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
      : playerMetricOutcome(handicapEstimateDelta, "lower", "shots");
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
      outcome: playerMetricOutcome(delta.bestScoreDelta, "lower", "shots"),
    },
    {
      label: "Scoring avg",
      a: formatScore(playerA.scoringAverage),
      b: formatScore(playerB.scoringAverage),
      diff: formatSignedStrokes(delta.scoringAverageDelta),
      outcome: playerMetricOutcome(delta.scoringAverageDelta, "lower", "shots"),
    },
    {
      label: "Latest score",
      a: formatScore(playerA.latestScore),
      b: formatScore(playerB.latestScore),
      diff: formatSignedStrokes(delta.latestScoreDelta),
      outcome: playerMetricOutcome(delta.latestScoreDelta, "lower", "shots"),
    },
    {
      label: "Tournament total",
      a: formatTournamentTotal(playerA),
      b: formatTournamentTotal(playerB),
      diff: formatSignedStrokes(delta.tournamentGrossDelta),
      outcome: playerMetricOutcome(delta.tournamentGrossDelta, "lower", "shots"),
    },
    {
      label: "Driver carry",
      a: formatYards(playerA.driverCarryYd),
      b: formatYards(playerB.driverCarryYd),
      diff: formatSignedYards(delta.driverCarryDeltaYd),
      outcome: playerMetricOutcome(delta.driverCarryDeltaYd, "higher", "yd"),
    },
    {
      label: "7i carry",
      a: formatYards(playerA.sevenIronCarryYd),
      b: formatYards(playerB.sevenIronCarryYd),
      diff: formatSignedYards(delta.sevenIronCarryDeltaYd),
      outcome: playerMetricOutcome(delta.sevenIronCarryDeltaYd, "higher", "yd"),
    },
    {
      label: "Offline avg",
      a: formatYards(playerA.absoluteOfflineAverageYd),
      b: formatYards(playerB.absoluteOfflineAverageYd),
      diff: formatSignedYards(delta.offlineDeltaYd),
      outcome: playerMetricOutcome(delta.offlineDeltaYd, "lower", "yd"),
    },
    {
      label: "Playable",
      a: formatRate(playerA.playableRate),
      b: formatRate(playerB.playableRate),
      diff: formatSignedRate(delta.playableRateDelta),
      outcome: playerMetricOutcome(delta.playableRateDelta, "higher", "pts"),
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

function formatMph(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}

function formatDegrees(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} deg`;
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

function formatSignedMph(value: number | null) {
  return value === null ? "--" : `${signed(value)} mph`;
}

function formatSignedDegrees(value: number | null) {
  return value === null ? "--" : `${signed(value)} deg`;
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
  unit: "yd" | "mph" | "pts" | "shots",
  labels: { a: string; b: string } = { a: "Club A", b: "Club B" },
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
    label: clubAWins ? labels.a : labels.b,
    detail: `by ${formatAbsoluteDelta(rounded, unit)}`,
    tone: clubAWins ? "green" : "sky",
  };
}

function playerMetricOutcome(
  value: number | null,
  direction: "higher" | "lower",
  unit: "yd" | "mph" | "pts" | "shots",
) {
  return metricOutcome(value, direction, unit, { a: "Player A", b: "Player B" });
}

function contextOutcome() {
  return {
    winner: "context" as const,
    label: "Context",
    detail: "Fit dependent",
    tone: "amber" as const,
  };
}

function formatAbsoluteDelta(value: number, unit: "yd" | "mph" | "pts" | "shots") {
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
