import { DriverDevelopmentPanel } from "@/components/analysis/driver-development-panel";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crosshair,
  Database,
  Gauge,
  LineChart,
  Target,
  Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FacePathClubSelector } from "@/app/dashboard/face-path-club-selector";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { StatusTimeline, type StatusTimelineItem } from "@/components/app/status-timeline";
import { Button } from "@/components/ui/button";
import {
  DataPair,
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import {
  getDashboardData,
  type DashboardData,
  type DashboardInsight,
} from "@/app/dashboard/dashboard-data";
import {
  formatDate,
  formatHandicapTrend,
  formatScoreVsPar,
  formatYards,
  getDashboardPracticeTask,
  integerFormatter,
  numberFormatter,
  normalizeDashboardTone,
  toneDotClass,
  toneSoftClass,
  type DashboardTone,
} from "@/app/dashboard/dashboard-formatters";
import { requireCurrentUserId } from "@/lib/current-user";
import { formatClubType } from "@/lib/club-format";
import { getCurrentPracticePlanSummary } from "@/lib/practice-planner";
import { formatHandicapValue } from "@/lib/round-handicap";
import { getFeatureIdeasData, type FeatureIdeasData } from "@/lib/feature-ideas";
import { getSpeedCoachCardData } from "@/lib/speed-training-data";
import type { SpeedDevelopmentSummary } from "@/lib/speed-development";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default async function DashboardPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    return <MissingDatabaseUrlSetup />;
  }

  const userId = await requireCurrentUserId();
  const [data, featureData, currentPracticePlan, speedCoachData] = await Promise.all([
    getDashboardData(),
    getFeatureIdeasData(),
    getCurrentPracticePlanSummary(userId),
    getSpeedCoachCardData(userId),
  ]);
  const pinnedDashboardSections = new Set(data.dashboardPins);
  const primaryAction = data.stats.shotCount > 0 ? "/bag" : "/import";
  const primaryActionLabel = data.stats.shotCount > 0 ? "Open bag map" : "Import first CSV";
  const latestSession = data.recentSessions[0] ?? null;
  const bestClub = getBestClub(data.bagPreview);
  const mappedClubCount = data.bagPreview.filter((club) => club.stock.confidenceScore >= 60).length;
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
      <DesktopWorkbenchLayout scope="dashboard">
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

        <DriverDevelopmentPanel compact />

        <DriverStatusPanel pathTrend={data.pathTrend} />

        <DashboardSpeedDevelopmentCard development={speedCoachData.development} />

        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
          <DashboardPanel
            title="Current work"
            description="The latest plan, import and round evidence in one scannable sequence."
          >
            <StatusTimeline
              items={currentWorkItems}
              empty={
                <AppEmptyState
                  icon={<CalendarDays className="size-5" aria-hidden />}
                  title="No current work yet"
                  description="Import a session or build a practice plan to start the timeline."
                  primaryAction={
                    <Button asChild size="sm">
                      <Link href="/import">Import a session</Link>
                    </Button>
                  }
                  secondaryAction={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/practice">Build a practice plan</Link>
                    </Button>
                  }
                />
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

function DashboardSpeedDevelopmentCard({ development }: { development: SpeedDevelopmentSummary }) {
  const nextIngredient =
    development.project.ingredients.find((ingredient) => ingredient.status === "needs_work") ??
    development.project.ingredients.find((ingredient) => ingredient.status === "unmeasured") ??
    null;
  const nextLevel = development.ladder.nextLevelMph;
  const speedIngredient = development.project.ingredients.find(
    (ingredient) => ingredient.key === "speed",
  );
  const ballSpeedIngredient = development.project.ingredients.find(
    (ingredient) => ingredient.key === "ball_speed",
  );
  const currentCarry = development.project.currentBestCarryYd;
  const carryGap = development.project.gapYd;
  const nextRecommendedDate = development.readiness.nextRecommendedDateIso
    ? new Date(development.readiness.nextRecommendedDateIso)
    : null;

  return (
    <Card className="overflow-hidden" data-dashboard-speed-development>
      <CardHeader className="flex-row items-start justify-between gap-4 border-b bg-muted/20 px-6 py-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">{development.project.label}</CardTitle>
            <StatusPill tone={development.readiness.tone}>{development.readiness.label}</StatusPill>
          </div>
          <CardDescription className="mt-1 max-w-4xl leading-6">
            {development.project.coachMessage}
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/speed" prefetch={false}>
            Open Speed Centre
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
        <SpeedDevelopmentReadout
          icon={<Target className="size-4" aria-hidden />}
          label="Project carry"
          value={
            currentCarry === null ? "Needs evidence" : `${numberFormatter.format(currentCarry)} yd`
          }
          detail={
            currentCarry === null
              ? `Add measured driver carry to track the ${development.project.targetCarryYd} yd target.`
              : carryGap !== null && carryGap > 0
                ? `${numberFormatter.format(carryGap)} yd to ${development.project.targetCarryYd} yd.`
                : `${development.project.targetCarryYd} yd target reached in the current evidence.`
          }
        />
        <SpeedDevelopmentReadout
          icon={<Gauge className="size-4" aria-hidden />}
          label="Next physical target"
          value={
            nextLevel !== null
              ? `${nextLevel} mph`
              : speedIngredient
                ? speedIngredient.target
                : "Maintain gains"
          }
          detail={
            nextLevel !== null
              ? "Hold the level across three qualifying speed sessions."
              : speedIngredient
                ? `Playing speed: ${speedIngredient.current}.`
                : "Driver speed target needs measured evidence."
          }
        />
        <SpeedDevelopmentReadout
          icon={<Crosshair className="size-4" aria-hidden />}
          label="Next performance target"
          value={ballSpeedIngredient?.target ?? nextIngredient?.target ?? "Maintain gains"}
          detail={
            ballSpeedIngredient
              ? `Ball speed: ${ballSpeedIngredient.current}.`
              : nextIngredient
                ? `${nextIngredient.label}: ${nextIngredient.current}.`
                : "Every currently measured Project ingredient is on track."
          }
        />
        <SpeedDevelopmentReadout
          icon={<Gauge className="size-4" aria-hidden />}
          label="Speed readiness"
          value={`${development.readiness.score}/100`}
          detail={`${development.readiness.recommendation}${
            nextRecommendedDate && Number.isFinite(nextRecommendedDate.getTime())
              ? ` Next recommended ${formatDate(nextRecommendedDate)}.`
              : ""
          }`}
        />
      </CardContent>
    </Card>
  );
}

function SpeedDevelopmentReadout({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
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

  const content = (
    <>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {steps.map((step, index) => (
          <Link
            key={step.title}
            href={step.href}
            prefetch={false}
            className="apple-panel-strong p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-7 place-items-center rounded-md bg-muted/30 text-xs font-semibold">
                {index + 1}
              </span>
              {step.ready ? (
                <CheckCircle2 className="size-4 text-primary" />
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
      <p className="text-lg font-bold leading-6 tracking-normal text-foreground">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
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
    <Card
      id={id}
      className={cn("@container/dashboard-card flex h-full scroll-mt-28 flex-col", className)}
    >
      <CardHeader className="flex-row items-start justify-between gap-4 border-b bg-muted/20 px-6 py-5">
        <div className="min-w-0">
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-1 max-w-3xl leading-6">{description}</CardDescription>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="flex-1 px-6 py-5">{children}</CardContent>
    </Card>
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
    <Card
      className="relative overflow-hidden border-primary/20 shadow-sm"
      data-dashboard-attention-card
    >
      <CardHeader className="gap-3 border-b bg-muted/20 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>
            <Target className="size-3.5" aria-hidden />
            Today&apos;s focus
          </Badge>
          <Badge variant="secondary">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {coachPreview ? `${coachPreview.trustIndex}% confidence` : "Build baseline"}
          </Badge>
          <Badge variant="outline">
            <LineChart className="size-3.5" aria-hidden />
            {trendBadge}
          </Badge>
          <Badge variant="outline">
            <Database className="size-3.5" aria-hidden />
            {coachPreview
              ? `${integerFormatter.format(coachPreview.sampleSize)} stock shots`
              : `${integerFormatter.format(bagSummary.mappedClubCount)} mapped clubs`}
          </Badge>
          {latestSession ? (
            <Badge variant="outline">
              <CalendarDays className="size-3.5" aria-hidden />
              Latest import {formatDate(latestSession.date)}
            </Badge>
          ) : null}
        </div>
        <CardTitle className="max-w-4xl text-3xl leading-tight sm:text-4xl">
          {practiceTitle}
        </CardTitle>
        <CardDescription className="max-w-4xl text-sm leading-6">{dashboardRead}</CardDescription>
      </CardHeader>

      <CardContent className="relative grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:items-stretch">
        <div className="grid h-full content-between gap-3">
          <div>
            <div className="grid gap-2 md:grid-cols-2">
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
            <div className="mt-3 rounded-xl border bg-muted/25 px-3 py-2.5">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="min-w-[10rem] pr-2">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                    Driver delivery
                  </p>
                  <p className="mt-1 text-2xl font-bold leading-7 tracking-normal text-foreground">
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
            <Alert className="mt-3 border-primary/25 bg-primary/5">
              <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.85fr)] xl:items-center">
                <div>
                  <AlertTitle>Development target</AlertTitle>
                  <p className="mt-1 text-sm font-semibold leading-6 text-foreground">
                    {driverDeliveryStory ?? expectedGain}
                  </p>
                </div>
                <AlertDescription className="text-xs font-medium leading-5">
                  {developmentTargetCopy} {focusSummary}
                </AlertDescription>
              </div>
            </Alert>
          </div>
          <FacePathClubSelector
            pathTrend={pathTrend}
            compact
            className="mt-3"
            action={
              <Button asChild>
                <Link href={practiceHref} prefetch={false}>
                  Start practice
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          />
        </div>

        <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] items-stretch gap-3">
          <RoundReadinessCard readiness={readiness} />
          <SinceLastSessionCard insights={whatChanged} />
        </div>
      </CardContent>

      <CardFooter className="grid auto-rows-fr gap-4 border-t bg-muted/20 px-6 py-3 lg:grid-cols-4">
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
          href="/bag?tab=fitting"
          tone="sky"
        />
      </CardFooter>
    </Card>
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
    <Item variant="muted" className="items-start">
      <ItemMedia className="pt-1">
        <DashboardDot tone={tone} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </ItemTitle>
        <p className="line-clamp-1 text-sm font-bold leading-5 text-foreground">{value}</p>
        <ItemDescription className="line-clamp-2 whitespace-normal">{detail}</ItemDescription>
      </ItemContent>
    </Item>
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
        primary ? "border-primary/25 shadow-sm hover:border-primary" : "hover:border-primary/25",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold leading-6 text-foreground">{title}</p>
        {actionText ? (
          <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors group-hover:bg-primary/90">
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
    <Card className={cn("gap-0 rounded-lg py-0", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-0">
        <div>
          <p className="text-sm font-semibold leading-5 text-foreground">Round readiness</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Driver, bag trust and scoring-zone calibration.
          </p>
        </div>
        <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="mt-5 grid items-center gap-4 xl:grid-cols-[10rem_minmax(0,1fr)]">
          <div
            className="mx-auto grid size-40 place-items-center rounded-full bg-[conic-gradient(var(--primary)_var(--readiness-angle),var(--muted)_0deg)] p-2.5 shadow-inner xl:mx-0"
            style={ringStyle}
          >
            <div className="grid size-full place-items-center rounded-full bg-card text-center ring-1 ring-border">
              <div>
                <p className="text-[38px] font-bold leading-none tracking-normal text-foreground">
                  {readiness.score}%
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-normal text-muted-foreground">
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
        <div className="mt-4 rounded-[16px] bg-muted/30 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Recommended
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-foreground">
            {readiness.recommended}
          </p>
        </div>
      </CardContent>
    </Card>
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
      <span className="flex items-center gap-2 font-medium text-foreground">
        <DashboardDot tone={tone} />
        {label}
      </span>
      <span className="text-right font-semibold text-foreground">{value}</span>
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
    <Card className={cn("gap-0 rounded-lg py-0", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-0">
        <div>
          <p className="text-sm font-semibold leading-5 text-foreground">Since last session</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Latest movement that should change today&apos;s practice.
          </p>
        </div>
        <LineChart className="size-5 text-primary" />
      </CardHeader>
      <CardContent className="p-5 pt-0">
        <div className="mt-4 grid gap-3">
          {insights.length > 0 ? (
            insights.slice(0, 3).map((insight) => (
              <Link
                key={`${insight.label}-${insight.value}`}
                href="/progress"
                prefetch={false}
                className="grid gap-1 rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:border-primary hover:bg-card"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">{insight.label}</span>
                  <DashboardDot tone={normalizeDashboardTone(insight.tone)} />
                </span>
                <span className="text-lg font-bold leading-6 tracking-normal text-foreground">
                  {insight.value}
                </span>
                <span className="text-sm leading-5 text-muted-foreground">{insight.detail}</span>
              </Link>
            ))
          ) : (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm leading-5 text-muted-foreground">
              Import another session and this becomes the first progress readout.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
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
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Current trend
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold leading-8 tracking-normal text-foreground">
              <LineChart className="size-5 text-primary" />
              {status.label}
            </p>
          </div>
          <StatusPill tone={status.tone}>{pathTrend.label}</StatusPill>
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-card px-4 py-3">
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
        <p className="rounded-lg border border-border bg-card px-3 py-3 text-sm leading-5 text-muted-foreground">
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
      <div className="relative h-2 rounded-full bg-muted">
        <span className="absolute left-1/2 top-1/2 h-5 w-px -translate-y-1/2 bg-primary" />
        <DriverPathMarker value={previous} label="Previous" tone="amber" />
        <DriverPathMarker value={current} label="Current" tone="green" />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
        "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card ring-2 ring-border",
        tone === "green" ? "bg-primary" : "bg-[var(--confidence-medium)]",
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
    <Card id="practice" className={cn("h-full scroll-mt-28 gap-0 rounded-lg py-0", className)}>
      <CardContent className="flex h-full flex-col p-5 lg:p-6">
        {coachPreview ? (
          <div className="grid h-full content-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <Target className="size-6" strokeWidth={2.4} />
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[15px] font-bold leading-6 tracking-normal text-foreground">
                    Next practice
                  </p>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-semibold leading-5 text-primary">
                    {coachPreview.trustIndex}% trust
                  </span>
                </div>
              </div>
              <h2 className="mt-5 text-[26px] font-bold leading-8 tracking-normal text-foreground">
                {coachPreview.clubName} delivery window
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-semibold leading-5 text-foreground">
                  <Crosshair className="size-3.5" />
                  {coachPreview.issueLabel}
                </span>
                <span className="text-sm leading-6 text-muted-foreground">
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
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Crosshair className="size-5" strokeWidth={2.3} />
                </span>
                <p className="text-sm font-bold leading-5 tracking-normal text-primary">
                  Practice task
                </p>
              </div>
              <div className="mt-5 space-y-3 text-sm leading-6 text-foreground">
                {practiceTaskParagraphs(taskCopy).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-6 grid gap-3">
                <Button
                  asChild
                  className="h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Link href={href} prefetch={false}>
                    Open drill
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <span className="grid h-11 place-items-center rounded-lg border border-border bg-card text-sm font-bold text-muted-foreground shadow-sm">
                  0 / 10 balls
                </span>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold leading-6 text-foreground">Next practice</p>
              <h2 className="mt-2 text-[26px] font-bold leading-8 tracking-normal text-foreground">
                {primaryActionLabel}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}

function PracticePayoffPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid min-h-14 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 text-sm font-bold leading-5 text-foreground">{value}</span>
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
    return <p className="mt-5 max-w-3xl text-base leading-7 text-foreground">{reason}</p>;
  }

  return (
    <p className="mt-5 max-w-3xl text-base leading-7 text-foreground">
      <span className="font-bold text-primary">{match[1]}</span>
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
