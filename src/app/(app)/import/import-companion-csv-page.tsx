import { CompanionRangeImport } from "@/app/import/companion-range-import";
import { CompanionSyncStatus } from "@/components/app/companion-sync-status";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import { getSavedPracticePlan } from "@/lib/practice-planner";

type ImportCsvSearchParams = Promise<{ practicePlanId?: string }> | undefined;

export default async function ImportCompanionCsvPage({
  searchParams,
}: {
  searchParams?: ImportCsvSearchParams;
}) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const practicePlan = params?.practicePlanId
    ? await getSavedPracticePlan(userId, params.practicePlanId)
    : null;
  const validPlan =
    practicePlan &&
    ["planned", "active", "awaiting_import", "match_found"].includes(practicePlan.status) &&
    !practicePlan.sourceSessionId
      ? practicePlan
      : null;

  return (
    <PageShell>
      <MobileAppShell
        className="gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
        data-import-companion-csv
      >
        <MobileTopBar title="CSV import" />
        {validPlan ? (
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            This upload will be scored against {validPlan.title}.
          </p>
        ) : null}
        <CompanionRangeImport practicePlanId={validPlan?.id ?? null} />
        <CompanionSyncStatus accountId={userId} />
      </MobileAppShell>
    </PageShell>
  );
}
