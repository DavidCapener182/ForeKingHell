import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  Flag,
  Info,
  Trophy,
  Upload,
} from "lucide-react";
import { asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  DataPanel,
  InsightBlock,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
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
import { sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { buildCoachSummary } from "@/lib/coach";
import { getProgressData } from "@/lib/progress-data";
import {
  calculateHandicapSummary,
  calculateRoundDifferential,
  formatHandicapDelta,
  formatHandicapValue,
  type HandicapSummary,
} from "@/lib/round-handicap";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const roundSessionTypes = ["round", "simulator", "simulated_course", "real_round"] as const;

export default async function HandicapPage() {
  const [rounds, progressData] = await Promise.all([getHandicapRounds(), getProgressData()]);
  const realRounds = rounds.filter((round) => round.type === "real_round");
  const simulatorRounds = rounds.filter((round) => round.type !== "real_round");
  const ratedRealRounds = realRounds.filter((round) => round.courseRating !== null && round.slopeRating !== null);
  const missingRatingRounds = rounds.filter((round) => round.courseRating === null || round.slopeRating === null);
  const realHandicap = calculateHandicapSummary(realRounds.map((round) => round.handicapDifferential));
  const simulatorHandicap = calculateHandicapSummary(simulatorRounds.map((round) => round.handicapDifferential));
  const combinedHandicap = calculateHandicapSummary(rounds.map((round) => round.handicapDifferential));
  const coach = buildCoachSummary(progressData.clubs);
  const topCoachCard = coach.clubCards[0] ?? null;
  const latestRound = rounds[0] ?? null;

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/rounds" prefetch={false}>
              <Flag className="size-4" />
              Rounds
            </Link>
          </Button>
          <Button asChild>
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import scorecard
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={<StatusPill tone="amber">Unofficial WHS-style estimate</StatusPill>}
        title="Handicap"
        description="Separate real-course, simulator, and combined estimates. ForeKingHell uses score differentials and reduced-score-count logic, but this is not an official Handicap Index."
        metrics={[
          {
            label: "Real estimate",
            value: formatHandicapValue(realHandicap.value),
            detail: handicapMethodDetail(realHandicap),
          },
          {
            label: "Simulator estimate",
            value: formatHandicapValue(simulatorHandicap.value),
            detail: handicapMethodDetail(simulatorHandicap),
          },
          {
            label: "Range performance",
            value: `${coach.summary.totals.averageTrust}%`,
            detail: "Club-trust index from launch monitor data, not a handicap.",
          },
          {
            label: "Eligible rounds",
            value: integerFormatter.format(rounds.length),
            detail: `${integerFormatter.format(ratedRealRounds.length)} real rounds have rating and slope.`,
          },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HandicapPanel title="Real course" summary={realHandicap} rounds={realRounds.length} tone="green" />
        <HandicapPanel title="Simulator" summary={simulatorHandicap} rounds={simulatorRounds.length} tone="sky" />
        <RangePerformancePanel
          trust={coach.summary.totals.averageTrust}
          clubs={coach.summary.totals.clubs}
          cleanShots={coach.summary.totals.trackedCleanShots}
        />
        <HandicapPanel title="Combined" summary={combinedHandicap} rounds={rounds.length} tone="amber" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <DataPanel>
          <SectionHeader
            title="Readout"
            description="What the current scorecards are saying."
            action={<Info className="size-5 text-sky-500" />}
          />
          <CardContent className="grid gap-3">
            <InsightBlock
              label="Trend"
              value={trendSentence(combinedHandicap)}
              detail="Lower is better. Trend compares the current estimate with the estimate before the newest eligible round."
              tone={combinedHandicap.trend.direction === "down" ? "green" : combinedHandicap.trend.direction === "up" ? "amber" : "slate"}
            />
            <InsightBlock
              label="Data quality"
              value={`${missingRatingRounds.length} round${missingRatingRounds.length === 1 ? "" : "s"} need rating/slope`}
              detail="Simulator rounds can fall back to par and 113 slope, but real-course estimates become stronger with course rating and slope."
              tone={missingRatingRounds.length > 0 ? "amber" : "green"}
            />
            <InsightBlock
              label="Latest round"
              value={
                latestRound
                  ? `${latestRound.totalScore ?? "--"} at ${latestRound.courseName ?? latestRound.fileName ?? "latest round"}`
                  : "No scorecards yet"
              }
              detail={latestRound ? `${formatDate(latestRound.date)} / differential ${formatHandicapValue(latestRound.handicapDifferential)}` : "Import or create a scorecard to start."}
              tone="sky"
            />
            <InsightBlock
              label="Range priority"
              value={topCoachCard ? `${topCoachCard.clubName}: ${topCoachCard.issueLabel}` : "No club priority yet"}
              detail={
                topCoachCard
                  ? topCoachCard.drill
                  : "Import more launch monitor sessions to separate range performance from scorecards."
              }
              tone={topCoachCard ? topCoachCard.tone : "slate"}
            />
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Trend chart"
            description="Running WHS-style estimate after each eligible round, oldest to newest."
            action={<Trophy className="size-5 text-amber-500" />}
          />
          <CardContent>
            <HandicapTrendChart rounds={[...rounds].reverse()} />
          </CardContent>
        </DataPanel>
      </section>

      {missingRatingRounds.length > 0 ? (
        <DataPanel className="border-amber-200 bg-amber-50/70">
          <SectionHeader
            title="Data to improve"
            description="These rounds are included using fallback assumptions where needed."
            action={<AlertTriangle className="size-5 text-amber-700" />}
          />
          <CardContent className="grid gap-2 md:grid-cols-2">
            {missingRatingRounds.slice(0, 6).map((round) => (
              <Link
                key={round.id}
                href={`/rounds/${round.id}`}
                prefetch={false}
                className="rounded-xl border border-amber-200 bg-white/80 p-4 hover:border-amber-400"
              >
                <p className="font-semibold">{round.courseName ?? round.fileName ?? "Untitled round"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Missing {round.courseRating === null ? "course rating" : ""}{round.courseRating === null && round.slopeRating === null ? " and " : ""}{round.slopeRating === null ? "slope rating" : ""}.
                </p>
              </Link>
            ))}
          </CardContent>
        </DataPanel>
      ) : null}

      <DataPanel>
        <SectionHeader
          title="Score differential table"
          description="WHS-style estimate is calculated from score differentials, newest scorecards first."
        />
        <CardContent>
          <div className="overflow-hidden rounded-xl border bg-white/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Round</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Slope</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                  <TableHead className="text-right">Shots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell className="max-w-64 truncate font-medium">
                      <Link href={`/rounds/${round.id}`} prefetch={false} className="hover:underline">
                        {round.courseName ?? round.fileName ?? "Untitled round"}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(round.date)}</TableCell>
                    <TableCell>
                      <Badge variant={round.type === "real_round" ? "default" : "secondary"}>
                        {formatSessionType(round.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{round.totalScore ?? "--"}</TableCell>
                    <TableCell className="text-right">{formatOptionalNumber(round.courseRating)}</TableCell>
                    <TableCell className="text-right">{round.slopeRating ?? "--"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatHandicapValue(round.handicapDifferential)}
                    </TableCell>
                    <TableCell className="text-right">{integerFormatter.format(round.shotCount)}</TableCell>
                  </TableRow>
                ))}
                {rounds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No scorecards yet. Import a simulated course or add a real round.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </DataPanel>
    </PageShell>
  );
}

async function getHandicapRounds() {
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
      .where(inArray(sessions.type, [...roundSessionTypes]))
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
    const handicapDifferential = calculateRoundDifferential({
      totalScore,
      totalPar,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
    });

    return {
      ...session,
      totalScore,
      totalPutts,
      totalPar,
      handicapDifferential,
      shotCount: shotCountBySessionId.get(session.id) ?? 0,
    };
  });
}

function HandicapPanel({
  title,
  summary,
  rounds,
  tone,
}: {
  title: string;
  summary: HandicapSummary;
  rounds: number;
  tone: "green" | "sky" | "amber";
}) {
  return (
    <DataPanel>
      <SectionHeader title={title} action={<StatusPill tone={tone}>{rounds} rounds</StatusPill>} />
      <CardContent>
        <p className="text-6xl font-semibold tracking-normal">{formatHandicapValue(summary.value)}</p>
        <div className="mt-4 grid gap-3">
          <MiniMetric label="Method" value={summary.methodLabel} />
          <MiniMetric label="Used scores" value={`${summary.usedDifferentialCount}/${summary.sampleSize}`} />
          <MiniMetric label="Trend" value={trendSentence(summary)} />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function RangePerformancePanel({
  trust,
  clubs,
  cleanShots,
}: {
  trust: number;
  clubs: number;
  cleanShots: number;
}) {
  return (
    <DataPanel>
      <SectionHeader title="Range performance" action={<StatusPill tone="pink">{clubs} clubs</StatusPill>} />
      <CardContent>
        <p className="text-6xl font-semibold tracking-normal">{trust}%</p>
        <div className="mt-4 grid gap-3">
          <MiniMetric label="Index type" value="Club trust, not handicap" />
          <MiniMetric label="Clean shots" value={integerFormatter.format(cleanShots)} />
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/coach" prefetch={false}>
              <Brain className="size-4" />
              Open coach
            </Link>
          </Button>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function HandicapTrendChart({ rounds }: { rounds: Awaited<ReturnType<typeof getHandicapRounds>> }) {
  const points = rounds
    .map((round, index) => {
      const summary = calculateHandicapSummary(rounds.slice(0, index + 1).map((item) => item.handicapDifferential).reverse());
      return summary.value === null ? null : { round, value: summary.value };
    })
    .filter((point): point is { round: (typeof rounds)[number]; value: number } => Boolean(point));

  if (points.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-2xl border bg-[#f9fafb] text-sm text-muted-foreground">
        No eligible score differentials yet.
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values) - 2;
  const maxValue = Math.max(...values) + 2;
  const xFor = (index: number) => 48 + (index / Math.max(1, points.length - 1)) * 784;
  const yFor = (value: number) => 252 - ((value - minValue) / Math.max(1, maxValue - minValue)) * 204;
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.value)}`).join(" ");

  return (
    <svg viewBox="0 0 880 300" className="h-72 w-full rounded-2xl border bg-[#0f172a]">
      {[0, 1, 2, 3].map((index) => {
        const value = minValue + ((maxValue - minValue) / 3) * index;
        const y = yFor(value);

        return (
          <g key={index}>
            <line x1="44" x2="836" y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.1" />
            <text x="18" y={y + 4} fill="#cbd5e1" fontSize="12">
              {numberFormatter.format(value)}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <g key={point.round.id}>
          <circle cx={xFor(index)} cy={yFor(point.value)} r="6" fill="#dcfce7" stroke="#22c55e" strokeWidth="3" />
          <text x={xFor(index)} y="282" fill="#94a3b8" fontSize="11" textAnchor="middle">
            {formatShortDate(point.round.date)}
          </text>
        </g>
      ))}
      <text x="44" y="28" fill="#e5e7eb" fontSize="13">
        Running estimate
      </text>
    </svg>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-[#f9fafb] p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function trendSentence(summary: HandicapSummary) {
  if (summary.sampleSize === 0) {
    return "No eligible rounds";
  }

  if (summary.trend.direction === "none") {
    return `${summary.sampleSize} round sample`;
  }

  if (summary.trend.direction === "flat") {
    return "Flat trend";
  }

  return `${summary.trend.direction === "down" ? "Improving" : "Drifting up"} ${formatHandicapDelta(summary.trend.delta)}`;
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function handicapMethodDetail(summary: HandicapSummary) {
  return summary.sampleSize === 0
    ? "No eligible scorecards"
    : `${summary.usedDifferentialCount} of ${summary.sampleSize} differentials used`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatOptionalNumber(value: number | null) {
  return typeof value === "number" ? numberFormatter.format(value) : "--";
}

function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real";
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
