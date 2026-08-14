import { PracticePlannerClient } from "@/app/practice/practice-planner-client";
import { PageShell } from "@/components/premium";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import {
  DesktopWorkflowLayout,
  type DesktopWorkflowHelpItem,
  type DesktopWorkflowStep,
} from "@/components/app/desktop-workbench";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <DesktopWorkflowLayout
        steps={workflowSteps}
        helpTitle="Practice workflow help"
        helpDescription="Plan, save, upload, then review"
        helpItems={practiceWorkflowHelpItems}
        workflowRailBreakpoint="2xl"
      >
        <Card className="hidden shadow-sm lg:block" data-practice-workbench-header>
          <CardContent className="grid gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
                    Practice Planner
                  </h1>
                  <Badge
                    variant={data.context.trainingLoad.highRecentLoad ? "destructive" : "secondary"}
                  >
                    {data.context.trainingLoad.statusLabel}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Create today&apos;s session from latest practice, progress roadmap, bag trust, and
                  training load.
                </p>
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
            <ConnectedMetricBar
              embedded
              label="Practice plan context"
              metrics={[
                {
                  label: "Latest opportunity",
                  value: latestOpportunity,
                  detail: "First measurable practice job",
                },
                {
                  label: "Roadmap priority",
                  value: roadmapPriority,
                  detail: "Progress-led club focus",
                },
                { label: "Session volume", value: planVolume },
                {
                  label: "Plan confidence",
                  value: initialPlan.confidenceLabel,
                  detail: "Based on available measured evidence",
                },
              ]}
            />
          </CardContent>
        </Card>

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
