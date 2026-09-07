import Link from "next/link";
import type { ReactNode } from "react";
import { and, countDistinct, eq, or } from "drizzle-orm";
import {
  ArrowRight,
  CalendarDays,
  Crosshair,
  Gauge,
  Target,
  Upload,
} from "lucide-react";
import { getDb } from "@/db/client";
import { courses, holes, teeSets } from "@/db/schema";
import { DriverDevelopmentPanel } from "@/components/analysis/driver-development-panel";
import { FacePathClubSelector } from "@/app/dashboard/face-path-club-selector";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusTimeline, type StatusTimelineItem } from "@/components/app/status-timeline";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/app/dashboard/dashboard-data";
import {
  formatDate,
  formatHandicapTrend,
  formatScoreVsPar,
  integerFormatter,
  numberFormatter,
} from "@/app/dashboard/dashboard-formatters";
import { requireCurrentUserId } from "@/lib/current-user";
import { getCurrentPracticePlanSummary } from "@/lib/practice-planner";
import { formatHandicapValue } from "@/lib/round-handicap";
import { getSpeedCoachCardData } from "@/lib/speed-training-data";
import type { SpeedDevelopmentSummary } from "@/lib/speed-development";
import { getProgressData } from "@/lib/progress-data";
import { ProgressComparison } from "@/app/progress/progress-comparison";

export const dynamic = "force-dynamic";

function DashboardUnavailable() {
  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Your saved golf overview is temporarily unavailable."
      />
      <AppEmptyState
        title="We couldn’t load your evidence"
        description="Try again shortly. Your saved sessions have not been changed."
        primaryAction={
          <Button asChild>
            <Link href="/dashboard">Try again</Link>
          </Button>
        }
        secondaryAction={
          <Button asChild variant="outline">
            <Link href="/today">Open Today</Link>
          </Button>
        }
      />
    </PageShell>
  );
}

async function dashboardCourseEvidence(userId: string) {
  // Same visible-course permission and measured hole/tee conditions used by Play.
  return getDb()
    .select({
      id: courses.id,
      name: courses.name,
      holes: countDistinct(holes.holeNumber),
      tees: countDistinct(teeSets.id),
    })
    .from(courses)
    .leftJoin(holes, eq(holes.courseId, courses.id))
    .leftJoin(teeSets, eq(teeSets.courseId, courses.id))
    .where(or(eq(courses.visibility, "shared"), and(eq(courses.createdByUserId, userId))))
    .groupBy(courses.id, courses.name);
}

