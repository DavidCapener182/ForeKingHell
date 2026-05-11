import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  CalendarDays,
  Crosshair,
  Database,
  Flag,
  LineChart,
  MapPinned,
  Target,
  Trophy,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataPanel,
  InsightBlock,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, importRows, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { buildCoachSummary } from "@/lib/coach";
import { clubSortValue, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { getDefaultUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
import {
  calculateHandicapSummary,
  calculateRoundDifferential,
  formatHandicapDelta,
  formatHandicapValue,
  type HandicapSummary,
} from "@/lib/round-handicap";
import { calculateStockYardage } from "@/lib/stock-yardage";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const roundSessionTypes = ["round", "simulator", "simulated_course", "real_round"] as const;

export default async function DashboardPage() {
  const data = await getDashboardData();
  const primaryAction = data.stats.shotCount > 0 ? "/bag" : "/import";
  const primaryActionLabel = data.stats.shotCount > 0 ? "Open bag map" : "Import first CSV";

  const metrics = [
    {
      label: "Shots saved",
      value: integerFormatter.format(data.stats.shotCount),
      detail: `${integerFormatter.format(data.stats.rawRowCount)} raw CSV rows`,
      href: "/shots",
      icon: BarChart3,
      tone: "sky" as const,
    },
    {
      label: "Active clubs",
      value: integerFormatter.format(data.stats.clubCount),
      detail: "Mapped into stock-yardage views",
      href: "/bag",
      icon: Target,
      tone: "pink" as const,
    },
    {
      label: "Imported sessions",
      value: integerFormatter.format(data.stats.sessionCount),
      detail: `${integerFormatter.format(data.stats.roundCount)} saved rounds, including real scorecards`,
      href: "/handicap",
      icon: CalendarDays,
      tone: "green" as const,
    },
    {
      label: "Combined handicap",
      value: formatHandicapValue(data.stats.combinedHandicap.value),
      detail: formatCombinedHandicapDetail(data.stats.realHandicap, data.stats.simHandicap, data.stats.combinedHandicap),
      href: "/rounds",
      icon: LineChart,
      tone: "amber" as const,
    },
  ];

  const routeCards = [
    {
      title: "Import CSV",
      description: "Upload Rapsodo range or simulated-course files.",
      href: "/import",
      metric: `${integerFormatter.format(data.stats.sessionCount)} sessions`,
      icon: Upload,
      accent: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Shot database",
      description: "Inspect every normalized shot and preserved raw row.",
      href: "/shots",
      metric: `${integerFormatter.format(data.stats.shotCount)} shots`,
      icon: Database,
      accent: "text-sky-600 bg-sky-50",
    },
    {
      title: "Bag map",
      description: "Review stock carry, confidence, and dispersion by club.",
      href: "/bag",
      metric: `${integerFormatter.format(data.stats.clubCount)} clubs`,
      icon: Target,
      accent: "text-pink-600 bg-pink-50",
    },
    {
      title: "Rounds",
      description: "Open scorecards, course imports, and shot maps.",
      href: "/rounds",
      metric: `${integerFormatter.format(data.stats.roundCount)} rounds`,
      icon: Flag,
      accent: "text-amber-700 bg-amber-50",
    },
    {
      title: "Handicap",
      description: "Review real, simulator, and combined WHS-style estimates.",
      href: "/handicap",
      metric: formatHandicapValue(data.stats.combinedHandicap.value),
      icon: LineChart,
      accent: "text-orange-700 bg-orange-50",
    },
    {
      title: "Courses",
      description: "Manage tee sets and hole geometry for map overlays.",
      href: "/courses",
      metric: "Maps",
      icon: MapPinned,
      accent: "text-emerald-700 bg-emerald-50",
    },
    {
      title: "Progress",
      description: "See what changed across the bag and what to practise next.",
      href: "/progress",
      metric: "Coach readout",
      icon: LineChart,
      accent: "text-emerald-700 bg-emerald-50",
    },
    {
      title: "Coach",
      description: "Open the next practice priority, diagnosis, and session plan.",
      href: "/coach",
      metric: data.coachPreview ? data.coachPreview.clubName : "Practice plan",
      icon: Brain,
      accent: "text-rose-700 bg-rose-50",
    },
    {
      title: "Longest shots",
      description: "Replay best total-distance shots by club.",
      href: "/bag/longest",
      metric: "Simulator",
      icon: Trophy,
      accent: "text-violet-600 bg-violet-50",
    },
    {
      title: "Achievements",
      description: "Track XP, round badges, and club mastery ladders.",
      href: "/achievements",
      metric: "XP system",
      icon: Award,
      accent: "text-zinc-700 bg-zinc-100",
    },
    {
      title: "Round review",
      description: "Open real scorecards, simulator overlays, and handicap inputs.",
      href: data.latestRound ? `/rounds/${data.latestRound.id}` : "/rounds",
      metric: data.latestRound ? "Latest round" : "No round yet",
      icon: MapPinned,
      accent: "text-rose-600 bg-rose-50",
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill>ForeKingHell</StatusPill>}
        title="Dashboard"
        description="Your golf operating system: imported shots, bag confidence, rounds, course overlays, and the latest signals from your game."
        actions={
          <>
            <Button asChild variant="outline" size="lg" className="w-full rounded-xl bg-white/70 sm:w-auto">
              <Link href="/shots" prefetch={false}>
                <Database className="size-4" />
                View shots
              </Link>
            </Button>
            <Button asChild size="lg" className="w-full rounded-xl bg-[#111827] text-white sm:w-auto">
              <Link href={primaryAction} prefetch={false}>
                <ArrowRight className="size-4" />
                {primaryActionLabel}
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            href={metric.href}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DataPanel>
          <SectionHeader
            title="What changed?"
            description="A lightweight readout from the imported shots and saved rounds already in the database."
            action={
              <Button asChild variant="outline">
                <Link href="/progress" prefetch={false}>
                  <LineChart className="size-4" />
                  Full progress
                </Link>
              </Button>
            }
          />
          <CardContent className="grid gap-3 md:grid-cols-3">
            {data.whatChanged.map((insight) => (
              <InsightBlock
                key={insight.label}
                label={insight.label}
                value={insight.value}
                detail={insight.detail}
                tone={insight.tone}
              />
            ))}
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Next practice"
            description="The current highest-value coach signal."
            action={<Crosshair className="size-5 text-pink-500" />}
          />
          <CardContent>
            {data.coachPreview ? (
              <Link
                href={`/bag/${data.coachPreview.clubId}/analytics`}
                prefetch={false}
                className="block rounded-xl border bg-[#f9fafb] p-4 transition-colors hover:border-emerald-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <StatusPill tone={data.coachPreview.tone}>{data.coachPreview.issueLabel}</StatusPill>
                    <p className="mt-3 text-3xl font-semibold tracking-normal">{data.coachPreview.clubName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{data.coachPreview.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{data.coachPreview.trustIndex}%</p>
                    <p className="text-xs text-muted-foreground">trust</p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-medium">{data.coachPreview.drill}</p>
                <Progress value={data.coachPreview.trustIndex} className="mt-4" />
              </Link>
            ) : (
              <div className="rounded-xl border bg-[#f9fafb] p-5">
                <p className="font-semibold">No coach priority yet</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Import a range session to unlock club-specific practice recommendations.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/coach" prefetch={false}>
                    <Brain className="size-4" />
                    Open coach
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </DataPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <DataPanel>
            <SectionHeader
              title="Quick routes"
              description="Direct links into the working parts of the app."
            />
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {routeCards.map((route) => (
                <RouteCard key={route.title} route={route} />
              ))}
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Recent imports"
              description="Open saved round imports or inspect the full shot database."
            />
            <CardContent>
              <div className="overflow-hidden rounded-xl border bg-white/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Shots</TableHead>
                      <TableHead className="text-right">Raw rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="max-w-56 truncate font-medium">
                          {isRoundSession(session.type) ? (
                            <Link
                              href={`/rounds/${session.id}`}
                              prefetch={false}
                              className="hover:underline"
                            >
                              {session.fileName ?? session.courseName ?? "Untitled import"}
                            </Link>
                          ) : (
                            <Link href="/shots" prefetch={false} className="hover:underline">
                              {session.fileName ?? "Untitled import"}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(session.date)}</TableCell>
                        <TableCell>{formatSessionType(session.type)}</TableCell>
                        <TableCell className="text-right">
                          {integerFormatter.format(session.shotCount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {integerFormatter.format(session.rawRowCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.recentSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No imports yet. Start with the CSV import flow.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </DataPanel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <DataPanel>
            <SectionHeader
              title="Bag snapshot"
              description="Active clubs with current stock-yardage confidence."
              action={
                <Button asChild variant="outline">
                  <Link href="/bag" prefetch={false}>
                    <Target className="size-4" />
                    Full bag
                  </Link>
                </Button>
              }
            />
            <CardContent className="space-y-3">
              {data.bagPreview.map((club) => (
                <Link
                  key={club.id}
                  href={`/bag/${club.id}`}
                  prefetch={false}
                  className="grid gap-3 rounded-[8px] border bg-[#f9fafb] p-4 transition-colors hover:border-emerald-300 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-normal">
                        {formatClubType(club.type)}
                      </p>
                      <Badge variant="outline">{club.stock.label}</Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{club.brandModel}</p>
                  </div>
                  <div className="grid min-w-48 grid-cols-2 gap-3">
                    <MiniMetric label="Carry" value={formatYards(club.stock.carryMedianYd)} />
                    <MiniMetric label="Shots" value={integerFormatter.format(club.shotCount)} />
                  </div>
                  <div className="sm:col-span-2">
                    <Progress value={club.stock.confidenceScore} />
                  </div>
                </Link>
              ))}
              {data.bagPreview.length === 0 ? (
                <div className="rounded-[8px] border bg-[#f9fafb] p-6 text-center">
                  <p className="font-medium">No active clubs yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Import a Rapsodo CSV and the bag map will build automatically.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/import" prefetch={false}>
                      <Upload className="size-4" />
                      Import CSV
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Latest round"
              description="Newest round, simulator, or simulated-course file."
              action={<Flag className="size-5 text-sky-500" />}
            />
            <CardContent>
              {data.latestRound ? (
                <div className="space-y-4">
                  <div className="rounded-[8px] border bg-[#f9fafb] p-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(data.latestRound.date)} - {formatSessionType(data.latestRound.type)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-normal">
                      {data.latestRound.courseName ?? data.latestRound.fileName ?? "Untitled round"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <RoundMetric label="Score" value={data.latestRound.totalScore} />
                    <RoundMetric label="Par" value={data.latestRound.totalPar} />
                    <RoundMetric label="Putts" value={data.latestRound.totalPutts} />
                    <RoundMetric
                      label="Diff"
                      value={formatHandicapValue(data.latestRound.handicapDifferential)}
                    />
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1">
                      <Link href={`/rounds/${data.latestRound.id}`} prefetch={false}>
                        <Flag className="size-4" />
                        Review round
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link href="/rounds" prefetch={false}>
                        All rounds
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[8px] border bg-[#f9fafb] p-6">
                  <p className="font-medium">No round imports yet</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Save a simulated-course CSV to unlock scorecards, hole review, and round shot maps.
                  </p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link href="/import" prefetch={false}>
                      <Upload className="size-4" />
                      Import round CSV
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </DataPanel>
        </section>
    </PageShell>
  );
}

function RouteCard({
  route,
}: {
  route: {
    title: string;
    description: string;
    href: string;
    metric: string;
    icon: LucideIcon;
    accent: string;
  };
}) {
  return (
    <Link
      href={route.href}
      prefetch={false}
      className="group grid min-h-36 gap-4 rounded-[8px] border bg-[#f9fafb] p-4 transition-colors hover:border-emerald-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`grid size-10 place-items-center rounded-[8px] ${route.accent}`}>
          <route.icon className="size-5" />
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{route.title}</p>
          <Badge variant="outline">{route.metric}</Badge>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{route.description}</p>
      </div>
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border bg-white px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-normal">{value}</p>
    </div>
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

function formatCombinedHandicapDetail(
  realHandicap: HandicapSummary,
  simHandicap: HandicapSummary,
  combinedHandicap: HandicapSummary,
) {
  const trend = combinedHandicap.trend.direction;
  const trendLabel =
    trend === "down"
      ? `Trending down ${formatHandicapDelta(combinedHandicap.trend.delta)}`
      : trend === "up"
        ? `Trending up ${formatHandicapDelta(combinedHandicap.trend.delta)}`
        : trend === "flat"
          ? "Flat trend"
          : `${combinedHandicap.sampleSize} round sample`;

  return `Real ${formatHandicapValue(realHandicap.value)} | Sim ${formatHandicapValue(simHandicap.value)} | ${trendLabel}`;
}

async function getDashboardData() {
  const db = getDb();
  const userId = getDefaultUserId();
  const [
    [shotCount],
    [rawRowCount],
    [sessionCount],
    [roundCount],
    recentSessionRows,
    roundRows,
    allClubRows,
    shotCountsByClub,
    recentStockShots,
  ] = await Promise.all([
    db.select({ value: count() }).from(shots).where(eq(shots.userId, userId)),
    db.select({ value: count() }).from(importRows).where(eq(importRows.userId, userId)),
    db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId)),
    db
      .select({ value: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), inArray(sessions.type, [...roundSessionTypes]))),
    db
      .select({
        id: sessions.id,
        fileName: sessions.fileName,
        type: sessions.type,
        courseName: sessions.courseName,
        date: sessions.date,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date), asc(sessions.fileName))
      .limit(5),
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
      .where(and(eq(sessions.userId, userId), inArray(sessions.type, [...roundSessionTypes])))
      .orderBy(desc(sessions.date), asc(sessions.fileName)),
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.type)),
    db
      .select({
        clubId: shots.clubId,
        count: count(),
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.clubId),
    db
      .select({
        id: shots.id,
        clubId: shots.clubId,
        shotAt: shots.shotAt,
        carryYd: shots.carryYd,
        totalYd: shots.totalYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        courseHoleNumber: shots.courseHoleNumber,
        sessionType: sessions.type,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .innerJoin(sessions, eq(shots.sessionId, sessions.id))
      .where(eq(shots.userId, userId))
      .orderBy(desc(shots.shotAt))
      .limit(500),
  ]);
  const clubRows = allClubRows.filter((club) => isTrackedClubType(club.type));

  const recentSessionIds = recentSessionRows.map((session) => session.id);
  const [shotCountsBySession, rawCountsBySession] =
    recentSessionIds.length > 0
      ? await Promise.all([
          db
            .select({
              sessionId: shots.sessionId,
              count: count(),
            })
            .from(shots)
            .where(and(eq(shots.userId, userId), inArray(shots.sessionId, recentSessionIds)))
            .groupBy(shots.sessionId),
          db
            .select({
              sessionId: importRows.sessionId,
              count: count(),
            })
            .from(importRows)
            .where(and(eq(importRows.userId, userId), inArray(importRows.sessionId, recentSessionIds)))
            .groupBy(importRows.sessionId),
        ])
      : [[], []];

  const shotCountBySessionId = new Map(
    shotCountsBySession.map((row) => [row.sessionId, row.count]),
  );
  const rawCountBySessionId = new Map(rawCountsBySession.map((row) => [row.sessionId, row.count]));
  const shotCountByClubId = new Map(shotCountsByClub.map((row) => [row.clubId, row.count]));
  const stockShotsByClubId = new Map<string, typeof recentStockShots>();

  for (const shot of recentStockShots) {
    const clubShots = stockShotsByClubId.get(shot.clubId) ?? [];
    clubShots.push(shot);
    stockShotsByClubId.set(shot.clubId, clubShots);
  }

  const recentSessions = recentSessionRows.map((session) => ({
    ...session,
    shotCount: shotCountBySessionId.get(session.id) ?? 0,
    rawRowCount: rawCountBySessionId.get(session.id) ?? 0,
  }));

  const bagPreview = clubRows
    .map((club) => {
      const clubShots = stockShotsByClubId.get(club.id) ?? [];
      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";

      return {
        ...club,
        brandModel,
        shotCount: shotCountByClubId.get(club.id) ?? 0,
        stock: calculateStockYardage(clubShots, 50, { clubType: club.type }),
      };
    })
    .sort((left, right) => {
      const shotCountDifference = right.shotCount - left.shotCount;
      return shotCountDifference || clubSortValue(left.type) - clubSortValue(right.type);
    })
    .slice(0, 5);
  const roundSummaries = roundRows.map(summarizeRound);
  const latestRound = roundSummaries[0] ?? null;
  const realHandicap = calculateHandicapSummary(
    roundSummaries
      .filter((round) => round.type === "real_round")
      .map((round) => round.handicapDifferential),
  );
  const simHandicap = calculateHandicapSummary(
    roundSummaries
      .filter((round) => round.type !== "real_round")
      .map((round) => round.handicapDifferential),
  );
  const combinedHandicap = calculateHandicapSummary(
    roundSummaries.map((round) => round.handicapDifferential),
  );
  const whatChanged = buildWhatChangedInsights({
    clubRows,
    stockShots: recentStockShots,
    bagPreview,
    latestRound,
  });
  const coachData = await getProgressData();
  const coachCard = buildCoachSummary(coachData.clubs).clubCards[0] ?? null;

  return {
    stats: {
      shotCount: shotCount?.value ?? 0,
      rawRowCount: rawRowCount?.value ?? 0,
      sessionCount: sessionCount?.value ?? 0,
      clubCount: clubRows.length,
      roundCount: roundCount?.value ?? 0,
      realHandicap,
      simHandicap,
      combinedHandicap,
    },
    recentSessions,
    latestRound,
    bagPreview,
    whatChanged,
    coachPreview: coachCard
      ? {
          clubId: coachCard.clubId,
          clubName: coachCard.clubName,
          issueLabel: coachCard.issueLabel,
          reason: coachCard.reason,
          drill: coachCard.drill,
          tone: coachCard.tone,
          trustIndex: coachCard.trustIndex,
        }
      : null,
  };
}

type InsightTone = "green" | "sky" | "pink" | "amber" | "slate";

function buildWhatChangedInsights({
  clubRows,
  stockShots,
  bagPreview,
  latestRound,
}: {
  clubRows: Array<{ id: string; type: string }>;
  stockShots: Array<{
    clubId: string;
    shotAt: Date;
    carryYd: number | null;
    sideCarryYd: number | null;
    ballSpeedMph: number | null;
  }>;
  bagPreview: Array<{
    type: string;
    shotCount: number;
    stock: {
      confidenceScore: number;
      carryMedianYd: number | null;
      label: string;
    };
  }>;
  latestRound: ReturnType<typeof summarizeRound> | null;
}) {
  const clubTypeById = new Map(clubRows.map((club) => [club.id, club.type]));
  const now = new Date();
  const currentStart = daysBefore(now, 30);
  const previousStart = daysBefore(now, 60);
  const shotsByClub = new Map<string, typeof stockShots>();

  for (const shot of stockShots) {
    if (!clubTypeById.has(shot.clubId)) {
      continue;
    }

    const clubShots = shotsByClub.get(shot.clubId) ?? [];
    clubShots.push(shot);
    shotsByClub.set(shot.clubId, clubShots);
  }

  const clubChanges = [...shotsByClub.entries()]
    .map(([clubId, clubShots]) => {
      const currentShots = clubShots.filter((shot) => {
        const shotDate = new Date(shot.shotAt);
        return shotDate >= currentStart && shotDate <= now;
      });
      const previousShots = clubShots.filter((shot) => {
        const shotDate = new Date(shot.shotAt);
        return shotDate >= previousStart && shotDate < currentStart;
      });

      const currentCarry = median(currentShots.map((shot) => shot.carryYd).filter(isNumber));
      const previousCarry = median(previousShots.map((shot) => shot.carryYd).filter(isNumber));
      const currentMiss = averageNumber(currentShots.map((shot) => shot.sideCarryYd).filter(isNumber).map(Math.abs));
      const previousMiss = averageNumber(previousShots.map((shot) => shot.sideCarryYd).filter(isNumber).map(Math.abs));
      const currentBallSpeed = averageNumber(currentShots.map((shot) => shot.ballSpeedMph).filter(isNumber));
      const previousBallSpeed = averageNumber(previousShots.map((shot) => shot.ballSpeedMph).filter(isNumber));

      return {
        clubId,
        clubType: clubTypeById.get(clubId) ?? "club",
        currentCount: currentShots.length,
        previousCount: previousShots.length,
        carryDelta: currentCarry !== null && previousCarry !== null ? currentCarry - previousCarry : null,
        missDelta: currentMiss !== null && previousMiss !== null ? currentMiss - previousMiss : null,
        ballSpeedDelta:
          currentBallSpeed !== null && previousBallSpeed !== null
            ? currentBallSpeed - previousBallSpeed
            : null,
      };
    })
    .filter((change) => change.currentCount >= 3 && change.previousCount >= 3);

  const insights: Array<{
    label: string;
    value: string;
    detail: string;
    tone: InsightTone;
  }> = [];

  const strongestCarryChange = clubChanges
    .filter((change) => change.carryDelta !== null)
    .sort((left, right) => Math.abs(right.carryDelta ?? 0) - Math.abs(left.carryDelta ?? 0))[0];

  if (strongestCarryChange?.carryDelta !== null && strongestCarryChange?.carryDelta !== undefined) {
    insights.push({
      label: `${formatClubType(strongestCarryChange.clubType)} carry`,
      value: `${formatSignedYards(strongestCarryChange.carryDelta)} vs previous 30`,
      detail: `${strongestCarryChange.currentCount} recent shots compared with ${strongestCarryChange.previousCount} older shots.`,
      tone: strongestCarryChange.carryDelta >= 0 ? "green" : "amber",
    });
  }

  const strongestMissChange = clubChanges
    .filter((change) => change.missDelta !== null)
    .sort((left, right) => Math.abs(right.missDelta ?? 0) - Math.abs(left.missDelta ?? 0))[0];

  if (strongestMissChange?.missDelta !== null && strongestMissChange?.missDelta !== undefined) {
    const tighter = strongestMissChange.missDelta < 0;
    insights.push({
      label: `${formatClubType(strongestMissChange.clubType)} dispersion`,
      value: `${numberFormatter.format(Math.abs(strongestMissChange.missDelta))} yd ${tighter ? "tighter" : "wider"}`,
      detail: "Average left/right miss compared with the previous 30-day window.",
      tone: tighter ? "green" : "amber",
    });
  }

  const strongestSpeedChange = clubChanges
    .filter((change) => change.ballSpeedDelta !== null)
    .sort((left, right) => Math.abs(right.ballSpeedDelta ?? 0) - Math.abs(left.ballSpeedDelta ?? 0))[0];

  if (strongestSpeedChange?.ballSpeedDelta !== null && strongestSpeedChange?.ballSpeedDelta !== undefined) {
    insights.push({
      label: `${formatClubType(strongestSpeedChange.clubType)} speed`,
      value: `${formatSignedNumber(strongestSpeedChange.ballSpeedDelta)} mph`,
      detail: "Ball speed movement against the previous 30-day window.",
      tone: strongestSpeedChange.ballSpeedDelta >= 0 ? "sky" : "slate",
    });
  }

  if (latestRound && latestRound.totalScore !== null && latestRound.totalPar !== null) {
    const versusPar = latestRound.totalScore - latestRound.totalPar;
    insights.push({
      label: "Latest round",
      value: `${latestRound.totalScore} (${versusPar >= 0 ? "+" : ""}${versusPar})`,
      detail: `${latestRound.courseName ?? "Latest scorecard"} on ${formatDate(latestRound.date)}.`,
      tone: versusPar <= 10 ? "green" : "pink",
    });
  }

  const bestConfidenceClub = [...bagPreview].sort(
    (left, right) => right.stock.confidenceScore - left.stock.confidenceScore,
  )[0];

  if (bestConfidenceClub) {
    insights.push({
      label: "Most trusted club",
      value: `${formatClubType(bestConfidenceClub.type)} / ${Math.round(bestConfidenceClub.stock.confidenceScore)}%`,
      detail: `${bestConfidenceClub.stock.label} with ${integerFormatter.format(bestConfidenceClub.shotCount)} saved shots.`,
      tone: "green",
    });
  }

  while (insights.length < 3) {
    insights.push({
      label: "Data depth",
      value: bagPreview.length > 0 ? `${integerFormatter.format(bagPreview.length)} clubs mapped` : "Import needed",
      detail:
        bagPreview.length > 0
          ? "Keep adding shots to unlock stronger trend comparisons."
          : "Upload a Rapsodo CSV to start building the personal baseline.",
      tone: "slate",
    });
  }

  return insights.slice(0, 3);
}

function summarizeRound(round: {
  id: string;
  fileName: string | null;
  type: string;
  courseName: string | null;
  date: Date;
  courseRating?: number | null;
  slopeRating?: number | null;
  scorecardJson:
    | Array<{
        par: number;
        score?: number | null;
        putts?: number | null;
      }>
    | null;
}) {
  const scorecard = round.scorecardJson ?? [];
  const totalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
  const totalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
  const totalPar = scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
  const handicapDifferential =
    calculateRoundDifferential({
      totalScore,
      totalPar,
      courseRating: round.courseRating ?? null,
      slopeRating: round.slopeRating ?? null,
    });

  return {
    ...round,
    totalScore,
    totalPutts,
    totalPar,
    handicapDifferential,
  };
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function daysBefore(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() - days);
  return date;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function averageNumber(values: number[]) {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}

function formatSignedYards(value: number) {
  return `${formatSignedNumber(value)} yd`;
}

function formatSignedNumber(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}`;
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

function isRoundSession(value: string) {
  return roundSessionTypes.some((sessionType) => sessionType === value);
}
