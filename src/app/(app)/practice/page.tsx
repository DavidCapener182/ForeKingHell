import { Upload } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";

import { PracticePlannerClient } from "@/app/practice/practice-planner-client";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { PageShell, StatusPill } from "@/components/premium";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSMetricRow,
} from "@/components/app/ios-mobile";
import {
  DesktopWorkflowLayout,
  type DesktopWorkflowHelpItem,
  type DesktopWorkflowStep,
} from "@/components/app/desktop-workbench";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { requireCurrentUserId } from "@/lib/current-user";
import { reportServerFailure } from "@/lib/server-observability";
import {
  generatePracticePlan,
  getLatestPracticeSessionReview,
  getPracticePlannerPageData,
  savedPracticePlanToPracticePlan,
  selectPracticePlannerInitialSavedPlan,
  type GeneratePracticePlanOptions,
  type PracticeLatestSessionReview,
  type PracticePlan,
} from "@/lib/practice-planner";

export const dynamic = "force-dynamic";

const practiceWorkflowHelpItems: DesktopWorkflowHelpItem[] = [
  {
    title: "Score from shot evidence",
    detail:
      "Practice completion and block scores come from matched launch-monitor rows, not manual notes.",
  },
  {
    title: "Keep the plan narrow",
    detail:
      "Use the latest opportunity and roadmap priority to avoid turning one session into a full rebuild.",
  },
  {
    title: "Export the ledger",
    detail: "The block table is the handoff for coach review, reports and plan-vs-actual checks.",
  },
];

type PracticePlannerPageProps = {
  searchParams?: Promise<{
    source?: string;
    time?: string;
    intent?: string;
    energy?: string;
    session?: string;
    balls?: string;
  }>;
};
export default async function PracticePlannerPage({ searchParams }: PracticePlannerPageProps) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const data = await getPracticePlannerPageData(userId);
  const requestedOptions = practiceOptionsFromSearchParams(params);
  const generatedPlan = generatePracticePlan(data.context, requestedOptions);
  const initialSavedPlan = selectPracticePlannerInitialSavedPlan(
    data.savedPlans,
    data.importOptions[0]?.id ?? null,
  );
  const initialSavedPracticePlan = initialSavedPlan
    ? savedPracticePlanToPracticePlan(initialSavedPlan, data.context)
    : null;
  const initialPlan = initialSavedPracticePlan ?? generatedPlan;
  const latestSessionReview =
    initialSavedPlan && !initialSavedPlan.result && initialSavedPracticePlan
      ? await getLatestPracticeSessionReviewSafely(userId, initialSavedPracticePlan)
      : null;
  const initialOptions = practicePlanOptionsFromPlan(initialPlan, requestedOptions);
  const cockpit = await getPracticeCockpitMetrics(userId, latestSessionReview);
  const planVolume =
    initialPlan.totalBalls === null
      ? `Timed | ${initialPlan.estimatedTimeMinutes} min`
      : `${initialPlan.totalBalls} balls | ${initialPlan.estimatedTimeMinutes} min`;
  const latestOpportunity = data.context.latestPractice.biggestOpportunity
    ? data.context.latestPractice.biggestOpportunity.toUpperCase()
    : "Building";
  const roadmapPriority = data.context.progress.priorities[0]?.clubType.toUpperCase() ?? "Baseline";
  const workflowSteps = buildPracticeWorkflowSteps({
    planVolume,
    confidenceLabel: initialPlan.confidenceLabel,
    focusLabel: latestOpportunity,
    hasSavedPlan: Boolean(initialSavedPlan),
    hasSessionEvidence: Boolean(latestSessionReview || initialSavedPlan?.result),
  });

  return (
    <PageShell size="full">
      <MobileRouteHeader title="Practice Planner" group="improve" activeKey="practice" />
      <DesktopWorkflowLayout
        steps={workflowSteps}
        helpTitle="Practice workflow help"
        helpDescription="Plan, save, upload, then review"
        helpItems={practiceWorkflowHelpItems}
        workflowRailBreakpoint="2xl"
      >
        <header className="hidden rounded-xl border border-border bg-card p-3 shadow-sm ring-1 ring-primary/10 lg:block">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
                Practice Planner
              </h1>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Create today&apos;s session from latest practice, progress roadmap, bag trust, and
                training load.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={data.context.trainingLoad.highRecentLoad ? "amber" : "green"}>
                {data.context.trainingLoad.statusLabel}
              </StatusPill>
              <StatusPill tone="amber">Latest opportunity: {latestOpportunity}</StatusPill>
              <StatusPill tone="sky">Roadmap: {roadmapPriority}</StatusPill>
              <StatusPill tone="green">{planVolume}</StatusPill>
              <StatusPill tone="green">Confidence {initialPlan.confidenceLabel}</StatusPill>
            </div>
            <div className="hidden h-24 w-40 shrink-0 min-[1800px]:block">
              <PageArtwork
                variant="practice"
                alt=""
                className="h-full w-full"
                sizes="160px"
                priority
              />
            </div>
          </div>
        </header>

        <PracticePlannerClient
          context={data.context}
          initialPlan={initialPlan}
          savedPlans={data.savedPlans}
          templates={data.templates}
          importOptions={data.importOptions}
          latestSessionReview={latestSessionReview}
          initialOptions={initialOptions}
        />
      </DesktopWorkflowLayout>
      <PracticeSessionCockpit
        metrics={cockpit}
        plan={initialPlan}
        latestSessionReview={latestSessionReview}
        trainingLoad={{
          statusLabel: data.context.trainingLoad.statusLabel,
          highRecentLoad: data.context.trainingLoad.highRecentLoad,
          recommendation: data.context.trainingLoad.recommendation,
        }}
      />
    </PageShell>
  );
}

