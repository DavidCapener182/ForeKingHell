import "server-only";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export { getSessionHistoryPage as loadHistoryPage } from "@/lib/session-history-page";

export function HistoryLoadMore({
  loaded,
  total,
  savedTotal,
  page,
  pages,
  query,
}: {
  loaded: number;
  total: number;
  savedTotal: number;
  page: number;
  pages: number;
  query: string;
}) {
  const href = (next: number) => {
    const params = new URLSearchParams(query);
    params.delete("session");
    if (next > 1) params.set("historyPage", String(next));
    else params.delete("historyPage");
    return `/sessions?${params}`;
  };
  return (
    <nav
      aria-label="Session history pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t py-4"
    >
      <p className="text-sm text-muted-foreground">
        {loaded ? (page - 1) * 24 + 1 : 0}–{(page - 1) * 24 + loaded} of {total} matching sessions ·{" "}
        {savedTotal} saved. Search and filters cover all saved history.
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={href(page - 1)} scroll={false}>
              Newer sessions
            </Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={href(page + 1)} scroll={false}>
              Older sessions
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">End of matching history</p>
        )}
      </div>
    </nav>
  );
}
