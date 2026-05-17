import Link from "next/link";
import { ArrowLeft, Award, Flag, Plus, Share2, Upload } from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  MobileSectionChips,
  PageHeader,
  PageShell,
  StatusPill,
  StickyMobileAction,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { rapsodoSyncSessions, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import {
  calculateHandicapSummary,
  calculateRoundDifferential,
  formatHandicapDelta,
  formatHandicapValue,
  type HandicapSummary,
} from "@/lib/round-handicap";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");

export default async function RoundsPage() {
  const rounds = await getRounds();
  const latestRound = rounds[0] ?? null;
  const realRounds = rounds.filter((round) => round.type === "real_round");
  const simulatorRounds = rounds.filter((round) => round.type !== "real_round");
  const realHandicap = calculateHandicapSummary(realRounds.map((round) => round.handicapDifferential));
  const simHandicap = calculateHandicapSummary(simulatorRounds.map((round) => round.handicapDifferential));

  return (
    <PageShell size="6xl">
        <MobileRouteHeader title="Play" group="play" activeKey="rounds" />

        <div className="hidden flex-col items-start gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button asChild variant="outline">
              <Link href="/achievements">
                <Award className="size-4" />
                Achievements
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/rounds/new">
                <Plus className="size-4" />
                Add real round
              </Link>
            </Button>
            <Button asChild>
              <Link href="/import">
                <Upload className="size-4" />
                Import round CSV
              </Link>
            </Button>
          </div>
        </div>

        <PageHeader
          eyebrow={<StatusPill tone="sky">Round tracker</StatusPill>}
          title="Saved rounds"
          description="View real scorecards separately from simulator and launch-monitor rounds."
          visual={<PageArtwork variant="rounds" alt="" className="h-full min-h-44" priority />}
          metrics={[
            { label: "Real rounds", value: realRounds.length },
            { label: "Simulator", value: simulatorRounds.length },
            { label: "Real ceiling", value: formatHandicapValue(realHandicap.value), detail: handicapTrendText(realHandicap) },
            { label: "Sim ceiling", value: formatHandicapValue(simHandicap.value), detail: handicapTrendText(simHandicap) },
          ]}
        />

        <MobileSectionChips
          items={[
            { label: "Latest", href: "#latest" },
            { label: "History", href: "#history" },
            { label: "Stats", href: "#stats" },
          ]}
        />

        <section id="stats" className="grid min-w-0 scroll-mt-28 gap-4 md:grid-cols-3">
          <Card id="history" className="premium-card order-2 min-w-0 scroll-mt-28 md:order-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Round history</CardTitle>
              <CardDescription>
                Open a real round to edit the scorecard, or a simulator round to review its club data.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden px-3 sm:px-4">
              <DataTableFrame
                mobile={
                  <MobileDataList>
                    {rounds.length > 0 ? (
                      <>
                        {rounds.slice(0, 3).map((round) => (
                          <RoundMobileCard key={round.id} round={round} />
                        ))}
                        {rounds.length > 3 ? (
                          <details className="contents">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                              Show more rounds
                            </summary>
                            {rounds.slice(3).map((round) => (
                              <RoundMobileCard key={round.id} round={round} />
                            ))}
                          </details>
                        ) : null}
                      </>
                    ) : (
                      <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                        No saved rounds yet. Import a simulated-course CSV or add a real scorecard.
                      </div>
                    )}
                  </MobileDataList>
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Round</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Diff</TableHead>
                      <TableHead className="text-right">Putts</TableHead>
                      <TableHead className="text-right">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rounds.map((round) => (
                      <TableRow key={round.id}>
                        <TableCell className="font-medium">
                          <Link href={`/rounds/${round.id}`} className="hover:underline">
                            {round.courseName ?? round.fileName ?? "Untitled round"}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(round.date)}</TableCell>
                        <TableCell>
                          <Badge variant={round.type === "real_round" ? "default" : "secondary"}>
                            {formatSessionType(round.type)}
                          </Badge>
                          {round.roundStatus === "in_progress" ? (
                            <Badge variant="outline" className="ml-2">Resume</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {round.totalScore === null ? "--" : integerFormatter.format(round.totalScore)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatHandicapValue(round.handicapDifferential)}
                        </TableCell>
                        <TableCell className="text-right">
                          {round.totalPutts === null ? "--" : integerFormatter.format(round.totalPutts)}
                        </TableCell>
                        <TableCell className="text-right">
                          {round.type === "real_round"
                            ? "Scorecard only"
                            : `${integerFormatter.format(round.shotCount)} shots`}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No saved rounds yet. Import a simulated-course CSV or add a real scorecard.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </CardContent>
          </Card>

          <Card id="latest" className="premium-card order-1 min-w-0 scroll-mt-28 md:order-2">
            <CardHeader>
              <CardTitle>Latest</CardTitle>
              <CardDescription>Most recent saved round.</CardDescription>
            </CardHeader>
            <CardContent>
              {latestRound ? (
                  <div className="space-y-4">
                  <PageArtwork
                    variant="fairway"
                    alt=""
                    crop="random"
                    cropKey={latestRound.id}
                    className="block h-28 min-h-0 rounded-xl"
                    sizes="(min-width: 768px) 320px, 100vw"
                  />
                  <div className="apple-panel-strong p-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(latestRound.date)} - {formatSessionType(latestRound.type)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-normal">
                      {latestRound.courseName ?? "Untitled round"}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <RoundMetric label="Score" value={latestRound.totalScore} />
                    <RoundMetric label="Par" value={latestRound.totalPar} />
                    <RoundMetric label="Putts" value={latestRound.totalPutts} />
                    <RoundMetric
                      label="Differential"
                      value={formatHandicapValue(latestRound.handicapDifferential)}
                    />
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/rounds/${latestRound.id}`}>
                      <Flag className="size-4" />
                      Review round
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Real and simulator rounds will appear here after they are saved.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
        <RoundSharingPanel latestRound={latestRound} />
        <StickyMobileAction>
          <Button asChild className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Link href="/rounds/new">
              <Plus className="size-4" />
              Add round
            </Link>
          </Button>
        </StickyMobileAction>
    </PageShell>
  );
}

function RoundMobileCard({ round }: { round: Awaited<ReturnType<typeof getRounds>>[number] }) {
  return (
    <MobileDataCard
      href={`/rounds/${round.id}`}
      title={round.courseName ?? round.fileName ?? "Untitled round"}
      subtitle={formatDate(round.date)}
      action={
        <Badge
          variant={round.type === "real_round" ? "default" : "secondary"}
          className="max-w-28 truncate"
        >
          {formatSessionType(round.type)}
        </Badge>
      }
    >
      <PageArtwork
        variant="fairway"
        alt=""
        crop="random"
        cropKey={round.id}
        className="block h-20 min-h-0 w-full rounded-xl"
        sizes="100vw"
      />
      {round.roundStatus === "in_progress" ? <DataPair label="Status" value="Resume" /> : null}
      <DataPair
        label="Score"
        value={round.totalScore === null ? "--" : integerFormatter.format(round.totalScore)}
      />
      <DataPair label="Differential" value={formatHandicapValue(round.handicapDifferential)} />
      <DataPair
        label="Putts"
        value={round.totalPutts === null ? "--" : integerFormatter.format(round.totalPutts)}
      />
      <DataPair
        label="Data"
        value={round.type === "real_round" ? "Scorecard only" : `${integerFormatter.format(round.shotCount)} shots`}
      />
    </MobileDataCard>
  );
}

function RoundSharingPanel({ latestRound }: { latestRound: Awaited<ReturnType<typeof getRounds>>[number] | null }) {
  return (
    <section className="premium-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Shareable round cards</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Round sharing stays controlled from each round. Create a private link, then choose whether any PB from that round belongs on the feed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={latestRound ? `/rounds/${latestRound.id}#share` : "/rounds/new"} prefetch={false}>
              <Share2 className="size-4" />
              Share summary
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/feed?filter=rounds" prefetch={false}>
              <Flag className="size-4" />
              Round feed
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

async function getRounds() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [sessionRows, shotCounts] = await Promise.all([
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
        roundStatus: sessions.roundStatus,
        weatherJson: sessions.weatherJson,
        equipmentNotes: sessions.equipmentNotes,
        scorecardJson: sessions.scorecardJson,
        courseRating: teeSets.courseRating,
        slopeRating: teeSets.slopeRating,
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
      .where(and(eq(sessions.userId, userId), inArray(sessions.type, [...roundSessionTypes])))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({
        sessionId: shots.sessionId,
        count: count(),
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.sessionId),
  ]);
  const shotCountBySessionId = new Map(shotCounts.map((row) => [row.sessionId, row.count]));

  return sessionRows.filter(isRoundHistorySession).map((session) => {
    const scorecard = session.scorecardJson ?? [];
    const totalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
    const totalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
    const totalPar = scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
    const handicapDifferential =
      calculateRoundDifferential({
        totalScore,
        totalPar,
        courseRating: session.courseRating,
        slopeRating: session.slopeRating,
        holesPlayed: scorecard.length,
      });

    return {
      ...session,
      shotCount: shotCountBySessionId.get(session.id) ?? 0,
      totalScore,
      totalPutts,
      totalPar,
      handicapDifferential,
    };
  });
}

function handicapTrendText(summary: HandicapSummary) {
  const direction = summary.trend.direction;

  if (summary.sampleSize === 0) {
    return "No scorecards";
  }

  if (direction === "none") {
    return `${summary.sampleSize} round sample`;
  }

  const label = direction === "down" ? "Trending down" : direction === "up" ? "Trending up" : "Flat";
  return `${label} ${formatHandicapDelta(summary.trend.delta)}`;
}

function RoundMetric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#F5F6F4] px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">
        {typeof value === "number" ? integerFormatter.format(value) : value ?? "--"}
      </span>
    </div>
  );
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real round";
  }

  if (value === "simulated_course") {
    return "Sim course";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
