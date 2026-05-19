import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
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
  type LucideIcon,
} from "lucide-react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ActionCentrePanel, DataHealthFeaturePanel } from "@/components/features/feature-panels";
import {
  DashboardMobileHeader,
  type DashboardTabKey,
} from "@/app/dashboard/dashboard-mobile-header";
import { Button } from "@/components/ui/button";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  MobileAccordionSection,
  MobileHorizontalRail,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
import { MobileStatusAction } from "@/components/mobile-sports";
import { ShotTraceMotif } from "@/components/visuals/page-artwork";
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
import { buildCourseDecisionAdvice, getClubDecisionLabel } from "@/lib/course-decision-advice";
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
  formatHandicapValue,
  type HandicapSummary,
} from "@/lib/round-handicap";
import { calculateShortGameTouchSummary } from "@/lib/short-game";
import { calculateStockYardage } from "@/lib/stock-yardage";
import { dashboardPinOptions, type DashboardPin } from "@/lib/user-settings";
import { isRoundHistorySession, roundSessionTypes } from "@/lib/round-sessions";
import { getFeedPageData, type FeedItemView } from "@/lib/social";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

function parseDashboardSection(section?: string): DashboardTabKey {
  if (
    section === "today" ||
    section === "decisions" ||
    section === "progress" ||
    section === "tools" ||
    section === "bag"
  ) {
    return section;
  }

  return "today";
}

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
                Use your Supabase (or other Postgres) connection string and configure Supabase Auth
                public keys so each request can be scoped to the signed-in user.
              </p>
              <p className="text-muted-foreground">
                After deploying with env vars, run{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run db:migrate</code>{" "}
                locally with the same{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">DATABASE_URL</code>.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </PageShell>
  );
}