export default async function DashboardPage() {
  if (!process.env.DATABASE_URL?.trim()) return <DashboardUnavailable />;
  const userId = await requireCurrentUserId();
  const [data, currentPlan, speed, progress, courseRows] = await Promise.all([
    getDashboardData(),
    getCurrentPracticePlanSummary(userId),
    getSpeedCoachCardData(userId),
    getProgressData(userId),
    dashboardCourseEvidence(userId),
  ]);
  const latest = data.recentSessions[0] ?? null;
  const focus = data.coachPreview;
  const clubType = data.bagPreview.find((club) => club.id === focus?.clubId)?.type;
  const practiceQuery = new URLSearchParams({ source: "dashboard", time: "15" });
  if (clubType) practiceQuery.set("club", clubType);
  const practiceHref = currentPlan
    ? `/practice?planId=${currentPlan.id}`
    : `/practice?${practiceQuery}`;
  const hasEvidence = data.stats.shotCount > 0;
  const actionHref = hasEvidence ? practiceHref : "/import";
  const actionLabel = hasEvidence
    ? currentPlan
      ? "Open saved practice"
      : "Build focused practice"
    : "Import first session";
  const readyCourses = courseRows.filter((course) => course.holes > 0 && course.tees > 0);
  const course =
    readyCourses.find((course) => course.id === data.latestRound?.courseId) ?? readyCourses[0];
  const trustedCount = data.bagSummary.trustedClubCount;
  const metrics = [
    {
      pin: "shots",
      label: "Saved shots",
      value: integerFormatter.format(data.stats.shotCount),
      detail: `Across ${data.stats.sessionCount} sessions`,
      href: "/shots",
    },
    {
      pin: "clubs",
      label: "Bag trust",
      value: `${trustedCount} / ${data.bagSummary.mappedClubCount}`,
      detail: "Trusted / mapped clubs",
      href: "/bag",
    },
    {
      pin: "sessions",
      label: "Session history",
      value: integerFormatter.format(data.stats.sessionCount),
      detail: latest ? `Latest ${formatDate(latest.date)}` : "No saved sessions",
      href: "/sessions",
    },
    {
      pin: "handicap",
      label: "Scoring handicap",
      value: formatHandicapValue(data.stats.combinedHandicap.value),
      detail: formatHandicapTrend(data.stats.combinedHandicap),
      href: "/rounds",
    },
  ].filter((metric) =>
    data.dashboardPins.includes(metric.pin as (typeof data.dashboardPins)[number]),
  );
  const work: StatusTimelineItem[] = [];
  if (currentPlan)
    work.push({
      id: `plan-${currentPlan.id}`,
      title: currentPlan.title,
      description: `${currentPlan.timeMinutes} minutes · ${currentPlan.focusClubs.join(", ") || "Full bag"}`,
      status: currentPlan.status,
      kind: "practice",
      href: practiceHref,
    });
  if (latest)
    work.push({
      id: latest.id,
      title: latest.fileName,
      timestamp: formatDate(latest.date),
      description: `${latest.shotCount} measured shots`,
      status: "Saved session",
      kind: "import",
      href: `/sessions/${latest.id}`,
    });
  if (data.latestRound)
    work.push({
      id: `round-${data.latestRound.id}`,
      title: data.latestRound.courseName ?? data.latestRound.fileName ?? "Latest round",
      timestamp: formatDate(data.latestRound.date),
      description:
        data.latestRound.totalScore !== null && data.latestRound.totalPar !== null
          ? `${data.latestRound.totalScore} strokes · ${formatScoreVsPar(data.latestRound.totalScore, data.latestRound.totalPar)}`
          : "Scoring evidence needs review",
      status: "Round",
      kind: "round",
      href: `/rounds/${data.latestRound.id}`,
    });
  const sections = [
    ["practice", "Practice"],
    ["driver-speed", "Driver & speed"],
    ["changes", "Changes"],
    ["delivery", "Club delivery"],
    ["readiness", "Round readiness"],
    ["current-work", "Current work"],
  ];
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5" data-dashboard-ui>
        <PageHeader
          title="Dashboard"
          description={
            latest
              ? `Latest saved evidence: ${latest.fileName} · ${formatDate(latest.date)}`
              : "Your saved golf evidence and next useful action."
          }
          actions={
            <Button asChild className="min-h-11">
              <Link href={actionHref}>
                {actionLabel}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          }
        />
        <section
          id="practice"
          className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-5"
          aria-label="Recommended practice"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {currentPlan?.title ??
                (focus
                  ? `${focus.clubName}: ${focus.issueLabel}`
                  : "Build your first useful baseline")}
            </h2>
            <StatusPill tone={focus ? "green" : "slate"}>
              {currentPlan
                ? currentPlan.status
                : focus
                  ? `${focus.sampleSize} stock shots`
                  : "No practice priority yet"}
            </StatusPill>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {currentPlan
              ? `${currentPlan.timeMinutes} minutes · ${currentPlan.focusClubs.join(", ") || "Full bag"}. Continue the saved targets and record the result against this plan.`
              : (focus?.reason ??
                "Import a session, confirm the clubs and review its quality before choosing a measured target.")}
          </p>
          {focus && !currentPlan ? (
            <p className="mt-2 text-sm leading-6">
              {focus.drill} · Suggested time: 15 minutes. Import the result to compare the same
              club’s evidence.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button asChild className="min-h-11">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
            {focus ? (
              <Link
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                href={`/bag/${focus.clubId}/analytics`}
              >
                Review supporting club evidence
              </Link>
            ) : null}
          </div>
        </section>
        <nav aria-label="Dashboard sections" className="flex flex-wrap gap-2">
          {sections.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              {label}
            </a>
          ))}
          <Link
            href="/progress"
            className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium"
          >
            Full Progress
          </Link>
          <Link
            href="/shots"
            className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium"
          >
            Shot data
          </Link>
        </nav>
        <dl className="grid min-w-0 divide-y rounded-xl border bg-card sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.pin} className="min-w-0 p-4">
              <dt className="text-sm text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</dd>
              <dd className="text-sm leading-6 text-muted-foreground">{metric.detail}</dd>
              <dd>
                <Link
                  href={metric.href}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                >
                  Review {metric.label.toLowerCase()}
                </Link>
              </dd>
            </div>
          ))}
        </dl>
        <section
          id="driver-speed"
          className="grid scroll-mt-24 gap-3"
          aria-label="Driver and speed evidence"
        >
          <DashboardSpeedDevelopmentCard development={speed.development} />
          <details className="rounded-xl border p-4">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">
              Latest Driver session and confidence
            </summary>
            <DriverDevelopmentPanel compact />
          </details>
        </section>
        <section id="changes" className="grid scroll-mt-24 gap-3">
          <SectionHeader
            title="Since your previous comparable session"
            description="Compare dated measurements for the same club. Missing or incompatible evidence never becomes a zero change."
          />
          <ProgressComparison clubs={progress.comparisons} />
        </section>
        <section id="delivery" className="grid scroll-mt-24 gap-3">
          <SectionHeader
            title="Club delivery"
            description="Select a club to update its delivery visual, measured sample and diagnosis together."
          />
          <FacePathClubSelector pathTrend={data.pathTrend} />
        </section>
        <section id="readiness" className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Round readiness</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Check the actual evidence before preparing your next round.
          </p>
          <ul className="mt-3 divide-y">
            {[
              {
                label: "Mapped course and tees",
                value: course
                  ? `${course.name} · ${course.holes} mapped holes · ${course.tees} tee sets`
                  : "No accessible course with mapped holes and tees",
                href: course ? `/play?courseId=${course.id}` : "/courses",
                action: course ? "Choose course and tees" : "Find or map a course",
              },
              {
                label: "Trusted bag",
                value: `${trustedCount} / ${data.bagSummary.mappedClubCount} mapped clubs have trusted stock evidence`,
                href: "/bag",
                action: trustedCount ? "Review bag gaps" : "Build stock distances",
              },
              {
                label: "Recent evidence",
                value: latest
                  ? `${latest.fileName} · ${formatDate(latest.date)} · ${latest.shotCount} shots`
                  : "No saved session yet",
                href: latest ? `/sessions/${latest.id}` : "/import",
                action: latest ? "Review latest session" : "Import a session",
              },
            ].map((item) => (
              <li
                key={item.label}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0 flex-1 basis-60">
                  <h3 className="font-medium">{item.label}</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                    {item.value}
                  </p>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                >
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-3 min-h-11">
            <Link href={course ? `/play?courseId=${course.id}` : "/play"}>
              Prepare a round
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </section>
        <section id="current-work" className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="mb-4 text-xl font-semibold">Current work</h2>
          <StatusTimeline
            items={work}
            empty={
              <AppEmptyState
                icon={<CalendarDays className="size-5" />}
                title="No saved work yet"
                description="Import your first session to begin a private evidence history."
                primaryAction={
                  <Button asChild>
                    <Link href="/import">Import a session</Link>
                  </Button>
                }
              />
            }
          />
        </section>
        {!hasEvidence ? (
          <AppEmptyState
            icon={<Upload className="size-5" />}
            title="Start with a session"
            description="Upload a CSV or connect Rapsodo, confirm clubs and review data quality. Sharing remains optional."
            primaryAction={
              <Button asChild>
                <Link href="/import">Import first session</Link>
              </Button>
            }
          />
        ) : null}
      </div>
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
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 border-b bg-muted/20 px-4 py-4">
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
      <CardContent className="grid gap-4 px-4 py-4">
        <dl className="grid divide-y rounded-lg border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {development.funnel.map((stage) => (
            <div key={stage.key} className="min-w-0 p-3">
              <dt className="text-sm text-muted-foreground">{stage.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {stage.valueMph === null
                  ? "Unmeasured"
                  : `${numberFormatter.format(stage.valueMph)} mph`}
              </dd>
              <dd className="mt-1 text-xs leading-5 text-muted-foreground">
                {stage.sampleSize} readings · {stage.source}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          No-ball ceiling, transfer, playing speed and course evidence remain separate. Summary as
          of {formatDate(new Date(development.generatedAtIso))}.
        </p>
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            Targets and training readiness
          </summary>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SpeedDevelopmentReadout
              icon={<Target className="size-4" aria-hidden />}
              label="Project carry"
              value={
                currentCarry === null
                  ? "Needs evidence"
                  : `${numberFormatter.format(currentCarry)} yd`
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
          </div>
        </details>
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
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
