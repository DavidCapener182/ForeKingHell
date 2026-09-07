import "server-only";
import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { CoachSourceList } from "./coach-source-list";

export async function CoachSourceRecords({
  userId,
  source,
  page: requestedPage,
}: {
  userId: string;
  source?: string;
  page?: string;
}) {
  const db = getDb();
  const sources = await db
    .selectDistinct({ source: sessions.source })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  const selected = sources.some((item) => item.source === source) ? source : undefined;
  const where = and(
    eq(sessions.userId, userId),
    selected ? eq(sessions.source, selected) : undefined,
  );
  const totals = await db.select({ count: count() }).from(sessions).where(where);
  const total = totals[0]?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(pages, Math.max(1, Number.parseInt(requestedPage ?? "1", 10) || 1));
  const rows = await db
    .select({
      id: sessions.id,
      date: sessions.date,
      name: sessions.fileName,
      course: sessions.courseName,
      source: sessions.source,
      type: sessions.type,
    })
    .from(sessions)
    .where(where)
    .orderBy(desc(sessions.date), desc(sessions.id))
    .limit(20)
    .offset((page - 1) * 20);
  const href = (target: number) =>
    `/coach?${new URLSearchParams({ tab: "evidence", evidencePage: String(target), ...(selected ? { source: selected } : {}) })}`;
  return (
    <section className="grid gap-4" aria-label="Source session records">
      <h2 className="text-xl font-semibold">Source sessions</h2>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <input type="hidden" name="tab" value="evidence" />
        <label className="grid gap-1 text-sm">
          Source
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            name="source"
            defaultValue={selected ?? ""}
          >
            <option value="">All sources</option>
            {sources.map((item) => (
              <option key={item.source} value={item.source}>
                {item.source}
              </option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded-lg border px-4" type="submit">
          Filter sources
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        {total} owned sessions · page {page} of {pages}. Source records do not imply a confidence
        score; club confidence is shown separately.
      </p>
      <CoachSourceList rows={rows.map((row) => ({ ...row, date: row.date.toISOString() }))} />
      <nav className="flex flex-wrap gap-4" aria-label="Source session pages">
        {page > 1 ? (
          <Link className="inline-flex min-h-11 items-center underline" href={href(page - 1)}>
            Previous sessions
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="inline-flex min-h-11 items-center underline" href={href(page + 1)}>
            Next sessions
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