type DashboardPageProps = {
  searchParams?: Promise<{
    section?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  if (!process.env.DATABASE_URL?.trim()) {
    return <MissingDatabaseUrlSetup />;
  }

  const [params, data, social, challengeData, featureData] = await Promise.all([
    searchParams,
    getDashboardData(),
    getFeedPageData(),
    getChallengesPageData(),
    getFeatureIdeasData(),
  ]);
  const activeDashboardSection = parseDashboardSection(params?.section);
  const pinnedDashboardSections = new Set(data.dashboardPins);
  const primaryAction = data.stats.shotCount > 0 ? "/bag" : "/import";
  const primaryActionLabel = data.stats.shotCount > 0 ? "Open bag map" : "Import first CSV";
  const latestSession = data.recentSessions[0] ?? null;
  const bestClub = getBestClub(data.bagPreview);
  const firstSignal = data.whatChanged[0] ?? null;
  const practiceHref = data.coachPreview
    ? `/bag/${data.coachPreview.clubId}/analytics`
    : primaryAction;
  const latestRoundHref = data.latestRound ? `/rounds/${data.latestRound.id}` : "/rounds";
  const mappedClubCount = data.bagPreview.filter((club) => club.stock.confidenceScore >= 60).length;

  const metrics = [
    {
      pin: "shots" as const,
      label: "Shot library",
      value: integerFormatter.format(data.stats.shotCount),
      detail: latestSession
        ? `+${integerFormatter.format(latestSession.shotCount)} from latest import`
        : `${integerFormatter.format(data.stats.rawRowCount)} raw CSV rows`,
      insight: "Feeds club distances, practice priorities, and shot history.",
      actionLabel: "Open shots",
      href: "/shots",
      icon: BarChart3,
      tone: "sky" as const,
    },
    {
      pin: "clubs" as const,
      label: "Bag map",
      value: integerFormatter.format(data.stats.clubCount),
      detail: `${integerFormatter.format(mappedClubCount)} trusted for decisions`,
      insight:
        data.stats.clubCount > mappedClubCount
          ? `${integerFormatter.format(data.stats.clubCount - mappedClubCount)} clubs still need more stock shots.`
          : "Every active club has usable trust.",
      actionLabel: "Open bag",
      href: "/bag",
      icon: Target,
      tone: "green" as const,
    },
    {
      pin: "sessions" as const,
      label: "Practice history",
      value: integerFormatter.format(data.stats.sessionCount),
      detail: latestSession
        ? `Latest import: ${formatDate(latestSession.date)}`
        : `${integerFormatter.format(data.stats.roundCount)} saved rounds`,
      insight: `${integerFormatter.format(data.stats.roundCount)} saved rounds give scoring context.`,
      actionLabel: "Open latest",
      href: "/today",
      icon: CalendarDays,
      tone: "green" as const,
    },
    {
      pin: "handicap" as const,
      label: "Scoring ceiling",
      value: formatHandicapValue(data.stats.combinedHandicap.value),
      detail: formatHandicapTrend(data.stats.combinedHandicap),
      insight: "Lower is better. Built from saved real and simulator rounds.",
      actionLabel: "Review rounds",
      href: "/rounds",
      icon: LineChart,
      tone: "amber" as const,
    },
  ].filter((metric) => pinnedDashboardSections.has(metric.pin));
  const mobileMetrics = [
    {
      pin: "shots" as const,
      label: "Shot library",
      value: integerFormatter.format(data.stats.shotCount),
      detail: `${integerFormatter.format(data.stats.rawRowCount)} raw CSV rows`,
      href: "/shots",
      icon: BarChart3,
      tone: "sky" as const,
    },
    {
      pin: "clubs" as const,
      label: "Bag map",
      value: integerFormatter.format(data.stats.clubCount),
      detail: "Mapped into stock-yardage views",
      href: "/bag",
      icon: Target,
      tone: "pink" as const,
    },
    {
      pin: "sessions" as const,
      label: "Practice history",
      value: integerFormatter.format(data.stats.sessionCount),
      detail: `${integerFormatter.format(data.stats.roundCount)} saved rounds, including real scorecards`,
      href: "/today",
      icon: CalendarDays,
      tone: "green" as const,
    },
    {
      pin: "handicap" as const,
      label: "Scoring ceiling",
      value: formatHandicapValue(data.stats.combinedHandicap.value),
      detail: formatHandicapTrend(data.stats.combinedHandicap),
      href: "/rounds",
      icon: LineChart,
      tone: "amber" as const,
    },
  ].filter((metric) => pinnedDashboardSections.has(metric.pin));

  const routeCards = [
    {
      title: "Start practice",
      description: "Open the current coach signal and drill.",
      href: practiceHref,
      metric: data.coachPreview ? data.coachPreview.clubName : primaryActionLabel,
      icon: Crosshair,
      accent: "text-emerald-700 bg-emerald-50",
    },
    {
      title: "Review latest practice",
      description: "Inspect the latest imported practice signal.",
      href: "/today",
      metric: latestSession
        ? `${integerFormatter.format(latestSession.shotCount)} shots`
        : "Practice",
      icon: CalendarDays,
      accent: "text-sky-700 bg-sky-50",
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
      accent: "text-blue-700 bg-blue-50",
    },
    {
      title: "Open bag map",
      description: "Review stock carry, confidence, and dispersion by club.",
      href: "/bag",
      metric: `${integerFormatter.format(data.stats.clubCount)} clubs`,
      icon: Target,
      accent: "text-emerald-700 bg-emerald-50",
    },
    {
      title: "Review round",
      description: "Open scorecards, course imports, and shot maps.",
      href: latestRoundHref,
      metric: data.latestRound
        ? formatScoreVsPar(data.latestRound.totalScore, data.latestRound.totalPar)
        : `${integerFormatter.format(data.stats.roundCount)} rounds`,
      icon: Flag,
      accent: "text-amber-700 bg-amber-50",
    },
  ];
  const mobileRouteCards = [
    {
      title: "Latest practice signal",
      description:
        "Review the latest imported practice day, session quality, and better-or-worse signals.",
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
      description: "Compare a focused session against the previous-session baseline.",
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
      description: "Review scoring ceiling, playing estimate, and data-limited warnings.",
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
      description: "Open real scorecards, simulator overlays, and handicap inputs.",
      href: data.latestRound ? `/rounds/${data.latestRound.id}` : "/rounds",
      metric: data.latestRound ? "Latest round" : "No round yet",
      icon: MapPinned,
      accent: "text-rose-600 bg-rose-50",
    },
  ];
  return (
    <PageShell>
      <DashboardMobileLayout
        data={data}
        social={social}
        challenges={challengeData.active}
        metrics={mobileMetrics}
        routeCards={mobileRouteCards}
        pinnedDashboardSections={pinnedDashboardSections}
        primaryAction={primaryAction}
        primaryActionLabel={primaryActionLabel}
        activeDashboardSection={activeDashboardSection}
        featureData={featureData}
      />

      <div className="hidden flex-col gap-6 sm:flex">
        <DashboardSummaryHero
          latestSession={latestSession}
          bestClub={bestClub}
          coachPreview={data.coachPreview}
          scoringCeiling={formatHandicapValue(data.stats.combinedHandicap.value)}
          scoringTrend={formatHandicapTrend(data.stats.combinedHandicap)}
          primaryAction={primaryAction}
          primaryActionLabel={primaryActionLabel}
          latestRound={data.latestRound}
        />

        {data.stats.shotCount === 0 ? <DashboardFirstRunOnboarding /> : null}

        <DataHealthFeaturePanel data={featureData} />

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <ActionCentrePanel data={featureData} layout="dashboard" />

            {pinnedDashboardSections.has("coach") ? (
              <PracticeRecommendationCard
                coachPreview={data.coachPreview}
                primaryAction={primaryAction}
                primaryActionLabel={primaryActionLabel}
              />
            ) : null}

            {pinnedDashboardSections.has("bag") ? (
              <div id="bag" className="scroll-mt-28">
                <BagConfidencePanel
                  clubs={data.bagPreview}
                  bagAlert={featureData.bagAlerts[0] ?? null}
                />
              </div>
            ) : null}

            <CourseDecisionPanel items={data.courseAdvice.slice(0, 3)} />

            <WhatChangedPanel insights={data.whatChanged} />
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <LatestPracticeSignalPanel
              compact
              latestSession={latestSession}
              stats={data.stats}
              firstSignal={firstSignal}
              latestRound={data.latestRound}
            />

            {pinnedDashboardSections.has("rounds") ? (
              <LatestRoundPanel latestRound={data.latestRound} />
            ) : null}

            {metrics.length > 0 ? <PerformanceSnapshot metrics={metrics} paired /> : null}

            <DashboardSocialPulse social={social} />

            <QuickActions routes={routeCards} />
          </aside>
        </div>
      </div>
    </PageShell>
  );
}

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type DashboardTone = "green" | "sky" | "amber" | "slate" | "pink";
type DashboardRoute = {
  title: string;
  description: string;
  href: string;
  metric: ReactNode;
  icon: LucideIcon;
  accent: string;
};
type DashboardMetric = {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  insight?: ReactNode;
  actionLabel?: string;
  href: string;
  icon: LucideIcon;
  tone: DashboardTone;
};

function DashboardMobileLayout({
  data,
  social,
  challenges,
  metrics,
  routeCards,
  pinnedDashboardSections,
  primaryAction,
  primaryActionLabel,
  activeDashboardSection,
  featureData,
}: {
  data: DashboardData;
  social: Awaited<ReturnType<typeof getFeedPageData>>;
  challenges: ChallengeListItem[];
  metrics: DashboardMetric[];
  routeCards: DashboardRoute[];
  pinnedDashboardSections: Set<DashboardPin>;
  primaryAction: string;
  primaryActionLabel: string;
  activeDashboardSection: DashboardTabKey;
  featureData: FeatureIdeasData;
}) {
  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-x-clip sm:hidden [&>*]:min-w-0">
      <DashboardMobileHeader initialActiveKey={activeDashboardSection} />

      <MobileStatusAction
        label="Latest signal"
        value={data.coachPreview?.clubName ?? "Build baseline"}
        detail={
          data.coachPreview?.issueLabel ?? "Import a session to unlock your next recommendation."
        }
        action={
          <Button
            asChild
            size="sm"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <Link
              href={
                data.coachPreview ? `/bag/${data.coachPreview.clubId}/analytics` : primaryAction
              }
              prefetch={false}
            >
              {data.coachPreview ? "Open" : primaryActionLabel}
            </Link>
          </Button>
        }
      />

      {data.stats.shotCount === 0 ? <DashboardFirstRunOnboarding /> : null}

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
          tone: metric.tone,
        }))}
      />

      <DashboardMobileDataHealth dataHealth={featureData.dataHealth} />

      <ActionCentrePanel data={featureData} />

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
                      <p className="text-2xl font-semibold">{data.coachPreview.trustIndex}%</p>
                      <p className="text-xs text-muted-foreground">trust</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium">{data.coachPreview.drill}</p>
                  <Progress value={data.coachPreview.trustIndex} className="mt-4" />
                </Link>
              ) : (
                <div className="apple-panel-strong p-5">
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
        ) : null}
      </section>

      <section id="tools" className="grid scroll-mt-28 gap-4">
        <MobileHorizontalRail
          title="Key tools"
          description="The fastest paths into today's golf work."
          action={
            <Button asChild variant="outline" size="sm" className="min-h-10 rounded-lg">
              <Link href="/dashboard#tools" prefetch={false}>
                Tools
              </Link>
            </Button>
          }
          itemClassName="min-w-[68vw] max-w-[18rem]"
        >
          {routeCards.slice(0, 6).map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                prefetch={false}
                className="apple-panel-strong block min-h-28 p-3"
              >
                <div className={`mb-3 grid size-10 place-items-center rounded-xl ${card.accent}`}>
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
        <MobileAccordionSection
          title="All tools"
          description="Every page remains available without turning the dashboard into a directory."
          count={`${routeCards.length} pages`}
        >
          <div className="grid gap-2">
            {routeCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.href}
                  href={card.href}
                  prefetch={false}
                  className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2"
                >
                  <span className={`grid size-8 place-items-center rounded-md ${card.accent}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{card.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {card.description}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{card.metric}</span>
                </Link>
              );
            })}
          </div>
        </MobileAccordionSection>
      </section>

      <section id="bag" className="grid scroll-mt-28 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        {pinnedDashboardSections.has("bag") ? (
          <MobileHorizontalRail
            title="Bag confidence"
            description="Stock numbers and confidence by club."
            action={
              <Button asChild variant="outline" size="sm" className="min-h-10 rounded-lg">
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
                <p className="text-lg font-semibold tracking-normal">{formatClubType(club.type)}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{club.brandModel}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniMetric label="Carry" value={formatYards(club.stock.carryMedianYd)} />
                  <MiniMetric label="Trust" value={`${club.stock.confidenceScore}%`} />
                </div>
                <Progress value={club.stock.confidenceScore} className="mt-4" />
              </Link>
            ))}
          </MobileHorizontalRail>
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
                <div className="apple-panel p-6">
                  <p className="font-medium">No round imports yet</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Save a simulated-course CSV to unlock scorecards, hole review, and round shot
                    maps.
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

      <DashboardMobileSocialPulse social={social} challenges={challenges} />
    </div>
  );
}

function DashboardFirstRunOnboarding() {
  const steps = [
    {
      title: "Welcome",
      detail: "Turn Rapsodo data into stock yardages, progress and practice priorities.",
      href: "/import",
      ready: true,
    },
    {
      title: "Import Rapsodo",
      detail: "Upload a CSV or connect/sync Rapsodo before any social prompt matters.",
      href: "/import",
      ready: false,
    },
    {
      title: "Map clubs",
      detail: "Confirm club names so every shot lands in the right bag slot.",
      href: "/import#csv-import",
      ready: false,
    },
    {
      title: "Read first insight",
      detail: "Import Quality and Data Health explain whether the data can be trusted.",
      href: "/import",
      ready: false,
    },
    {
      title: "Check bag gaps",
      detail: "Open stock yardages and see the first gapping summary.",
      href: "/bag",
      ready: false,
    },
    {
      title: "Use coach next action",
      detail: "Follow the first practice priority before comparing with anyone else.",
      href: "/coach",
      ready: false,
    },
    {
      title: "Optional share/compete",
      detail: "Share a PB or join a challenge only after your data checks pass.",
      href: "/challenges",
      ready: false,
    },
  ];

  return (
    <DataPanel id="first-run-onboarding" className="scroll-mt-28">
      <SectionHeader
        title="First-run Rapsodo path"
        description="Start here if there is no usable shot data yet. Data comes first; sharing and competition stay optional."
        action={
          <Button asChild className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import Rapsodo
            </Link>
          </Button>
        }
      />
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
          {steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              prefetch={false}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/35"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-[#F5F6F4] text-xs font-semibold">
                  {index + 1}
                </span>
                {step.ready ? (
                  <CheckCircle2 className="size-4 text-emerald-700" />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">Next</span>
                )}
              </div>
              <p className="mt-3 font-semibold leading-5">{step.title}</p>
              <p className="mt-1 leading-5 text-muted-foreground">{step.detail}</p>
            </Link>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
          <p className="text-sm font-semibold">What happens to my data?</p>
          <div className="mt-2 grid gap-2 text-sm leading-5 text-muted-foreground sm:grid-cols-4">
            <p>Private by default.</p>
            <p>You control profile, feed and leaderboard visibility.</p>
            <p>Friends do not get account access.</p>
            <p>Coach, viewer and editor access is separate.</p>
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function DashboardMobileDataHealth({ dataHealth }: { dataHealth: FeatureIdeasData["dataHealth"] }) {
  return (
    <section className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3 sm:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#050505]">Data health</p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6B7280]">
            Last import, club mapping and next useful data check.
          </p>
        </div>
        <StatusPill tone={dataHealth.tone}>{dataHealth.status}</StatusPill>
      </div>
      <div className="grid gap-2">
        <DataPair label="Score" value={dataHealth.metric} />
        {dataHealth.checks.slice(0, 4).map((check) => (
          <DataPair key={check.title} label={check.title} value={check.metric ?? check.detail} />
        ))}
      </div>
    </section>
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
  latestSession: DashboardData["recentSessions"][number] | null;
  totalShots: number;
  bestClub: DashboardData["bagPreview"][number] | null;
  biggestProblem: DashboardData["coachPreview"];
  firstSignal: ReturnType<typeof buildWhatChangedInsights>[number] | null;
  primaryAction: string;
  primaryActionLabel: string;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Latest practice signal"
        description="Start here: latest practice form, latest change, club costing you shots, and what to practise next."
        action={
          <div data-primary-action>
            <Button
              asChild
              size="sm"
              className="min-h-9 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
            >
              <Link
                href={biggestProblem ? `/bag/${biggestProblem.clubId}/analytics` : primaryAction}
                prefetch={false}
              >
                {biggestProblem ? "Plan" : "Import"}
              </Link>
            </Button>
          </div>
        }
      />
      <CardContent>
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/85 p-3 shadow-sm sm:hidden">
          <ShotTraceMotif className="h-14 w-20 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Latest readout
            </p>
            <p className="truncate text-sm font-semibold">
              {biggestProblem
                ? `${biggestProblem.clubName}: ${biggestProblem.issueLabel}`
                : primaryActionLabel}
            </p>
          </div>
        </div>
        <div className="mb-3 sm:hidden" data-primary-action>
          <Button asChild className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Link
              href={biggestProblem ? `/bag/${biggestProblem.clubId}/analytics` : primaryAction}
              prefetch={false}
            >
              {biggestProblem ? "Open practice plan" : primaryActionLabel}
            </Link>
          </Button>
        </div>
        <CompactReadoutGrid
          columnsClassName="md:grid-cols-2 xl:grid-cols-4"
          items={[
            {
              label: "Latest session",
              value: latestSession ? formatDate(latestSession.date) : "No import yet",
              detail: latestSession
                ? `${latestSession.shotCount} shots · ${formatSessionType(latestSession.type)}`
                : "Import a CSV to build your baseline",
              tone: "sky",
            },
            {
              label: "Your game",
              value: `${totalShots.toLocaleString("en-GB")} shots`,
              detail: firstSignal ? firstSignal.detail : "Waiting for enough data to spot movement",
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
              label: "Practice priority",
              value: biggestProblem?.clubName ?? primaryActionLabel,
              detail: biggestProblem?.drill ?? "Import data or review the latest round",
              tone: biggestProblem?.tone ?? "amber",
              href: biggestProblem ? `/bag/${biggestProblem.clubId}/analytics` : primaryAction,
            },
          ]}
        />
      </CardContent>
    </DataPanel>
  );
}
function DashboardMobileSocialPulse({
  social,
  challenges,
}: {
  social: Awaited<ReturnType<typeof getFeedPageData>>;
  challenges: ChallengeListItem[];
}) {
  const topItems = social.items.slice(0, 3);
  const pbCount = social.items.filter(
    (item) => item.itemType === "new_pb" || item.itemType === "longest_drive",
  ).length;
  const recordCount = social.items.filter((item) =>
    item.itemType.startsWith("course_record"),
  ).length;
  const tournamentCount = social.items.filter((item) =>
    item.itemType.startsWith("tournament"),
  ).length;
  const closingSoon =
    challenges
      .filter((challenge) => challenge.endsAt)
      .sort((left, right) => (left.endsAt?.getTime() ?? 0) - (right.endsAt?.getTime() ?? 0))[0] ??
    null;

  return (
    <DataPanel>
      <SectionHeader
        title="Social pulse"
        description="Recent activity from your golf network."
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
              detail: closingSoon?.endsAt
                ? `Ends ${formatDate(closingSoon.endsAt)}`
                : "No open closing board",
              tone: closingSoon ? "sky" : "slate",
              href: closingSoon ? `/challenges/${closingSoon.id}` : "/challenges",
            },
          ]}
        />
        <div className="grid gap-2">
          {topItems.length > 0 ? (
            topItems.map((item) => <DashboardMobileSocialMoment key={item.id} item={item} />)
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

function DashboardMobileSocialMoment({ item }: { item: FeedItemView }) {
  return (
    <Link
      href={item.proofUrl ?? "/feed"}
      prefetch={false}
      className="grid gap-1 rounded-xl border bg-slate-50 px-3 py-2 text-sm transition-colors hover:bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{item.headline}</p>
        <StatusPill
          tone={
            item.verificationLabel === "Manual" || item.verificationLabel === "Unverified"
              ? "slate"
              : "green"
          }
        >
          {item.verificationLabel}
        </StatusPill>
      </div>
      <p className="text-muted-foreground">
        {item.metricValue
          ? `${item.metricLabel ?? "Metric"} ${item.metricValue}`
          : (item.context ?? "Social update")}
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

function RoundMetric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">
        {typeof value === "number" ? integerFormatter.format(value) : (value ?? "--")}
      </span>
    </div>
  );
}

function DashboardPanel({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 rounded-[18px] border border-[#DFE7DF] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#EDF1ED] px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold leading-7 tracking-normal text-[#111827]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function DashboardSummaryHero({
  latestSession,
  bestClub,
  coachPreview,
  scoringCeiling,
  scoringTrend,
  primaryAction,
  primaryActionLabel,
  latestRound,
}: {
  latestSession: DashboardData["recentSessions"][number] | null;
  bestClub: DashboardData["bagPreview"][number] | null;
  coachPreview: DashboardData["coachPreview"];
  scoringCeiling: string;
  scoringTrend: string;
  primaryAction: string;
  primaryActionLabel: string;
  latestRound: DashboardData["latestRound"];
}) {
  const practiceHref = coachPreview ? `/bag/${coachPreview.clubId}/analytics` : primaryAction;
  const practiceTitle = coachPreview
    ? `${coachPreview.clubName} ${coachPreview.issueLabel.toLowerCase()}`
    : primaryActionLabel;
  const nextUsefulMove = coachPreview
    ? `the next useful move is ${coachPreview.clubName} ${coachPreview.issueLabel.toLowerCase()}`
    : `the next useful move is ${primaryActionLabel.toLowerCase()}`;
  const todayRead = bestClub
    ? `current form is ${scoringCeiling}, ${formatClubType(bestClub.type)} is your most trusted club, and ${nextUsefulMove}`
    : `current form is ${scoringCeiling}, bag confidence needs more shots, and ${nextUsefulMove}`;

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#CFE7D6] bg-white shadow-[0_12px_30px_rgba(8,122,61,0.06)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,#F8FAF8_0%,#FFFFFF_48%,#ECF7F1_100%)]" />
        <div className="absolute right-0 top-0 h-full w-[46%] border-l border-[#DCECE0] bg-[repeating-linear-gradient(90deg,rgba(15,143,77,0.10)_0,rgba(15,143,77,0.10)_1px,transparent_1px,transparent_54px)]" />
        <div className="absolute right-10 top-8 h-40 w-40 rounded-full border border-[#BFE4CA]" />
        <div className="absolute right-20 top-[4.5rem] h-20 w-20 rounded-full border border-[#D7ECDD]" />
        <div className="absolute right-10 bottom-9 h-px w-72 -rotate-6 bg-[#9DCFB0]" />
        <div className="absolute right-32 bottom-20 h-px w-52 -rotate-6 bg-[#C8D9FF]" />
      </div>

      <div className="relative grid gap-6 px-7 py-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill className="bg-[#E8F7EE] text-[#087A3D] ring-[#CFE7D6]">
                Dashboard
              </StatusPill>
              {latestSession ? (
                <StatusPill className="bg-[#EAF1FF] text-[#2563EB] ring-[#CFDAFF]">
                  Latest import {formatDate(latestSession.date)}
                </StatusPill>
              ) : null}
            </div>
            <h1 className="mt-4 text-[34px] font-bold leading-10 tracking-normal text-[#111827]">
              ForeKingHell
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Your golf operating system: form, bag confidence, practice and rounds.
            </p>
            <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-[#111827]">
              Today&apos;s read: {todayRead}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-lg border-[#DFE7DF] bg-white">
              <Link href="/today" prefetch={false}>
                <CalendarDays className="size-4" />
                Review latest practice
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-lg border-[#DFE7DF] bg-white">
              <Link href="/shots" prefetch={false}>
                <Database className="size-4" />
                Shot database
              </Link>
            </Button>
          </div>
        </div>

        <Link
          href={practiceHref}
          prefetch={false}
          className="group flex min-h-full flex-col justify-between rounded-[22px] border border-[#CFE7D6] bg-white/90 p-5 shadow-[0_18px_40px_rgba(8,122,61,0.10)] backdrop-blur transition-colors hover:border-[#0F8F4D]"
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <StatusPill tone={coachPreview ? normalizeDashboardTone(coachPreview.tone) : "green"}>
                Next best action
              </StatusPill>
              <Target className="size-5 text-[#087A3D]" />
            </div>
            <h2 className="mt-4 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
              {practiceTitle}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#087A3D]">
              {coachPreview ? `${coachPreview.trustIndex}% trust` : "Build the first trust signal"}
            </p>
            <p className="mt-4 text-sm leading-6 text-[#667085]">
              {coachPreview
                ? getDashboardPracticeTask(coachPreview)
                : "Import a clean CSV, then build the first club-specific practice recommendation."}
            </p>
          </div>
          <span className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#087A3D] px-4 text-sm font-semibold text-white transition-colors group-hover:bg-[#065F32]">
            Start practice
            <ArrowRight className="size-4" />
          </span>
        </Link>
      </div>

      <div className="relative grid gap-4 border-t border-[#EDF1ED] bg-white/78 px-7 py-4 lg:grid-cols-4">
        <HeroInsightCard
          title="Current form"
          value={scoringCeiling}
          detail={`Scoring ceiling · ${scoringTrend}`}
          href="/rounds"
          tone="amber"
        />
        <HeroInsightCard
          title="Best club"
          value={bestClub ? formatClubType(bestClub.type) : "--"}
          detail={
            bestClub
              ? `${bestClub.stock.confidenceScore}% trust · ${integerFormatter.format(bestClub.shotCount)} shots`
              : "Import shots to build club trust"
          }
          href={bestClub ? `/bag/${bestClub.id}` : "/bag"}
          tone="green"
        />
        <HeroInsightCard
          title="Practice priority"
          value={practiceTitle}
          detail={
            coachPreview
              ? `${coachPreview.trustIndex}% trust · Start from next practice`
              : "Start with a clean import or coach review"
          }
          href={practiceHref}
          tone="green"
        />
        <HeroInsightCard
          title="Latest round"
          value={
            latestRound ? formatScoreVsPar(latestRound.totalScore, latestRound.totalPar) : "--"
          }
          detail={
            latestRound
              ? (latestRound.courseName ?? latestRound.fileName ?? "Review round")
              : "No round imported yet"
          }
          href={latestRound ? `/rounds/${latestRound.id}` : "/rounds"}
          tone="sky"
        />
      </div>
    </section>
  );
}

function HeroInsightCard({
  title,
  value,
  detail,
  href,
  tone,
  primary = false,
  actionText,
}: {
  title: string;
  value: ReactNode;
  detail: ReactNode;
  href: string;
  tone: DashboardTone;
  primary?: boolean;
  actionText?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "group block rounded-[18px] border bg-white p-4 transition-colors",
        primary
          ? "border-[#CFE7D6] shadow-[0_12px_30px_rgba(8,122,61,0.08)] hover:border-[#0F8F4D]"
          : "border-[#DFE7DF] hover:border-[#CFE7D6]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold leading-6 text-[#111827]">{title}</p>
        {actionText ? (
          <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#087A3D] px-3 text-xs font-semibold text-white transition-colors group-hover:bg-[#065F32]">
            {actionText}
            <ArrowRight className="size-3.5" />
          </span>
        ) : (
          <DashboardDot tone={tone} />
        )}
      </div>
      <p className="mt-2 text-[26px] font-bold leading-8 tracking-normal text-[#111827]">{value}</p>
      <p className="mt-1.5 text-sm leading-5 text-[#667085]">{detail}</p>
    </Link>
  );
}

function LatestPracticeSignalPanel({
  latestSession,
  stats,
  firstSignal,
  latestRound,
  compact = false,
  className,
}: {
  latestSession: DashboardData["recentSessions"][number] | null;
  stats: DashboardData["stats"];
  firstSignal: ReturnType<typeof buildWhatChangedInsights>[number] | null;
  latestRound: DashboardData["latestRound"];
  compact?: boolean;
  className?: string;
}) {
  return (
    <DashboardPanel
      id="today"
      className={className}
      title="Latest practice signal"
      description="Latest import, game depth and the strongest round or practice insight."
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/today" prefetch={false}>
            <CalendarDays className="size-4" />
            Open latest practice
          </Link>
        </Button>
      }
    >
      {compact ? (
        <div className="grid gap-2">
          <CompactSignalRow
            label="Latest session"
            value={latestSession ? formatDate(latestSession.date) : "No import yet"}
            detail={
              latestSession
                ? `${integerFormatter.format(latestSession.shotCount)} shots · ${formatSessionType(latestSession.type)}`
                : "Import a CSV to start the practice signal."
            }
          />
          <CompactSignalRow
            label="Your game"
            value={`${integerFormatter.format(stats.shotCount)} shots`}
            detail={`${integerFormatter.format(stats.sessionCount)} sessions · ${integerFormatter.format(stats.clubCount)} active clubs`}
          />
          <CompactSignalRow
            label="Strongest insight"
            value={
              latestRound
                ? formatScoreVsPar(latestRound.totalScore, latestRound.totalPar)
                : (firstSignal?.value ?? "Building")
            }
            detail={
              latestRound
                ? (latestRound.courseName ?? latestRound.fileName ?? "Latest round")
                : (firstSignal?.detail ?? "Keep adding shots to surface trend changes.")
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <SignalTile
            label="Latest session"
            value={latestSession ? formatDate(latestSession.date) : "No import yet"}
            detail={
              latestSession
                ? `${integerFormatter.format(latestSession.shotCount)} shots · ${formatSessionType(latestSession.type)}`
                : "Import a CSV to start the practice signal."
            }
            tone="sky"
          />
          <SignalTile
            label="Your game"
            value={`${integerFormatter.format(stats.shotCount)} shots`}
            detail={`${integerFormatter.format(stats.sessionCount)} sessions · ${integerFormatter.format(stats.clubCount)} active clubs`}
            tone="green"
          />
          <SignalTile
            label="Best insight"
            value={
              latestRound
                ? formatScoreVsPar(latestRound.totalScore, latestRound.totalPar)
                : (firstSignal?.value ?? "Building")
            }
            detail={
              latestRound
                ? (latestRound.courseName ?? latestRound.fileName ?? "Latest round")
                : (firstSignal?.detail ?? "Keep adding shots to surface trend changes.")
            }
            tone={latestRound ? "amber" : (firstSignal?.tone ?? "slate")}
          />
        </div>
      )}
      <div className="mt-4 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-4 py-3 text-sm leading-6 text-[#667085]">
        <span className="font-semibold text-[#111827]">Data quality:</span>{" "}
        {latestSession
          ? "Latest session imported cleanly."
          : "Import a session to unlock quality checks."}{" "}
        <span className="font-semibold text-[#111827]">Strongest insight:</span>{" "}
        {latestRound
          ? `latest round ${formatScoreVsPar(latestRound.totalScore, latestRound.totalPar)}.`
          : firstSignal
            ? `${firstSignal.label.toLowerCase()} · ${firstSignal.value}.`
            : "No major movement yet."}
      </div>
    </DashboardPanel>
  );
}

function CompactSignalRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-[#DFE7DF] bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
        <p className="text-right text-sm font-semibold text-[#111827]">{value}</p>
      </div>
      <p className="text-sm leading-5 text-[#667085]">{detail}</p>
    </div>
  );
}

function SignalTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone: DashboardTone;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#DFE7DF] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
        <DashboardDot tone={tone} />
      </div>
      <p className="mt-3 truncate text-2xl font-bold leading-8 tracking-normal text-[#111827]">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#667085]">{detail}</p>
    </div>
  );
}

function PracticeRecommendationCard({
  coachPreview,
  primaryAction,
  primaryActionLabel,
  className,
}: {
  coachPreview: DashboardData["coachPreview"];
  primaryAction: string;
  primaryActionLabel: string;
  className?: string;
}) {
  const href = coachPreview ? `/bag/${coachPreview.clubId}/analytics` : primaryAction;
  const taskCopy = coachPreview ? getDashboardPracticeTask(coachPreview) : "";

  return (
    <section
      id="practice"
      className={cn(
        "scroll-mt-28 rounded-[22px] border border-[#CFE7D6] bg-white p-5 shadow-[0_12px_30px_rgba(8,122,61,0.08)] sm:p-6",
        className,
      )}
    >
      {coachPreview ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold leading-6 text-[#111827]">Next practice</p>
              <StatusPill tone={normalizeDashboardTone(coachPreview.tone)}>
                {coachPreview.trustIndex}% trust
              </StatusPill>
            </div>
            <h2 className="mt-2 text-[26px] font-bold leading-8 tracking-normal text-[#111827]">
              {coachPreview.clubName} delivery window
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone={normalizeDashboardTone(coachPreview.tone)}>
                {coachPreview.issueLabel}
              </StatusPill>
              <span className="text-sm leading-6 text-[#667085]">
                Goal: path inside +/-5 degrees with a predictable start line.
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#111827]">{coachPreview.reason}</p>
            <TargetLaneVisual coachPreview={coachPreview} />
          </div>

          <div className="self-start rounded-2xl border border-[#EDF1ED] bg-[#F8FAF8] p-4">
            <div className="flex items-center gap-2 text-[#8A4B00]">
              <Crosshair className="size-5" />
              <p className="text-sm font-semibold">Practice task</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#111827]">{taskCopy}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Button asChild className="h-9 rounded-lg bg-[#087A3D] text-white hover:bg-[#065F32]">
                <Link href={href} prefetch={false}>
                  Open drill
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <span className="rounded-lg border border-[#DFE7DF] bg-white px-3 py-2 text-sm font-semibold text-[#667085]">
                0 / 10 balls
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold leading-6 text-[#111827]">Next practice</p>
            <h2 className="mt-2 text-[26px] font-bold leading-8 tracking-normal text-[#111827]">
              {primaryActionLabel}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#667085]">
              Import enough shots to unlock a focused club recommendation.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href={href} prefetch={false}>
              {primaryActionLabel}
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

type PracticeMissSide = "left" | "right" | "neutral";

function TargetLaneVisual({
  coachPreview,
}: {
  coachPreview: NonNullable<DashboardData["coachPreview"]>;
}) {
  const missSide = getPracticeMissSide(coachPreview);
  const markerPosition =
    missSide === "left" ? "left-[34%]" : missSide === "right" ? "left-[66%]" : "left-1/2";
  const markerLabel =
    missSide === "left"
      ? "Left miss trend"
      : missSide === "right"
        ? "Right miss trend"
        : "Current pattern";
  const markerTone =
    missSide === "right"
      ? "border-[#2563EB] bg-[#2563EB]"
      : missSide === "left"
        ? "border-[#8A4B00] bg-[#8A4B00]"
        : "border-[#087A3D] bg-[#087A3D]";

  return (
    <div className="mt-5 rounded-2xl border border-[#DFE7DF] bg-[#F8FAF8] p-4">
      <div className="mb-3 grid grid-cols-[22%_50%_28%] text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
        <span>Left miss</span>
        <span className="text-center">Playable window</span>
        <span className="text-right">Right miss</span>
      </div>
      <div className="relative h-24 overflow-hidden rounded-xl border border-[#DFE7DF] bg-white">
        <div className="absolute inset-y-0 left-0 w-[22%] bg-[#FFF4DB]" />
        <div className="absolute inset-y-0 left-[22%] w-[50%] bg-[#E8F7EE]" />
        <div className="absolute inset-y-0 right-0 w-[28%] bg-[#EAF1FF]" />
        <div className="absolute left-[22%] top-0 h-full border-l border-dashed border-[#8A4B00]" />
        <div className="absolute left-[72%] top-0 h-full border-l border-dashed border-[#2563EB]" />
        <div className="absolute left-1/2 top-0 h-full border-l-2 border-[#087A3D]" />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#087A3D] shadow-sm">
          Target
        </span>
        <div
          className={cn(
            "absolute bottom-4 flex -translate-x-1/2 flex-col items-center",
            markerPosition,
          )}
        >
          <span className="whitespace-nowrap rounded-full border border-[#DFE7DF] bg-white px-2 py-1 text-[11px] font-semibold text-[#111827] shadow-sm">
            {markerLabel}
          </span>
          <span className={cn("h-3 w-px", markerTone)} />
          <span
            className={cn(
              "size-3 rounded-full border-2 border-white shadow-[0_0_0_5px_rgba(17,24,39,0.10)]",
              markerTone,
            )}
          />
        </div>
      </div>
    </div>
  );
}

function getPracticeMissSide(
  coachPreview: NonNullable<DashboardData["coachPreview"]>,
): PracticeMissSide {
  const reason = coachPreview.reason.toLowerCase();

  if (/\bleft miss\b|\bleft miss tendency\b|\bleft tendency\b/.test(reason)) {
    return "left";
  }

  if (/\bright miss\b|\bright miss tendency\b|\bright tendency\b/.test(reason)) {
    return "right";
  }

  return "neutral";
}

function PerformanceSnapshot({
  metrics,
  paired = false,
  className,
}: {
  metrics: DashboardMetric[];
  paired?: boolean;
  className?: string;
}) {
  return (
    <DashboardPanel
      title="Performance snapshot"
      description="What the headline numbers mean and where to act on them."
      className={className}
    >
      <div className={cn("grid gap-3", paired ? "grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4")}>
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Link
              key={metric.label}
              href={metric.href}
              prefetch={false}
              className={cn(
                "group min-w-0 rounded-xl border border-[#DFE7DF] bg-white p-4 transition-colors hover:border-[#CFE7D6] hover:bg-[#F8FAF8]",
                paired ? "min-h-[148px]" : "min-h-[178px]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5 text-[#111827]">{metric.label}</p>
                  <p
                    className={cn(
                      "mt-2 font-bold tracking-normal text-[#111827]",
                      paired ? "text-2xl leading-8" : "text-[28px] leading-[34px]",
                    )}
                  >
                    {metric.value}
                  </p>
                </div>
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg",
                    toneSoftClass(metric.tone),
                  )}
                >
                  <Icon className="size-5" />
                </span>
              </div>
              <p className={cn("mt-2 text-sm text-[#667085]", paired ? "leading-5" : "leading-6")}>
                {metric.detail}
              </p>
              <div className="mt-4 line-clamp-2 rounded-lg border border-[#EDF1ED] bg-[#F8FAF8] px-3 py-2 text-sm leading-5 text-[#111827]">
                {metric.insight ?? metric.detail}
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#087A3D]">
                {metric.actionLabel ?? "Open"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </DashboardPanel>
  );
}

function BagConfidencePanel({
  clubs,
  bagAlert,
}: {
  clubs: DashboardData["bagPreview"];
  bagAlert: FeatureIdeasData["bagAlerts"][number] | null;
}) {
  const trustedClubs = [...clubs]
    .sort((left, right) => {
      const trustDelta = right.stock.confidenceScore - left.stock.confidenceScore;
      return trustDelta || right.shotCount - left.shotCount;
    })
    .slice(0, 3);
  const needsDataClub =
    [...clubs]
      .sort((left, right) => {
        const trustDelta = left.stock.confidenceScore - right.stock.confidenceScore;
        return trustDelta || left.shotCount - right.shotCount;
      })
      .find((club) => club.stock.confidenceScore < 60) ?? null;

  return (
    <DashboardPanel
      title="Bag confidence"
      description="The most important bag signals without turning the dashboard into the full bag page."
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/bag" prefetch={false}>
            <Target className="size-4" />
            Open bag map
          </Link>
        </Button>
      }
    >
      {clubs.length > 0 ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            {trustedClubs.map((club) => (
              <BagSignalPill
                key={club.id}
                href={`/bag/${club.id}`}
                label={formatClubType(club.type)}
                value={`${club.stock.confidenceScore}%`}
              />
            ))}
            {needsDataClub ? (
              <BagSignalPill
                href={`/bag/${needsDataClub.id}`}
                label={formatClubType(needsDataClub.type)}
                value={
                  needsDataClub.stock.carryMedianYd === null
                    ? "Needs data"
                    : `${needsDataClub.stock.confidenceScore}% trust`
                }
                tone="amber"
              />
            ) : null}
            <BagSignalPill
              href={bagAlert?.href ?? "/bag"}
              label="Biggest gap"
              value={bagAlert?.metric ?? "Clear"}
              tone={bagAlert?.tone === "pink" || bagAlert?.tone === "amber" ? "amber" : "green"}
            />
          </div>

          <ClubConfidenceLadder clubs={getDashboardLadderClubs(clubs)} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-[#667085]">
            Import a Rapsodo CSV and the bag map will build automatically.
          </p>
          <Button asChild className="rounded-lg bg-[#087A3D] text-white">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
        </div>
      )}
    </DashboardPanel>
  );
}

function BagSignalPill({
  href,
  label,
  value,
  tone = "green",
}: {
  href: string;
  label: string;
  value: string;
  tone?: "green" | "amber";
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-white",
        tone === "amber"
          ? "border-[#F1C36D] bg-[#FFF8E7] text-[#7A4A00]"
          : "border-[#CFE7D6] bg-[#F0FAF3] text-[#075F33]",
      )}
    >
      <span className="font-semibold">{label}</span>
      <span className="text-xs font-semibold uppercase tracking-[0.08em]">{value}</span>
    </Link>
  );
}

const DASHBOARD_LADDER_TYPES = ["driver", "6i", "8i", "pw"] as const;

function getDashboardLadderClubs(clubs: DashboardData["bagPreview"]) {
  const preferred = DASHBOARD_LADDER_TYPES.map((type) =>
    clubs.find((club) => club.type === type),
  ).filter((club): club is DashboardData["bagPreview"][number] => Boolean(club));

  if (preferred.length >= 4) {
    return preferred;
  }

  return [...clubs]
    .filter((club) => club.type !== "sw")
    .sort((left, right) => (right.stock.carryMedianYd ?? 0) - (left.stock.carryMedianYd ?? 0))
    .slice(0, 4);
}

function ClubConfidenceLadder({ clubs }: { clubs: DashboardData["bagPreview"] }) {
  const maxCarry = Math.max(1, ...clubs.map((club) => club.stock.carryMedianYd ?? 0));

  return (
    <div className="min-w-0 rounded-lg border border-[#DFE7DF] bg-white p-4">
      <p className="text-sm font-semibold text-[#111827]">Club-distance ladder</p>
      <div className="mt-3 grid gap-2.5">
        {clubs.map((club) => {
          const carry = club.stock.carryMedianYd ?? 0;
          const width = Math.max(8, Math.round((carry / maxCarry) * 100));

          return (
            <Link
              key={club.id}
              href={`/bag/${club.id}`}
              prefetch={false}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm"
            >
              <span className="font-semibold text-[#111827]">{formatClubType(club.type)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-[#EEF2F0]">
                <span
                  className="block h-full rounded-full bg-[#9AD7AE]"
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-[#667085]">
                {formatYards(club.stock.carryMedianYd)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LatestRoundPanel({
  latestRound,
  className,
}: {
  latestRound: DashboardData["latestRound"];
  className?: string;
}) {
  const holeHighlights = latestRound ? getRoundHoleHighlights(latestRound) : null;

  return (
    <DashboardPanel
      title="Latest round"
      description="Newest scorecard or simulated-course round."
      className={className}
      action={<Flag className="size-5 text-[#2563EB]" />}
    >
      {latestRound ? (
        <div>
          <p className="text-[15px] font-semibold leading-6 text-[#111827]">
            {formatDate(latestRound.date)} · {formatSessionType(latestRound.type)}
          </p>
          <h3 className="mt-1 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
            {latestRound.courseName ?? latestRound.fileName ?? "Untitled round"}
          </h3>
          <p className="mt-3 text-[32px] font-bold leading-9 tracking-normal text-[#111827]">
            {formatScoreVsPar(latestRound.totalScore, latestRound.totalPar)}
          </p>
          <HoleResultStrip latestRound={latestRound} />
          <div className="mt-4 flex flex-wrap gap-2">
            <RoundSignalPill
              label="Putts"
              value={
                typeof latestRound.totalPutts === "number"
                  ? integerFormatter.format(latestRound.totalPutts)
                  : "--"
              }
            />
            <RoundSignalPill
              label="Differential"
              value={formatHandicapValue(latestRound.handicapDifferential)}
            />
          </div>
          {holeHighlights ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p className="rounded-lg border border-[#DFE7DF] bg-white px-3 py-2 text-sm text-[#667085]">
                <span className="font-semibold text-[#111827]">Best hole:</span>{" "}
                {holeHighlights.best}
              </p>
              {holeHighlights.watch ? (
                <p className="rounded-lg border border-[#DFE7DF] bg-white px-3 py-2 text-sm text-[#667085]">
                  <span className="font-semibold text-[#111827]">Watch:</span>{" "}
                  {holeHighlights.watch}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-5">
            <Button
              asChild
              className="w-full rounded-lg bg-[#087A3D] text-white hover:bg-[#065F32]"
            >
              <Link href={`/rounds/${latestRound.id}`} prefetch={false}>
                <Flag className="size-4" />
                Review round
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-sm leading-6 text-[#667085]">
            Save a round CSV to unlock scorecards, hole review, and round shot maps.
          </p>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import round CSV
            </Link>
          </Button>
        </div>
      )}
    </DashboardPanel>
  );
}

function RoundSignalPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-2 text-sm">
      <span className="font-medium text-[#667085]">{label}</span>
      <span className="font-semibold text-[#111827]">{value}</span>
    </span>
  );
}

function HoleResultStrip({
  latestRound,
}: {
  latestRound: NonNullable<DashboardData["latestRound"]>;
}) {
  const holes = (latestRound.scorecardJson ?? []).slice(0, 9);

  if (holes.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 grid grid-cols-9 gap-1" aria-label="Hole result strip">
      {holes.map((hole, index) => {
        const score = hole.score ?? null;
        const delta = typeof score === "number" ? score - hole.par : null;

        return (
          <span
            key={`${index}-${hole.par}-${score ?? "empty"}`}
            className={cn(
              "grid h-8 place-items-center rounded-md text-[11px] font-semibold",
              holeResultClass(delta),
            )}
            title={`Hole ${index + 1}: ${formatHoleResult(delta)}`}
          >
            {formatHoleResult(delta)}
          </span>
        );
      })}
    </div>
  );
}

function CourseDecisionPanel({ items }: { items: DashboardData["courseAdvice"] }) {
  return (
    <DashboardPanel
      id="decisions"
      title="On-course decisions"
      description="Course-number reminders from the current bag map."
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/bag" prefetch={false}>
            <Target className="size-4" />
            Full advice
          </Link>
        </Button>
      }
    >
      <div className="grid md:grid-cols-3">
        {items.map((item, index) => (
          <Link
            key={item.label}
            href={item.clubId ? `/bag/${item.clubId}` : "/bag"}
            prefetch={false}
            className={cn(
              "group min-w-0 px-3 py-2 transition-colors hover:bg-[#F8FAF8] md:px-4",
              index > 0 ? "border-t border-[#EDF1ED] md:border-l md:border-t-0" : "",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  toneSoftClass(normalizeDashboardTone(item.tone)),
                )}
              >
                <DecisionIcon itemKey={item.key} />
              </span>
              <p className="text-sm font-semibold leading-5 text-[#111827]">{item.label}</p>
            </div>
            <p className="mt-2 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
              {item.value}
            </p>
            <p className="mt-1 text-sm leading-5 text-[#667085]">{item.detail}</p>
          </Link>
        ))}
      </div>
    </DashboardPanel>
  );
}

function DecisionIcon({ itemKey }: { itemKey: DashboardData["courseAdvice"][number]["key"] }) {
  if (itemKey === "180-tee") {
    return <Flag className="size-4" />;
  }

  if (itemKey === "150-approach") {
    return <Crosshair className="size-4" />;
  }

  return <Target className="size-4" />;
}

function WhatChangedPanel({
  insights,
  className,
}: {
  insights: ReturnType<typeof buildWhatChangedInsights>;
  className?: string;
}) {
  return (
    <DashboardPanel
      id="progress"
      className={className}
      title="What changed"
      description="Latest imported-shot and round signals."
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/progress" prefetch={false}>
            <LineChart className="size-4" />
            Full progress
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4">
        {insights.map((insight, index) => (
          <div
            key={`${insight.label}-${insight.value}`}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3"
          >
            <div className="flex flex-col items-center">
              <DashboardDot tone={normalizeDashboardTone(insight.tone)} />
              {index < insights.length - 1 ? (
                <span className="mt-2 h-full min-h-10 w-px bg-[#DFE7DF]" />
              ) : null}
            </div>
            <div className="min-w-0 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-4 py-3">
              <p className="text-[15px] font-semibold leading-6 text-[#111827]">{insight.label}</p>
              <p className="mt-1 text-lg font-bold leading-7 tracking-normal text-[#111827]">
                {insight.value}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#667085]">{insight.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function DashboardSocialPulse({
  social,
  className,
}: {
  social: Awaited<ReturnType<typeof getFeedPageData>>;
  className?: string;
}) {
  const topItems = social.items.slice(0, 3);
  const pbCount = social.items.filter(
    (item) => item.itemType === "new_pb" || item.itemType === "longest_drive",
  ).length;

  return (
    <DashboardPanel
      title="Social pulse"
      description="Recent activity from your golf network."
      className={className}
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/feed" prefetch={false}>
            <Radio className="size-4" />
            Open feed
          </Link>
        </Button>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SocialStatLink
            href="/friends"
            label="Friends active"
            value={social.friendCount.toString()}
            detail="Accepted golfer friendships"
            icon={Users}
          />
          <SocialStatLink
            href="/feed?filter=pbs"
            label="Network PBs"
            value={pbCount.toString()}
            detail="Visible PB and longest-drive cards"
          />
        </div>
        <div className="rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-4 py-3">
          <p className="text-[15px] font-semibold leading-6 text-[#111827]">Latest activity</p>
          <div className="mt-3 divide-y divide-[#EDF1ED]">
            {topItems.length > 0 ? (
              topItems.map((item) => <DashboardSocialMoment key={item.id} item={item} />)
            ) : (
              <p className="py-4 text-sm leading-6 text-[#667085]">
                No visible social moments yet. Add friends or join a challenge to populate this
                pulse.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}

function SocialStatLink({
  href,
  label,
  value,
  detail,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group block rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-2.5 transition-colors hover:border-[#0F8F4D] hover:bg-white"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold leading-6 text-[#111827]">{label}</p>
        {Icon ? <Icon className="size-4 text-[#087A3D]" /> : null}
      </div>
      <p className="mt-1 text-2xl font-bold leading-8 tracking-normal text-[#111827]">{value}</p>
      <p className="mt-1 text-sm leading-5 text-[#667085]">{detail}</p>
    </Link>
  );
}

function QuickActions({ routes }: { routes: DashboardRoute[] }) {
  const primaryRoutes = routes.slice(0, 6);
  const secondaryRoutes = routes.slice(6);

  const renderRoute = (route: DashboardRoute) => {
    const Icon = route.icon;

    return (
      <Link
        key={route.href}
        href={route.href}
        prefetch={false}
        title={route.description}
        className="group flex min-h-12 items-center gap-3 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-2.5 transition-colors hover:border-[#0F8F4D] hover:bg-white"
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${route.accent}`}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-5 text-[#111827]">
            {route.title}
          </span>
          <span className="block truncate text-xs font-medium leading-5 text-[#667085]">
            {route.metric}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-[#667085] transition-transform group-hover:translate-x-0.5 group-hover:text-[#087A3D]" />
      </Link>
    );
  };

  return (
    <DashboardPanel
      id="tools"
      title="Quick actions"
      description="Action-first shortcuts for import, practice, shots, bag and rounds."
    >
      <div className="grid gap-2 sm:grid-cols-2">{primaryRoutes.map(renderRoute)}</div>
      {secondaryRoutes.length > 0 ? (
        <details className="mt-3 rounded-lg border border-[#DFE7DF] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-[#111827] marker:hidden">
            <span>All tools</span>
            <span className="text-xs font-medium text-[#667085]">
              {secondaryRoutes.length} more
            </span>
          </summary>
          <div className="grid gap-2 border-t border-[#E5E7EB] p-3 sm:grid-cols-2">
            {secondaryRoutes.map(renderRoute)}
          </div>
        </details>
      ) : null}
    </DashboardPanel>
  );
}

