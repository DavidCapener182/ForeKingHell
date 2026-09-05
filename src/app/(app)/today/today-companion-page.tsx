import { MobileCurrentActivity } from "@/components/app/mobile-current-activity";
import styles from "@/components/app/mobile-companion.module.css";
import { ChevronRight, Flag, Upload, Activity, Trophy, Target } from "lucide-react";
import { MobileTodayGreeting } from "@/components/app/mobile-today-greeting";
import { MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";

import { LazyMobileShotPatternCharts as MobileShotPatternCharts } from "@/components/app/lazy-mobile-shot-pattern-charts";
import { TodayPrimaryAnswer } from "@/components/app/today-primary-answer";
import { IOSDisclosureGroup } from "@/components/app/ios-mobile";
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
  const [context, currentPlan, activeRound, recent] = await Promise.all([
    getPracticePlannerContext(userId, { compactTraining: true, includeSpeed: false }),
    getCurrentPracticePlanSummary(userId),
    getInProgressRound(userId),
    getTodayActivity(userId),
  ]);
  const recommendation = buildTodayRecommendation(context);
  const latestData = context.latestPractice.sessionId
    ? await getTodayPracticeData({
        sessionId: context.latestPractice.sessionId,
        scope: "day",
      }).catch(() => null)
    : null;
  const latestShots = latestData?.rawShots ?? [];
  const patternPoints = buildShotPatternPoints(latestShots);
  const confidenceWarning = context.bag.issues.find(
    (issue) => !issue.startsWith("Bag trust is building"),
  );
  const mainState = resolveTodayPrimaryState({
    currentPlan: null,
    activeRound: null,
    recommendation,
    latestData: null,
  });

  const change = latestData?.clubComparisons
    .filter(
      (item) =>
        item.today.shotCount >= 6 &&
        item.previous.shotCount >= 6 &&
        item.verdict !== "new" &&
        item.carryDeltaYd !== null &&
        Math.abs(item.carryDeltaYd) >= 1,
    )
    .sort((a, b) => Math.abs(b.carryDeltaYd ?? 0) - Math.abs(a.carryDeltaYd ?? 0))[0];
  return (
    <PageShell>
      <MobileAppShell className="gap-6" data-today-companion>
        <MobileTodayGreeting />
        <TodayPrimaryAnswer
          accountId={userId}
          serverState={mainState}
          trainingLoadLabel={context.trainingLoad.statusLabel}
          facts={[
            { label: "Session", value: `${recommendation.minutes} min` },
            { label: "Club", value: recommendation.clubLabel },
            { label: "Evidence", value: compactEvidenceLabel(recommendation.evidenceLabel) },
          ]}
        />

        <MobileCurrentActivity
          accountId={userId}
          plan={
            currentPlan
              ? { id: currentPlan.id, title: currentPlan.title, status: currentPlan.status }
              : null
          }
          round={activeRound ? { id: activeRound.id, courseName: activeRound.courseName } : null}
        />
        <MobileSection title="Next up">
          <MobileGroupedList>
            {currentPlan?.status === "completed" ? (
              <MobileListRow
                label="Review your practice"
                icon={Upload}
                detail="Add the shots from your last session."
                href={`/import?practicePlanId=${currentPlan.id}`}
              />
            ) : (
              <MobileListRow
                label="Prepare your next round"
                icon={Flag}
                detail="Course strategy and trusted club numbers"
                href="/play"
              />
            )}
          </MobileGroupedList>
        </MobileSection>
        {change && context.latestPractice.sessionId ? (
          <MobileSection title="What changed">
            <Link href={`/sessions/${context.latestPractice.sessionId}`} className={styles.change}>
              <div>
                <p className={styles.changeLabel}>{change.clubLabel} carry</p>
                <p className={styles.changeValue}>
                  {(change.carryDeltaYd ?? 0) > 0 ? "+" : ""}
                  {Math.round(change.carryDeltaYd ?? 0)}
                  <span>yd</span>
                </p>
                <p className={styles.changeDetail}>
                  Latest compared with previous practice.
                  <br />
                  Tap to inspect the measured shots.
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
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

        <div id="today-evidence" className="scroll-mt-20">
          <IOSDisclosureGroup
            label="Why this recommendation?"
            items={[
              {
                value: "why",
                title: "Why this recommendation?",
                description: recommendation.explanation,
                content: (
                  <div className="grid gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Evidence used
                    </p>
                    <ul className="grid gap-2 text-sm leading-5 text-foreground">
                      <li>Latest measured practice day · {context.latestPractice.dateLabel}</li>
                      <li>
                        {latestShots.length} measured shots across{" "}
                        {uploadLabel(latestData?.sessions.length ?? 0)}
                      </li>
                      <li>Training load · {context.trainingLoad.statusLabel}</li>
                    </ul>
                    {patternPoints.length ? (
                      <MobileShotPatternCharts
                        points={patternPoints}
                        preferredClub={recommendation.clubType}
                        compact
                      />
                    ) : null}
                    <p className="text-xs leading-5 text-muted-foreground">
                      Recommendations use measured golf evidence. Completing a practice activity
                      manually does not count as measured success.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>
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
    match.endsWith("shots") ? " shots" : " shot",
  );
}
