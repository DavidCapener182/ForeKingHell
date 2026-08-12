import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { RapsodoCompanionClient } from "@/app/rapsodo/rapsodo-companion-client";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import { getSavedPracticePlan } from "@/lib/practice-planner";

export const dynamic = "force-dynamic";

export default async function RapsodoCompanionPage({
  searchParams,
}: {
  searchParams?: Promise<{ practicePlanId?: string }>;
}) {
  const [status, userId, params] = await Promise.all([
    getRapsodoConnectionStatusAction(),
    requireCurrentUserId(),
    searchParams,
  ]);
  const initialStatus = status.ok
    ? status.data
    : { connected: false, expiresAt: null, profile: null };
  const plan = params?.practicePlanId
    ? await getSavedPracticePlan(userId, params.practicePlanId)
    : null;
  const validPlanId =
    plan &&
    ["planned", "active", "awaiting_import", "match_found"].includes(plan.status) &&
    !plan.sourceSessionId
      ? plan.id
      : null;

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-rapsodo-companion>
        <MobileTopBar title="Rapsodo R-Cloud" />
        {validPlanId ? (
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            This session will be scored against {plan?.title}.
          </p>
        ) : null}
        <RapsodoCompanionClient initialStatus={initialStatus} practicePlanId={validPlanId} />
      </MobileAppShell>
    </PageShell>
  );
}
