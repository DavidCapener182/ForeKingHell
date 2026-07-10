import Link from "next/link";
import { ArrowRight, CalendarDays, Database, Flag, Upload } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function SessionsPage() {
  const rows = await getRecentSessions();

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="green">Review history</StatusPill>}
        title="Sessions"
        description="Open practice and round evidence in one chronological history, then continue into the relevant review."
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
        <section
          aria-label="Recent sessions"
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          {rows.map((session, index) => {
            const isRound = session.type === "round" || session.type === "real_round";
            const href = isRound ? `/rounds/${session.id}` : `/today?session=${session.id}`;
            const Icon = isRound ? Flag : Database;

            return (
              <Link
                key={session.id}
                href={href}
                className="focus-aaa group grid min-h-[5.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 outline-none transition-colors last:border-b-0 hover:bg-secondary/55 active:bg-secondary motion-reduce:transition-none sm:px-5"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {session.courseName ?? session.fileName ?? session.typeLabel}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {dateFormatter.format(session.date)} · {session.shotCount} shot
                    {session.shotCount === 1 ? "" : "s"} · {session.sourceLabel}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {index === 0 ? <StatusPill tone="sky">Latest</StatusPill> : null}
                  <ArrowRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </span>
              </Link>
            );
          })}
        </section>
      ) : (
        <Card className="premium-card">
          <CardContent className="grid place-items-center gap-3 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
              <CalendarDays className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold">No sessions yet</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Import launch-monitor data or add a round to create your review history.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="min-h-11 rounded-xl">
                <Link href="/import">Import data</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11 rounded-xl">
                <Link href="/rounds/new">Add round</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

async function getRecentSessions() {
  const userId = await requireCurrentUserId();
  const rows = await getDb()
    .select({
      id: sessions.id,
      type: sessions.type,
      source: sessions.source,
      date: sessions.date,
      courseName: sessions.courseName,
      fileName: sessions.fileName,
      shotCount: sql<number>`count(${shots.id})::int`,
    })
    .from(sessions)
    .leftJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .where(eq(sessions.userId, userId))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.date))
    .limit(24);

  return rows.map((row) => ({
    ...row,
    shotCount: Number(row.shotCount ?? 0),
    typeLabel: formatLabel(row.type),
    sourceLabel: formatLabel(row.source),
  }));
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