function buildPracticeWorkflowSteps({
  planVolume,
  confidenceLabel,
  focusLabel,
  hasSavedPlan,
  hasSessionEvidence,
}: {
  planVolume: string;
  confidenceLabel: string;
  focusLabel: string;
  hasSavedPlan: boolean;
  hasSessionEvidence: boolean;
}): DesktopWorkflowStep[] {
  return [
    {
      title: "Set session brief",
      detail: "Choose time, volume, energy, intent and available practice facilities.",
      status: "complete",
      value: planVolume,
    },
    {
      title: "Build practice blocks",
      detail: `Use ${focusLabel.toLowerCase()} as the first measurable practice focus.`,
      status: "complete",
      value: `Confidence ${confidenceLabel}`,
    },
    {
      title: "Save and start",
      detail: "Save the generated plan before the upload can be matched back to it.",
      status: hasSavedPlan ? "complete" : "current",
    },
    {
      title: "Import evidence",
      detail: "Upload or sync the matching launch-monitor session after practice.",
      status: hasSessionEvidence ? "complete" : hasSavedPlan ? "current" : "upcoming",
    },
    {
      title: "Review plan vs actual",
      detail: "Compare planned blocks against imported shot rows and export the ledger.",
      status: hasSessionEvidence ? "current" : "upcoming",
    },
  ];
}

function practiceOptionsFromSearchParams(
  params: Awaited<PracticePlannerPageProps["searchParams"]>,
): GeneratePracticePlanOptions {
  return {
    sessionType: parseSessionType(params?.session),
    ballCount: parseBallCount(params?.balls),
    timeMinutes: parsePracticeTime(params?.time),
    energy: parseEnergy(params?.energy),
    intent: parseIntent(params?.intent),
    facility: {
      chippingGreen: true,
      bunker: true,
      puttingGreen: true,
      golfClubOnly: true,
      rapsodoSpeed: true,
    },
  };
}

function practicePlanOptionsFromPlan(
  plan: PracticePlan,
  fallback: GeneratePracticePlanOptions,
): GeneratePracticePlanOptions {
  return {
    ...fallback,
    sessionType: plan.sessionType,
    ballCount: plan.totalBalls ?? fallback.ballCount,
    timeMinutes: plan.estimatedTimeMinutes,
    energy: plan.energy,
    intent: plan.intent,
  };
}

function parsePracticeTime(value: string | undefined) {
  const minutes = Number(value);

  if (minutes === 20 || minutes === 30 || minutes === 45 || minutes === 60 || minutes === 90) {
    return minutes;
  }

  return 45;
}

function parseBallCount(value: string | undefined) {
  const balls = Number(value);

  if (balls === 30 || balls === 50 || balls === 80 || balls === 100 || balls === 120) {
    return balls;
  }

  return 80;
}

function parseSessionType(value: string | undefined): GeneratePracticePlanOptions["sessionType"] {
  if (
    value === "range" ||
    value === "short_game" ||
    value === "speed" ||
    value === "putting" ||
    value === "course_warmup" ||
    value === "mixed"
  ) {
    return value;
  }

  return "range";
}

function parseEnergy(value: string | undefined): GeneratePracticePlanOptions["energy"] {
  if (value === "fresh" || value === "normal" || value === "tired" || value === "niggle") {
    return value;
  }

  return "normal";
}

function parseIntent(value: string | undefined): GeneratePracticePlanOptions["intent"] {
  if (
    value === "scoring" ||
    value === "confidence" ||
    value === "latest_weakness" ||
    value === "round_preparation" ||
    value === "distance_mapping" ||
    value === "speed"
  ) {
    return value;
  }

  return "latest_weakness";
}

async function getLatestPracticeSessionReviewSafely(
  userId: string,
  plan: PracticePlan,
): Promise<PracticeLatestSessionReview | null> {
  try {
    return await getLatestPracticeSessionReview(userId, plan);
  } catch (error) {
    reportServerFailure("practice_latest_review_failed", error, {
      "app.route": "/practice",
      "app.fallback": "empty_latest_review",
    });
    return null;
  }
}

type PracticeCockpitMetrics = {
  sourceLabel: string;
  sessionId: string | null;
  shotCount: number;
  carryAverageYd: number | null;
  spinAverageRpm: number | null;
  smashAverage: number | null;
  playableRate: number | null;
};

