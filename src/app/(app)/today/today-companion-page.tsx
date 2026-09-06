import { MobileTodayActivities } from "@/components/app/mobile-today-activities";
import { MobileTodayChangeDetail } from "@/components/app/mobile-today-change";
import { MobileTodayPracticeReview } from "@/components/app/mobile-today-review";
import { buildMobileTodayReview, practiceDateKey } from "@/lib/mobile-today-review";
import { buildMobileTodayChange } from "@/lib/mobile-today-briefing";
import { formatCompanionClubType } from "@/lib/club-format";
import { Flag, Upload, Activity, Trophy, Target } from "lucide-react";
import { MobileTodayGreeting } from "@/components/app/mobile-today-greeting";
import { MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";

import { LazyMobileShotPatternCharts as MobileShotPatternCharts } from "@/components/app/lazy-mobile-shot-pattern-charts";
import { TodayPrimaryAnswer } from "@/components/app/today-primary-answer";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { getCurrentPracticePlanSummary, getPracticePlannerContext } from "@/lib/practice-planner";
import { buildShotPatternPoints } from "@/lib/shot-pattern-chart-data";
import { buildTodayRecommendation, resolveTodayPrimaryState } from "@/lib/today-primary-state";
import { getTodayActivity } from "@/lib/today-activity-data";
import { getTodayPracticeData } from "@/lib/today-session-data";

export default async function TodayCompanionPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <PageShell>
        <MobileAppShell>
          <MobileTopBar title="Today" />
          <Alert>
            <AlertTitle>Connect your golf data</AlertTitle>
            <AlertDescription>
              A database connection is required before Today can build a recommendation.
            </AlertDescription>
          </Alert>
        </MobileAppShell>
      </PageShell>
    );
  }

  const userId = await requireCurrentUserId();
  const now = new Date();
  const [context, currentPlan, activeRound, recent, todayData] = await Promise.all([
    getPracticePlannerContext(userId, { compactTraining: true, includeSpeed: false }),
    getCurrentPracticePlanSummary(userId),
    getInProgressRound(userId),
    getTodayActivity(userId),
    getTodayPracticeData({ date: practiceDateKey(now), scope: "day", practiceOnly: true }).catch(
      () => null,
    ),
  ]);
  const recommendation = buildTodayRecommendation(context);
  const latestData = todayData?.rawShots.length
    ? todayData
    : context.latestPractice.sessionId
      ? await getTodayPracticeData({
          sessionId: context.latestPractice.sessionId,
          scope: "day",
        }).catch(() => null)
      : null;
  const latestShots = latestData?.rawShots ?? [];
  const patternPoints = buildShotPatternPoints(
    (latestData?.comparisonShots ?? []).map((shot) => ({
      ...shot,
      clubLabel: formatCompanionClubType(shot.clubType),
    })),
    {
      trustedShotIds: new Set(latestData?.comparisonShots.map((shot) => shot.id) ?? []),
    },
  );
  const confidenceWarning = context.bag.issues.find(
    (issue) => !issue.startsWith("Bag trust is building"),
  );
  const recommendationState = resolveTodayPrimaryState({
    currentPlan: null,
    activeRound: null,
    recommendation,
    latestData: null,
  });
  const review = buildMobileTodayReview(todayData, now);
  const nextPracticeState =
    recommendation.confidence === "Low"
      ? {
          ...recommendationState,
          href: `/practice?intent=confidence&club=${encodeURIComponent(recommendation.clubType ?? "")}&time=${recommendation.minutes}&source=today`,
        }
      : recommendationState;
  const mainState = review?.state ?? nextPracticeState;
  const reviewPatternPoints =
    review && todayData
      ? buildShotPatternPoints(
          todayData.rawShots.map((shot) => ({
            ...shot,
            clubLabel: formatCompanionClubType(shot.clubType),
          })),
          {
            trustedShotIds: new Set(todayData.comparisonShots.map((shot) => shot.id)),
          },
        )
      : [];

  const change = buildMobileTodayChange(latestData);
  return (
    <PageShell>
      <MobileAppShell className="gap-6" data-today-companion>
        <MobileTodayGreeting initialNow={now.toISOString()} />
        {!todayData ? (
          <Alert>
            <AlertTitle>Today’s review couldn’t load</AlertTitle>
            <AlertDescription>
              Reload Today to try again, or <Link href="/sessions">open your saved sessions</Link>.
            </AlertDescription>
          </Alert>
        ) : null}
        <TodayPrimaryAnswer
          accountId={userId}
          serverState={mainState}
          evidenceDate={
            latestData
              ? new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "Europe/London",
                }).format(new Date(`${latestData.dateKey}T12:00:00Z`))
              : undefined
          }
          evidenceContent={
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Evidence used
              </p>
              <ul className="grid gap-2 text-sm leading-5 text-foreground">
                <li>
                  Latest measured practice day ·{" "}
                  {latestData?.dateLabel ?? context.latestPractice.dateLabel}
                </li>
                <li>
                  {latestShots.length} measured shots across{" "}
                  {uploadLabel(latestData?.sessions.length ?? 0)}
                </li>
                <li>
                  Comparisons use trusted full shots; chips, recovery shots and excluded readings
                  are left out.
                </li>
                <li>Training load · {context.trainingLoad.statusLabel}</li>
              </ul>
              {!review && patternPoints.length ? (
                <MobileShotPatternCharts
                  points={patternPoints}
                  preferredClub={recommendation.clubType}
                  compact
                />
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">
                {review
                  ? "Open any session for its full review, or explore today’s club comparisons and shot patterns below."
                  : "Recommendations use measured golf evidence. Completing a practice activity manually does not count as measured success."}
              </p>
            </div>
          }
          facts={
            review
              ? [{ label: "Evidence", value: review.summary }]
              : [
                  { label: "Session", value: `${recommendation.minutes} min` },
                  {
                    label: "Club",
                    value: recommendation.clubType
                      ? formatCompanionClubType(recommendation.clubType)
                      : recommendation.clubLabel,
                  },
                  { label: "Evidence", value: compactEvidenceLabel(recommendation.evidenceLabel) },
                ]
          }
        />

        {review ? (
          <MobileTodayPracticeReview
            review={review}
            pattern={
              reviewPatternPoints.length ? (
                <MobileShotPatternCharts
                  key={reviewPatternPoints.map((point) => point.id).join(",")}
                  points={reviewPatternPoints}
                  defaultToAllClubs
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No measured coordinates are available for a shot pattern. Your session reviews
                  remain available above.
                </p>
              )
            }
          />
        ) : null}

        <MobileTodayActivities
          accountId={userId}
          plan={
            currentPlan
              ? { id: currentPlan.id, title: currentPlan.title, status: currentPlan.status }
              : null
          }
          round={activeRound ? { id: activeRound.id, courseName: activeRound.courseName } : null}
        />
        {change ? (
          <MobileSection title="What changed">
            <MobileTodayChangeDetail change={change} />
          </MobileSection>
        ) : null}
        {review ? (
          <MobileSection title="For your next practice">
            <MobileGroupedList>
              <MobileListRow
                label={
                  recommendation.confidence === "Low"
                    ? recommendation.clubType
                      ? `${formatCompanionClubType(recommendation.clubType)} baseline`
                      : "Build your baseline"
                    : recommendation.title
                }
                detail={`${recommendation.minutes} minutes · ${compactEvidenceLabel(recommendation.evidenceLabel)} · ${recommendation.confidence.toLowerCase()} confidence`}
                href={nextPracticeState.href}
                icon={Target}
              />
            </MobileGroupedList>
          </MobileSection>
        ) : null}
        {recent.length ? (
          <MobileSection title="Recent">
            <MobileGroupedList>
              {recent.map((item) => (
                <MobileListRow
                  key={item.id}
                  label={item.title}
                  icon={
                    item.kind === "round"
                      ? Flag
                      : item.kind === "import"
                        ? Upload
                        : item.kind === "goal"
                          ? Target
                          : ["achievement", "personal-best"].includes(item.kind)
                            ? Trophy
                            : Activity
                  }
                  detail={`${item.detail} · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(item.date)}`}
                  href={item.href}
                />
              ))}
            </MobileGroupedList>
          </MobileSection>
        ) : null}

        {confidenceWarning ? (
          <Alert>
            <ShieldAlert aria-hidden />
            <AlertTitle>{confidenceWarningTitle(confidenceWarning)}</AlertTitle>
            <AlertDescription>
              {confidenceWarning}. <Link href="/quick-bag">Review Quick Bag.</Link>
            </AlertDescription>
          </Alert>
        ) : null}
      </MobileAppShell>
    </PageShell>
  );
}

function confidenceWarningTitle(issue: string) {
  if (issue.endsWith(" needs more data")) {
    return issue.replace(/ needs more data$/, " needs more evidence");
  }
  if (issue.endsWith(" lowest trust")) {
    return issue.replace(/ lowest trust$/, " confidence is low");
  }
  if (issue.endsWith(" volatile")) {
    return issue.replace(/ volatile$/, " numbers are volatile");
  }
  return issue;
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

function uploadLabel(count: number) {
  return `${count} upload${count === 1 ? "" : "s"}`;
}

function compactEvidenceLabel(label: string) {
  return label.replace(/ measured shots?$/i, (match) =>
    match.endsWith("shots") ? " trusted shots" : " trusted shot",
  );
}