function DashboardSocialMoment({ item }: { item: FeedItemView }) {
  return (
    <Link
      href={item.proofUrl ?? "/feed"}
      prefetch={false}
      className="block py-3 text-sm transition-colors hover:bg-[#F8FAF8]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold leading-6 text-[#111827]">{item.headline}</p>
        <StatusPill
          tone={
            item.verificationLabel === "Manual" || item.verificationLabel === "Unverified"
              ? "slate"
              : "green"
          }
        >
          {item.verificationLabel}
        </StatusPill>
      </div>
      <p className="leading-6 text-[#667085]">
        {item.metricValue
          ? `${item.metricLabel ?? "Metric"} ${item.metricValue}`
          : (item.context ?? "Social update")}
      </p>
    </Link>
  );
}

function DashboardDot({ tone }: { tone: DashboardTone }) {
  return <span className={cn("size-2.5 shrink-0 rounded-full ring-4", toneDotClass(tone))} />;
}

function getBestClub(clubs: DashboardData["bagPreview"]) {
  return (
    [...clubs].sort((left, right) => {
      const trustDelta = right.stock.confidenceScore - left.stock.confidenceScore;
      return trustDelta || right.shotCount - left.shotCount;
    })[0] ?? null
  );
}

function formatHandicapTrend(summary: HandicapSummary) {
  const trend = summary.trend.direction;
  const delta = summary.trend.delta;

  if (trend === "down" && typeof delta === "number") {
    return `Improved by ${formatHandicapValue(Math.abs(delta))}`;
  }

  if (trend === "up" && typeof delta === "number") {
    return `Higher by ${formatHandicapValue(Math.abs(delta))}`;
  }

  if (trend === "flat") {
    return "Flat trend";
  }

  return `${summary.sampleSize} round sample`;
}

