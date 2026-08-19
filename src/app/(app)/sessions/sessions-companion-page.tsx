import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { SessionsCompanionList } from "@/app/sessions/sessions-companion-list";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { requireCurrentUserId } from "@/lib/current-user";
import { getRecentSessionHistory } from "@/lib/session-history";
import {
  resolveSessionHistorySearchParams,
  sessionHistoryHref,
  type SessionHistorySearchParamsInput,
} from "@/lib/session-history-search-params";

export default async function SessionsCompanionPage({
  searchParams,
}: {
  searchParams: SessionHistorySearchParamsInput;
}) {
  const userId = await requireCurrentUserId();
  const sessions = await getRecentSessionHistory(userId, 24, { includeShotPatterns: false });
  const resolved = resolveSessionHistorySearchParams(searchParams, sessions);

  if (resolved.changed) redirect(sessionHistoryHref(resolved.query));

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-sessions-companion>
        {sessions.length > 0 ? (
          <SessionsCompanionList sessions={sessions} accountId={userId} />
        ) : (
          <AppEmptyState
            icon={<CalendarDays className="size-6" aria-hidden />}
            title="No sessions yet"
            description="Import measured data or add a round to create your review history."
            primaryAction={
              <Button asChild className="min-h-11 rounded-xl">
                <Link href="/import">Import data</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline" className="min-h-11 rounded-xl">
                <Link href="/rounds/new">Add round</Link>
              </Button>
            }
            className="ios-grouped-list border-0"
          />
        )}
      </MobileAppShell>
    </PageShell>
  );
}
