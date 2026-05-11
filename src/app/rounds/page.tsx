import Link from "next/link";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Award, Flag, Minus, Plus, Upload } from "lucide-react";
import { asc, count, desc, eq, inArray } from "drizzle-orm";

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
import { sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
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
  const combinedHandicap = calculateHandicapSummary(rounds.map((round) => round.handicapDifferential));

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
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

        <header className="premium-hero p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <Badge className="w-fit bg-sky-100 text-sky-700 hover:bg-sky-100">
                Round tracker
              </Badge>
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                Saved rounds
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                View real scorecards separately from simulator and launch-monitor rounds.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <StatTile label="Real rounds" value={realRounds.length} />
              <StatTile label="Simulator" value={simulatorRounds.length} />
              <HandicapStatTile label="Real HCP" summary={realHandicap} />
              <HandicapStatTile label="Sim HCP" summary={simHandicap} />
              <HandicapStatTile label="Combined" summary={combinedHandicap} />
              <StatTile label="Club shots" value={rounds.reduce((total, round) => total + round.shotCount, 0)} />
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="premium-card md:col-span-2">
            <CardHeader>
              <CardTitle>Round history</CardTitle>
              <CardDescription>
                Open a real round to edit the scorecard, or a simulator round to review its club data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-[8px] border">
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
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Latest</CardTitle>
              <CardDescription>Most recent saved round.</CardDescription>
            </CardHeader>
            <CardContent>
              {latestRound ? (
                <div className="space-y-4">
                  <div className="rounded-[8px] border bg-[#f9fafb] p-4">
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
      </div>
    </main>
  );
}

async function getRounds() {
  const db = getDb();
  const [sessionRows, shotCounts] = await Promise.all([
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
        scorecardJson: sessions.scorecardJson,
        courseRating: teeSets.courseRating,
        slopeRating: teeSets.slopeRating,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .where(inArray(sessions.type, ["round", "simulator", "simulated_course", "real_round"]))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({
        sessionId: shots.sessionId,
        count: count(),
      })
      .from(shots)
      .groupBy(shots.sessionId),
  ]);
  const shotCountBySessionId = new Map(shotCounts.map((row) => [row.sessionId, row.count]));

  return sessionRows.map((session) => {
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

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[8px] border bg-[#f9fafb] p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-normal">
        {typeof value === "number" ? integerFormatter.format(value) : value}
      </p>
    </div>
  );
}

function HandicapStatTile({ label, summary }: { label: string; summary: HandicapSummary }) {
  return (
    <div className="rounded-[8px] border bg-[#f9fafb] p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-normal">
        {formatHandicapValue(summary.value)}
      </p>
      <HandicapTrend summary={summary} />
    </div>
  );
}

function HandicapTrend({ summary }: { summary: HandicapSummary }) {
  const direction = summary.trend.direction;

  if (summary.sampleSize === 0) {
    return <p className="mt-1 text-xs text-muted-foreground">No scorecards</p>;
  }

  if (direction === "none") {
    return <p className="mt-1 text-xs text-muted-foreground">{summary.sampleSize} round sample</p>;
  }

  const Icon = direction === "down" ? ArrowDownRight : direction === "up" ? ArrowUpRight : Minus;
  const label = direction === "down" ? "Trending down" : direction === "up" ? "Trending up" : "Flat";
  const tone =
    direction === "down"
      ? "text-emerald-700"
      : direction === "up"
        ? "text-rose-700"
        : "text-muted-foreground";

  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon className="size-3.5" />
      {label} {formatHandicapDelta(summary.trend.delta)}
    </p>
  );
}

function RoundMetric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex items-center justify-between rounded-[8px] border bg-[#f9fafb] px-3 py-2">
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