async function getPracticeCockpitMetrics(
  userId: string,
  latestSessionReview: PracticeLatestSessionReview | null,
): Promise<PracticeCockpitMetrics> {
  const db = getDb();
  const reviewedSessionId = latestSessionReview?.sourceSessionId ?? null;
  const latestSession =
    reviewedSessionId === null
      ? (
          await db
            .select({ id: sessions.id, date: sessions.date })
            .from(sessions)
            .where(eq(sessions.userId, userId))
            .orderBy(desc(sessions.date))
            .limit(1)
        )[0]
      : null;
  const sessionId = reviewedSessionId ?? latestSession?.id ?? null;

  if (!sessionId) {
    return {
      sourceLabel: "Waiting for import",
      sessionId: null,
      shotCount: 0,
      carryAverageYd: null,
      spinAverageRpm: null,
      smashAverage: null,
      playableRate: null,
    };
  }

  const rows = await db
    .select({
      carryYd: shots.carryYd,
      spinRate: shots.spinRate,
      smashFactor: shots.smashFactor,
      sideCarryYd: shots.sideCarryYd,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.sessionId, sessionId)))
    .limit(220);
  const sideRows = rows.filter((row) => isPracticeMetric(row.sideCarryYd));
  const playableRows = sideRows.filter((row) => Math.abs(Number(row.sideCarryYd)) <= 20);

  return {
    sourceLabel: latestSessionReview
      ? `${latestSessionReview.importedSession.shotCount}-shot reviewed session`
      : latestSession?.date
        ? `Latest import ${latestSession.date.toISOString().slice(0, 10)}`
        : "Latest import",
    sessionId,
    shotCount: rows.length,
    carryAverageYd: averagePracticeMetric(rows.map((row) => row.carryYd)),
    spinAverageRpm: averagePracticeMetric(rows.map((row) => row.spinRate)),
    smashAverage: averagePracticeMetric(rows.map((row) => row.smashFactor)),
    playableRate:
      sideRows.length > 0 ? Math.round((playableRows.length / sideRows.length) * 100) : null,
  };
}

function PracticeSessionCockpit({
  metrics,
  plan,
  latestSessionReview,
  trainingLoad,
}: {
  metrics: PracticeCockpitMetrics;
  plan: PracticePlan;
  latestSessionReview: PracticeLatestSessionReview | null;
  trainingLoad: {
    statusLabel: string;
    highRecentLoad: boolean;
    recommendation: string;
  };
}) {
  const readiness = latestSessionReview
    ? `${latestSessionReview.score.score}/100`
    : trainingLoad.highRecentLoad
      ? "Ease off"
      : "Ready";
  const readinessDetail = latestSessionReview
    ? latestSessionReview.score.verdict
    : trainingLoad.recommendation;

  return (
    <div className="lg:hidden">
      <IOSDisclosureGroup
        label="Latest practice evidence"
        items={[
          {
            value: "active-session-evidence",
            title: "Active session mode",
            summary: readiness,
            description: `${metrics.sourceLabel}. Practice scoring is driven by imported launch-monitor shots.`,
            content: (
              <IOSGroupedList label="Latest measured practice metrics" className="bg-card">
                <IOSMetricRow
                  label="Carry"
                  value={formatPracticeYards(metrics.carryAverageYd)}
                  detail={`${metrics.shotCount} shots`}
                />
                <IOSMetricRow
                  label="Spin"
                  value={formatPracticeSpin(metrics.spinAverageRpm)}
                  detail="Session average"
                />
                <IOSMetricRow
                  label="Smash"
                  value={formatPracticeDecimal(metrics.smashAverage)}
                  detail="Efficiency"
                />
                <IOSMetricRow label="Readiness" value={readiness} detail={readinessDetail} />
                <IOSMetricRow
                  label="Playable rate"
                  value={metrics.playableRate === null ? "--" : `${metrics.playableRate}%`}
                />
                <IOSListRow
                  label="Next drill"
                  detail={
                    plan.blocks[0]?.title ??
                    latestSessionReview?.score.nextAction ??
                    "Import session"
                  }
                />
                <IOSListRow
                  label={metrics.sessionId ? "Review session shots" : "Import session"}
                  detail={trainingLoad.recommendation}
                  href={
                    metrics.sessionId
                      ? `/shots?sessionId=${encodeURIComponent(metrics.sessionId)}`
                      : "/import"
                  }
                  icon={Upload}
                />
              </IOSGroupedList>
            ),
          },
        ]}
      />
    </div>
  );
}

function isPracticeMetric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function averagePracticeMetric(values: Array<number | null>) {
  const finite = values.filter(isPracticeMetric);

  if (finite.length === 0) {
    return null;
  }

  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function formatPracticeYards(value: number | null) {
  return value === null ? "--" : Math.round(value).toString();
}

function formatPracticeSpin(value: number | null) {
  return value === null ? "--" : Math.round(value).toLocaleString("en-GB");
}

function formatPracticeDecimal(value: number | null) {
  return value === null ? "--" : value.toFixed(2);
}
