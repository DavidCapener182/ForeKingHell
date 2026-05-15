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
  GitCompareArrows,
  LineChart,
  MapPinned,
  Radio,
  Target,
  Trophy,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CompactLinkGrid,
  CompactReadoutGrid,
  DataPanel,
  MetricCard,
  MobileAccordionSection,
  MobileHorizontalRail,
  MobileSectionChips,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { PageArtwork, ShotTraceMotif } from "@/components/visuals/page-artwork";
import {
  clubs,
  importRows,
  rapsodoSyncSessions,
  sessions,
  shots,
  teeSets,
  users,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { buildCoachSummary } from "@/lib/coach";
import { getChallengesPageData, type ChallengeListItem } from "@/lib/challenges";
import {
  buildCourseDecisionAdvice,
  getClubDecisionLabel,
  getClubDecisionTone,
} from "@/lib/course-decision-advice";
import {
  clubSortValue,
  formatClubType,
  isShortGameTouchClubType,
  isTrackedClubType,
} from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
import {
  calculateHandicapSummary,
  calculateRoundDifferential,
  formatHandicapDelta,
  formatHandicapValue,
  type HandicapSummary,
} from "@/lib/round-handicap";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import { calculateStockYardage } from "@/lib/stock-yardage";
import { dashboardPinOptions, type DashboardPin } from "@/lib/user-settings";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import { getFeedPageData, type FeedItemView } from "@/lib/social";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

function MissingDatabaseUrlSetup() {
  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Configuration
          </span>
        }
        title="Database connection required"
        description="The app needs DATABASE_URL on the server. Add it in Vercel (or your host) under Environment Variables, redeploy, then run Drizzle migrations against the same database."
      />
      <Card className="premium-card">
        <CardContent className="pt-6">
          <Alert>
            <Database className="size-4" aria-hidden />
            <AlertTitle>Set DATABASE_URL</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Use your Supabase (or other Postgres) connection string and
                configure Supabase Auth public keys so each request can be
                scoped to the signed-in user.
              </p>
              <p className="text-muted-foreground">
                After deploying with env vars, run{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  npm run db:migrate
                </code>{" "}
                locally with the same{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  DATABASE_URL
                </code>
                .
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default async function DashboardPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    return <MissingDatabaseUrlSetup />;
  }

  const [data, social, challengeData] = await Promise.all([
    getDashboardData(),
    getFeedPageData(),
    getChallengesPageData(),
  ]);
  const pinnedDashboardSections = new Set(data.dashboardPins);
  const primaryAction = data.stats.shotCount > 0 ? "/bag" : "/import";
  const primaryActionLabel =
    data.stats.shotCount > 0 ? "Open bag map" : "Import first CSV";

  const metrics = [
    {
      pin: "shots" as const,
      label: "Shots saved",
      value: integerFormatter.format(data.stats.shotCount),
      detail: `${integerFormatter.format(data.stats.rawRowCount)} raw CSV rows`,
      href: "/shots",
      icon: BarChart3,
      tone: "sky" as const,
    },
    {
      pin: "clubs" as const,
      label: "Active clubs",
      value: integerFormatter.format(data.stats.clubCount),
      detail: "Mapped into stock-yardage views",
      href: "/bag",
      icon: Target,
      tone: "pink" as const,
    },
    {
      pin: "sessions" as const,
      label: "Imported sessions",
      value: integerFormatter.format(data.stats.sessionCount),
      detail: `${integerFormatter.format(data.stats.roundCount)} saved rounds, including real scorecards`,
      href: "/handicap",
      icon: CalendarDays,
      tone: "green" as const,
    },
    {
      pin: "handicap" as const,
      label: "Scoring ceiling",
      value: formatHandicapValue(data.stats.combinedHandicap.value),
      detail: formatCombinedHandicapDetail(
        data.stats.realHandicap,
        data.stats.simHandicap,
        data.stats.combinedHandicap,
      ),
      href: "/rounds",
      icon: LineChart,
      tone: "amber" as const,
    },
  ].filter((metric) => pinnedDashboardSections.has(metric.pin));

  const routeCards = [
    {
      title: "Today",
      description:
        "Review today’s shots, session quality, and better-or-worse signals.",
      href: "/today",
      metric: "Practice",
      icon: CalendarDays,
      accent: "text-emerald-700 bg-emerald-50",
    },
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
      title: "Compare",
      description:
        "Compare a focused session against the previous-session baseline.",
      href: "/compare",
      metric: "Session delta",
      icon: GitCompareArrows,
      accent: "text-indigo-700 bg-indigo-50",
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
      description:
        "Review scoring ceiling, playing estimate, and data-limited warnings.",
      href: "/handicap",
      metric: formatHandicapValue(data.stats.combinedHandicap.value),
      icon: LineChart,
      accent: "text-orange-700 bg-orange-50",
    },
    {
      title: "Courses",
      description: "Open course champions, record boards, and tee-map details.",
      href: "/courses",
      metric: "Champions",
      icon: MapPinned,
      accent: "text-emerald-700 bg-emerald-50",
    },
    {
      title: "Course records",
      description: "Challenge all-time, monthly, friend, and hole honours boards.",
      href: "/course-records",
      metric: "Records",
      icon: Award,
      accent: "text-amber-700 bg-amber-50",
    },
    {
      title: "Tournaments",
      description: "Enter major-style events with rounds, standings, and proof.",
      href: "/tournaments",
      metric: "Events",
      icon: Trophy,
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
      description:
        "Open the next practice priority, diagnosis, and session plan.",
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
      title: "Feed",
      description: "See friend PBs, achievements, rounds, and challenge cards.",
      href: "/feed",
      metric: "Social",
      icon: Radio,
      accent: "text-sky-700 bg-sky-50",
    },
    {
      title: "Friends",
      description: "Search by username and manage normal golfer friendships.",
      href: "/friends",
      metric: "Network",
      icon: Users,
      accent: "text-emerald-700 bg-emerald-50",
    },
    {
      title: "Challenges",
      description: "Create private friend challenges and monthly boards.",
      href: "/challenges",
      metric: "Compete",
      icon: Trophy,
      accent: "text-amber-700 bg-amber-50",
    },
    {
      title: "Profile",
      description: "Set your username, QR invite, and social privacy defaults.",
      href: "/profile",
      metric: "Identity",
      icon: UserRound,
      accent: "text-indigo-700 bg-indigo-50",
    },
    {
      title: "Round review",
      description:
        "Open real scorecards, simulator overlays, and handicap inputs.",
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
        visual={
          <PageArtwork
            variant="fairway"
            alt=""
            priority
            className="h-full min-h-44"
          />
        }
        actions={
          <>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full rounded-xl bg-white/70 sm:w-auto"
            >
              <Link href="/shots" prefetch={false}>
                <Database className="size-4" />
                View shots
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="w-full rounded-xl bg-[#111827] text-white sm:w-auto"
            >
              <Link href={primaryAction} prefetch={false}>
                <ArrowRight className="size-4" />
                {primaryActionLabel}
              </Link>
            </Button>
          </>
        }
      />

      <MobileSectionChips
        items={[
          { label: "Today", href: "#today" },
          { label: "Decisions", href: "#decisions" },
          { label: "Progress", href: "#progress" },
          { label: "Tools", href: "#tools" },
          { label: "Bag", href: "#bag" },
        ]}
      />

      <section id="today" className="scroll-mt-28">
        <TodayPlan
          latestSession={data.recentSessions[0] ?? null}
          totalShots={data.stats.shotCount}
          bestClub={data.bagPreview[0] ?? null}
          biggestProblem={data.coachPreview}
          firstSignal={data.whatChanged[0] ?? null}
          primaryAction={primaryAction}
          primaryActionLabel={primaryActionLabel}
        />
      </section>

      <MobileMetricStrip
        items={metrics.map((metric) => ({
          label: metric.label,
          value: metric.value,
          detail: metric.detail,
          tone: metric.tone === "pink" ? "pink" : metric.tone,
        }))}
      />

      <DashboardSocialPulse social={social} challenges={challengeData.active} />

      <section className="hidden gap-4 sm:grid md:grid-cols-2 xl:grid-cols-4">
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

      <DataPanel id="decisions" className="scroll-mt-28">
        <SectionHeader
          title="On-course decisions"
          description="Course-number reminders from the current bag map."
          action={
            <Button asChild variant="outline">
              <Link href="/bag" prefetch={false}>
                <Target className="size-4" />
                Full advice
              </Link>
            </Button>
          }
        />
        <CardContent>
          <CompactReadoutGrid
            columnsClassName="md:grid-cols-3"
            items={data.courseAdvice.slice(0, 3).map((item) => ({
              label: item.label,
              value: item.value,
              detail: item.detail,
              tone: item.tone,
              href: item.clubId ? `/bag/${item.clubId}` : "/bag",
            }))}
          />
        </CardContent>
      </DataPanel>

      <section
        id="progress"
        className="grid scroll-mt-28 items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]"
      >
        <MobileAccordionSection
          title="What changed?"
          description="Latest imported-shot and round signals."
          count={`${data.whatChanged.length} signals`}
        >
          <CompactReadoutGrid items={data.whatChanged} />
        </MobileAccordionSection>

        <DataPanel className="hidden sm:flex">
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
          <CardContent>
            <CompactReadoutGrid
              items={data.whatChanged}
              columnsClassName="md:grid-cols-3"
            />
          </CardContent>
        </DataPanel>

        {pinnedDashboardSections.has("coach") ? (
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
                  className="apple-panel-strong block p-4 transition-colors hover:border-emerald-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <StatusPill tone={data.coachPreview.tone}>
                        {data.coachPreview.issueLabel}
                      </StatusPill>
                      <p className="mt-3 text-3xl font-semibold tracking-normal">
                        {data.coachPreview.clubName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {data.coachPreview.reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold">
                        {data.coachPreview.trustIndex}%
                      </p>
                      <p className="text-xs text-muted-foreground">trust</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium">
                    {data.coachPreview.drill}
                  </p>
                  <Progress
                    value={data.coachPreview.trustIndex}
                    className="mt-4"
                  />
                </Link>
              ) : (
                <div className="apple-panel-strong p-5">
                  <p className="font-semibold">No coach priority yet</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Import a range session to unlock club-specific practice
                    recommendations.
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
        ) : null}
      </section>

      <section id="tools" className="grid scroll-mt-28 gap-4">
        <MobileHorizontalRail
          title="Tools"
          description="Fast routes into the main workflows."
          action={
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-10 rounded-xl"
            >
              <Link href="/dashboard#tools" prefetch={false}>
                All
              </Link>
            </Button>
          }
        >
          {routeCards.slice(0, 8).map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                prefetch={false}
                className="apple-panel-strong block min-h-28 p-3"
              >
                <div
                  className={`mb-3 grid size-10 place-items-center rounded-xl ${card.accent}`}
                >
                  <Icon className="size-5" />
                </div>
                <p className="font-semibold tracking-normal">{card.title}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {card.description}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {card.metric}
                </p>
              </Link>
            );
          })}
        </MobileHorizontalRail>

        <DataPanel className="hidden sm:block">
          <SectionHeader
            title="Quick routes"
            description="Direct links into the working parts of the app."
          />
          <CardContent>
            <CompactLinkGrid items={routeCards} />
          </CardContent>
        </DataPanel>
      </section>

      <section
        id="bag"
        className="grid scroll-mt-28 gap-4 lg:grid-cols-[1.15fr_0.85fr]"
      >
        {pinnedDashboardSections.has("bag") ? (
          <>
            <MobileHorizontalRail
              title="Bag snapshot"
              description="Stock numbers and confidence by club."
              action={
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="min-h-10 rounded-xl"
                >
                  <Link href="/bag" prefetch={false}>
                    View all
                  </Link>
                </Button>
              }
            >
              {data.bagPreview.map((club) => (
                <Link
                  key={club.id}
                  href={`/bag/${club.id}`}
                  prefetch={false}
                  className="apple-panel-strong block p-4"
                >
                  <p className="text-lg font-semibold tracking-normal">
                    {formatClubType(club.type)}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {club.brandModel}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MiniMetric
                      label="Carry"
                      value={formatYards(club.stock.carryMedianYd)}
                    />
                    <MiniMetric
                      label="Trust"
                      value={`${club.stock.confidenceScore}%`}
                    />
                  </div>
                  <Progress
                    value={club.stock.confidenceScore}
                    className="mt-4"
                  />
                </Link>
              ))}
            </MobileHorizontalRail>

            <DataPanel className="hidden sm:block">
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
                    className="apple-panel-strong grid gap-3 p-4 transition-colors hover:border-emerald-300 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold tracking-normal">
                          {formatClubType(club.type)}
                        </p>
                        <StatusPill
                          tone={getClubDecisionTone(club.decisionLabel)}
                        >
                          {club.decisionLabel}
                        </StatusPill>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {club.brandModel}
                      </p>
                    </div>
                    <div className="grid min-w-48 grid-cols-2 gap-3">
                      <MiniMetric
                        label="Carry"
                        value={formatYards(club.stock.carryMedianYd)}
                      />
                      <MiniMetric
                        label="Shots"
                        value={integerFormatter.format(club.shotCount)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Progress value={club.stock.confidenceScore} />
                    </div>
                  </Link>
                ))}
                {data.bagPreview.length === 0 ? (
                  <div className="apple-panel p-6 text-center">
                    <p className="font-medium">No active clubs yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Import a Rapsodo CSV and the bag map will build
                      automatically.
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
          </>
        ) : null}

        {pinnedDashboardSections.has("rounds") ? (
          <DataPanel>
            <SectionHeader
              title="Latest round"
              description="Newest round, simulator, or simulated-course file."
              action={<Flag className="size-5 text-sky-500" />}
            />
            <CardContent>
              {data.latestRound ? (
                <div className="space-y-4">
                  <div className="apple-panel-strong p-4">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(data.latestRound.date)} -{" "}
                      {formatSessionType(data.latestRound.type)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-normal">
                      {data.latestRound.courseName ??
                        data.latestRound.fileName ??
                        "Untitled round"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <RoundMetric
                      label="Score"
                      value={data.latestRound.totalScore}
                    />
                    <RoundMetric
                      label="Par"
                      value={data.latestRound.totalPar}
                    />
                    <RoundMetric
                      label="Putts"
                      value={data.latestRound.totalPutts}
                    />
                    <RoundMetric
                      label="Diff"
                      value={formatHandicapValue(
                        data.latestRound.handicapDifferential,
                      )}
                    />
                  </div>
                  <Separator />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1">
                      <Link
                        href={`/rounds/${data.latestRound.id}`}
                        prefetch={false}
                      >
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
                <div className="apple-panel p-6">
                  <p className="font-medium">No round imports yet</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Save a simulated-course CSV to unlock scorecards, hole
                    review, and round shot maps.
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
        ) : null}
      </section>
    </PageShell>
  );
}

function TodayPlan({
  latestSession,
  totalShots,
  bestClub,
  biggestProblem,
  firstSignal,
  primaryAction,
  primaryActionLabel,
}: {
  latestSession:
    | Awaited<ReturnType<typeof getDashboardData>>["recentSessions"][number]
    | null;
  totalShots: number;
  bestClub:
    | Awaited<ReturnType<typeof getDashboardData>>["bagPreview"][number]
    | null;
  biggestProblem: Awaited<ReturnType<typeof getDashboardData>>["coachPreview"];
  firstSignal: ReturnType<typeof buildWhatChangedInsights>[number] | null;
  primaryAction: string;
  primaryActionLabel: string;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Today"
        description="Start here: current form, latest change, club costing you shots, and what to practise next."
        action={<CalendarDays className="size-5 text-emerald-500" />}
      />
      <CardContent>
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/85 p-3 shadow-sm sm:hidden">
          <ShotTraceMotif className="h-14 w-20 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Today&apos;s readout
            </p>
            <p className="truncate text-sm font-semibold">
              {biggestProblem
                ? `${biggestProblem.clubName}: ${biggestProblem.issueLabel}`
                : primaryActionLabel}
            </p>
          </div>
        </div>
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-2 xl:grid-cols-4"
          items={[
            {
              label: "Latest session",
              value: latestSession
                ? formatDate(latestSession.date)
                : "No import yet",
              detail: latestSession
                ? `${latestSession.shotCount} shots · ${formatSessionType(latestSession.type)}`
                : "Import a CSV to build your baseline",
              tone: "sky",
            },
            {
              label: "Your game",
              value: `${totalShots.toLocaleString("en-GB")} shots`,
              detail: firstSignal
                ? firstSignal.detail
                : "Waiting for enough data to spot movement",
              tone: firstSignal?.tone ?? "slate",
            },
            {
              label: "Best club",
              value: bestClub ? formatClubType(bestClub.type) : "--",
              detail: bestClub
                ? `${bestClub.decisionLabel} · ${bestClub.stock.confidenceScore}% confidence · ${bestClub.shotCount} shots`
                : "Need a tracked club sample",
              tone: "green",
            },
            {
              label: "Practise next",
              value: biggestProblem?.clubName ?? primaryActionLabel,
              detail:
                biggestProblem?.drill ??
                "Import data or review the latest round",
              tone: biggestProblem?.tone ?? "amber",
              href: biggestProblem
                ? `/bag/${biggestProblem.clubId}/analytics`
                : primaryAction,
            },
          ]}
        />
      </CardContent>
    </DataPanel>
  );
}

function DashboardSocialPulse({
  social,
  challenges,
}: {
  social: Awaited<ReturnType<typeof getFeedPageData>>;
  challenges: ChallengeListItem[];
}) {
  const topItems = social.items.slice(0, 3);
  const pbCount = social.items.filter((item) => item.itemType === "new_pb" || item.itemType === "longest_drive").length;
  const recordCount = social.items.filter((item) => item.itemType.startsWith("course_record")).length;
  const tournamentCount = social.items.filter((item) => item.itemType.startsWith("tournament")).length;
  const closingSoon = challenges
    .filter((challenge) => challenge.endsAt)
    .sort((left, right) => (left.endsAt?.getTime() ?? 0) - (right.endsAt?.getTime() ?? 0))[0] ?? null;

  return (
    <DataPanel>
      <SectionHeader
        title="Social pulse"
        description="A compact view of network activity without turning the dashboard into another feed."
        action={
          <Button asChild variant="outline">
            <Link href="/feed" prefetch={false}>
              <Radio className="size-4" />
              Open feed
            </Link>
          </Button>
        }
      />
      <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <CompactReadoutGrid
          columnsClassName="sm:grid-cols-2"
          items={[
            {
              label: "Friends active",
              value: social.friendCount.toString(),
              detail: "Accepted golfer friendships",
              tone: "green",
              href: "/friends",
            },
            {
              label: "Network PBs",
              value: pbCount.toString(),
              detail: "Visible PB and longest-drive cards",
              tone: "amber",
              href: "/feed?filter=pbs",
            },
            {
              label: "Course records",
              value: recordCount.toString(),
              detail: "Champion, defended, and beaten marks",
              tone: "amber",
              href: "/course-records",
            },
            {
              label: "Tournaments",
              value: tournamentCount.toString(),
              detail: "Entries and verified round submissions",
              tone: "green",
              href: "/tournaments",
            },
            {
              label: "Challenge closing",
              value: closingSoon?.title ?? "--",
              detail: closingSoon?.endsAt ? `Ends ${formatDate(closingSoon.endsAt)}` : "No open closing board",
              tone: closingSoon ? "sky" : "slate",
              href: closingSoon ? `/challenges/${closingSoon.id}` : "/challenges",
            },
          ]}
        />
        <div className="grid gap-2">
          {topItems.length > 0 ? (
            topItems.map((item) => <DashboardSocialMoment key={item.id} item={item} />)
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No visible social moments yet. Add friends or join a challenge to populate this pulse.
            </p>
          )}
        </div>
      </CardContent>
    </DataPanel>
  );
}

function DashboardSocialMoment({ item }: { item: FeedItemView }) {
  return (
    <Link
      href={item.proofUrl ?? "/feed"}
      prefetch={false}
      className="grid gap-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm transition-colors hover:bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{item.headline}</p>
        <StatusPill tone={item.verificationLabel === "Manual" || item.verificationLabel === "Unverified" ? "slate" : "green"}>
          {item.verificationLabel}
        </StatusPill>
      </div>
      <p className="text-muted-foreground">
        {item.metricValue ? `${item.metricLabel ?? "Metric"} ${item.metricValue}` : item.context ?? "Social update"}
      </p>
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function RoundMetric({
  label,
  value,
}: {
  label: string;
  value: number | string | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">
        {typeof value === "number"
          ? integerFormatter.format(value)
          : (value ?? "--")}
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

  return `Real ceiling ${formatHandicapValue(realHandicap.value)} | Sim ceiling ${formatHandicapValue(simHandicap.value)} | ${trendLabel}`;
}

function normalizeDashboardPins(
  value: string[] | null | undefined,
): DashboardPin[] {
  const allowedPins = new Set<string>(dashboardPinOptions);
  const pins = (value ?? []).filter((pin): pin is DashboardPin =>
    allowedPins.has(pin),
  );

  return pins.length > 0 ? pins : [...dashboardPinOptions];
}

async function getDashboardData() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [
    [shotCount],
    [rawRowCount],
    [sessionCount],
    [profile],
    recentSessionRows,
    roundRows,
    allClubRows,
    shotCountsByClub,
    recentStockShots,
  ] = await Promise.all([
    db.select({ value: count() }).from(shots).where(eq(shots.userId, userId)),
    db
      .select({ value: count() })
      .from(importRows)
      .where(eq(importRows.userId, userId)),
    db
      .select({ value: count() })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    db
      .select({ dashboardPins: users.dashboardPins })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
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
        providerKind: rapsodoSyncSessions.providerKind,
        providerSessionMode: rapsodoSyncSessions.providerSessionMode,
      })
      .from(sessions)
      .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
      .leftJoin(
        rapsodoSyncSessions,
        eq(sessions.id, rapsodoSyncSessions.importedSessionId),
      )
      .where(
        and(
          eq(sessions.userId, userId),
          inArray(sessions.type, [...roundSessionTypes]),
        ),
      )
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
            .where(
              and(
                eq(shots.userId, userId),
                inArray(shots.sessionId, recentSessionIds),
              ),
            )
            .groupBy(shots.sessionId),
          db
            .select({
              sessionId: importRows.sessionId,
              count: count(),
            })
            .from(importRows)
            .where(
              and(
                eq(importRows.userId, userId),
                inArray(importRows.sessionId, recentSessionIds),
              ),
            )
            .groupBy(importRows.sessionId),
        ])
      : [[], []];

  const shotCountBySessionId = new Map(
    shotCountsBySession.map((row) => [row.sessionId, row.count]),
  );
  const rawCountBySessionId = new Map(
    rawCountsBySession.map((row) => [row.sessionId, row.count]),
  );
  const shotCountByClubId = new Map(
    shotCountsByClub.map((row) => [row.clubId, row.count]),
  );
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

  const bag = clubRows
    .map((club) => {
      const clubShots = stockShotsByClubId.get(club.id) ?? [];
      const brandModel =
        [club.brand, club.model].filter(Boolean).join(" ") ||
        "Unspecified model";
      const stock = calculateStockYardage(clubShots, 50, {
        clubType: club.type,
      });
      const touch = calculateShortGameTouchSummary(clubShots, 80, {
        clubType: club.type,
      });
      const isShortGameTouch = isShortGameTouchClubType(club.type);
      const decisionLabel = getClubDecisionLabel({
        isShortGameTouch,
        stockLabel: stock.label,
      });

      return {
        ...club,
        brandModel,
        isShortGameTouch,
        decisionLabel,
        shotCount: shotCountByClubId.get(club.id) ?? 0,
        stock,
        touch,
      };
    })
    .sort((left, right) => {
      const shotCountDifference = right.shotCount - left.shotCount;
      return (
        shotCountDifference ||
        clubSortValue(left.type) - clubSortValue(right.type)
      );
    });
  const bagPreview = bag.slice(0, 5);
  const courseAdvice = buildCourseDecisionAdvice(bag);
  const roundSummaries = roundRows
    .filter(isRoundHistorySession)
    .map(summarizeRound);
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
    dashboardPins: normalizeDashboardPins(profile?.dashboardPins),
    stats: {
      shotCount: shotCount?.value ?? 0,
      rawRowCount: rawRowCount?.value ?? 0,
      sessionCount: sessionCount?.value ?? 0,
      clubCount: clubRows.length,
      roundCount: roundSummaries.length,
      realHandicap,
      simHandicap,
      combinedHandicap,
    },
    recentSessions,
    latestRound,
    bagPreview,
    courseAdvice,
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

      const currentCarry = median(
        currentShots.map((shot) => shot.carryYd).filter(isNumber),
      );
      const previousCarry = median(
        previousShots.map((shot) => shot.carryYd).filter(isNumber),
      );
      const currentMiss = averageNumber(
        currentShots
          .map((shot) => shot.sideCarryYd)
          .filter(isNumber)
          .map(Math.abs),
      );
      const previousMiss = averageNumber(
        previousShots
          .map((shot) => shot.sideCarryYd)
          .filter(isNumber)
          .map(Math.abs),
      );
      const currentBallSpeed = averageNumber(
        currentShots.map((shot) => shot.ballSpeedMph).filter(isNumber),
      );
      const previousBallSpeed = averageNumber(
        previousShots.map((shot) => shot.ballSpeedMph).filter(isNumber),
      );

      return {
        clubId,
        clubType: clubTypeById.get(clubId) ?? "club",
        currentCount: currentShots.length,
        previousCount: previousShots.length,
        carryDelta:
          currentCarry !== null && previousCarry !== null
            ? currentCarry - previousCarry
            : null,
        missDelta:
          currentMiss !== null && previousMiss !== null
            ? currentMiss - previousMiss
            : null,
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
    .sort(
      (left, right) =>
        Math.abs(right.carryDelta ?? 0) - Math.abs(left.carryDelta ?? 0),
    )[0];

  if (
    strongestCarryChange?.carryDelta !== null &&
    strongestCarryChange?.carryDelta !== undefined
  ) {
    insights.push({
      label: `${formatClubType(strongestCarryChange.clubType)} carry`,
      value: `${formatSignedYards(strongestCarryChange.carryDelta)} vs previous 30`,
      detail: `${strongestCarryChange.currentCount} recent shots compared with ${strongestCarryChange.previousCount} older shots.`,
      tone: strongestCarryChange.carryDelta >= 0 ? "green" : "amber",
    });
  }

  const strongestMissChange = clubChanges
    .filter((change) => change.missDelta !== null)
    .sort(
      (left, right) =>
        Math.abs(right.missDelta ?? 0) - Math.abs(left.missDelta ?? 0),
    )[0];

  if (
    strongestMissChange?.missDelta !== null &&
    strongestMissChange?.missDelta !== undefined
  ) {
    const tighter = strongestMissChange.missDelta < 0;
    insights.push({
      label: `${formatClubType(strongestMissChange.clubType)} dispersion`,
      value: `${numberFormatter.format(Math.abs(strongestMissChange.missDelta))} yd ${tighter ? "tighter" : "wider"}`,
      detail:
        "Average left/right miss compared with the previous 30-day window.",
      tone: tighter ? "green" : "amber",
    });
  }

  const strongestSpeedChange = clubChanges
    .filter((change) => change.ballSpeedDelta !== null)
    .sort(
      (left, right) =>
        Math.abs(right.ballSpeedDelta ?? 0) -
        Math.abs(left.ballSpeedDelta ?? 0),
    )[0];

  if (
    strongestSpeedChange?.ballSpeedDelta !== null &&
    strongestSpeedChange?.ballSpeedDelta !== undefined
  ) {
    insights.push({
      label: `${formatClubType(strongestSpeedChange.clubType)} speed`,
      value: `${formatSignedNumber(strongestSpeedChange.ballSpeedDelta)} mph`,
      detail: "Ball speed movement against the previous 30-day window.",
      tone: strongestSpeedChange.ballSpeedDelta >= 0 ? "sky" : "slate",
    });
  }

  if (
    latestRound &&
    latestRound.totalScore !== null &&
    latestRound.totalPar !== null
  ) {
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

  const fillerOptions: Array<{
    label: string;
    value: string;
    detail: string;
    tone: "slate";
  }> = [
    {
      label: "Data depth",
      value:
        bagPreview.length > 0
          ? `${integerFormatter.format(bagPreview.length)} clubs mapped`
          : "Import needed",
      detail:
        bagPreview.length > 0
          ? "Keep adding shots to unlock stronger trend comparisons."
          : "Upload a Rapsodo CSV to start building the personal baseline.",
      tone: "slate",
    },
    {
      label: "Next step",
      value: "Log a session",
      detail:
        "More recent shots produce sharper insight cards on this dashboard.",
      tone: "slate",
    },
    {
      label: "Coverage",
      value: bagPreview.length > 0 ? "Bag mapped" : "Bag not mapped",
      detail:
        bagPreview.length > 0
          ? "Refresh stock yardages from the bag page after each range session."
          : "Map every club so on-course distances become trustworthy.",
      tone: "slate",
    },
  ];

  let fillerIndex = 0;
  while (insights.length < 3 && fillerIndex < fillerOptions.length) {
    insights.push(fillerOptions[fillerIndex]);
    fillerIndex += 1;
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
  scorecardJson: Array<{
    par: number;
    score?: number | null;
    putts?: number | null;
  }> | null;
}) {
  const scorecard = round.scorecardJson ?? [];
  const totalScore = sumNullable(scorecard.map((hole) => hole.score ?? null));
  const totalPutts = sumNullable(scorecard.map((hole) => hole.putts ?? null));
  const totalPar =
    scorecard.length > 0
      ? scorecard.reduce((total, hole) => total + hole.par, 0)
      : null;
  const handicapDifferential = calculateRoundDifferential({
    totalScore,
    totalPar,
    courseRating: round.courseRating ?? null,
    slopeRating: round.slopeRating ?? null,
    holesPlayed: scorecard.length,
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
  const present = values.filter(
    (value): value is number => typeof value === "number",
  );
  return present.length > 0
    ? present.reduce((total, value) => total + value, 0)
    : null;
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

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function averageNumber(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
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
