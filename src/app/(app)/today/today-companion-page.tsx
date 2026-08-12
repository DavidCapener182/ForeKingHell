import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CalendarDays, Flag, ShieldCheck, Target } from "lucide-react";

import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import { TodayPrimaryAnswer } from "@/components/app/today-primary-answer";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getCurrentPracticePlanSummary,
  getPracticePlannerContext,
  type PracticePlannerContext,
} from "@/lib/practice-planner";
import { buildShotPatternPoints } from "@/lib/shot-pattern-chart-data";
import { classifyTodayRecommendationIssue } from "@/lib/today-recommendation-issue";
import { getTodayPracticeData } from "@/lib/today-session-data";

export default async function TodayCompanionPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <MobileAppShell>
          <MobileTopBar title="Today" />
          <section className="ios-grouped-list p-5">
            <h1 className="text-xl font-bold">Connect your golf data</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A database connection is required before Today can build a recommendation.
            </p>
          </section>
        </MobileAppShell>
      </PageShell>
    );
  }

  const userId = await requireCurrentUserId();
  const [context, currentPlan, activeRound] = await Promise.all([
    getPracticePlannerContext(userId, { compactTraining: true, includeSpeed: false }),
    getCurrentPracticePlanSummary(userId),
    getInProgressRound(userId),
  ]);
  const recommendation = companionRecommendation(context);
  const latestData = context.latestPractice.sessionId
    ? await getTodayPracticeData({ sessionId: context.latestPractice.sessionId }).catch(() => null)
    : null;
  const latestShots =
    latestData?.rawShots.filter((shot) => shot.sessionId === context.latestPractice.sessionId) ??
    [];
  const patternPoints = buildShotPatternPoints(latestShots);
  const mainState = todayMainState({ currentPlan, activeRound, recommendation, latestData });

  return (
    <PageShell>
      <MobileAppShell className="gap-3" data-today-companion>
        <TodayPrimaryAnswer
          accountId={userId}
          serverState={mainState}
          facts={[
            { label: "Suggested session", value: `${recommendation.minutes} min` },
            { label: "Training load", value: context.trainingLoad.statusLabel },
            { label: "Main club", value: recommendation.clubLabel },
            { label: "Evidence", value: recommendation.evidenceLabel },
          ]}
        />

        {patternPoints.length > 0 && context.latestPractice.sessionId ? (
          <section className="grid gap-2.5" aria-label="Latest measured pattern">
            <IOSSectionHeader title="Latest pattern" description={latestSessionDetail(context)} />
            <Link
              href={`/sessions/${context.latestPractice.sessionId}`}
              className="focus-aaa block rounded-2xl"
            >
              <MobileShotPatternCharts
                points={patternPoints}
                preferredClub={recommendation.clubType}
                compact
              />
            </Link>
          </section>
        ) : null}

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Quick actions" />
          <IOSGroupedList label="Today quick actions">
            <IOSListRow icon={Target} label="Plan practice" href="/practice" />
            <IOSListRow icon={Flag} label="Prepare to play" href="/play" />
            <IOSListRow icon={ShieldCheck} label="Quick Bag" href="/quick-bag" />
          </IOSGroupedList>
        </section>

        {context.bag.issues[0] ? (
          <section className="grid gap-2.5">
            <IOSSectionHeader title="Data health" />
            <IOSGroupedList label="Data health">
              <IOSListRow
                icon={ShieldCheck}
                label="One confidence warning"
                detail={context.bag.issues[0]}
                href="/quick-bag"
              />
            </IOSGroupedList>
          </section>
        ) : null}

        <IOSDisclosureGroup
          label="Why this recommendation?"
          items={[
            {
              value: "why",
              title: "Why this recommendation?",
              description: recommendation.explanation,
              content: (
                <div className="grid gap-2">
                  <IOSMetricRow label="Latest weakness" value={recommendation.clubLabel} />
                  <IOSMetricRow label="Bag confidence" value={recommendation.bagConfidence} />
                  <IOSMetricRow
                    label="Training status"
                    value={context.trainingLoad.recommendation}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Recommendations use measured golf evidence. Completing a practice activity
                    manually does not count as measured success.
                  </p>
                </div>
              ),
            },
          ]}
        />

        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden />
          Updated from your latest available golf evidence.
        </div>
      </MobileAppShell>
    </PageShell>
  );
}

