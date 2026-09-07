import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { SessionsCompanionList } from "@/app/sessions/sessions-companion-list";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobileAppShell } from "@/components/app/mobile-app-shell";
import { PageShell } from "@/components/app/page-shell";
import { UntitledPageHeader as PageHeader } from "@/components/untitled-ui/headers";
import { Button } from "@/components/ui/button";
import { requireCurrentUserId } from "@/lib/current-user";
import { loadHistoryPage, HistoryLoadMore } from "@/app/sessions/history-page-data";
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
  const { rows: sessions, total } = await loadHistoryPage(userId, searchParams, false);
  const resolved = resolveSessionHistorySearchParams(searchParams, sessions);

  if (resolved.changed) redirect(sessionHistoryHref(resolved.query));

  return (
    <PageShell>
      <PageHeader
        title="History"
        description="Practice, simulator sessions and rounds in date order."
        actions={
          <Button asChild className="min-h-11">
            <Link href="/import">Import session</Link>
          </Button>
        }
      />
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
      <HistoryLoadMore loaded={sessions.length} total={total} query={resolved.query} />
    </PageShell>
  );
}
