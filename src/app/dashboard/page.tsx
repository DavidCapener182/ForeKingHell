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
  Eye,
  Flag,
  GitCompareArrows,
  LineChart,
  MapPinned,
  Radio,
  Star,
  Target,
  Trophy,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ActionCentrePanel } from "@/components/features/feature-panels";
import {
  DashboardMobileHeader,
  type DashboardTabKey,
} from "@/app/dashboard/dashboard-mobile-header";
import {
  DashboardCommandPalette,
  type DashboardCommandRoute,
} from "@/app/dashboard/dashboard-command-palette";
import { Button } from "@/components/ui/button";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  MobileBentoSummary,
  MobileCompanionAccordion,
  MobileCompanionHero,
  MobileHorizontalRail,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ShotTraceMotif } from "@/components/visuals/page-artwork";
import {
  getDashboardData,
  type DashboardData,
  type DashboardInsight,
} from "@/app/dashboard/dashboard-data";
import {
  formatDate,
  formatHandicapTrend,
  formatHoleResult,
  formatScoreVsPar,
  formatSessionType,
  formatYards,
  getDashboardPracticeTask,
  getRoundHoleHighlights,
  holeResultClass,
  integerFormatter,
  numberFormatter,
  normalizeDashboardTone,
  toneDotClass,
  toneSoftClass,
  type DashboardTone,
} from "@/app/dashboard/dashboard-formatters";
import { formatClubType } from "@/lib/club-format";
import { formatHandicapValue } from "@/lib/round-handicap";
import type { DashboardPin } from "@/lib/user-settings";
import { getFeedPageData, type FeedItemView } from "@/lib/social";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseDashboardSection(section?: string): DashboardTabKey {
  if (section === "today" || section === "decisions" || section === "more") {
    return section;
  }

  if (section === "progress" || section === "tools" || section === "bag") {
    return "more";
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

  const [params, data, social, featureData] = await Promise.all([
    searchParams,
    getDashboardData(),
    getFeedPageData(),
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
      title: "Import session",
      description: "Bring in Rapsodo range or simulated-course data.",
      href: "/import",
      metric: `${integerFormatter.format(data.stats.sessionCount)} sessions`,
      icon: Upload,
      accent: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Your shots",
      description: "Review every saved shot and the file audit behind it.",
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
      title: "Import session",
      description: "Bring in Rapsodo range or simulated-course data.",
      href: "/import",
      metric: `${integerFormatter.format(data.stats.sessionCount)} sessions`,
      icon: Upload,
      accent: "text-emerald-600 bg-emerald-50",
    },
    {
      title: "Your shots",
      description: "Review every saved shot and the file audit behind it.",
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
        metrics={mobileMetrics}
        routeCards={mobileRouteCards}
        pinnedDashboardSections={pinnedDashboardSections}
        primaryAction={primaryAction}
        primaryActionLabel={primaryActionLabel}
        activeDashboardSection={activeDashboardSection}
        featureData={featureData}
        commandRoutes={toDashboardCommandRoutes(mobileRouteCards)}
      />

      <div className="hidden flex-col gap-8 sm:flex">
        <DashboardSummaryHero
          latestSession={latestSession}
          bestClub={bestClub}
          coachPreview={data.coachPreview}
          scoringCeiling={formatHandicapValue(data.stats.combinedHandicap.value)}
          scoringTrend={formatHandicapTrend(data.stats.combinedHandicap)}
          scoringSampleSize={data.stats.combinedHandicap.sampleSize}
          dataHealth={featureData.dataHealth}
          whatChanged={data.whatChanged}
          bagSummary={data.bagSummary}
          pathTrend={data.pathTrend}
          primaryAction={primaryAction}
          primaryActionLabel={primaryActionLabel}
          latestRound={data.latestRound}
        />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <div className="flex min-w-0 flex-col gap-7">
            {metrics.length > 0 ? <PerformanceSnapshot metrics={metrics} /> : null}

            {pinnedDashboardSections.has("coach") ? (
              <PracticeRecommendationCard
                coachPreview={data.coachPreview}
                primaryAction={primaryAction}
                primaryActionLabel={primaryActionLabel}
              />
            ) : null}

            <CourseDecisionPanel items={data.courseAdvice} />

            {pinnedDashboardSections.has("bag") ? (
              <div id="bag" className="scroll-mt-28">
                <BagConfidencePanel
                  clubs={data.bagPreview}
                  bagSummary={data.bagSummary}
                  bagAlert={featureData.bagAlerts[0] ?? null}
                />
              </div>
            ) : null}

            <ActionCentrePanel data={featureData} layout="dashboard" />
          </div>

          <section className="flex min-w-0 flex-col gap-6">
            <DriverStatusPanel pathTrend={data.pathTrend} />

            <ScoringZonePanel bagSummary={data.bagSummary} />

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

            <DashboardSocialPulse social={social} compact />

            <QuickActions
              routes={routeCards}
              commandRoutes={toDashboardCommandRoutes(routeCards)}
            />
          </section>
        </div>

        <TodayCommandBrief
          latestSession={latestSession}
          bestClub={bestClub}
          coachPreview={data.coachPreview}
          firstSignal={firstSignal}
          dataHealth={featureData.dataHealth}
          primaryAction={primaryAction}
          primaryActionLabel={primaryActionLabel}
          latestRound={data.latestRound}
        />

        {data.stats.shotCount === 0 ? <DashboardFirstRunOnboarding /> : null}
      </div>
    </PageShell>
  );
}

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

function DashboardTodayCompanionHero({
  inbox,
  latestSession,
  coachPreview,
  firstSignal,
  dataHealth,
  bagSummary,
  pathTrend,
  primaryAction,
  primaryActionLabel,
}: {
  inbox: DashboardData["rapsodoInbox"];
  latestSession: DashboardData["recentSessions"][number] | null;
  coachPreview: DashboardData["coachPreview"];
  firstSignal: DashboardInsight | null;
  dataHealth: FeatureIdeasData["dataHealth"];
  bagSummary: DashboardData["bagSummary"];
  pathTrend: DashboardData["pathTrend"];
  primaryAction: string;
  primaryActionLabel: string;
}) {
  const latest = inbox.latest;
  const hasPending = inbox.pendingCount > 0 && Boolean(latest);
  const readiness = calculateRoundReadiness({ bagSummary, pathTrend, coachPreview });
  const shotLabel =
    latest?.shotCount !== null && latest?.shotCount !== undefined
      ? `${integerFormatter.format(latest.shotCount)} shots`
      : "Preview shots";
  const sessionTitle = latest?.title ?? latestSession?.fileName ?? "Rapsodo session";
  const actionHref = hasPending
    ? "/rapsodo"
    : coachPreview
      ? `/bag/${coachPreview.clubId}/analytics`
      : primaryAction;
  const actionLabel = hasPending
    ? "Review latest"
    : coachPreview
      ? "Start drill"
      : primaryActionLabel;
  const title = hasPending
    ? "New Rapsodo session found"
    : coachPreview
      ? `${coachPreview.clubName} ${coachPreview.issueLabel}`
      : latestSession
        ? "Build today's focus"
        : "Build today's baseline";
  const description = hasPending
    ? `${sessionTitle} is waiting. Confirm clubs, import it, then trust the bag update.`
    : coachPreview
      ? coachPreview.reason
      : latestSession
        ? `${formatDate(latestSession.date)} is saved. Use the strongest signal and keep the next practice narrow.`
        : "Connect or import Rapsodo data before the dashboard asks you to compare, share or compete.";

  return (
    <MobileCompanionHero
      eyebrow={
        <StatusPill
          tone={hasPending ? "amber" : coachPreview ? coachPreview.tone : dataHealth.tone}
        >
          Today&apos;s focus
        </StatusPill>
      }
      title={title}
      description={description}
      metricLabel={hasPending ? "Rapsodo inbox" : "Readiness"}
      metricValue={
        hasPending
          ? `${integerFormatter.format(inbox.pendingCount)} waiting`
          : `${readiness.score}%`
      }
      metricDetail={hasPending ? shotLabel : readiness.label}
      action={
        <Button asChild size="sm" className="premium-action rounded-lg">
          <Link href={actionHref} prefetch={false}>
            {actionLabel}
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <MiniMetric
          label="Trust"
          value={
            hasPending
              ? integerFormatter.format(inbox.pendingCount)
              : coachPreview
                ? `${coachPreview.trustIndex}%`
                : (dataHealth.metric ?? dataHealth.status)
          }
        />
        <MiniMetric
          label="Change"
          value={
            firstSignal?.value?.toString() ??
            (latestSession ? formatDate(latestSession.date) : "Build")
          }
        />
        <MiniMetric label="Round" value={`${readiness.score}%`} />
      </div>
    </MobileCompanionHero>
  );
}

function DashboardMobileLayout({
  data,
  social,
  metrics,
  routeCards,
  pinnedDashboardSections,
  primaryAction,
  primaryActionLabel,
  activeDashboardSection,
  featureData,
  commandRoutes,
}: {
  data: DashboardData;
  social: Awaited<ReturnType<typeof getFeedPageData>>;
  metrics: DashboardMetric[];
  routeCards: DashboardRoute[];
  pinnedDashboardSections: Set<DashboardPin>;
  primaryAction: string;
  primaryActionLabel: string;
  activeDashboardSection: DashboardTabKey;
  featureData: FeatureIdeasData;
  commandRoutes: DashboardCommandRoute[];
}) {
  const mobileFeatureData = {
    ...featureData,
    dashboardActions: featureData.dashboardActions.slice(0, 3),
  };
  const hiddenActionCount = Math.max(
    0,
    featureData.dashboardActions.length - mobileFeatureData.dashboardActions.length,
  );

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-x-clip sm:hidden [&>*]:min-w-0">
      <DashboardMobileHeader initialActiveKey={activeDashboardSection} />

      <div
        id="dashboard-mobile-today"
        className="scroll-mt-[calc(8.25rem+env(safe-area-inset-top))]"
      />
      <DashboardTodayCompanionHero
        inbox={data.rapsodoInbox}
        latestSession={data.recentSessions[0] ?? null}
        coachPreview={data.coachPreview}
        firstSignal={data.whatChanged[0] ?? null}
        dataHealth={featureData.dataHealth}
        bagSummary={data.bagSummary}
        pathTrend={data.pathTrend}
        primaryAction={primaryAction}
        primaryActionLabel={primaryActionLabel}
      />

      <MobileBentoSummary
        items={metrics.slice(0, 4).map((metric) => ({
          label: metric.label,
          value: metric.value,
          detail: metric.detail,
          tone: metric.tone,
        }))}
      />

      <MobileCompanionAccordion
        items={[
          {
            value: "performance",
            title: "Performance",
            description: "Changes, bag trust and latest round.",
            summary: `${data.whatChanged.length} signals`,
            children: (
              <div className="grid gap-4">
                <DashboardMobileGroup
                  title="What changed"
                  count={`${data.whatChanged.length} signals`}
                >
                  <CompactReadoutGrid items={data.whatChanged} />
                </DashboardMobileGroup>
                {pinnedDashboardSections.has("bag") ? (
                  <DashboardMobileBagConfidence clubs={data.bagPreview} />
                ) : null}
                {pinnedDashboardSections.has("rounds") ? (
                  <DashboardMobileLatestRound latestRound={data.latestRound} />
                ) : null}
              </div>
            ),
          },
        ]}
      />

      <div
        id="dashboard-mobile-decisions"
        className="scroll-mt-[calc(8.25rem+env(safe-area-inset-top))]"
      />
      <MobileCompanionAccordion
        items={[
          {
            value: "decisions",
            title: "Decisions",
            description: "Course reads and next practice.",
            summary: data.coachPreview?.clubName ?? `${data.courseAdvice.length} reads`,
            children: (
              <div className="grid gap-4">
                <DashboardMobileCourseDecisions items={data.courseAdvice} />
                {pinnedDashboardSections.has("coach") ? (
                  <DashboardMobileNextPractice
                    coachPreview={data.coachPreview}
                    primaryAction={primaryAction}
                    primaryActionLabel={primaryActionLabel}
                  />
                ) : null}
              </div>
            ),
          },
        ]}
      />

      <div
        id="dashboard-mobile-more"
        className="scroll-mt-[calc(8.25rem+env(safe-area-inset-top))]"
      />
      <MobileCompanionAccordion
        items={[
          {
            value: "data-trust",
            title: "Data trust",
            description: "Health, mapping and repair actions.",
            summary: featureData.dataHealth.metric,
            children: (
              <div className="grid gap-4">
                {data.stats.shotCount === 0 ? <DashboardFirstRunOnboarding compactMobile /> : null}
                <DashboardMobileDataHealth dataHealth={featureData.dataHealth} />
                <DashboardMobileGroup
                  title="Action centre"
                  count={`${mobileFeatureData.dashboardActions.length} items`}
                  action={
                    hiddenActionCount > 0 ? (
                      <Button asChild variant="outline" size="sm" className="rounded-lg">
                        <Link href="/progress" prefetch={false}>
                          View all
                        </Link>
                      </Button>
                    ) : undefined
                  }
                >
                  <ActionCentrePanel data={mobileFeatureData} layout="dashboard" compactMobile />
                </DashboardMobileGroup>
              </div>
            ),
          },
          {
            value: "more",
            title: "More tools",
            description: "Full command centre tools, route search and quieter social pulse.",
            summary: `${routeCards.length} tools`,
            children: (
              <div className="grid gap-4">
                <DashboardMobileTools routeCards={routeCards} commandRoutes={commandRoutes} />
                <DashboardMobileSocialPulse social={social} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function DashboardMobileGroup({
  title,
  count,
  description,
  action,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-normal">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : count ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DashboardMobileCourseDecisions({ items }: { items: DashboardData["courseAdvice"] }) {
  return (
    <DashboardMobileGroup
      title="On-course decisions"
      description="Course-number reminders from the current bag map."
      count={`${items.length} reads`}
      action={
        <Button asChild variant="outline" size="sm" className="rounded-lg">
          <Link href="/bag" prefetch={false}>
            <Target className="size-4" />
            Full advice
          </Link>
        </Button>
      }
    >
      <CompactReadoutGrid
        columnsClassName="md:grid-cols-3"
        items={items.slice(0, 3).map((item) => ({
          label: item.label,
          value: item.value,
          detail: item.detail,
          tone: item.tone,
          href: item.clubId ? `/bag/${item.clubId}` : "/bag",
        }))}
      />
    </DashboardMobileGroup>
  );
}

function DashboardMobileNextPractice({
  coachPreview,
  primaryAction,
  primaryActionLabel,
}: {
  coachPreview: DashboardData["coachPreview"];
  primaryAction: string;
  primaryActionLabel: string;
}) {
  return (
    <DashboardMobileGroup
      title="Next practice"
      description="The current highest-value coach signal."
      count={coachPreview?.clubName ?? "Waiting"}
    >
      {coachPreview ? (
        <Link
          href={`/bag/${coachPreview.clubId}/analytics`}
          prefetch={false}
          className="apple-panel-strong block p-4 transition-colors hover:border-emerald-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <StatusPill tone={coachPreview.tone}>{coachPreview.issueLabel}</StatusPill>
              <p className="mt-3 text-3xl font-semibold tracking-normal">{coachPreview.clubName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{coachPreview.reason}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{coachPreview.trustIndex}%</p>
              <p className="text-xs text-muted-foreground">trust</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium">{coachPreview.drill}</p>
          <Progress value={coachPreview.trustIndex} className="mt-4" />
        </Link>
      ) : (
        <div className="apple-panel-strong p-5">
          <p className="font-semibold">No coach priority yet</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Import a range session to unlock club-specific practice recommendations.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={primaryAction} prefetch={false}>
              <Brain className="size-4" />
              {primaryActionLabel}
            </Link>
          </Button>
        </div>
      )}
    </DashboardMobileGroup>
  );
}

function DashboardMobileBagConfidence({ clubs }: { clubs: DashboardData["bagPreview"] }) {
  return (
    <DashboardMobileGroup
      title="Bag confidence"
      description="Stock numbers and confidence by club."
      count={`${clubs.length} clubs`}
    >
      <MobileHorizontalRail
        action={
          <Button asChild variant="outline" size="sm" className="min-h-10 rounded-lg">
            <Link href="/bag" prefetch={false}>
              View all
            </Link>
          </Button>
        }
      >
        {clubs.map((club) => (
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
              <MiniMetric label="Play" value={formatYards(club.stock.recommendedPlayNumberYd)} />
              <MiniMetric label="Trust" value={`${club.stock.confidenceScore}%`} />
              <MiniMetric label="Miss" value={formatStockMiss(club.stock)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]">
              <span
                className={cn(
                  "rounded-full px-2 py-1",
                  club.stock.confidenceScore < 35
                    ? "bg-rose-50 text-rose-700"
                    : club.stock.confidenceScore < 60
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700",
                )}
              >
                {club.stock.label}
              </span>
              {club.stock.sampleSize < 20 ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  Needs {integerFormatter.format(20 - club.stock.sampleSize)} clean shots
                </span>
              ) : null}
            </div>
            <Progress value={club.stock.confidenceScore} className="mt-3" />
          </Link>
        ))}
      </MobileHorizontalRail>
    </DashboardMobileGroup>
  );
}

function DashboardMobileLatestRound({
  latestRound,
}: {
  latestRound: DashboardData["latestRound"];
}) {
  return (
    <DashboardMobileGroup
      title="Latest round"
      description="Newest round, simulator, or simulated-course file."
      count={latestRound ? formatScoreVsPar(latestRound.totalScore, latestRound.totalPar) : "None"}
    >
      {latestRound ? (
        <div className="grid gap-4">
          <div className="apple-panel-strong p-4">
            <p className="text-sm text-muted-foreground">
              {formatDate(latestRound.date)} - {formatSessionType(latestRound.type)}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-normal">
              {latestRound.courseName ?? latestRound.fileName ?? "Untitled round"}
            </p>
          </div>
          <div className="grid gap-3">
            <RoundMetric label="Score" value={latestRound.totalScore} />
            <RoundMetric label="Par" value={latestRound.totalPar} />
            <RoundMetric label="Putts" value={latestRound.totalPutts} />
            <RoundMetric
              label="Diff"
              value={formatHandicapValue(latestRound.handicapDifferential)}
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Button asChild className="flex-1">
              <Link href={`/rounds/${latestRound.id}`} prefetch={false}>
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
    </DashboardMobileGroup>
  );
}

function DashboardMobileTools({
  routeCards,
  commandRoutes,
}: {
  routeCards: DashboardRoute[];
  commandRoutes: DashboardCommandRoute[];
}) {
  return (
    <>
      <DashboardMobileGroup
        title="Tools"
        description="Fast paths into the full command centre."
        count={`${routeCards.length} pages`}
      >
        <MobileHorizontalRail itemClassName="min-w-[68vw] max-w-[18rem]">
          {routeCards.slice(0, 6).map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={`${card.title}-${card.href}`}
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
      </DashboardMobileGroup>
      <DashboardMobileGroup
        title="Find a tool"
        description="Search every route without turning Today into a directory."
        count={`${routeCards.length} pages`}
      >
        <DashboardCommandPalette routes={commandRoutes} />
      </DashboardMobileGroup>
    </>
  );
}

function DashboardFirstRunOnboarding({ compactMobile = false }: { compactMobile?: boolean }) {
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

  const content = (
    <>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {steps.map((step, index) => (
          <Link
            key={step.title}
            href={step.href}
            prefetch={false}
            className="apple-panel-strong p-3 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/35"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-7 place-items-center rounded-md bg-[#F5F6F4] text-xs font-semibold">
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
      <div className="trust-indicator mt-3 rounded-lg p-3">
        <p className="text-sm font-semibold">What happens to my data?</p>
        <div className="mt-2 grid gap-2 text-sm leading-5 text-muted-foreground sm:grid-cols-4">
          <p>Private by default.</p>
          <p>You control profile, feed and leaderboard visibility.</p>
          <p>Friends do not get account access.</p>
          <p>Coach, viewer and editor access is separate.</p>
        </div>
      </div>
    </>
  );

  if (compactMobile) {
    return (
      <DashboardMobileGroup
        title="First-run path"
        description="Import, map clubs and read the first signal."
        count="7 steps"
      >
        {content}
      </DashboardMobileGroup>
    );
  }

  return (
    <DataPanel id="first-run-onboarding" className="scroll-mt-28">
      <SectionHeader
        title="First-run Rapsodo path"
        description="Start here if there is no usable shot data yet. Data comes first; sharing and competition stay optional."
        action={
          <Button asChild className="premium-action rounded-lg">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import Rapsodo
            </Link>
          </Button>
        }
      />
      <CardContent>{content}</CardContent>
    </DataPanel>
  );
}

function DashboardMobileDataHealth({ dataHealth }: { dataHealth: FeatureIdeasData["dataHealth"] }) {
  return (
    <section className="premium-card grid gap-3 rounded-lg p-3 sm:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Can I trust this?</p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
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

function DashboardMobileSocialPulse({
  social,
}: {
  social: Awaited<ReturnType<typeof getFeedPageData>>;
}) {
  const topItem = social.items[0] ?? null;
  const pbCount = social.items.filter(
    (item) => item.itemType === "new_pb" || item.itemType === "longest_drive",
  ).length;

  return (
    <DashboardMobileGroup
      title="Social pulse"
      description="One quiet network signal. Open Social for the full feed."
      action={
        <Button asChild variant="outline" size="sm" className="rounded-lg">
          <Link href="/feed" prefetch={false}>
            <Radio className="size-4" />
            Open feed
          </Link>
        </Button>
      }
    >
      <Link
        href={topItem?.proofUrl ?? "/feed"}
        prefetch={false}
        className="grid gap-3 rounded-xl border bg-slate-50 px-3 py-3 text-sm transition-colors hover:bg-white"
      >
        <div className="grid grid-cols-2 gap-2">
          <DataPair label="Friends" value={social.friendCount.toString()} />
          <DataPair label="Network PBs" value={pbCount.toString()} />
        </div>
        {topItem ? (
          <div className="border-t border-slate-200 pt-3">
            <p className="font-semibold leading-5">{topItem.headline}</p>
            <p className="mt-1 line-clamp-2 text-muted-foreground">
              {topItem.metricValue
                ? `${topItem.metricLabel ?? "Metric"} ${topItem.metricValue}`
                : (topItem.context ?? "Social update")}
            </p>
          </div>
        ) : (
          <p className="border-t border-slate-200 pt-3 text-muted-foreground">
            Add friends or join a challenge to populate this pulse.
          </p>
        )}
      </Link>
    </DashboardMobileGroup>
  );
}

function formatStockMiss(stock: DashboardData["bagPreview"][number]["stock"]) {
  const left = stock.dispersionLeftYd ?? 0;
  const right = stock.dispersionRightYd ?? 0;

  if (left === 0 && right === 0) {
    return "--";
  }

  if (left > right + 2) {
    return `L ${formatYards(left)}`;
  }

  if (right > left + 2) {
    return `R ${formatYards(right)}`;
  }

  return "Balanced";
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tracking-normal">{value}</p>
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
    <section id={id} className={cn("premium-card scroll-mt-28 rounded-lg", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-white/30 px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold leading-7 tracking-normal text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
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
  scoringSampleSize,
  dataHealth,
  whatChanged,
  bagSummary,
  pathTrend,
  primaryAction,
  primaryActionLabel,
  latestRound,
}: {
  latestSession: DashboardData["recentSessions"][number] | null;
  bestClub: DashboardData["bagPreview"][number] | null;
  coachPreview: DashboardData["coachPreview"];
  scoringCeiling: string;
  scoringTrend: string;
  scoringSampleSize: number;
  dataHealth: FeatureIdeasData["dataHealth"];
  whatChanged: DashboardInsight[];
  bagSummary: DashboardData["bagSummary"];
  pathTrend: DashboardData["pathTrend"];
  primaryAction: string;
  primaryActionLabel: string;
  latestRound: DashboardData["latestRound"];
}) {
  const practiceHref = coachPreview ? `/bag/${coachPreview.clubId}/analytics` : primaryAction;
  const practiceTitle = coachPreview
    ? `${coachPreview.clubName} ${coachPreview.issueLabel}`
    : primaryActionLabel;
  const firstChange = whatChanged[0] ?? null;
  const readiness = calculateRoundReadiness({ bagSummary, pathTrend, coachPreview });
  const driverStatus = getDriverStatus(pathTrend);
  const scoringZone =
    bagSummary.scoringZones.find((zone) => !zone.isSuggested && zone.fullCarryYd !== null) ??
    bagSummary.scoringZones[0] ??
    null;
  const focusReasons = coachPreview
    ? [
        coachPreview.reason,
        `${integerFormatter.format(coachPreview.sampleSize)} stock shots available for this read.`,
        firstChange
          ? `${firstChange.label}: ${firstChange.value}`
          : "No stronger movement signal yet.",
      ]
    : [
        "The first useful job is getting clean launch-monitor data into the app.",
        `${integerFormatter.format(bagSummary.mappedClubCount)} clubs are mapped today.`,
        firstChange
          ? `${firstChange.label}: ${firstChange.value}`
          : "Progress cards unlock after imports.",
      ];
  const expectedGain = coachPreview
    ? readiness.recommended
    : "Unlocks the first reliable practice priority.";

  return (
    <section className="premium-hero relative overflow-hidden rounded-lg">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(248,250,248,0.92)_0%,rgba(255,255,255,0.46)_48%,rgba(236,247,241,0.62)_100%)]" />
        <div className="absolute right-0 top-0 h-full w-[46%] border-l border-[#DCECE0] bg-[repeating-linear-gradient(90deg,rgba(15,143,77,0.10)_0,rgba(15,143,77,0.10)_1px,transparent_1px,transparent_54px)]" />
        <div className="absolute right-10 bottom-9 h-px w-72 -rotate-6 bg-[#9DCFB0]" />
        <div className="absolute right-32 bottom-20 h-px w-52 -rotate-6 bg-[#C8D9FF]" />
      </div>

      <div className="relative grid gap-5 px-7 py-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:items-stretch">
        <Link
          href={practiceHref}
          prefetch={false}
          className="group flex min-h-full flex-col justify-between rounded-[22px] border border-[#CFE7D6] bg-white/95 p-6 shadow-[0_18px_40px_rgba(8,122,61,0.10)] transition-colors hover:border-[#0F8F4D]"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill className="bg-[#E8F7EE] text-[#087A3D] ring-[#CFE7D6]">
                Today&apos;s focus
              </StatusPill>
              <StatusPill tone={coachPreview ? normalizeDashboardTone(coachPreview.tone) : "green"}>
                {coachPreview ? `${coachPreview.trustIndex}% trust` : "Build baseline"}
              </StatusPill>
              {latestSession ? (
                <StatusPill className="bg-[#EAF1FF] text-[#2563EB] ring-[#CFDAFF]">
                  Latest import {formatDate(latestSession.date)}
                </StatusPill>
              ) : null}
            </div>
            <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[3.3rem] tracking-normal text-[#111827] xl:text-[56px] xl:leading-[3.7rem]">
              {practiceTitle}
            </h1>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MiniMetric
                label="Trust"
                value={
                  coachPreview
                    ? `${coachPreview.trustIndex}%`
                    : (dataHealth.metric ?? dataHealth.status)
                }
              />
              <MiniMetric
                label="Shots"
                value={
                  coachPreview
                    ? integerFormatter.format(coachPreview.sampleSize)
                    : integerFormatter.format(bagSummary.mappedClubCount)
                }
              />
              <MiniMetric label="Readiness" value={`${readiness.score}%`} />
            </div>
            <div className="mt-5 grid gap-2">
              {focusReasons.map((reason) => (
                <p
                  key={reason}
                  className="flex gap-2 rounded-lg border border-[#EDF1ED] bg-[#F8FAF8] px-3 py-2 text-sm leading-5 text-[#111827]"
                >
                  <Target className="mt-0.5 size-4 shrink-0 text-[#087A3D]" />
                  <span>{reason}</span>
                </p>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-[#CFE7D6] bg-[#F0FAF3] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#087A3D]">
                Expected gain
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#111827]">{expectedGain}</p>
            </div>
          </div>
          <ShotTraceMotif className="mt-5 h-9 w-full text-emerald-700/70" />
          <span className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#087A3D] px-4 text-sm font-semibold text-white transition-colors group-hover:bg-[#065F32]">
            Start practice
            <ArrowRight className="size-4" />
          </span>
        </Link>

        <div className="grid gap-4">
          <RoundReadinessCard readiness={readiness} />
          <SinceLastSessionCard insights={whatChanged} />
        </div>
      </div>

      <div className="relative grid gap-4 border-t border-[#EDF1ED] bg-white/78 px-7 py-4 lg:grid-cols-4">
        <HeroInsightCard
          title="Current form"
          value={scoringCeiling}
          detail={`${scoringTrend} · ${integerFormatter.format(scoringSampleSize)} round sample`}
          href="/rounds"
          tone="amber"
        />
        <HeroInsightCard
          title="Most trusted club"
          value={bagSummary.mostTrusted?.label ?? (bestClub ? formatClubType(bestClub.type) : "--")}
          detail={
            bagSummary.mostTrusted
              ? `${bagSummary.mostTrusted.confidenceScore}% confidence · ${formatYards(
                  bagSummary.mostTrusted.playNumberYd,
                )}`
              : "Import shots to build club trust"
          }
          href={bagSummary.mostTrusted ? `/bag/${bagSummary.mostTrusted.id}` : "/bag"}
          tone="green"
        />
        <HeroInsightCard
          title="Driver status"
          value={driverStatus.label}
          detail={`Path ${formatSignedDegrees(driverStatus.pathDeg)} · F-P ${formatSignedDegrees(
            driverStatus.faceToPathDeg,
          )}`}
          href={pathTrend.clubId ? `/bag/${pathTrend.clubId}` : "/bag"}
          tone={driverStatus.tone}
        />
        <HeroInsightCard
          title="Scoring zone"
          value={
            scoringZone
              ? `${scoringZone.label} ${formatYards(scoringZone.fullCarryYd)}`
              : bagSummary.scoringStatus
          }
          detail={
            scoringZone
              ? `${scoringZone.matrixScore}% matrix · ${bagSummary.scoringStatus}`
              : latestRound
                ? (latestRound.courseName ?? latestRound.fileName ?? "Review round")
                : dataHealth.status
          }
          href="/bag#wedge-roles"
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
        "group premium-rail-card block rounded-lg p-4 transition-colors",
        primary
          ? "border-[#CFE7D6] shadow-[0_12px_30px_rgba(8,122,61,0.08)] hover:border-[#0F8F4D]"
          : "hover:border-[#CFE7D6]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold leading-6 text-foreground">{title}</p>
        {actionText ? (
          <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#087A3D] px-3 text-xs font-semibold text-white transition-colors group-hover:bg-[#065F32]">
            {actionText}
            <ArrowRight className="size-3.5" />
          </span>
        ) : (
          <DashboardDot tone={tone} />
        )}
      </div>
      <p className="mt-2 text-[26px] font-bold leading-8 tracking-normal text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{detail}</p>
    </Link>
  );
}

type RoundReadiness = {
  score: number;
  label: string;
  tone: DashboardTone;
  driver: string;
  irons: string;
  wedges: string;
  recommended: string;
};

function RoundReadinessCard({ readiness }: { readiness: RoundReadiness }) {
  return (
    <section className="premium-card rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold leading-5 text-[#111827]">Round readiness</p>
          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Driver, bag trust and scoring-zone calibration.
          </p>
        </div>
        <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-[42px] font-bold leading-none tracking-normal text-[#111827]">
          {readiness.score}%
        </p>
        <div className="min-w-[9rem] flex-1">
          <Progress value={readiness.score} />
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        <ReadinessRow label="Driver" value={readiness.driver} />
        <ReadinessRow label="Irons" value={readiness.irons} />
        <ReadinessRow label="Wedges" value={readiness.wedges} />
      </div>
      <div className="mt-4 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">Recommended</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-[#111827]">
          {readiness.recommended}
        </p>
      </div>
    </section>
  );
}

function ReadinessRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-lg border border-[#EDF1ED] bg-white px-3 py-2 text-sm">
      <span className="font-medium text-[#667085]">{label}</span>
      <span className="text-right font-semibold text-[#111827]">{value}</span>
    </p>
  );
}

function SinceLastSessionCard({ insights }: { insights: DashboardInsight[] }) {
  return (
    <section className="premium-card rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold leading-5 text-[#111827]">Since last session</p>
          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Latest movement that should change today&apos;s practice.
          </p>
        </div>
        <LineChart className="size-5 text-[#087A3D]" />
      </div>
      <div className="mt-4 grid gap-3">
        {insights.length > 0 ? (
          insights.slice(0, 3).map((insight) => (
            <Link
              key={`${insight.label}-${insight.value}`}
              href="/progress"
              prefetch={false}
              className="grid gap-1 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-2.5 transition-colors hover:border-[#0F8F4D] hover:bg-white"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#111827]">{insight.label}</span>
                <DashboardDot tone={normalizeDashboardTone(insight.tone)} />
              </span>
              <span className="text-lg font-bold leading-6 tracking-normal text-[#111827]">
                {insight.value}
              </span>
              <span className="text-sm leading-5 text-[#667085]">{insight.detail}</span>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-3 text-sm leading-5 text-[#667085]">
            Import another session and this becomes the first progress readout.
          </p>
        )}
      </div>
    </section>
  );
}

function calculateRoundReadiness({
  bagSummary,
  pathTrend,
  coachPreview,
}: {
  bagSummary: DashboardData["bagSummary"];
  pathTrend: DashboardData["pathTrend"];
  coachPreview: DashboardData["coachPreview"];
}): RoundReadiness {
  const driverStatus = getDriverStatus(pathTrend);
  const measuredScoringZones = bagSummary.scoringZones.filter((zone) => !zone.isSuggested);
  const wedgeScore =
    measuredScoringZones.length > 0
      ? Math.round(
          measuredScoringZones.reduce((total, zone) => total + zone.matrixScore, 0) /
            measuredScoringZones.length,
        )
      : 42;
  const score = clampNumber(
    Math.round(bagSummary.averageConfidence * 0.52 + driverStatus.score * 0.24 + wedgeScore * 0.24),
    0,
    100,
  );
  const label = score >= 85 ? "Ready" : score >= 70 ? "Playable" : "Calibrating";
  const tone: DashboardTone = score >= 85 ? "green" : score >= 70 ? "sky" : "amber";
  const wedgeLabel = bagSummary.scoringZones.some((zone) => zone.isSuggested)
    ? "Calibrating"
    : wedgeScore >= 75
      ? "Ready"
      : wedgeScore >= 50
        ? "Calibrating"
        : "Needs data";
  const recommended = coachPreview
    ? getDashboardPracticeTask(coachPreview)
    : bagSummary.leastTrusted?.needsShots
      ? `Add ${integerFormatter.format(bagSummary.leastTrusted.needsShots)} ${bagSummary.leastTrusted.label} shots before next round.`
      : "Import a clean session before the next round.";

  return {
    score,
    label,
    tone,
    driver: driverStatus.label,
    irons: `${bagSummary.trustedClubCount}/${bagSummary.mappedClubCount} trusted`,
    wedges: wedgeLabel,
    recommended,
  };
}

function getDriverStatus(pathTrend: DashboardData["pathTrend"]) {
  const latestPoint =
    [...pathTrend.points].reverse().find((point) => point.pathDeg !== null) ?? null;
  const latestShot = pathTrend.recentShots[0] ?? null;
  const pathDeg = latestPoint?.pathDeg ?? latestShot?.pathDeg ?? null;
  const faceToPathDeg = latestPoint?.faceToPathProxyDeg ?? latestShot?.faceToPathProxyDeg ?? null;
  const faceAbs = faceToPathDeg === null ? null : Math.abs(faceToPathDeg);

  if (pathDeg === null) {
    return {
      label: "Building",
      detail: pathTrend.detail,
      pathDeg,
      faceToPathDeg,
      score: 42,
      tone: "slate" as DashboardTone,
    };
  }

  if (Math.abs(pathDeg) <= 5 && (faceAbs === null || faceAbs <= 3)) {
    return {
      label: latestPoint?.patternLabel ?? latestShot?.patternLabel ?? "In window",
      detail: "Path is inside the target delivery window.",
      pathDeg,
      faceToPathDeg,
      score: 88,
      tone: "green" as DashboardTone,
    };
  }

  if (pathTrend.status === "neutralising") {
    return {
      label: "Neutralising",
      detail: pathTrend.detail,
      pathDeg,
      faceToPathDeg,
      score: 76,
      tone: "sky" as DashboardTone,
    };
  }

  if (pathTrend.status === "widening") {
    return {
      label: "Watch path",
      detail: pathTrend.detail,
      pathDeg,
      faceToPathDeg,
      score: 58,
      tone: "amber" as DashboardTone,
    };
  }

  return {
    label: latestPoint?.patternLabel ?? latestShot?.patternLabel ?? "Measured",
    detail: pathTrend.detail,
    pathDeg,
    faceToPathDeg,
    score: 68,
    tone: "sky" as DashboardTone,
  };
}

function formatSignedDegrees(value: number | null) {
  return value === null ? "--" : `${formatSignedNumberForDashboard(value)} deg`;
}

function formatSignedNumberForDashboard(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function DriverStatusPanel({ pathTrend }: { pathTrend: DashboardData["pathTrend"] }) {
  const status = getDriverStatus(pathTrend);
  const latestPoint =
    [...pathTrend.points].reverse().find((point) => point.pathDeg !== null) ?? null;
  const sampleSize = latestPoint?.sampleSize ?? pathTrend.recentShots.length;

  return (
    <DashboardPanel
      title="Driver status"
      description="One-glance path and face-to-path proxy from the latest measured driver trend."
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href={pathTrend.clubId ? `/bag/${pathTrend.clubId}` : "/bag"} prefetch={false}>
            <BarChart3 className="size-4" />
            Open trend
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">Status</p>
            <p className="mt-1 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
              {status.label}
            </p>
          </div>
          <StatusPill tone={status.tone}>{pathTrend.label}</StatusPill>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DataPair label="Path" value={formatSignedDegrees(status.pathDeg)} />
          <DataPair label="Target" value="+/-5 deg" />
          <DataPair label="F-P" value={formatSignedDegrees(status.faceToPathDeg)} />
        </div>
        <p className="rounded-lg border border-[#EDF1ED] bg-white px-3 py-3 text-sm leading-5 text-[#667085]">
          {status.detail}{" "}
          {sampleSize > 0
            ? `${integerFormatter.format(sampleSize)} measured shots in the latest point.`
            : ""}
        </p>
      </div>
    </DashboardPanel>
  );
}

function ScoringZonePanel({ bagSummary }: { bagSummary: DashboardData["bagSummary"] }) {
  const zones = bagSummary.scoringZones.slice(0, 3);

  return (
    <DashboardPanel
      title="Scoring zones"
      description="Full wedge anchors and measured partial windows."
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/bag#wedge-roles" prefetch={false}>
            <Target className="size-4" />
            Wedges
          </Link>
        </Button>
      }
    >
      {zones.length > 0 ? (
        <div className="grid gap-3">
          <p className="rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-2.5 text-sm font-semibold leading-5 text-[#111827]">
            {bagSummary.scoringStatus}
          </p>
          {zones.map((zone) => (
            <Link
              key={zone.id}
              href="/bag#wedge-roles"
              prefetch={false}
              className="grid gap-3 rounded-lg border border-[#DFE7DF] bg-white px-3 py-3 transition-colors hover:border-[#0F8F4D] hover:bg-[#F8FAF8]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold leading-5 text-[#111827]">{zone.label}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[#667085]">
                    {zone.isSuggested ? "Suggested gap" : `${zone.matrixScore}% matrix`}
                  </p>
                </div>
                <p className="text-xl font-bold leading-7 tracking-normal text-[#111827]">
                  {formatYards(zone.fullCarryYd)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {zone.rows.map((row) => (
                  <span
                    key={`${zone.id}-${row.key}`}
                    className={cn(
                      "rounded-lg px-2 py-2 text-center text-xs font-semibold leading-4",
                      toneSoftClass(normalizeDashboardTone(row.tone)),
                    )}
                  >
                    <span className="block">{row.label}</span>
                    <span className="block">{formatYards(row.carryYd)}</span>
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-3 py-3 text-sm leading-5 text-[#667085]">
          Add PW, GW/AW, SW or LW shots to build the scoring-zone matrix.
        </p>
      )}
    </DashboardPanel>
  );
}

function TodayCommandBrief({
  latestSession,
  bestClub,
  coachPreview,
  firstSignal,
  dataHealth,
  primaryAction,
  primaryActionLabel,
  latestRound,
}: {
  latestSession: DashboardData["recentSessions"][number] | null;
  bestClub: DashboardData["bagPreview"][number] | null;
  coachPreview: DashboardData["coachPreview"];
  firstSignal: DashboardInsight | null;
  dataHealth: FeatureIdeasData["dataHealth"];
  primaryAction: string;
  primaryActionLabel: string;
  latestRound: DashboardData["latestRound"];
}) {
  const nextActionHref = coachPreview ? `/bag/${coachPreview.clubId}/analytics` : primaryAction;
  const detailHref = bestClub
    ? `/bag/${bestClub.id}`
    : latestRound
      ? `/rounds/${latestRound.id}`
      : "/today";
  const items = [
    {
      question: "What should I do next?",
      answer: coachPreview
        ? `${coachPreview.clubName} ${coachPreview.issueLabel.toLowerCase()}`
        : primaryActionLabel,
      detail: coachPreview
        ? getDashboardPracticeTask(coachPreview)
        : "Import one clean session to unlock the first reliable practice signal.",
      href: nextActionHref,
      action: coachPreview ? "Start drill" : "Import",
      icon: Target,
      tone: coachPreview ? normalizeDashboardTone(coachPreview.tone) : "green",
    },
    {
      question: "What changed since last time?",
      answer:
        firstSignal?.value ?? (latestSession ? formatDate(latestSession.date) : "No signal yet"),
      detail:
        firstSignal?.detail ??
        (latestSession
          ? `${integerFormatter.format(latestSession.shotCount)} shots in the latest saved session.`
          : "Save a session and this becomes the latest movement readout."),
      href: "/progress",
      action: "Review",
      icon: Star,
      tone: firstSignal ? normalizeDashboardTone(firstSignal.tone) : "slate",
    },
    {
      question: "Can I trust the data?",
      answer: dataHealth.metric,
      detail: dataHealth.detail,
      href: "/settings#offline-storage",
      action: "Check",
      icon: Eye,
      tone: normalizeDashboardTone(dataHealth.tone),
    },
    {
      question: "Where do I go for detail?",
      answer: bestClub ? formatClubType(bestClub.type) : latestRound ? "Latest round" : "Today",
      detail: bestClub
        ? `${bestClub.stock.confidenceScore}% trust with ${integerFormatter.format(bestClub.shotCount)} saved shots.`
        : latestRound
          ? (latestRound.courseName ?? latestRound.fileName ?? "Open the latest round review.")
          : "Start from the latest practice readout once an import exists.",
      href: detailHref,
      action: "Open",
      icon: Database,
      tone: bestClub ? "green" : "sky",
    },
  ] satisfies Array<{
    question: string;
    answer: ReactNode;
    detail: ReactNode;
    href: string;
    action: string;
    icon: LucideIcon;
    tone: DashboardTone;
  }>;

  return (
    <section className="premium-card grid gap-3 rounded-lg p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Quick answers</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Shortcuts into the command centre without competing with the main action.
          </p>
        </div>
        <StatusPill className="bg-background text-muted-foreground ring-border">Context</StatusPill>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.question}
              href={item.href}
              prefetch={false}
              className="group grid min-h-[9.75rem] grid-rows-[auto_1fr_auto] rounded-lg border border-border bg-white/70 p-3.5 transition-colors hover:border-primary/30 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-5 text-foreground">{item.question}</p>
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    toneSoftClass(item.tone),
                  )}
                >
                  <Icon className="size-4" />
                </span>
              </div>
              <div className="mt-4 min-w-0">
                <p className="text-lg font-bold leading-6 tracking-normal text-foreground">
                  {item.answer}
                </p>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {item.action}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
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
  firstSignal: DashboardInsight | null;
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
      className={cn("premium-card scroll-mt-28 rounded-lg p-5 lg:p-6", className)}
    >
      {coachPreview ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-[#E8F7EE] text-[#087A3D] shadow-[inset_0_0_0_1px_rgba(8,122,61,0.06)]">
                <Target className="size-6" strokeWidth={2.4} />
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[15px] font-bold leading-6 tracking-normal text-[#111827]">
                  Next practice
                </p>
                <span className="rounded-full border border-[#F8D9A4] bg-[#FFF8ED] px-3 py-1 text-sm font-semibold leading-5 text-[#A94B00]">
                  {coachPreview.trustIndex}% trust
                </span>
              </div>
            </div>
            <h2 className="mt-5 text-[26px] font-bold leading-8 tracking-normal text-[#111827]">
              {coachPreview.clubName} delivery window
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#F8D9A4] bg-[#FFF8ED] px-3 py-1.5 text-sm font-semibold leading-5 text-[#B45309]">
                <Crosshair className="size-3.5" />
                {coachPreview.issueLabel}
              </span>
              <span className="text-sm leading-6 text-[#667085]">
                Goal: path inside +/-5 degrees with a predictable start line.
              </span>
            </div>
            <PracticeReasonText reason={coachPreview.reason} />
            <TargetLaneVisual coachPreview={coachPreview} />
          </div>

          <section className="premium-command-surface rounded-lg p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#E8F7EE] text-[#087A3D]">
                <Crosshair className="size-5" strokeWidth={2.3} />
              </span>
              <p className="text-sm font-bold leading-5 tracking-normal text-[#087A3D]">
                Practice task
              </p>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-6 text-[#111827]">
              {practiceTaskParagraphs(taskCopy).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-6 grid gap-3">
              <Button
                asChild
                className="h-11 rounded-lg bg-[#087A3D] px-4 text-sm font-bold text-white shadow-[0_8px_18px_rgba(8,122,61,0.18)] hover:bg-[#065F32]"
              >
                <Link href={href} prefetch={false}>
                  Open drill
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <span className="grid h-11 place-items-center rounded-lg border border-[#D9E1D9] bg-white text-sm font-bold text-[#667085] shadow-sm">
                0 / 10 balls
              </span>
            </div>
          </section>
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

function PracticeReasonText({ reason }: { reason: string }) {
  const match = reason.match(/^(\d+(?:\.\d+)?%)(.*)$/);

  if (!match) {
    return <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]">{reason}</p>;
  }

  return (
    <p className="mt-5 max-w-3xl text-base leading-7 text-[#111827]">
      <span className="font-bold text-[#087A3D]">{match[1]}</span>
      {match[2]}
    </p>
  );
}

function practiceTaskParagraphs(taskCopy: string) {
  return taskCopy
    .split(/(?<=\.)\s+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
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
    <div className="premium-command-surface mt-8 rounded-lg p-4">
      <div className="mb-3 grid grid-cols-[24%_50%_26%] px-1 text-sm font-bold uppercase tracking-[0.12em] text-[#667085]">
        <span>Left miss</span>
        <span className="text-center">Playable window</span>
        <span className="text-right">Right miss</span>
      </div>
      <div className="relative h-32 overflow-hidden rounded-xl border border-[#DFE7DF] bg-white">
        <div className="absolute inset-y-0 left-0 w-[24%] bg-[linear-gradient(135deg,#FFF2D8_0%,#FFF8E8_100%)]" />
        <div className="absolute inset-y-0 left-[24%] w-[50%] bg-[linear-gradient(135deg,#E7F6EF_0%,#F3FBF7_100%)]" />
        <div className="absolute inset-y-0 right-0 w-[26%] bg-[linear-gradient(135deg,#EAF1FF_0%,#F4F7FF_100%)]" />
        <div className="absolute left-[24%] top-0 h-full border-l border-dashed border-[#EA6A00]" />
        <div className="absolute left-[74%] top-0 h-full border-l border-dashed border-[#2563EB]" />
        <div className="absolute left-1/2 top-0 h-full border-l border-[#087A3D]" />
        <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#087A3D] shadow-[0_8px_18px_rgba(15,23,42,0.1)]">
          Target
        </span>
        <div
          className={cn(
            "absolute bottom-5 flex -translate-x-1/2 flex-col items-center",
            markerPosition,
          )}
        >
          <span className="whitespace-nowrap rounded-full border border-[#DFE7DF] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.1)]">
            {markerLabel}
          </span>
          <span className={cn("h-5 w-px", markerTone)} />
          <span
            className={cn(
              "size-4 rounded-full border-[3px] border-white shadow-[0_0_0_7px_rgba(17,24,39,0.10)]",
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
    <section className={cn("premium-card scroll-mt-28 rounded-lg", className)}>
      <div className="flex items-start gap-4 px-5 py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#E8F7EE] text-[#087A3D]">
          <BarChart3 className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-7 tracking-normal text-[#111827]">
            Performance snapshot
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#667085]">
            What the headline numbers mean and where to act on them.
          </p>
        </div>
      </div>
      <div
        className={cn(
          "grid gap-4 px-5 pb-5",
          paired ? "grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Link
              key={metric.label}
              href={metric.href}
              prefetch={false}
              className={cn(
                "group premium-rail-card flex min-w-0 flex-col rounded-lg p-4 transition-colors hover:border-[#CFE7D6] hover:bg-[#F8FAF8]",
                paired ? "min-h-[190px]" : "min-h-[220px]",
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
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    toneSoftClass(metric.tone),
                  )}
                >
                  <Icon className="size-5" />
                </span>
              </div>
              <p className={cn("mt-2 text-sm text-[#667085]", paired ? "leading-5" : "leading-6")}>
                {metric.detail}
              </p>
              <div className="mt-4 line-clamp-3 rounded-xl border border-[#EDF1ED] bg-[#F8FAF8] px-3 py-3 text-sm leading-5 text-[#111827]">
                {metric.insight ?? metric.detail}
              </div>
              <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-[#087A3D]">
                {metric.actionLabel ?? "Open"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function BagConfidencePanel({
  clubs,
  bagSummary,
  bagAlert,
}: {
  clubs: DashboardData["bagPreview"];
  bagSummary: DashboardData["bagSummary"];
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
          <div className="grid gap-3 xl:grid-cols-2">
            {bagSummary.mostTrusted ? (
              <BagCaddieCard title="Most trusted club" club={bagSummary.mostTrusted} tone="green" />
            ) : null}
            {bagSummary.leastTrusted ? (
              <BagCaddieCard
                title="Least trusted club"
                club={bagSummary.leastTrusted}
                tone="amber"
              />
            ) : null}
          </div>

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

function BagCaddieCard({
  title,
  club,
  tone,
}: {
  title: string;
  club: NonNullable<DashboardData["bagSummary"]["mostTrusted"]>;
  tone: "green" | "amber";
}) {
  return (
    <Link
      href={`/bag/${club.id}`}
      prefetch={false}
      className={cn(
        "grid gap-3 rounded-lg border px-4 py-4 transition-colors hover:bg-white",
        tone === "green"
          ? "border-[#CFE7D6] bg-[#F0FAF3] hover:border-[#0F8F4D]"
          : "border-[#F1C36D] bg-[#FFF8E7] hover:border-[#B87500]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">{title}</p>
          <p className="mt-1 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
            {club.label}
          </p>
        </div>
        <p className="text-right text-2xl font-bold leading-8 tracking-normal text-[#111827]">
          {formatYards(club.playNumberYd)}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <DataPair label="Confidence" value={`${club.confidenceScore}%`} />
        <DataPair label="Miss" value={club.missLabel} />
        <DataPair
          label="Need"
          value={
            club.needsShots > 0 ? `${integerFormatter.format(club.needsShots)} shots` : "Ready"
          }
        />
      </div>
    </Link>
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
  const sortedClubs = [...clubs].sort(
    (left, right) => (right.stock.carryMedianYd ?? 0) - (left.stock.carryMedianYd ?? 0),
  );

  return (
    <div className="premium-command-surface min-w-0 rounded-lg p-4">
      <p className="text-sm font-semibold text-foreground">Bag confidence ladder</p>
      <div className="mt-3 grid gap-2.5">
        {sortedClubs.map((club, index) => {
          const carry = club.stock.carryMedianYd ?? 0;
          const width = Math.max(8, Math.round((carry / maxCarry) * 100));
          const nextCarry = sortedClubs[index + 1]?.stock.carryMedianYd ?? null;
          const hasGappingWarning =
            carry > 0 && nextCarry !== null && nextCarry > 0 && Math.abs(carry - nextCarry) < 8;
          const needsMoreShots = club.stock.confidenceScore < 60;

          return (
            <Link
              key={club.id}
              href={`/bag/${club.id}`}
              prefetch={false}
              className="grid gap-2 rounded-lg border border-transparent px-2 py-2 text-sm transition-colors hover:border-[#CFE7D6] hover:bg-white/60"
            >
              <span className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.75rem_3.75rem] items-center gap-3">
                <span className="font-semibold text-[#111827]">{formatClubType(club.type)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[#EEF2F0]">
                  <span
                    className="block h-full rounded-full bg-[#9AD7AE]"
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="text-right tabular-nums text-[#111827]">
                  {formatYards(club.stock.carryMedianYd)}
                </span>
                <span className="text-right tabular-nums text-[#667085]">
                  {club.stock.confidenceScore}%
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5 pl-[4.5rem] text-[11px] font-semibold uppercase tracking-[0.08em]">
                {club.stock.recommendedPlayNumberYd ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                    Safe {formatYards(club.stock.recommendedPlayNumberYd)}
                  </span>
                ) : null}
                {needsMoreShots ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                    Needs more shots
                  </span>
                ) : null}
                {hasGappingWarning ? (
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">
                    Gap warning
                  </span>
                ) : null}
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
    <section className={cn("premium-card scroll-mt-28 rounded-lg", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-white/30 px-5 py-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#E8F7EE] text-[#087A3D]">
            <Flag className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold leading-7 tracking-normal text-foreground">
              Latest round
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Newest scorecard or simulated-course round.
            </p>
          </div>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-white/70 text-[#2563EB]">
          <Flag className="size-5" />
        </span>
      </div>
      {latestRound ? (
        <div className="px-5 py-5">
          <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-6 text-[#111827]">
            <CalendarDays className="size-4 text-[#111827]" />
            <span>{formatDate(latestRound.date)}</span>
            <span className="text-[#667085]">·</span>
            <span className="rounded-full bg-[#E8F7EE] px-2.5 py-1 text-sm font-semibold leading-5 text-[#087A3D]">
              {formatSessionType(latestRound.type)}
            </span>
          </div>
          <h3 className="mt-3 text-[26px] font-bold leading-8 tracking-normal text-[#111827]">
            {latestRound.courseName ?? latestRound.fileName ?? "Untitled round"}
          </h3>
          <RoundScoreDisplay score={latestRound.totalScore} par={latestRound.totalPar} />
          <HoleResultStrip latestRound={latestRound} />
          <div className="mt-5 flex flex-wrap gap-3">
            <RoundSignalPill
              icon={Flag}
              label="Putts"
              value={
                typeof latestRound.totalPutts === "number"
                  ? integerFormatter.format(latestRound.totalPutts)
                  : "--"
              }
            />
            <RoundSignalPill
              icon={BarChart3}
              label="Differential"
              value={formatHandicapValue(latestRound.handicapDifferential)}
            />
          </div>
          {holeHighlights ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <RoundInsightTile icon={Star} label="Best hole" value={holeHighlights.best} />
              {holeHighlights.watch ? (
                <RoundInsightTile icon={Eye} label="Watch" value={holeHighlights.watch} />
              ) : null}
            </div>
          ) : null}
          <div className="mt-5">
            <Button asChild className="premium-action h-11 w-full rounded-lg text-sm font-semibold">
              <Link href={`/rounds/${latestRound.id}`} prefetch={false}>
                <Flag className="size-4" />
                Review round
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
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
    </section>
  );
}

function RoundScoreDisplay({ score, par }: { score: number | null; par: number | null }) {
  if (typeof score !== "number") {
    return (
      <p className="mt-4 text-[36px] font-bold leading-10 tracking-normal text-[#111827]">--</p>
    );
  }

  if (typeof par !== "number") {
    return (
      <p className="mt-4 text-[36px] font-bold leading-10 tracking-normal text-[#111827]">
        {integerFormatter.format(score)}
      </p>
    );
  }

  const versusPar = score - par;

  return (
    <p className="mt-4 text-[36px] font-bold leading-10 tracking-normal text-[#111827]">
      {integerFormatter.format(score)}{" "}
      <span className="text-2xl text-[#0B57D0]">
        ({versusPar >= 0 ? "+" : ""}
        {integerFormatter.format(versusPar)})
      </span>
    </p>
  );
}

function RoundSignalPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="inline-flex min-h-14 items-center gap-3 rounded-xl border border-[#DFE7DF] bg-white px-4 py-2 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <Icon className="size-5 text-[#087A3D]" />
      <span>
        <span className="block font-medium leading-5 text-[#667085]">{label}</span>
        <span className="block text-xl font-semibold leading-6 text-[#111827]">{value}</span>
      </span>
    </span>
  );
}

function RoundInsightTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <p className="flex min-h-12 items-center gap-3 rounded-xl border border-[#DFE7DF] bg-white px-4 py-3 text-sm text-[#667085]">
      <Icon className="size-5 shrink-0 text-[#087A3D]" />
      <span>
        <span className="font-semibold text-[#111827]">{label}:</span> {value}
      </span>
    </p>
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <Link
            key={item.label}
            href={item.clubId ? `/bag/${item.clubId}` : "/bag"}
            prefetch={false}
            className={cn(
              "group min-w-0 rounded-lg border border-[#DFE7DF] bg-white px-4 py-4 transition-colors hover:border-[#0F8F4D] hover:bg-[#F8FAF8]",
              index === 0 ? "xl:border-[#CFE7D6]" : "",
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
            <div className="mt-3 grid gap-2">
              <DataPair label="Call" value={courseDecisionCallLabel(item)} />
              <DataPair label="Expected leave" value={courseDecisionLeaveLabel(item)} />
            </div>
            <p className="mt-3 text-sm leading-5 text-[#667085]">{item.detail}</p>
          </Link>
        ))}
      </div>
    </DashboardPanel>
  );
}

function courseDecisionCallLabel(item: DashboardData["courseAdvice"][number]) {
  if (item.key === "200-out") {
    return "Lay up";
  }

  if (item.key === "180-tee") {
    return "Position";
  }

  if (item.key === "150-approach") {
    return "Hit stock";
  }

  return "Score";
}

function courseDecisionLeaveLabel(item: DashboardData["courseAdvice"][number]) {
  if (typeof item.expectedLeaveYd !== "number") {
    return "Build trust";
  }

  if (item.expectedLeaveYd === 0) {
    return "On number";
  }

  return `${formatYards(item.expectedLeaveYd)} pitch`;
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

function DashboardSocialPulse({
  social,
  className,
  compact = false,
}: {
  social: Awaited<ReturnType<typeof getFeedPageData>>;
  className?: string;
  compact?: boolean;
}) {
  const topItems = social.items.slice(0, 3);
  const pbCount = social.items.filter(
    (item) => item.itemType === "new_pb" || item.itemType === "longest_drive",
  ).length;

  if (compact) {
    return (
      <DashboardPanel
        title="Social pulse"
        description="Collapsed behind the golf analytics."
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
        <div className="grid gap-3 sm:grid-cols-2">
          <SocialStatLink
            href="/friends"
            label="Friends"
            value={social.friendCount.toString()}
            detail="Accepted golfers"
            icon={Users}
          />
          <SocialStatLink
            href="/feed?filter=pbs"
            label="Network PBs"
            value={pbCount.toString()}
            detail="Visible PB cards"
          />
        </div>
      </DashboardPanel>
    );
  }

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

function QuickActions({
  routes,
  commandRoutes,
}: {
  routes: DashboardRoute[];
  commandRoutes: DashboardCommandRoute[];
}) {
  const primaryRoutes = routes.slice(0, 6);
  const secondaryRoutes = routes.slice(6);

  const renderRoute = (route: DashboardRoute) => {
    const Icon = route.icon;

    return (
      <Link
        key={`${route.title}-${route.href}`}
        href={route.href}
        prefetch={false}
        aria-label={`${route.title}: ${route.description}`}
        title={`${route.title} - ${route.description}`}
        className="group grid size-12 place-items-center rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] transition-colors hover:border-[#0F8F4D] hover:bg-white"
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${route.accent}`}>
          <Icon className="size-4" />
        </span>
        <span className="sr-only">
          {route.title} {route.metric}
        </span>
      </Link>
    );
  };

  return (
    <DashboardPanel
      id="tools"
      title="Quick actions"
      description="Icon shortcuts for import, practice, shots, bag and rounds."
    >
      <div className="flex flex-wrap gap-2">{primaryRoutes.map(renderRoute)}</div>
      {secondaryRoutes.length > 0 ? (
        <details className="mt-3 rounded-lg border border-[#DFE7DF] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-[#111827] marker:hidden">
            <span>Find a tool</span>
            <span className="text-xs font-medium text-[#667085]">
              {secondaryRoutes.length} more
            </span>
          </summary>
          <div className="border-t border-[#E5E7EB] p-3">
            <DashboardCommandPalette routes={commandRoutes} />
          </div>
        </details>
      ) : null}
    </DashboardPanel>
  );
}

function toDashboardCommandRoutes(routes: DashboardRoute[]): DashboardCommandRoute[] {
  return routes.map((route) => ({
    title: route.title,
    description: route.description,
    href: route.href,
    metric: String(route.metric),
  }));
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
