import { PracticePlannerClient } from "@/app/practice/practice-planner-client";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageShell, StatusPill } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  generatePracticePlan,
  getLatestPracticeSessionReview,
  getPracticePlannerPageData,
  savedPracticePlanToPracticePlan,
  type PracticeLatestSessionReview,
  type PracticePlan,
} from "@/lib/practice-planner";

export const dynamic = "force-dynamic";

export default async function PracticePlannerPage() {
  const userId = await requireCurrentUserId();
  const data = await getPracticePlannerPageData(userId);
  const generatedPlan = generatePracticePlan(data.context, {
    sessionType: "range",
    ballCount: 80,
    timeMinutes: 45,
    energy: "normal",
    intent: "latest_weakness",
    facility: {
      chippingGreen: true,
      bunker: true,
      puttingGreen: true,
      golfClubOnly: true,
      rapsodoSpeed: true,
    },
  });
  const latestOpenPlan =
    data.savedPlans.find(
      (plan) =>
        plan.status === "planned" ||
        plan.status === "awaiting_import" ||
        plan.status === "match_found",
    ) ?? null;
  const latestOpenPracticePlan = latestOpenPlan
    ? savedPracticePlanToPracticePlan(latestOpenPlan, data.context)
    : null;
  const initialPlan = latestOpenPracticePlan ?? generatedPlan;
  const latestSessionReview =
    latestOpenPlan && !latestOpenPlan.result && latestOpenPracticePlan
      ? await getLatestPracticeSessionReviewSafely(userId, latestOpenPracticePlan)
      : null;
  const planVolume =
    initialPlan.totalBalls === null
      ? `Timed | ${initialPlan.estimatedTimeMinutes} min`
      : `${initialPlan.totalBalls} balls | ${initialPlan.estimatedTimeMinutes} min`;
  const latestOpportunity = data.context.latestPractice.biggestOpportunity
    ? data.context.latestPractice.biggestOpportunity.toUpperCase()
    : "Building";
  const roadmapPriority =
    data.context.progress.priorities[0]?.clubType.toUpperCase() ?? "Baseline";

  return (
    <PageShell size="full">
      <MobileRouteHeader title="Improve" group="improve" activeKey="practice" />
      <header className="rounded-xl border bg-white/85 p-3 shadow-sm ring-1 ring-emerald-950/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
              Practice Planner
            </h1>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Create today&apos;s session from latest practice, progress roadmap, bag trust,
              and training load.
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
        </div>
      </header>

      <PracticePlannerClient
        context={data.context}
        initialPlan={initialPlan}
        savedPlans={data.savedPlans}
        templates={data.templates}
        importOptions={data.importOptions}
        latestSessionReview={latestSessionReview}
      />
    </PageShell>
  );
}

async function getLatestPracticeSessionReviewSafely(
  userId: string,
  plan: PracticePlan,
): Promise<PracticeLatestSessionReview | null> {
  try {
    return await getLatestPracticeSessionReview(userId, plan);
  } catch (error) {
    console.error("[practice] Latest session review unavailable", error);
    return null;
  }
}
