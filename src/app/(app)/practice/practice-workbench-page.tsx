import { DriverDevelopmentPanel } from "@/components/analysis/driver-development-panel";
import { PracticePlannerClient } from "@/app/practice/practice-planner-client";
import { PageShell } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import { reportServerFailure } from "@/lib/server-observability";
import { notFound } from "next/navigation";
import { practiceSourceSessionId } from "@/lib/practice-handoff";
import {
  generatePracticePlan,
  getLatestPracticeSessionReview,
  getPracticePlannerPageData,
  getSavedPracticePlan,
  getPracticeSourceSession,
  savedPracticePlanToPracticePlan,
  selectPracticePlannerInitialSavedPlan,
  type GeneratePracticePlanOptions,
  type PracticeLatestSessionReview,
  type PracticePlan,
} from "@/lib/practice-planner";

export const dynamic = "force-dynamic";

type PracticePlannerPageProps = {
  searchParams?: Promise<{
    source?: string;
    time?: string;
    intent?: string;
    energy?: string;
    session?: string;
    balls?: string;
    goalId?: string;
    planId?: string;
    club?: string;
    sourceSessionId?: string;
  }>;
};
export default async function PracticePlannerPage({ searchParams }: PracticePlannerPageProps) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const requestedOptions = practiceOptionsFromSearchParams(params);
  if (
    requestedOptions.sourceSessionId &&
    !(await getPracticeSourceSession(userId, requestedOptions.sourceSessionId))
  )
    notFound();
  const requestedPlan = params?.planId ? await getSavedPracticePlan(userId, params.planId) : null;
  if (params?.planId && !requestedPlan) notFound();
  const data = await getPracticePlannerPageData(userId, {
    sourceSessionId: requestedOptions.sourceSessionId,
  });
  if (requestedPlan && !data.savedPlans.some((plan) => plan.id === requestedPlan.id))
    data.savedPlans.unshift(requestedPlan);
  const generatedPlan = generatePracticePlan(data.context, requestedOptions);
  const explicitSpeedRequest = params?.intent === "speed" && params?.session === "speed";
  const initialSavedPlan =
    requestedPlan ??
    (explicitSpeedRequest || requestedOptions.focusClub || requestedOptions.sourceSessionId
      ? null
      : selectPracticePlannerInitialSavedPlan(data.savedPlans, data.importOptions[0]?.id ?? null));
  const initialSavedPracticePlan = initialSavedPlan
    ? savedPracticePlanToPracticePlan(initialSavedPlan, data.context)
    : null;
  const initialPlan = initialSavedPracticePlan ?? generatedPlan;
  const latestSessionReview =
    initialSavedPlan && !initialSavedPlan.result && initialSavedPracticePlan
      ? await getLatestPracticeSessionReviewSafely(userId, initialSavedPracticePlan)
      : null;
  const initialOptions = practicePlanOptionsFromPlan(initialPlan, requestedOptions);

  return (
    <PageShell size="full" contentClassName="pb-5">
      <PracticePlannerClient
        key={
          initialSavedPlan?.id ??
          `recommended:${requestedOptions.sourceSessionId ?? "latest"}:${requestedOptions.focusClub ?? "auto"}`
        }
        goalId={
          params?.goalId && /^[0-9a-f-]{36}$/i.test(params.goalId) ? params.goalId : undefined
        }
        context={data.context}
        initialPlan={initialPlan}
        savedPlans={data.savedPlans}
        templates={data.templates}
        importOptions={data.importOptions}
        latestSessionReview={latestSessionReview}
        initialOptions={initialOptions}
      />
      <DriverDevelopmentPanel compact />
    </PageShell>
  );
}

function practiceOptionsFromSearchParams(
  params: Awaited<PracticePlannerPageProps["searchParams"]>,
): GeneratePracticePlanOptions {
  return {
    sourceSessionId: practiceSourceSessionId(params),
    focusClub: /^[a-z0-9]{1,12}$/i.test(params?.club ?? "")
      ? params?.club?.toLowerCase()
      : undefined,
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
    sourceSessionId: plan.sourceContext.latestPractice.sessionId ?? fallback.sourceSessionId,
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
