import { ImportPracticeContextBanner } from "@/app/import/import-practice-context-banner";
import { ImportWorkspaceChoice } from "@/app/import/import-workspace-choice";
import { UntitledPageHeader } from "@/components/untitled-ui/headers";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CompanionSyncStatus } from "@/components/app/companion-sync-status";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import { getImportPracticeContext } from "@/lib/import-practice-context";

type ImportCsvSearchParams = Promise<{ practicePlanId?: string; source?: string }> | undefined;

export default async function ImportCompanionCsvPage({
  searchParams,
}: {
  searchParams?: ImportCsvSearchParams;
}) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const [profile] = await getDb()
    .select({ preferredUnits: users.preferredUnits })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const validPlan = await getImportPracticeContext(userId, params?.practicePlanId);

  return (
    <PageShell>
      <MobileAppShell
        className="gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
        data-import-companion-csv
      >
        <UntitledPageHeader
          title="Import"
          description="Review files, settings and shot evidence."
        />
        <ImportPracticeContextBanner plan={validPlan} />
        <ImportWorkspaceChoice
          practicePlanId={validPlan?.id ?? null}
          defaultDistanceUnit={profile?.preferredUnits === "metres" ? "meters" : "yards"}
          sample={params?.source === "sample"}
        />
        <CompanionSyncStatus accountId={userId} />
      </MobileAppShell>
    </PageShell>
  );
}
