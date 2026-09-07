"use client";

import { PageShell } from "@/components/premium";
import { QuickRangeCompanionSession } from "./quick-range-session";

/** Both surfaces use the same account draft, clock, labels and historical notes. */
export function QuickRangeWorkbenchSession({
  focus,
  accountId,
  initialClubType,
}: {
  focus: string;
  accountId: string;
  initialClubType?: string;
}) {
  return (
    <PageShell>
      <div data-quick-range-desktop>
        <QuickRangeCompanionSession
          focus={focus}
          accountId={accountId}
          initialClubType={initialClubType}
        />
      </div>
    </PageShell>
  );
}