function companionRecommendation(context: PracticePlannerContext) {
  const opportunity = context.latestPractice.biggestOpportunity;
  const club =
    context.latestPractice.clubs.find((item) => item.clubType === opportunity) ??
    context.latestPractice.clubs.sort((left, right) => left.score - right.score)[0] ??
    null;
  const bagClub = context.bag.clubs.find((item) => item.clubType === club?.clubType) ?? null;
  const confidence =
    (club?.shotCount ?? 0) >= 12 ? "High" : (club?.shotCount ?? 0) >= 6 ? "Moderate" : "Low";
  const minutes = context.trainingLoad.highRecentLoad ? 20 : 45;
  const clubLabel = club?.label ?? "Baseline";
  const issue = classifyTodayRecommendationIssue({
    club,
    bagClub,
    priority:
      context.progress.priorities.find((priority) => priority.clubType === club?.clubType) ?? null,
    bagIssues: context.bag.issues,
    scoring: context.scoring,
    speed: context.speed,
  });
  const title = club
    ? `Practise ${clubLabel} ${issue.label.toLowerCase()}`
    : "Build a measured baseline";
  const reason = club
    ? `${clubLabel} is the clearest current opportunity. ${club.shotCount} measured shots show ${formatDirectionEvidence(club)}. Begin with a short calibration block before adding pressure.`
    : "There is not enough measured evidence to isolate a weakness yet. Start with a short baseline session so the next recommendation is evidence-led.";

  return {
    title,
    reason,
    clubLabel,
    clubType: club?.clubType ?? null,
    issue: issue.label,
    confidence,
    minutes,
    evidenceLabel: club ? `${club.shotCount} measured shots` : "Baseline needed",
    bagConfidence: bagClub?.confidenceLabel ?? "Not established",
    explanation: club
      ? `The latest measured weakness, ${bagClub?.confidenceLabel?.toLowerCase() ?? "unsettled"} bag confidence and ${context.trainingLoad.statusLabel.toLowerCase()} training load point to a ${minutes}-minute ${clubLabel} session.`
      : "The app needs a fresh measured sample before it can make a club-specific claim.",
  };
}

function todayMainState({
  currentPlan,
  activeRound,
  recommendation,
  latestData,
}: {
  currentPlan: Awaited<ReturnType<typeof getCurrentPracticePlanSummary>>;
  activeRound: Awaited<ReturnType<typeof getInProgressRound>>;
  recommendation: ReturnType<typeof companionRecommendation>;
  latestData: Awaited<ReturnType<typeof getTodayPracticeData>> | null;
}) {
  if (currentPlan?.status === "active") {
    return {
      eyebrow: "Active Range Mode",
      title: currentPlan.title,
      reason: "Your practice is still active on this phone. Continue at the current block.",
      status: "In progress",
      tone: "positive" as const,
      href: "/practice",
      action: "Continue practice",
    };
  }
  if (currentPlan?.status === "awaiting_import") {
    return {
      eyebrow: "Practice finished",
      title: "Add the measured session",
      reason: "Choose R-Cloud or a CSV to replace activity tracking with measured evidence.",
      status: "Evidence needed",
      tone: "attention" as const,
      href: `/import?practicePlanId=${encodeURIComponent(currentPlan.id)}`,
      action: "Import session",
    };
  }
  if (
    latestData?.sessions[0]?.id &&
    latestData.shots.length > 0 &&
    isReviewReadyDate(currentPlan?.sourceSessionId ? null : latestData.dateLabel)
  ) {
    return {
      eyebrow: "New session ready",
      title: latestData.overall.title,
      reason: latestData.overall.summary,
      status: "Review ready",
      tone: "positive" as const,
      href: `/sessions/${latestData.sessions[0].id}`,
      action: "Review session",
    };
  }
  if (activeRound) {
    return {
      eyebrow: "Round in progress",
      title: activeRound.courseName ?? "Continue your round",
      reason: "Your scorecard is still open and ready at the current hole.",
      status: "In progress",
      tone: "positive" as const,
      href: `/rounds/${activeRound.id}`,
      action: "Continue round",
    };
  }
  if (currentPlan?.status === "planned") {
    return {
      eyebrow: "Saved practice plan",
      title: currentPlan.title,
      reason: `${currentPlan.timeMinutes} minutes planned and ready to start.`,
      status: "Ready",
      tone: "info" as const,
      href: "/practice",
      action: "Start plan",
    };
  }
  return {
    eyebrow: "Today’s recommendation",
    title: recommendation.title,
    reason: recommendation.reason,
    status: recommendation.confidence,
    tone: recommendation.confidence === "Low" ? ("attention" as const) : ("positive" as const),
    href: `/practice?intent=latest_weakness&club=${encodeURIComponent(recommendation.clubType ?? "")}&time=${recommendation.minutes}&source=today`,
    action: "Plan range session",
  };
}

function isReviewReadyDate(dateLabel: string | null) {
  if (dateLabel === null) return true;
  const date = new Date(dateLabel);
  if (Number.isNaN(date.getTime())) return false;
  const age = Date.now() - date.getTime();
  return age >= 0 && age <= 36 * 60 * 60 * 1_000;
}

async function getInProgressRound(userId: string) {
  return (
    (
      await getDb()
        .select({ id: sessions.id, courseName: sessions.courseName })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, userId),
            inArray(sessions.type, ["round", "real_round", "simulator", "simulated_course"]),
            inArray(sessions.roundStatus, ["in_progress", "active"]),
          ),
        )
        .orderBy(desc(sessions.date))
        .limit(1)
    )[0] ?? null
  );
}

function formatDirectionEvidence(club: PracticePlannerContext["latestPractice"]["clubs"][number]) {
  if (club.straightRate !== null) {
    return `${Math.round(club.straightRate)}% finished in the straight window`;
  }

  if (club.offlineAverageYd !== null) {
    return `${Math.round(club.offlineAverageYd)} yd average offline dispersion`;
  }

  return "an incomplete control sample";
}

function latestSessionDetail(context: PracticePlannerContext) {
  if (!context.latestPractice.sessionId) {
    return "Import a measured session to unlock a verdict.";
  }

  return `${context.latestPractice.dateLabel} · ${context.latestPractice.clubs.reduce((total, club) => total + club.shotCount, 0)} measured shots`;
}
