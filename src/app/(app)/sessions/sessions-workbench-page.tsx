import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Upload } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/app/page-shell";
import { UntitledPageHeader as PageHeader } from "@/components/untitled-ui/headers";
import { requireCurrentUserId } from "@/lib/current-user";
import { UrlBackedSessionTimeline } from "@/app/sessions/session-timeline";
import { loadHistoryPage, HistoryLoadMore } from "@/app/sessions/history-page-data";
import {
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
  const result = await loadHistoryPage(userId, searchParams, true);
  const { rows, total, filterOptions } = result;

  const original = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) =>
      value === undefined ? [] : Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]],
    ),
  ).toString();
  if (result.query !== original) redirect(sessionHistoryHref(result.query));

  return (
    <PageShell>
      <PageHeader
        title="History"
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

      {result.savedTotal > 0 ? (
        <UrlBackedSessionTimeline
          sessions={rows}
          accountId={userId}
          filterOptions={filterOptions}
          matchingTotal={total}
        />
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
      <HistoryLoadMore
        loaded={rows.length}
        total={total}
        savedTotal={result.savedTotal}
        page={result.page}
        pages={result.pages}
        query={result.query}
      />
    </PageShell>
  );
}
