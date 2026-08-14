import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CalendarDays, ShieldAlert } from "lucide-react";

import { MobileShotPatternCharts } from "@/components/app/mobile-shot-pattern-charts";
import { TodayPrimaryAnswer } from "@/components/app/today-primary-answer";
import { IOSDisclosureGroup, IOSMetricRow } from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getCurrentPracticePlanSummary,
  getPracticePlannerContext,
  type PracticePlannerContext,
} from "@/lib/practice-planner";
import { buildShotPatternPoints } from "@/lib/shot-pattern-chart-data";
import { buildTodayRecommendation, resolveTodayPrimaryState } from "@/lib/today-primary-state";
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
  const [context, currentPlan, activeRound] = await Promise.all([
    getPracticePlannerContext(userId, { compactTraining: true, includeSpeed: false }),
    getCurrentPracticePlanSummary(userId),
    getInProgressRound(userId),
  ]);
  const recommendation = buildTodayRecommendation(context);
  const latestData = context.latestPractice.sessionId
    ? await getTodayPracticeData({ sessionId: context.latestPractice.sessionId }).catch(() => null)
    : null;
  const latestShots =
    latestData?.rawShots.filter((shot) => shot.sessionId === context.latestPractice.sessionId) ??
    [];
  const patternPoints = buildShotPatternPoints(latestShots);
  const mainState = resolveTodayPrimaryState({
    currentPlan,
    activeRound,
    recommendation,
    latestData,
  });

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
          <Card aria-label="Latest measured pattern" className="gap-3 py-3">
            <CardHeader className="px-3">
              <CardTitle>Latest pattern</CardTitle>
              <CardDescription>{latestSessionDetail(context)}</CardDescription>
            </CardHeader>
            <CardContent className="px-3">
              <Link
                href={`/sessions/${context.latestPractice.sessionId}`}
                className="focus-aaa block rounded-xl"
              >
                <MobileShotPatternCharts
                  points={patternPoints}
                  preferredClub={recommendation.clubType}
                  compact
                />
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {context.bag.issues[0] ? (
          <Alert>
            <ShieldAlert aria-hidden />
            <AlertTitle>One confidence warning</AlertTitle>
            <AlertDescription>
              {context.bag.issues[0]} <Link href="/quick-bag">Review Quick Bag.</Link>
            </AlertDescription>
          </Alert>
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

function latestSessionDetail(context: PracticePlannerContext) {
  if (!context.latestPractice.sessionId) {
    return "Import a measured session to unlock a verdict.";
  }

  return `${context.latestPractice.dateLabel} · ${context.latestPractice.clubs.reduce((total, club) => total + club.shotCount, 0)} measured shots`;
}
