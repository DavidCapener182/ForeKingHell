import Link from "next/link";
import { AlertTriangle, ArrowLeft, Brain, Flag, Info, Trophy, Upload } from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  DataTableFrame,
  MobileAccordionSection,
  MobileBentoSummary,
  MobileDataCard,
  MobileDataList,
  MobileSectionChips,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
  StickyMobileAction,
} from "@/components/premium";
import { HandicapConfidenceFeaturePanel } from "@/components/features/feature-panels";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageArtwork } from "@/components/visuals/page-artwork";
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
import { rapsodoSyncSessions, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildCoachSummary } from "@/lib/coach";
import { getProgressData } from "@/lib/progress-data";
import {
  calculateHandicapSummary,
  calculatePlayingHandicapSummary,
  calculateRoundDifferential,
  formatHandicapDelta,
  formatHandicapValue,
  normaliseHandicapRoundInput,
  type HandicapSummary,
  type PlayingHandicapSummary,
} from "@/lib/round-handicap";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import { getFeatureIdeasData } from "@/lib/feature-ideas";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export default async function HandicapPage() {
  const [rounds, progressData, featureData] = await Promise.all([
    getHandicapRounds(),
    getProgressData(),
    getFeatureIdeasData(),
  ]);
  const realRounds = rounds.filter((round) => round.type === "real_round");
  const simulatorRounds = rounds.filter((round) => round.type !== "real_round");
  const missingRatingRounds = rounds.filter(
    (round) => round.courseRating === null || round.slopeRating === null,
  );
  const realHandicap = calculateHandicapSummary(
    realRounds.map((round) => round.handicapDifferential),
  );
  const simulatorHandicap = calculateHandicapSummary(
    simulatorRounds.map((round) => round.handicapDifferential),
  );
  const combinedHandicap = calculateHandicapSummary(
    rounds.map((round) => round.handicapDifferential),
  );
  const playingHandicap = calculatePlayingHandicapSummary(
    rounds.map((round) => ({
      handicapDifferential: round.handicapDifferential,
      type: round.type,
    })),
  );
  const coach = buildCoachSummary(progressData.clubs);
  const topCoachCard = coach.clubCards[0] ?? null;
  const latestRound = rounds[0] ?? null;

  return (
    <PageShell contentClassName="pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-5">
      <MobileRouteHeader title="Play" group="play" activeKey="handicap" />

      <div className="hidden items-center justify-between gap-4 sm:flex">
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
        eyebrow={<StatusPill tone="amber">Unofficial scoring estimates</StatusPill>}
        title="Handicap"
        description="Separate best-form differentials from a conservative playing estimate. ForeKingHell uses score differentials and reduced-score-count logic, but this is not an official Handicap Index."
        visual={<PageArtwork variant="handicap" alt="" className="h-full min-h-44" />}
        actions={
          <Button
            asChild
            size="sm"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <Link href="/rounds" prefetch={false}>
              <Flag className="size-4" />
              Rounds
            </Link>
          </Button>
        }
        metrics={[
          {
            label: "Real best-form",
            value: formatHandicapValue(realHandicap.value),
            detail: handicapMethodDetail(realHandicap),
          },
          {
            label: "Simulator best-form",
            value: formatHandicapValue(simulatorHandicap.value),
            detail: handicapMethodDetail(simulatorHandicap),
          },
          {
            label: "Realistic playing",
            value: formatHandicapValue(playingHandicap.value),
            detail: playingHandicap.methodLabel,
          },
          {
            label: "Range performance",
            value: `${coach.summary.totals.averageTrust}%`,
            detail: "Club-trust index from launch monitor data, not a handicap.",
          },
        ]}
      />

      <MobileSectionChips
        items={[
          { label: "Estimate", href: "#estimate" },
          { label: "Trend", href: "#trend" },
          { label: "Tasks", href: "#tasks" },
          { label: "Rounds", href: "#rounds" },
        ]}
      />

      <MobileBentoSummary
        items={[
          {
            label: "Playing estimate",
            value: formatHandicapValue(playingHandicap.value),
            detail: playingHandicap.methodLabel,
            tone: "amber",
          },
          {
            label: "Best form",
            value: formatHandicapValue(realHandicap.value),
            detail: `${realRounds.length} real`,
            tone: "green",
          },
          {
            label: "Trend",
            value: trendSentence(combinedHandicap),
            detail: "Combined",
            tone:
              combinedHandicap.trend.direction === "down"
                ? "green"
                : combinedHandicap.trend.direction === "up"
                  ? "amber"
                  : "slate",
          },
          {
            label: "Ratings",
            value: missingRatingRounds.length.toString(),
            detail: "Need data",
            tone: missingRatingRounds.length > 0 ? "pink" : "sky",
          },
        ]}
      />

      <HandicapConfidenceFeaturePanel data={featureData} />

      <section id="estimate" className="scroll-mt-28">
        <PlayingHandicapPanel summary={playingHandicap} />
      </section>

      <section className="-mx-4 flex scroll-mt-28 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
        <div className="min-w-[82vw] md:min-w-0">
          <HandicapPanel
            title="Real course ceiling"
            summary={realHandicap}
            rounds={realRounds.length}
            tone="green"
          />
        </div>
        <div className="min-w-[82vw] md:min-w-0">
          <HandicapPanel
            title="Simulator ceiling"
            summary={simulatorHandicap}
            rounds={simulatorRounds.length}
            tone="sky"
          />
        </div>
        <div className="min-w-[82vw] md:min-w-0">
          <RangePerformancePanel
            trust={coach.summary.totals.averageTrust}
            clubs={coach.summary.totals.clubs}
            cleanShots={coach.summary.totals.trackedCleanShots}
          />
        </div>
        <div className="min-w-[82vw] md:min-w-0">
          <HandicapPanel
            title="Combined ceiling"
            summary={combinedHandicap}
            rounds={rounds.length}
            tone="amber"
          />
        </div>
      </section>

      <section id="trend" className="grid scroll-mt-28 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <MobileAccordionSection
          title="Readout"
          description="Current scorecard signals."
          count="4 signals"
        >
          <CompactReadoutGrid
            items={[
              {
                label: "Trend",
                value: trendSentence(combinedHandicap),
                detail: "Lower is better. Trend compares current estimate with the prior estimate.",
                tone:
                  combinedHandicap.trend.direction === "down"
                    ? "green"
                    : combinedHandicap.trend.direction === "up"
                      ? "amber"
                      : "slate",
              },
              {
                label: "Data quality",
                value: `${missingRatingRounds.length} round${missingRatingRounds.length === 1 ? "" : "s"} need rating/slope`,
                detail: "Real-course estimates are stronger with rating and slope.",
                tone: missingRatingRounds.length > 0 ? "amber" : "green",
              },
              {
                label: "Latest round",
                value: latestRound
                  ? `${latestRound.totalScore ?? "--"} at ${latestRound.courseName ?? latestRound.fileName ?? "latest round"}`
                  : "No scorecards yet",
                detail: latestRound
                  ? `${formatDate(latestRound.date)} / differential ${formatHandicapValue(latestRound.handicapDifferential)}`
                  : "Import or create a scorecard to start.",
                tone: "sky",
              },
              {
                label: "Range priority",
                value: topCoachCard
                  ? `${topCoachCard.clubName}: ${topCoachCard.issueLabel}`
                  : "No club priority yet",
                detail: topCoachCard ? topCoachCard.drill : "Import more launch monitor sessions.",
                tone: topCoachCard ? topCoachCard.tone : "slate",
                href: topCoachCard ? `/bag/${topCoachCard.clubId}/analytics` : "/coach",
              },
            ]}
          />
        </MobileAccordionSection>

        <MobileAccordionSection
          title="Trend chart"
          description="Running best-form estimate."
          count={`${rounds.length} rounds`}
        >
          <HandicapTrendChart rounds={[...rounds].reverse()} />
        </MobileAccordionSection>

        <DataPanel className="hidden sm:flex">
          <SectionHeader
            title="Readout"
            description="What the current scorecards are saying."
            action={<Info className="size-5 text-sky-500" />}
          />
          <CardContent>
            <CompactReadoutGrid
              columnsClassName="md:grid-cols-2"
              items={[
                {
                  label: "Trend",
                  value: trendSentence(combinedHandicap),
                  detail:
                    "Lower is better. Trend compares the current estimate with the estimate before the newest eligible round.",
                  tone:
                    combinedHandicap.trend.direction === "down"
                      ? "green"
                      : combinedHandicap.trend.direction === "up"
                        ? "amber"
                        : "slate",
                },
                {
                  label: "Data quality",
                  value: `${missingRatingRounds.length} round${missingRatingRounds.length === 1 ? "" : "s"} need rating/slope`,
                  detail:
                    "Simulator rounds can fall back to par and 113 slope; real-course estimates are stronger with rating and slope.",
                  tone: missingRatingRounds.length > 0 ? "amber" : "green",
                },
                {
                  label: "Latest round",
                  value: latestRound
                    ? `${latestRound.totalScore ?? "--"} at ${latestRound.courseName ?? latestRound.fileName ?? "latest round"}`
                    : "No scorecards yet",
                  detail: latestRound
                    ? `${formatDate(latestRound.date)} / differential ${formatHandicapValue(latestRound.handicapDifferential)}`
                    : "Import or create a scorecard to start.",
                  tone: "sky",
                },
                {
                  label: "Range priority",
                  value: topCoachCard
                    ? `${topCoachCard.clubName}: ${topCoachCard.issueLabel}`
                    : "No club priority yet",
                  detail: topCoachCard
                    ? topCoachCard.drill
                    : "Import more launch monitor sessions to separate range performance from scorecards.",
                  tone: topCoachCard ? topCoachCard.tone : "slate",
                  href: topCoachCard ? `/bag/${topCoachCard.clubId}/analytics` : "/coach",
                },
              ]}
            />
          </CardContent>
        </DataPanel>

        <DataPanel className="hidden sm:flex">
          <SectionHeader
            title="Trend chart"
            description="Running best-form estimate after each eligible round, oldest to newest."
            action={<Trophy className="size-5 text-amber-500" />}
          />
          <CardContent>
            <HandicapTrendChart rounds={[...rounds].reverse()} />
          </CardContent>
        </DataPanel>
      </section>

      {missingRatingRounds.length > 0 ? (
        <DataPanel id="tasks" className="scroll-mt-28 border-amber-200 bg-amber-50/70">
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
                <p className="font-semibold">
                  {round.courseName ?? round.fileName ?? "Untitled round"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Missing {round.courseRating === null ? "course rating" : ""}
                  {round.courseRating === null && round.slopeRating === null ? " and " : ""}
                  {round.slopeRating === null ? "slope rating" : ""}.
                </p>
              </Link>
            ))}
          </CardContent>
        </DataPanel>
      ) : null}

      <MobileAccordionSection
        title="Score differential table"
        description="Newest scorecards and 18-hole equivalent inputs."
        count={`${rounds.length} rounds`}
      >
        <MobileDataList>
          {rounds.length > 0 ? (
            rounds.map((round) => (
              <MobileDataCard
                key={round.id}
                href={`/rounds/${round.id}`}
                title={round.courseName ?? round.fileName ?? "Untitled round"}
                subtitle={formatDate(round.date)}
                action={
                  <Badge variant={round.type === "real_round" ? "default" : "secondary"}>
                    {formatSessionType(round.type)}
                  </Badge>
                }
              >
                <DataPair label="Score" value={round.totalScore ?? "--"} />
                <DataPair label="Rating" value={formatOptionalNumber(round.courseRating)} />
                <DataPair label="Slope" value={round.slopeRating ?? "--"} />
                <DataPair
                  label="Differential"
                  value={formatHandicapValue(round.handicapDifferential)}
                />
                <DataPair label="Holes" value={formatHolesPlayed(round)} />
              </MobileDataCard>
            ))
          ) : (
            <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
              No scorecards yet. Import a simulated course or add a real round.
            </div>
          )}
        </MobileDataList>
      </MobileAccordionSection>

      <DataPanel id="rounds" className="hidden scroll-mt-28 sm:flex">
        <SectionHeader
          title="Score differential table"
          description="Best-form estimates use score differentials; 9-hole rounds are shown as 18-hole equivalents."
        />
        <CardContent>
          <DataTableFrame>
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
                  <TableHead className="text-right">Holes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell className="max-w-64 truncate font-medium">
                      <Link
                        href={`/rounds/${round.id}`}
                        prefetch={false}
                        className="hover:underline"
                      >
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
                    <TableCell className="text-right">
                      {formatOptionalNumber(round.courseRating)}
                    </TableCell>
                    <TableCell className="text-right">{round.slopeRating ?? "--"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatHandicapValue(round.handicapDifferential)}
                    </TableCell>
                    <TableCell className="text-right">{formatHolesPlayed(round)}</TableCell>
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
          </DataTableFrame>
        </CardContent>
      </DataPanel>
      <StickyMobileAction>
        <Button asChild className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Link href="/import" prefetch={false}>
            <Upload className="size-4" />
            Import scorecard
          </Link>
        </Button>
      </StickyMobileAction>
    </PageShell>
  );
}

