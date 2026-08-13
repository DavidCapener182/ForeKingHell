import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
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
import { FacePathClubSelector } from "@/app/dashboard/face-path-club-selector";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { StatusTimeline, type StatusTimelineItem } from "@/components/app/status-timeline";
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
  formatScoreVsPar,
  formatSessionType,
  formatYards,
  getDashboardPracticeTask,
  integerFormatter,
  numberFormatter,
  normalizeDashboardTone,
  toneDotClass,
  toneSoftClass,
  type DashboardTone,
} from "@/app/dashboard/dashboard-formatters";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { getCurrentPracticePlanSummary } from "@/lib/practice-planner";
import { buildAiCaddieBrief, type AiCaddieBrief } from "@/lib/ai-caddie-brief";
import { formatHandicapValue } from "@/lib/round-handicap";
import type { DashboardPin } from "@/lib/user-settings";
import { getFeedPageData } from "@/lib/social";
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

  const userId = await requireCurrentUserId();
  const [params, data, social, featureData, currentPracticePlan] = await Promise.all([
    searchParams,
    getDashboardData(),
    getFeedPageData(),
    getFeatureIdeasData(),
    getCurrentPracticePlanSummary(userId),
  ]);
  const activeDashboardSection = parseDashboardSection(params?.section);
  const pinnedDashboardSections = new Set(data.dashboardPins);
  const primaryAction = data.stats.shotCount > 0 ? "/bag" : "/import";
  const primaryActionLabel = data.stats.shotCount > 0 ? "Open bag map" : "Import first CSV";
  const latestSession = data.recentSessions[0] ?? null;
  const bestClub = getBestClub(data.bagPreview);
  const mappedClubCount = data.bagPreview.filter((club) => club.stock.confidenceScore >= 60).length;
  const aiCaddieBrief = buildAiCaddieBrief({
    stats: {
      shotCount: data.stats.shotCount,
      sessionCount: data.stats.sessionCount,
      roundCount: data.stats.roundCount,
    },
    latestSession: latestSession
      ? {
          fileName: latestSession.fileName,
          dateLabel: formatDate(latestSession.date),
          shotCount: latestSession.shotCount,
          rawRowCount: latestSession.rawRowCount,
        }
      : null,
    rapsodoInbox: {
      pendingCount: data.rapsodoInbox.pendingCount,
      latest: data.rapsodoInbox.latest
        ? {
            title: data.rapsodoInbox.latest.title,
            shotCount: data.rapsodoInbox.latest.shotCount,
          }
        : null,
    },
    bagSummary: data.bagSummary,
    coachPreview: data.coachPreview,
    dataHealth: featureData.dataHealth,
    playContextSummary: data.playContextSummary,
    whatChanged: data.whatChanged,
    currentPracticePlan,
  });
  const metrics = [
    {
      pin: "shots" as const,
      label: "Golf database",
      value: integerFormatter.format(data.stats.shotCount),
      detail: latestSession
        ? `+${integerFormatter.format(latestSession.shotCount)} from latest import`
        : `${integerFormatter.format(data.stats.sessionCount)} saved sessions`,
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
      label: "Golf database",
      value: integerFormatter.format(data.stats.shotCount),
      detail: `${integerFormatter.format(data.stats.sessionCount)} saved sessions`,
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
      metric: data.coachPreview?.clubName ?? "Practice plan",
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
  const currentWorkItems: StatusTimelineItem[] = [];
  if (currentPracticePlan) {
    currentWorkItems.push({
      id: `plan-${currentPracticePlan.id}`,
      title: currentPracticePlan.title,
      description: `${currentPracticePlan.timeMinutes} minutes · ${currentPracticePlan.focusClubs.join(", ") || "Full bag"}`,
      status: currentPracticePlan.status,
      kind: "practice",
      href: "/practice",
    });
  }
  if (latestSession) {
    currentWorkItems.push({
      id: `session-${latestSession.id}`,
      timestamp: formatDate(latestSession.date),
      title: latestSession.fileName,
      description: `${integerFormatter.format(latestSession.shotCount)} measured shots imported`,
      status: "Latest practice",
      kind: "import",
      href: "/today",
    });
  }
  if (data.latestRound) {
    currentWorkItems.push({
      id: `round-${data.latestRound.id}`,
      timestamp: formatDate(data.latestRound.date),
      title: data.latestRound.courseName ?? data.latestRound.fileName ?? "Latest round",
      description:
        data.latestRound.totalScore !== null && data.latestRound.totalPar !== null
          ? `${data.latestRound.totalScore} strokes · ${formatScoreVsPar(data.latestRound.totalScore, data.latestRound.totalPar)}`
          : "Round evidence ready to review",
      status: "Round",
      kind: "round",
      href: `/rounds/${data.latestRound.id}`,
    });
  }
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
        aiCaddieBrief={aiCaddieBrief}
      />

      <DesktopWorkbenchLayout scope="dashboard" className="hidden lg:grid">
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

        <ConnectedMetricBar
          label="Current dashboard metrics"
          metrics={metrics.map((metric) => ({
            label: metric.label,
            value: metric.value,
            detail: metric.detail,
          }))}
        />

        <DriverStatusPanel pathTrend={data.pathTrend} />

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
          <DashboardPanel
            title="Current work"
            description="The latest plan, import and round evidence in one scannable sequence."
          >
            <StatusTimeline
              items={currentWorkItems}
              empty={
                <p className="text-sm text-muted-foreground">
                  Import a session or build a practice plan to start the timeline.
                </p>
              }
            />
          </DashboardPanel>
          <PracticeRecommendationCard
            coachPreview={data.coachPreview}
            primaryAction={primaryAction}
            primaryActionLabel={primaryActionLabel}
          />
        </section>

        {data.stats.shotCount === 0 ? <DashboardFirstRunOnboarding /> : null}
      </DesktopWorkbenchLayout>
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
  aiCaddieBrief,
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
  aiCaddieBrief: AiCaddieBrief;
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
    <div className="ios-mobile-screen grid w-full min-w-0 max-w-full gap-4 overflow-x-clip lg:hidden [&>*]:min-w-0">
      <DashboardMobileHeader initialActiveKey={activeDashboardSection} />

      <div
        id="dashboard-mobile-today"
        className="scroll-mt-[calc(6.75rem+env(safe-area-inset-top))]"
      />
      <DashboardAiCaddieBriefCard brief={aiCaddieBrief} />
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
        className="scroll-mt-[calc(6.75rem+env(safe-area-inset-top))]"
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
        className="scroll-mt-[calc(6.75rem+env(safe-area-inset-top))]"
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

function DashboardAiCaddieBriefCard({ brief }: { brief: AiCaddieBrief }) {
  const primaryBlock =
    brief.practice.blocks.find((block) => block.balls > 0) ?? brief.practice.blocks[0];

  return (
    <section
      aria-labelledby="dashboard-ai-caddie-title"
      data-mobile-surface="grouped"
      className="ios-grouped-list overflow-hidden bg-[var(--ios-grouped-surface)]"
    >
      <div className="ios-grouped-row p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[0.625rem] bg-[var(--ios-fill)] text-[var(--ios-tint)]">
                <Brain className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold leading-4 text-[var(--ios-label)]">
                  {brief.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-4 text-[var(--ios-secondary-label)]">
                  AI caddie · <span className="capitalize">{brief.confidence}</span> confidence
                </p>
              </div>
            </div>
            <h2
              id="dashboard-ai-caddie-title"
              className="mt-4 text-[1.75rem] font-bold leading-[1.13] tracking-[-0.025em] text-[var(--ios-label)]"
            >
              {brief.headline}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] font-medium text-[var(--ios-secondary-label)]">Session</p>
            <p className="mt-0.5 text-[20px] font-semibold tracking-[-0.015em] text-[var(--ios-label)]">
              {brief.practice.durationMinutes} min
            </p>
            <p className="text-[13px] text-[var(--ios-secondary-label)]">
              {brief.practice.ballCount ? `${brief.practice.ballCount} balls` : "Import first"}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-[1.47] text-[var(--ios-secondary-label)]">
          {brief.summary}
        </p>
      </div>

      <div className="ios-grouped-row p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-[var(--ios-secondary-label)]">
            Practice block
          </p>
          <span className="rounded-full bg-[var(--ios-fill)] px-2.5 py-1 text-[13px] font-semibold text-[var(--ios-label)]">
            {primaryBlock.balls} balls
          </span>
        </div>
        <p className="mt-2 text-[17px] font-semibold tracking-[-0.012em] text-[var(--ios-label)]">
          {primaryBlock.label}
        </p>
        <p className="mt-1 text-[15px] leading-[1.4] text-[var(--ios-secondary-label)]">
          {primaryBlock.task}
        </p>
        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-[0.625rem] bg-[var(--ios-fill)] px-3 py-2.5">
          <CheckCircle2 className="mt-0.5 size-4 text-[var(--ios-tint)]" aria-hidden />
          <p className="text-[14px] font-medium leading-5 text-[var(--ios-label)]">
            Success: {brief.practice.successMetric}
          </p>
        </div>
      </div>

      {brief.warnings.map((warning) => (
        <div
          key={warning}
          className="ios-grouped-row grid grid-cols-[auto_minmax(0,1fr)] gap-2 p-4"
        >
          <span className="mt-[0.42rem] size-2 rounded-full bg-[var(--ios-warning)]" aria-hidden />
          <div>
            <p className="text-[13px] font-medium text-[var(--ios-warning)]">Needs attention</p>
            <p className="mt-0.5 text-[14px] leading-5 text-[var(--ios-label)]">{warning}</p>
          </div>
        </div>
      ))}

      <div data-primary-action className="ios-grouped-row p-3">
        <Button asChild className="min-h-12 w-full rounded-[0.75rem] text-[17px] font-semibold">
          <Link href={brief.actions.primary.href} prefetch={false}>
            <Crosshair className="size-4" aria-hidden />
            {brief.actions.primary.label}
          </Link>
        </Button>
      </div>

      <nav aria-label="AI caddie actions" className="ios-grouped-row px-4">
        <div className="divide-y divide-[var(--ios-separator)]">
          {brief.actions.secondary.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              prefetch={false}
              className="focus-aaa flex min-h-12 items-center justify-between gap-3 text-[15px] font-medium text-[var(--ios-link)] outline-none"
            >
              <span>{action.label}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ))}
        </div>
      </nav>

      <div
        id="dashboard-caddie-evidence"
        className="ios-grouped-row flex scroll-mt-28 items-baseline justify-between gap-3 px-4 py-3"
      >
        <p className="text-[17px] font-semibold tracking-[-0.012em] text-[var(--ios-label)]">
          Data used
        </p>
        <span className="text-[13px] text-[var(--ios-secondary-label)]">Structured JSON</span>
      </div>

      {brief.dataUsed.slice(0, 4).map((item) => (
        <div
          key={item.label}
          className="ios-grouped-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-[13px] text-[var(--ios-secondary-label)]">{item.label}</p>
            <p className="mt-0.5 truncate text-[16px] font-semibold tracking-[-0.01em] text-[var(--ios-label)]">
              {item.value}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-[1.35] text-[var(--ios-secondary-label)]">
              {item.detail}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px] font-medium capitalize",
              item.status === "ready"
                ? "text-[var(--ios-link)]"
                : item.status === "limited"
                  ? "text-[var(--ios-warning)]"
                  : "text-[var(--ios-secondary-label)]",
            )}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {item.status}
          </span>
        </div>
      ))}

      <p className="ios-grouped-row px-4 py-3 text-[13px] leading-5 text-[var(--ios-secondary-label)]">
        {brief.confidenceReason}
      </p>
    </section>
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
          <p className="text-[17px] font-semibold tracking-[-0.012em] text-[var(--ios-label)]">
            {title}
          </p>
          {description ? (
            <p className="mt-0.5 text-[13px] leading-[1.35] text-[var(--ios-secondary-label)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : count ? (
          <span className="shrink-0 rounded-full bg-[var(--ios-fill)] px-2.5 py-1 text-[13px] font-medium text-[var(--ios-secondary-label)]">
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
          data-mobile-surface="grouped"
          className="ios-grouped-list block p-4 transition-colors active:bg-[var(--ios-fill)]"
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
        <div data-mobile-surface="grouped" className="ios-grouped-list p-5">
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
            data-mobile-surface="grouped"
            className="ios-grouped-list block p-4 active:bg-[var(--ios-fill)]"
          >
            <p className="text-lg font-semibold tracking-normal">{formatClubType(club.type)}</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">{club.brandModel}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="Carry" value={formatYards(club.stock.carryMedianYd)} />
              <MiniMetric label="Play" value={formatYards(club.stock.recommendedPlayNumberYd)} />
              <MiniMetric label="Trust" value={`${club.stock.confidenceScore}%`} />
              <MiniMetric label="Miss" value={formatStockMiss(club.stock)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[13px] font-medium",
                  club.stock.confidenceScore < 35
                    ? "text-[var(--ios-warning)]"
                    : club.stock.confidenceScore < 60
                      ? "text-[var(--ios-secondary-label)]"
                      : "text-[var(--ios-link)]",
                )}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                {club.stock.label}
              </span>
              {club.stock.sampleSize < 20 ? (
                <span className="text-[13px] font-medium text-[var(--ios-secondary-label)]">
                  Needs {formatShotCount(20 - club.stock.sampleSize, "clean")}
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
          <div data-mobile-surface="grouped" className="ios-grouped-list p-4">
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
        <div data-mobile-surface="grouped" className="ios-grouped-list p-6">
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
                data-mobile-surface="grouped"
                className="ios-grouped-list block min-h-28 p-3 active:bg-[var(--ios-fill)]"
              >
                <div className="mb-3 grid size-10 place-items-center rounded-[0.625rem] bg-[var(--ios-fill)] text-[var(--ios-tint)]">
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
      <div
        className={cn(
          "grid",
          compactMobile ? "ios-grouped-list gap-0" : "gap-2 sm:grid-cols-2 xl:grid-cols-7",
        )}
      >
        {steps.map((step, index) => (
          <Link
            key={step.title}
            href={step.href}
            prefetch={false}
            className={cn(
              "text-sm transition-colors",
              compactMobile
                ? "ios-grouped-row p-4 active:bg-[var(--ios-fill)]"
                : "apple-panel-strong p-3 hover:border-emerald-300 hover:bg-emerald-50/35",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-md text-xs font-semibold",
                  compactMobile
                    ? "bg-[var(--ios-fill)] text-[var(--ios-secondary-label)]"
                    : "bg-[#F5F6F4]",
                )}
              >
                {index + 1}
              </span>
              {step.ready ? (
                <CheckCircle2
                  className={cn(
                    "size-4",
                    compactMobile ? "text-[var(--ios-tint)]" : "text-emerald-700",
                  )}
                />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">Next</span>
              )}
            </div>
            <p className="mt-3 font-semibold leading-5">{step.title}</p>
            <p className="mt-1 leading-5 text-muted-foreground">{step.detail}</p>
          </Link>
        ))}
      </div>
      <div
        className={cn(
          "mt-3 rounded-lg p-3",
          compactMobile ? "bg-[var(--ios-fill)]" : "trust-indicator",
        )}
      >
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
    <section data-mobile-surface="grouped" className="ios-grouped-list grid gap-3 p-4 lg:hidden">
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
        data-mobile-surface="grouped"
        className="ios-grouped-list grid gap-3 px-3 py-3 text-sm transition-colors active:bg-[var(--ios-fill)]"
      >
        <div className="grid grid-cols-2 gap-2">
          <DataPair label="Friends" value={social.friendCount.toString()} />
          <DataPair label="Network PBs" value={pbCount.toString()} />
        </div>
        {topItem ? (
          <div className="border-t border-[var(--ios-separator)] pt-3">
            <p className="font-semibold leading-5">{topItem.headline}</p>
            <p className="mt-1 line-clamp-2 text-muted-foreground">
              {topItem.metricValue
                ? `${topItem.metricLabel ?? "Metric"} ${topItem.metricValue}`
                : (topItem.context ?? "Social update")}
            </p>
          </div>
        ) : (
          <p className="border-t border-[var(--ios-separator)] pt-3 text-muted-foreground">
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
    <div className="rounded-[0.625rem] bg-[var(--ios-fill)] px-3 py-2">
      <p className="text-[13px] font-medium text-[var(--ios-secondary-label)]">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tracking-normal text-[var(--ios-label)]">
        {value}
      </p>
    </div>
  );
}

function HeroMissionMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-[4rem] shrink-0", className)}>
      <p className="text-[19px] font-bold leading-6 tracking-normal text-[#111827]">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-normal text-[#667085]">{label}</p>
    </div>
  );
}

function RoundMetric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex items-center justify-between rounded-[0.625rem] bg-[var(--ios-fill)] px-3 py-2.5">
      <span className="text-[15px] text-[var(--ios-secondary-label)]">{label}</span>
      <span className="font-semibold text-[var(--ios-label)]">
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
        "@container/dashboard-card premium-card flex h-full scroll-mt-28 flex-col rounded-lg",
        className,
      )}
    >
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
      <div className="flex-1 px-6 py-5">{children}</div>
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
  const driverTrendPoints = pathTrend.points.filter((point) => point.pathDeg !== null).slice(-4);
  const driverImprovementLabel = formatDriverImprovementLabel(driverTrendPoints);
  const driverDeliveryStory = formatDriverDeliveryStory(pathTrend.points);
  const developmentTargetCopy = getDevelopmentTargetCopy(coachPreview);
  const trendBadge = getHeroTrendBadge(pathTrend, driverImprovementLabel);
  const dashboardRead = buildDashboardIntelligenceSentence({
    coachPreview,
    bagSummary,
    pathTrend,
    firstChange,
  });
  const driverImprovementValue = driverImprovementLabel?.replace("Improved ", "") ?? "Steady";
  const driverImprovementMetricLabel = driverImprovementLabel ? "Improved" : "Delivery";
  const latestFaceDeg =
    [...pathTrend.points].reverse().find((point) => point.faceDeg !== null)?.faceDeg ??
    pathTrend.recentShots[0]?.faceDeg ??
    null;
  const scoringZone =
    bagSummary.scoringZones.find((zone) => !zone.isSuggested && zone.fullCarryYd !== null) ??
    bagSummary.scoringZones[0] ??
    null;
  const focusReasons = coachPreview
    ? [
        driverImprovementLabel
          ? `${driverImprovementLabel}. Delivery is moving closer to neutral.`
          : coachPreview.reason,
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
  const focusSummary = focusReasons.join(" · ");

  return (
    <section className="premium-hero relative overflow-hidden rounded-lg">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(248,250,248,0.92)_0%,rgba(255,255,255,0.46)_48%,rgba(236,247,241,0.62)_100%)]" />
        <div className="absolute right-0 top-0 h-full w-[46%] border-l border-[#DCECE0] bg-[repeating-linear-gradient(90deg,rgba(15,143,77,0.10)_0,rgba(15,143,77,0.10)_1px,transparent_1px,transparent_54px)]" />
        <div className="absolute right-10 bottom-9 h-px w-72 -rotate-6 bg-[#9DCFB0]" />
        <div className="absolute right-32 bottom-20 h-px w-52 -rotate-6 bg-[#C8D9FF]" />
        <ShotTraceMotif className="absolute right-8 bottom-5 h-24 w-72 text-emerald-700/25" />
      </div>

      <div className="relative grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:items-stretch">
        <div className="h-full rounded-[22px] bg-white/96 p-4 shadow-[0_16px_34px_rgba(8,122,61,0.11)] ring-1 ring-[#E4EFE7]">
          <div>
            <div className="mb-3 rounded-[16px] border border-[#DCECE0] bg-[#F8FAF8] px-3 py-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#087A3D]">
                Coach read
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[#111827]">{dashboardRead}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F7EE] px-2.5 py-1 text-xs font-bold leading-4 text-[#087A3D] ring-1 ring-[#CFE7D6]">
                <Target className="size-3.5" />
                Today&apos;s focus
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2.5 py-1 text-xs font-bold leading-4 text-[#087A3D] ring-1 ring-[#CFE7D6]">
                <CheckCircle2 className="size-3.5" />
                {coachPreview ? `${coachPreview.trustIndex}% confidence` : "Build baseline"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8ED] px-2.5 py-1 text-xs font-bold leading-4 text-[#A94B00] ring-1 ring-[#F8D9A4]">
                <LineChart className="size-3.5" />
                {trendBadge}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8FAF8] px-2.5 py-1 text-xs font-bold leading-4 text-[#375041] ring-1 ring-[#DCECE0]">
                <Database className="size-3.5" />
                {coachPreview
                  ? `${integerFormatter.format(coachPreview.sampleSize)} stock shots`
                  : `${integerFormatter.format(bagSummary.mappedClubCount)} mapped clubs`}
              </span>
              {latestSession ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF1FF] px-2.5 py-1 text-xs font-bold leading-4 text-[#2563EB] ring-1 ring-[#CFDAFF]">
                  <CalendarDays className="size-3.5" />
                  Latest import {formatDate(latestSession.date)}
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 max-w-3xl text-[42px] font-bold leading-[2.8rem] tracking-normal text-[#111827] xl:text-[48px] xl:leading-[3.15rem]">
              {practiceTitle}
            </h1>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <FocusContextTile
                label="Development focus"
                value={practiceTitle}
                detail={developmentTargetCopy}
                tone="green"
              />
              <FocusContextTile
                label="Latest session focus"
                value={firstChange ? firstChange.label : "Latest practice signal"}
                detail={
                  firstChange
                    ? `${firstChange.value} · ${firstChange.detail}`
                    : latestSession
                      ? `${formatDate(latestSession.date)} · open latest practice for the session read.`
                      : "Import a session to separate latest result from the development plan."
                }
                tone={firstChange ? normalizeDashboardTone(firstChange.tone) : "sky"}
              />
            </div>
            <div className="mt-3 rounded-[16px] bg-[#F8FAF8] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(220,236,224,0.72)]">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="min-w-[10rem] pr-2">
                  <p className="text-xs font-bold uppercase tracking-normal text-[#667085]">
                    Driver delivery
                  </p>
                  <p className="mt-1 text-[24px] font-bold leading-7 tracking-normal text-[#111827]">
                    {driverStatus.label}
                  </p>
                </div>
                <HeroMissionMetric
                  label="Trust"
                  value={
                    coachPreview
                      ? `${coachPreview.trustIndex}%`
                      : (dataHealth.metric ?? dataHealth.status)
                  }
                />
                <HeroMissionMetric label="Round ready" value={`${readiness.score}%`} />
                <HeroMissionMetric
                  label={driverImprovementMetricLabel}
                  value={driverImprovementValue}
                />
                <HeroMissionMetric label="Path" value={formatSignedDegrees(driverStatus.pathDeg)} />
                <HeroMissionMetric label="Face" value={formatSignedDegrees(latestFaceDeg)} />
                <HeroMissionMetric
                  label="F-P"
                  value={formatSignedDegrees(driverStatus.faceToPathDeg)}
                />
                <HeroMissionMetric
                  label="Shots"
                  value={
                    coachPreview
                      ? integerFormatter.format(coachPreview.sampleSize)
                      : integerFormatter.format(bagSummary.mappedClubCount)
                  }
                />
              </div>
            </div>
            <div className="mt-3 rounded-[16px] bg-[#F0FAF3] px-3 py-2.5">
              <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.85fr)] xl:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#087A3D]">
                    Development target
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#111827]">
                    {driverDeliveryStory ?? expectedGain}
                  </p>
                </div>
                <p className="text-xs font-medium leading-5 text-[#526071]">
                  {developmentTargetCopy} {focusSummary}
                </p>
              </div>
            </div>
          </div>
          <FacePathClubSelector
            pathTrend={pathTrend}
            compact
            className="mt-3"
            action={
              <Link
                href={practiceHref}
                prefetch={false}
                className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-xl bg-[#087A3D] px-4 text-sm font-bold text-white shadow-[0_14px_28px_rgba(8,122,61,0.18)] outline-none transition-colors hover:bg-[#065F32] focus-visible:ring-3 focus-visible:ring-[#087A3D]/30"
              >
                Start practice
                <ArrowRight className="size-4" />
              </Link>
            }
          />
        </div>

        <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] items-stretch gap-3">
          <RoundReadinessCard readiness={readiness} />
          <SinceLastSessionCard insights={whatChanged} />
        </div>
      </div>

      <div className="relative grid auto-rows-fr gap-4 border-t border-[#EDF1ED] bg-white/78 px-6 py-3 lg:grid-cols-4">
        <HeroInsightCard
          title="Scoring trend"
          value={formatScoringCeilingValue(scoringCeiling)}
          detail={`${scoringTrend} · ${integerFormatter.format(scoringSampleSize)} comparable rounds`}
          href="/rounds"
          tone="amber"
        />
        <HeroInsightCard
          title="Most trusted historically"
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
          value={readiness.driver}
          detail={`${driverStatus.label} · Path ${formatSignedDegrees(driverStatus.pathDeg)} · F-P ${formatSignedDegrees(
            driverStatus.faceToPathDeg,
          )}`}
          href={pathTrend.clubId ? `/bag/${pathTrend.clubId}` : "/bag"}
          tone={driverStatus.tone}
        />
        <HeroInsightCard
          title="Best course scoring club"
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

function FocusContextTile({
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
    <div className="rounded-[16px] border border-[#DFE7DF] bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
        <DashboardDot tone={tone} />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-bold leading-5 text-[#111827]">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667085]">{detail}</p>
    </div>
  );
}

function formatDriverDeliveryStory(points: DashboardData["pathTrend"]["points"]) {
  const measured = getMeasuredPathPoints(points);

  if (measured.length < 2) {
    return null;
  }

  const first = measured[0];
  const latest = measured[measured.length - 1];

  return `Delivery moving from ${formatSignedDegrees(first.pathDeg)} to ${formatSignedDegrees(latest.pathDeg)} path.`;
}

function getMeasuredPathPoints(points: DashboardData["pathTrend"]["points"]) {
  return points.filter(
    (point): point is (typeof points)[number] & { pathDeg: number } =>
      typeof point.pathDeg === "number" && Number.isFinite(point.pathDeg),
  );
}

function getHeroTrendBadge(
  pathTrend: DashboardData["pathTrend"],
  driverImprovementLabel: string | null,
) {
  if (pathTrend.status === "neutralising" || driverImprovementLabel) {
    return "Improving trend";
  }

  if (pathTrend.status === "widening") {
    return "Watch trend";
  }

  return pathTrend.label;
}

function getDevelopmentTargetCopy(coachPreview: DashboardData["coachPreview"]) {
  if (!coachPreview) {
    return "Import a clean session to unlock the first development focus.";
  }

  const clubLabel =
    coachPreview.clubName.toLowerCase() === "driver"
      ? "stock drivers"
      : `stock ${coachPreview.clubName} shots`;

  return `Keep the next 10 ${clubLabel} inside the neutral window.`;
}

function buildDashboardIntelligenceSentence({
  coachPreview,
  bagSummary,
  pathTrend,
  firstChange,
}: {
  coachPreview: DashboardData["coachPreview"];
  bagSummary: DashboardData["bagSummary"];
  pathTrend: DashboardData["pathTrend"];
  firstChange: DashboardInsight | null;
}) {
  if (coachPreview && pathTrend.status === "neutralising") {
    const trustedClub = bagSummary.mostTrusted?.label
      ? ` Trust ${bagSummary.mostTrusted.label} on-course while that delivery settles.`
      : "";
    const sessionCue = firstChange
      ? ` Latest-session signal: ${firstChange.label.toLowerCase()} ${firstChange.value}.`
      : "";

    return `${coachPreview.clubName} delivery is moving toward neutral, so keep the work narrow and measured.${trustedClub}${sessionCue}`;
  }

  if (coachPreview) {
    return `${coachPreview.clubName} is the development job today. ${getDashboardPracticeTask(
      coachPreview,
    )}`;
  }

  if (bagSummary.mappedClubCount > 0) {
    return `${integerFormatter.format(
      bagSummary.mappedClubCount,
    )} clubs are mapped. Add the next clean import to turn the dashboard into a practice plan.`;
  }

  return "Import one clean launch-monitor session and the dashboard can separate practice, bag and scoring priorities.";
}

function formatScoringCeilingValue(scoringCeiling: string) {
  if (scoringCeiling === "--") {
    return "Building";
  }

  return `${scoringCeiling} ceiling`;
}

const DRIVER_PATH_TARGET = { min: 2, max: 5 };
const DRIVER_FACE_TARGET = { min: 3, max: 5 };

function formatDriverImprovementLabel(points: DashboardData["pathTrend"]["points"]) {
  const measured = points.filter(
    (point): point is (typeof points)[number] & { pathDeg: number } =>
      typeof point.pathDeg === "number" && Number.isFinite(point.pathDeg),
  );

  if (measured.length < 2) {
    return null;
  }

  const first = measured[0].pathDeg;
  const latest = measured[measured.length - 1].pathDeg;
  const changeTowardNeutral = Math.abs(first) - Math.abs(latest);

  if (changeTowardNeutral <= 0.05) {
    return null;
  }

  return `Improved ${formatUnsignedDegrees(changeTowardNeutral)}`;
}

function formatUnsignedDegrees(value: number) {
  const rounded = Math.round(Math.abs(value) * 10) / 10;

  return `${numberFormatter.format(rounded)} deg`;
}

function driverAngleTargetState(
  value: number | null | undefined,
  window: { min: number; max: number },
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      label: "Needs data",
      tone: "slate" as DashboardTone,
    };
  }

  if (value >= window.min && value <= window.max) {
    return {
      label: "OK",
      tone: "green" as DashboardTone,
    };
  }

  return {
    label: value > window.max ? "Slightly open" : "Slightly closed",
    tone: "amber" as DashboardTone,
  };
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
        "group premium-rail-card block h-full rounded-lg p-4 transition-colors",
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
  driverTone: DashboardTone;
  irons: string;
  ironsTone: DashboardTone;
  wedges: string;
  wedgesTone: DashboardTone;
  recommended: string;
};

function RoundReadinessCard({
  readiness,
  className,
}: {
  readiness: RoundReadiness;
  className?: string;
}) {
  const ringStyle = {
    "--readiness-angle": `${readiness.score * 3.6}deg`,
  } as CSSProperties;

  return (
    <section className={cn("premium-card rounded-lg p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold leading-5 text-[#111827]">Round readiness</p>
          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Driver, bag trust and scoring-zone calibration.
          </p>
        </div>
        <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
      </div>
      <div className="mt-5 grid items-center gap-4 xl:grid-cols-[10rem_minmax(0,1fr)]">
        <div
          className="mx-auto grid size-40 place-items-center rounded-full bg-[conic-gradient(#087A3D_var(--readiness-angle),#E7EFE9_0deg)] p-2.5 shadow-inner xl:mx-0"
          style={ringStyle}
        >
          <div className="grid size-full place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(220,236,224,0.85)]">
            <div>
              <p className="text-[38px] font-bold leading-none tracking-normal text-[#111827]">
                {readiness.score}%
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-normal text-[#667085]">
                Round ready
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <ReadinessRow label="Driver" value={readiness.driver} tone={readiness.driverTone} />
          <ReadinessRow label="Irons" value={readiness.irons} tone={readiness.ironsTone} />
          <ReadinessRow label="Wedges" value={readiness.wedges} tone={readiness.wedgesTone} />
        </div>
      </div>
      <div className="mt-4 rounded-[16px] bg-[#F8FAF8] px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">Recommended</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-[#111827]">
          {readiness.recommended}
        </p>
      </div>
    </section>
  );
}

function ReadinessRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: DashboardTone;
}) {
  return (
    <p
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm",
        toneSoftClass(tone),
      )}
    >
      <span className="flex items-center gap-2 font-medium text-[#111827]">
        <DashboardDot tone={tone} />
        {label}
      </span>
      <span className="text-right font-semibold text-[#111827]">{value}</span>
    </p>
  );
}

function SinceLastSessionCard({
  insights,
  className,
}: {
  insights: DashboardInsight[];
  className?: string;
}) {
  return (
    <section className={cn("premium-card rounded-lg p-5", className)}>
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
  const driverLabel = getRoundReadinessDriverLabel(pathTrend, driverStatus);
  const wedgeLabel = bagSummary.scoringZones.some((zone) => zone.isSuggested)
    ? "Calibrating"
    : wedgeScore >= 75
      ? "Ready"
      : wedgeScore >= 50
        ? "Calibrating"
        : "Needs data";
  const trustedRatio =
    bagSummary.mappedClubCount > 0 ? bagSummary.trustedClubCount / bagSummary.mappedClubCount : 0;
  const ironsTone: DashboardTone =
    bagSummary.mappedClubCount === 0
      ? "slate"
      : trustedRatio >= 0.75
        ? "green"
        : trustedRatio >= 0.5
          ? "amber"
          : "pink";
  const wedgesTone: DashboardTone = bagSummary.scoringZones.some((zone) => zone.isSuggested)
    ? "amber"
    : wedgeScore >= 75
      ? "green"
      : wedgeScore >= 50
        ? "amber"
        : "pink";
  const recommended = coachPreview
    ? getDashboardPracticeTask(coachPreview)
    : bagSummary.leastTrusted?.needsShots
      ? `Add ${formatShotCount(bagSummary.leastTrusted.needsShots, bagSummary.leastTrusted.label)} before next round.`
      : "Import a clean session before the next round.";

  return {
    score,
    label,
    tone,
    driver: driverLabel,
    driverTone: driverStatus.tone,
    irons: `${bagSummary.trustedClubCount}/${bagSummary.mappedClubCount} trusted`,
    ironsTone,
    wedges: wedgeLabel,
    wedgesTone,
    recommended,
  };
}

function getRoundReadinessDriverLabel(
  pathTrend: DashboardData["pathTrend"],
  driverStatus: ReturnType<typeof getDriverStatus>,
) {
  const latestPoint =
    [...pathTrend.points].reverse().find((point) => point.pathDeg !== null) ?? null;
  const latestShot = pathTrend.recentShots[0] ?? null;
  const faceDeg = latestPoint?.faceDeg ?? latestShot?.faceDeg ?? null;
  const pathState = driverAngleTargetState(driverStatus.pathDeg, DRIVER_PATH_TARGET);
  const faceState = driverAngleTargetState(faceDeg, DRIVER_FACE_TARGET);

  if (pathState.tone === "green" && faceState.tone === "green") {
    return "Path healthy";
  }

  if (pathState.tone === "green" && faceState.tone === "amber") {
    return `Face ${faceState.label.toLowerCase()}`;
  }

  if (pathState.tone === "amber") {
    return "Path outside window";
  }

  return driverStatus.label;
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

function formatShotCount(count: number, qualifier?: string) {
  const shotLabel = count === 1 ? "shot" : "shots";
  const qualifierLabel = qualifier ? `${qualifier} ` : "";

  return `${integerFormatter.format(count)} ${qualifierLabel}${shotLabel}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function DriverStatusPanel({
  pathTrend,
  className,
}: {
  pathTrend: DashboardData["pathTrend"];
  className?: string;
}) {
  const status = getDriverStatus(pathTrend);
  const measuredPathPoints = getMeasuredPathPoints(pathTrend.points);
  const previousPoint =
    measuredPathPoints.length >= 2 ? measuredPathPoints[0] : (measuredPathPoints[0] ?? null);
  const currentPoint = measuredPathPoints[measuredPathPoints.length - 1] ?? null;
  const latestPoint =
    [...pathTrend.points].reverse().find((point) => point.pathDeg !== null) ?? null;
  const sampleSize = latestPoint?.sampleSize ?? pathTrend.recentShots.length;

  return (
    <DashboardPanel
      className={className}
      title="Driver status"
      description="One-glance path and face-to-path from the latest measured driver trend."
      action={
        <Button asChild variant="outline" className="rounded-lg">
          <Link href={pathTrend.clubId ? `/bag/${pathTrend.clubId}` : "/bag"} prefetch={false}>
            <BarChart3 className="size-4" />
            Open trend
          </Link>
        </Button>
      }
    >
      <div className="grid h-full min-w-0 content-between gap-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 rounded-lg border border-[#DFE7DF] bg-[#F8FAF8] px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
              Current trend
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold leading-8 tracking-normal text-[#111827]">
              <LineChart className="size-5 text-[#087A3D]" />
              {status.label}
            </p>
          </div>
          <StatusPill tone={status.tone}>{pathTrend.label}</StatusPill>
        </div>
        <div className="min-w-0 rounded-lg border border-[#DFE7DF] bg-white px-4 py-3">
          <div className="grid min-w-0 gap-2 @[34rem]/dashboard-card:grid-cols-3">
            <DataPair
              label="Previous"
              value={formatSignedDegrees(previousPoint?.pathDeg ?? null)}
            />
            <DataPair label="Current" value={formatSignedDegrees(currentPoint?.pathDeg ?? null)} />
            <DataPair label="Target" value="0 deg" />
          </div>
          <DriverPathProgress previous={previousPoint?.pathDeg ?? null} current={status.pathDeg} />
        </div>
        <div className="grid min-w-0 gap-2 @[34rem]/dashboard-card:grid-cols-3">
          <DataPair label="Path" value={formatSignedDegrees(status.pathDeg)} />
          <DataPair label="Window" value="+/-5 deg" />
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

function DriverPathProgress({
  previous,
  current,
}: {
  previous: number | null;
  current: number | null;
}) {
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-[#EEF2F0]">
        <span className="absolute left-1/2 top-1/2 h-5 w-px -translate-y-1/2 bg-[#087A3D]" />
        <DriverPathMarker value={previous} label="Previous" tone="amber" />
        <DriverPathMarker value={current} label="Current" tone="green" />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
        <span>Outside</span>
        <span>Neutral</span>
        <span>Outside</span>
      </div>
    </div>
  );
}

function DriverPathMarker({
  value,
  label,
  tone,
}: {
  value: number | null;
  label: string;
  tone: "green" | "amber";
}) {
  if (value === null) {
    return null;
  }

  const left = clampNumber(((value + 10) / 20) * 100, 4, 96);

  return (
    <span
      className={cn(
        "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_3px_rgba(17,24,39,0.08)]",
        tone === "green" ? "bg-[#087A3D]" : "bg-[#B87500]",
      )}
      style={{ left: `${left}%` }}
      role="img"
      aria-label={`${label}: ${formatSignedDegrees(value)}`}
      title={`${label}: ${formatSignedDegrees(value)}`}
    />
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
  const expectedImprovement = coachPreview ? getPracticeExpectedImprovement(coachPreview) : null;

  return (
    <section
      id="practice"
      className={cn(
        "premium-card flex h-full scroll-mt-28 flex-col rounded-lg p-5 lg:p-6",
        className,
      )}
    >
      {coachPreview ? (
        <div className="grid h-full content-between gap-5">
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
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <PracticePayoffPill label="Estimated time" value="15 mins" />
              {expectedImprovement ? (
                <PracticePayoffPill label="Expected improvement" value={expectedImprovement} />
              ) : null}
            </div>
            <PracticeReasonText reason={coachPreview.reason} />
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

function PracticePayoffPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid min-h-14 rounded-lg border border-[#DFE7DF] bg-white px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">{label}</span>
      <span className="mt-1 text-sm font-bold leading-5 text-[#111827]">{value}</span>
    </span>
  );
}

function getPracticeExpectedImprovement(coachPreview: NonNullable<DashboardData["coachPreview"]>) {
  const issue = coachPreview.issueLabel.toLowerCase();
  const reason = coachPreview.reason.toLowerCase();

  if (issue.includes("delivery") || reason.includes("path")) {
    return "Neutral start line";
  }

  if (issue.includes("trust")) {
    return "+12 clean stock shots";
  }

  return "Cleaner stock window";
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

function toDashboardCommandRoutes(routes: DashboardRoute[]): DashboardCommandRoute[] {
  return routes.map((route) => ({
    title: route.title,
    description: route.description,
    href: route.href,
    metric: String(route.metric),
  }));
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
