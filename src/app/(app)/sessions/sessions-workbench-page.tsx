import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Upload } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import { UrlBackedSessionTimeline } from "@/app/sessions/session-timeline";
import { getRecentSessionHistory } from "@/lib/session-history";
import {
  resolveSessionHistorySearchParams,
  sessionHistoryHref,
  type SessionHistorySearchParamsInput,
} from "@/lib/session-history-search-params";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: SessionHistorySearchParamsInput;
}) {
  const userId = await requireCurrentUserId();
  const rows = await getRecentSessionHistory(userId);
  const resolved = resolveSessionHistorySearchParams(searchParams, rows);

  if (resolved.changed) redirect(sessionHistoryHref(resolved.query));

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="green">Review history</StatusPill>}
        title="Your golf history"
        description="Move through practice, simulator sessions and rounds chronologically. Select any entry for its evidence-led preview."
        actions={
          <Button asChild className="premium-action min-h-11 rounded-xl">
            <Link href="/import">
              <Upload className="size-4" aria-hidden />
              Import session
            </Link>
          </Button>
        }
      />

      {rows.length > 0 ? (
        <UrlBackedSessionTimeline sessions={rows} accountId={userId} />
      ) : (
        <AppEmptyState
          icon={<CalendarDays className="size-6" aria-hidden />}
          title="No sessions yet"
          description="Import launch-monitor data or add a round to create your review history."
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
        />
      )}
    </PageShell>
  );
}