function formatScoreVsPar(score: number | null, par: number | null) {
  if (typeof score !== "number") {
    return "--";
  }

  if (typeof par !== "number") {
    return integerFormatter.format(score);
  }

  const versusPar = score - par;
  return `${integerFormatter.format(score)} (${versusPar >= 0 ? "+" : ""}${integerFormatter.format(versusPar)})`;
}

function getRoundHoleHighlights(latestRound: NonNullable<DashboardData["latestRound"]>) {
  const holes = (latestRound.scorecardJson ?? [])
    .map((hole, index) => ({
      holeNumber: index + 1,
      delta: typeof hole.score === "number" ? hole.score - hole.par : null,
    }))
    .filter((hole): hole is { holeNumber: number; delta: number } => hole.delta !== null);

  if (holes.length === 0) {
    return null;
  }

  const best = holes.reduce((left, right) => (right.delta < left.delta ? right : left));
  const worst = holes.reduce((left, right) => (right.delta > left.delta ? right : left));

  return {
    best: `${best.delta <= -1 ? "Birdie" : formatHoleResult(best.delta)} · hole ${best.holeNumber}`,
    watch: worst.delta > 0 ? `+${worst.delta} · hole ${worst.holeNumber}` : null,
  };
}

function formatHoleResult(delta: number | null) {
  if (delta === null) {
    return "--";
  }

  if (delta <= -1) {
    return "Bird";
  }

  if (delta === 0) {
    return "Par";
  }

  if (delta === 1) {
    return "Bog";
  }

  return `+${delta}`;
}