async function getHandicapRounds() {
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
    const rawTotalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
    const rawTotalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
    const rawTotalPar =
      scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
    const handicapInput = normaliseHandicapRoundInput({
      totalScore: rawTotalScore,
      totalPar: rawTotalPar,
      courseRating: session.courseRating,
      slopeRating: session.slopeRating,
      holesPlayed: scorecard.length,
    });
    const handicapDifferential = calculateRoundDifferential(handicapInput);

    return {
      ...session,
      courseRating: handicapInput.courseRating,
      totalScore: handicapInput.totalScore,
      totalPutts: handicapInput.isNineHoleEquivalent
        ? doubleNullable(rawTotalPutts)
        : rawTotalPutts,
      totalPar: handicapInput.totalPar ?? null,
      handicapDifferential,
      holesPlayed: handicapInput.holesPlayed ?? null,
      originalHolesPlayed: handicapInput.originalHolesPlayed,
      isNineHoleEquivalent: handicapInput.isNineHoleEquivalent,
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
      <CardContent className="py-4 sm:py-6">
        <p className="text-4xl font-semibold tracking-normal sm:text-6xl">
          {formatHandicapValue(summary.value)}
        </p>
        <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
          <MiniMetric label="Method" value={summary.methodLabel} />
          <MiniMetric
            label="Used scores"
            value={`${summary.usedDifferentialCount}/${summary.sampleSize}`}
          />
          <MiniMetric label="Trend" value={trendSentence(summary)} />
        </div>
      </CardContent>
    </DataPanel>
  );
}

