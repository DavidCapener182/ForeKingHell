import { PracticeCompanionClient } from "@/app/practice/practice-companion-client";
import { notFound } from "next/navigation";
import { MobileSavedPracticeReview } from "@/app/practice/mobile-saved-practice-review";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  generatePracticePlan,
  getCurrentPracticePlanSummary,
  getSavedPracticePlan,
  getPracticePlannerContext,
  savedPracticePlanToPracticePlan,
  selectPracticePlannerInitialSavedPlan,
  type GeneratePracticePlanOptions,
} from "@/lib/practice-planner";

type PracticeSearchParams = Promise<{
  planId?: string;
  time?: string;
  intent?: string;
  energy?: string;
  session?: string;
  balls?: string;
}>;

export default async function PracticeCompanionPage({
  searchParams,
}: {
  searchParams?: PracticeSearchParams;
}) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  if (
    params?.planId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.planId)
  )
    notFound();
  const options = practiceCompanionOptions(params);
  const requestedPlan = params?.planId ? await getSavedPracticePlan(userId, params.planId) : null;
  if (params?.planId && !requestedPlan) notFound();
  if (requestedPlan && ["completed", "analysed"].includes(requestedPlan.status)) {
    return (
      <PageShell>
        <MobileAppShell>
          <MobileSavedPracticeReview plan={requestedPlan} />
        </MobileAppShell>
      </PageShell>
    );
  }
  const explicitSpeedRequest = params?.intent === "speed" && params?.session === "speed";
  const [context, currentPlan] = await Promise.all([
    getPracticePlannerContext(userId, {
      compactTraining: true,
      includeSpeed: options.intent === "speed",
    }),
    requestedPlan ?? getCurrentPracticePlanSummary(userId),
  ]);
  if (params?.planId && !currentPlan) notFound();
  const selectedPlan = params?.planId
    ? currentPlan
    : !explicitSpeedRequest && currentPlan
      ? selectPracticePlannerInitialSavedPlan([currentPlan], null)
      : null;
  const initialPlan = selectedPlan
    ? savedPracticePlanToPracticePlan(selectedPlan, context)
    : generatePracticePlan(context, options);

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-practice-companion>
        <PracticeCompanionClient
          key={currentPlan?.id ?? "recommended"}
          accountId={userId}
          context={context}
          initialPlan={initialPlan}
          initialOptions={options}
          measuredResult={selectedPlan?.result ?? null}
        />
      </MobileAppShell>
    </PageShell>
  );
}

function practiceCompanionOptions(
  params: Awaited<PracticeSearchParams> | undefined,
): GeneratePracticePlanOptions {
  const minutes = Number(params?.time);
  const balls = Number(params?.balls);
  const energy = params?.energy;
  const intent = params?.intent;
  const session = params?.session;

  return {
    sessionType:
      session === "short_game" || session === "putting" || session === "speed" ? session : "range",
    ballCount: [30, 50, 80, 100, 120].includes(balls) ? balls : null,
    timeMinutes: [20, 30, 45, 60].includes(minutes) ? minutes : 45,
    energy: energy === "fresh" || energy === "tired" || energy === "niggle" ? energy : "normal",
    intent:
      intent === "scoring" ||
      intent === "confidence" ||
      intent === "latest_weakness" ||
      intent === "round_preparation" ||
      intent === "distance_mapping" ||
      intent === "speed"
        ? intent
        : "scoring",
    facility: {
      chippingGreen: false,
      bunker: false,
      puttingGreen: false,
      golfClubOnly: true,
      rapsodoSpeed: true,
    },
  };
}