function holeResultClass(delta: number | null) {
  if (delta === null) {
    return "bg-[#F2F4F7] text-[#667085]";
  }

  if (delta <= -1) {
    return "bg-[#E8F7EE] text-[#087A3D]";
  }

  if (delta === 0) {
    return "bg-[#EAF1FF] text-[#2563EB]";
  }

  if (delta === 1) {
    return "bg-[#FFF4DB] text-[#8A4B00]";
  }

  return "bg-[#FEE4E2] text-[#B42318]";
}

function getCompactPracticeTask(drill: string) {
  return drill.split(/\s+The goal\b/i)[0]?.trim() || drill;
}

function getDashboardPracticeTask(coachPreview: NonNullable<DashboardData["coachPreview"]>) {
  if (/direction/i.test(coachPreview.issueLabel)) {
    return "Hit 10 balls with a hard left boundary. Count only shots inside the playable window.";
  }

  return getCompactPracticeTask(coachPreview.drill);
}

function normalizeDashboardTone(tone: DashboardTone): Exclude<DashboardTone, "pink"> {
  return tone === "pink" ? "amber" : tone;
}

function toneDotClass(tone: DashboardTone) {
  switch (normalizeDashboardTone(tone)) {
    case "green":
      return "bg-[#0F8F4D] ring-[#E8F7EE]";
    case "amber":
      return "bg-[#8A4B00] ring-[#FFF4DB]";
    case "sky":
      return "bg-[#2563EB] ring-[#EAF1FF]";
    case "slate":
      return "bg-[#98A2B3] ring-[#F2F4F7]";
  }
}

