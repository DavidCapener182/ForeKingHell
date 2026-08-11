import { PracticeCompanionClient } from "@/app/practice/practice-companion-client";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  generatePracticePlan,
  getCurrentPracticePlanSummary,
  getPracticePlannerContext,
  savedPracticePlanToPracticePlan,
  type GeneratePracticePlanOptions,
} from "@/lib/practice-planner";

type PracticeSearchParams = Promise<{
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
  const [context, currentPlan] = await Promise.all([
    getPracticePlannerContext(userId),
    getCurrentPracticePlanSummary(userId),
  ]);
  const options = practiceCompanionOptions(params);
  const resumable =
    currentPlan &&
    ["planned", "active", "awaiting_import", "match_found"].includes(currentPlan.status)
      ? currentPlan
      : null;
  const initialPlan = resumable
    ? savedPracticePlanToPracticePlan(resumable, context)
    : generatePracticePlan(context, options);

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-practice-companion>
        <MobileTopBar title="Practice" />
        <PracticeCompanionClient
          accountId={userId}
          context={context}
          initialPlan={initialPlan}
          initialOptions={options}
          measuredResult={currentPlan?.result ?? null}
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
