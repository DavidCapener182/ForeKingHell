import { DriverDevelopmentPanel } from "@/components/analysis/driver-development-panel";
import { PracticePlannerClient } from "@/app/practice/practice-planner-client";
import { PageShell } from "@/components/premium";
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
  const explicitSpeedRequest = params?.intent === "speed" && params?.session === "speed";
  const initialSavedPlan = explicitSpeedRequest
    ? null
    : selectPracticePlannerInitialSavedPlan(data.savedPlans, data.importOptions[0]?.id ?? null);
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
