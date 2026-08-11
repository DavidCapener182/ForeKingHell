import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, CalendarDays, Flag, Gauge, ShieldCheck, Target } from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { CompanionImageHero } from "@/components/app/companion-image-hero";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getCurrentPracticePlanSummary,
  getPracticePlannerContext,
  type PracticePlannerContext,
} from "@/lib/practice-planner";
import { SELECTED_COURSE_COOKIE } from "@/lib/selected-course";

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
  const [context, currentPlan, courses, cookieStore] = await Promise.all([
    getPracticePlannerContext(userId, { compactTraining: true, includeSpeed: false }),
    getCurrentPracticePlanSummary(userId),
    listAvailableCourseTwins(userId),
    cookies(),
  ]);
  const recommendation = companionRecommendation(context);
  const selectedCourse =
    courses.find((course) => course.courseId === cookieStore.get(SELECTED_COURSE_COOKIE)?.value) ??
    courses[0] ??
    null;

  return (
    <PageShell>
      <MobileAppShell className="gap-3" data-today-companion>
        <MobileTopBar title="Today" />
        <CompanionImageHero
          variant="today"
          label="Your next move"
          alt="A golf hole viewed from the tee toward a tree-lined fairway and green"
        />

        <section className="ios-grouped-list grid gap-2 p-3" data-primary-recommendation>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Today&apos;s recommendation
              </p>
              <h1 className="mt-1 text-xl font-bold leading-6 tracking-tight">
                {recommendation.title}
              </h1>
            </div>
            <IOSInlineStatus
              label={recommendation.confidence}
              tone={recommendation.confidence === "Low" ? "attention" : "positive"}
            />
          </div>

          <p className="text-sm leading-5 text-muted-foreground">{recommendation.reason}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border/70 py-2">
            <RecommendationFact label="Suggested session" value={`${recommendation.minutes} min`} />
            <RecommendationFact label="Training load" value={context.trainingLoad.statusLabel} />
            <RecommendationFact label="Main club" value={recommendation.clubLabel} />
            <RecommendationFact label="Evidence" value={recommendation.evidenceLabel} />
          </div>

          <Button asChild className="min-h-12 rounded-xl text-base">
            <Link href={`/practice?time=${recommendation.minutes}`}>
              Plan range session
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            <Link className="focus-aaa rounded-xl bg-secondary px-2 py-3" href="/sessions">
              Latest session
            </Link>
            <Link className="focus-aaa rounded-xl bg-secondary px-2 py-3" href="/play">
              Prepare to play
            </Link>
            <Link className="focus-aaa rounded-xl bg-secondary px-2 py-3" href="/quick-bag">
              Quick Bag
            </Link>
          </div>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader title="At a glance" />
          <IOSGroupedList label="Today at a glance">
            <IOSListRow
              icon={Gauge}
              label="Latest session"
              detail={latestSessionDetail(context)}
              href="/sessions"
            />
            <IOSListRow
              icon={Target}
              label={currentPlan?.title ?? "No saved practice plan"}
              detail={
                currentPlan
                  ? `${currentPlan.timeMinutes} min · ${formatPlanStatus(currentPlan.status)}`
                  : "Build the recommended session when you are ready."
              }
              href="/practice"
            />
            <IOSListRow
              icon={Flag}
              label={selectedCourse?.name ?? "No course selected"}
              detail={
                selectedCourse
                  ? `Course strategy ready · Grade ${selectedCourse.grade}`
                  : "Choose a mapped course before your next round."
              }
              href="/play"
            />
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

function RecommendationFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
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
  const title = club ? `Practise ${clubLabel} start-line control` : "Build a measured baseline";
  const reason = club
    ? `${clubLabel} is the clearest current opportunity. ${club.shotCount} measured shots show ${formatDirectionEvidence(club)}. Begin with a short calibration block before adding pressure.`
    : "There is not enough measured evidence to isolate a weakness yet. Start with a short baseline session so the next recommendation is evidence-led.";

  return {
    title,
    reason,
    clubLabel,
    confidence,
    minutes,
    evidenceLabel: club ? `${club.shotCount} measured shots` : "Baseline needed",
    bagConfidence: bagClub?.confidenceLabel ?? "Not established",
    explanation: club
      ? `The latest measured weakness, ${bagClub?.confidenceLabel?.toLowerCase() ?? "unsettled"} bag confidence and ${context.trainingLoad.statusLabel.toLowerCase()} training load point to a ${minutes}-minute ${clubLabel} session.`
      : "The app needs a fresh measured sample before it can make a club-specific claim.",
  };
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

function formatPlanStatus(status: string) {
  return status.replaceAll("_", " ");
}