function PlayingHandicapPanel({ summary }: { summary: PlayingHandicapSummary }) {
  return (
    <DataPanel className="border-amber-200 bg-amber-50/70">
      <SectionHeader
        title="Realistic playing handicap"
        description={summary.warning}
        action={<StatusPill tone="amber">Data-limited</StatusPill>}
      />
      <CardContent className="grid gap-3 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="apple-panel-strong p-3 sm:p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Playing estimate
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-normal sm:mt-2 sm:text-6xl">
            {formatHandicapValue(summary.value)}
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground sm:leading-6">
            Uses recent adjusted scoring, not lowest-score WHS selection.
          </p>
        </div>
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-3"
          items={[
            {
              label: "Method",
              value: summary.methodLabel,
              detail: `${summary.usedDifferentialCount} of ${summary.sampleSize} eligible rounds used.`,
              tone: summary.value === null ? "amber" : "green",
            },
            {
              label: "Blend",
              value: `${summary.realDifferentialCount} real / ${summary.simulatorDifferentialCount} sim`,
              detail: `Simulator rounds carry a ${formatHandicapDelta(summary.simulatorAdjustment)} differential adjustment.`,
              tone: summary.realDifferentialCount > 0 ? "sky" : "amber",
            },
            {
              label: "Mindset",
              value: "Judge the trend",
              detail: "A best-form ceiling can be low; this estimate is the fairer playing target.",
              tone: "slate",
            },
          ]}
        />
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
      <SectionHeader
        title="Range performance"
        action={<StatusPill tone="pink">{clubs} clubs</StatusPill>}
      />
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
      const summary = calculateHandicapSummary(
        rounds
          .slice(0, index + 1)
          .map((item) => item.handicapDifferential)
          .reverse(),
      );
      return summary.value === null ? null : { round, value: summary.value };
    })
    .filter((point): point is { round: (typeof rounds)[number]; value: number } => Boolean(point));

  if (points.length === 0) {
    return (
      <div className="apple-panel grid h-72 place-items-center text-sm text-muted-foreground">
        No eligible score differentials yet.
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values) - 2;
  const maxValue = Math.max(...values) + 2;
  const xFor = (index: number) => 48 + (index / Math.max(1, points.length - 1)) * 784;
  const yFor = (value: number) =>
    252 - ((value - minValue) / Math.max(1, maxValue - minValue)) * 204;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.value)}`)
    .join(" ");

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
      <path
        d={path}
        fill="none"
        stroke="#22c55e"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <g key={point.round.id}>
          <circle
            cx={xFor(index)}
            cy={yFor(point.value)}
            r="6"
            fill="#dcfce7"
            stroke="#22c55e"
            strokeWidth="3"
          />
          <text x={xFor(index)} y="282" fill="#94a3b8" fontSize="11" textAnchor="middle">
            {formatShortDate(point.round.date)}
          </text>
        </g>
      ))}
      <text x="44" y="28" fill="#e5e7eb" fontSize="13">
        Best-form estimate
      </text>
    </svg>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-panel-strong p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
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

function doubleNullable(value: number | null) {
  return typeof value === "number" ? value * 2 : null;
}

function formatHolesPlayed(round: { holesPlayed: number | null; isNineHoleEquivalent: boolean }) {
  if (round.isNineHoleEquivalent) {
    return "18 eq";
  }

  return typeof round.holesPlayed === "number" ? integerFormatter.format(round.holesPlayed) : "--";
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