function toneSoftClass(tone: DashboardTone) {
  switch (normalizeDashboardTone(tone)) {
    case "green":
      return "bg-[#E8F7EE] text-[#087A3D]";
    case "amber":
      return "bg-[#FFF4DB] text-[#8A4B00]";
    case "sky":
      return "bg-[#EAF1FF] text-[#2563EB]";
    case "slate":
      return "bg-[#F2F4F7] text-[#667085]";
  }
}

function normalizeDashboardPins(value: string[] | null | undefined): DashboardPin[] {
  const allowedPins = new Set<string>(dashboardPinOptions);
  const pins = (value ?? []).filter((pin): pin is DashboardPin => allowedPins.has(pin));

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
    db.select({ value: count() }).from(importRows).where(eq(importRows.userId, userId)),
    db.select({ value: count() }).from(sessions).where(eq(sessions.userId, userId)),
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
      .leftJoin(rapsodoSyncSessions, eq(sessions.id, rapsodoSyncSessions.importedSessionId))
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
            .where(
              and(eq(importRows.userId, userId), inArray(importRows.sessionId, recentSessionIds)),
            )
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

  const bag = clubRows
    .map((club) => {
      const clubShots = stockShotsByClubId.get(club.id) ?? [];
      const brandModel = [club.brand, club.model].filter(Boolean).join(" ") || "Unspecified model";
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
      return shotCountDifference || clubSortValue(left.type) - clubSortValue(right.type);
    });
  const bagPreview = bag.slice(0, 5);
  const courseAdvice = buildCourseDecisionAdvice(bag);
  const roundSummaries = roundRows.filter(isRoundHistorySession).map(summarizeRound);
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

type InsightTone = "green" | "sky" | "amber" | "slate";

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
          currentCarry !== null && previousCarry !== null ? currentCarry - previousCarry : null,
        missDelta:
          currentMiss !== null && previousMiss !== null ? currentMiss - previousMiss : null,
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
    .sort(
      (left, right) => Math.abs(right.ballSpeedDelta ?? 0) - Math.abs(left.ballSpeedDelta ?? 0),
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

  if (latestRound && latestRound.totalScore !== null && latestRound.totalPar !== null) {
    const versusPar = latestRound.totalScore - latestRound.totalPar;
    insights.push({
      label: "Latest round",
      value: `${latestRound.totalScore} (${versusPar >= 0 ? "+" : ""}${versusPar})`,
      detail: "Review this round to keep recent form accurate.",
      tone: versusPar <= 10 ? "green" : "amber",
    });
  }

  const bestConfidenceClub = [...bagPreview].sort(
    (left, right) => right.stock.confidenceScore - left.stock.confidenceScore,
  )[0];

  if (bestConfidenceClub) {
    insights.push({
      label: "Most trusted club",
      value: `${formatClubType(bestConfidenceClub.type)} / ${Math.round(bestConfidenceClub.stock.confidenceScore)}%`,
      detail: `Reliable with ${integerFormatter.format(bestConfidenceClub.shotCount)} saved shots.`,
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
      detail: "More recent shots produce sharper insight cards on this dashboard.",
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
    scorecard.length > 0 ? scorecard.reduce((total, hole) => total + hole.par, 0) : null;
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
