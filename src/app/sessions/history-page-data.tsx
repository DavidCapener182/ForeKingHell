import "server-only";
import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { getRecentSessionHistory } from "@/lib/session-history";
import { Button } from "@/components/ui/button";
import type { SessionHistorySearchParamsInput } from "@/lib/session-history-search-params";
export async function loadHistoryPage(
  userId: string,
  params: SessionHistorySearchParamsInput,
  includeShotPatterns: boolean,
) {
  const [result] = await getDb()
    .select({ value: count() })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  const total = result?.value ?? 0;
  const requested = Number(params.historyLimit ?? 24);
  const limit = Math.min(
    total || 24,
    Number.isSafeInteger(requested) && requested >= 24 ? requested : 24,
  );
  const rows = await getRecentSessionHistory(userId, limit, { includeShotPatterns });
  return { rows, total, limit };
}
export function HistoryLoadMore({
  loaded,
  total,
  query,
}: {
  loaded: number;
  total: number;
  query: string;
}) {
  const params = new URLSearchParams(query);
  params.set("historyLimit", String(Math.min(total, loaded + 24)));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t py-4">
      <p className="text-sm text-muted-foreground">
        {loaded} of {total} saved sessions loaded. Filters apply to the loaded history.
      </p>
      {loaded < total ? (
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/sessions?${params}`} scroll={false}>
            Load older sessions
          </Link>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">End of saved history</p>
      )}
    </div>
  );
}
