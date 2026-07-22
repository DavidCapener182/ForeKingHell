import Link from "next/link";
import { CalendarDays, Upload } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { SessionTimeline } from "@/app/sessions/session-timeline";

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
        <SessionTimeline sessions={rows} />
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
      playContext: sessions.playContext,
      notes: sessions.notes,
      equipmentNotes: sessions.equipmentNotes,
      shotCount: sql<number>`count(${shots.id})::int`,
    })
    .from(sessions)
    .leftJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .where(eq(sessions.userId, userId))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.date))
    .limit(24);

  return rows.map((row) => ({
    id: row.id,
    isRound: row.type === "round" || row.type === "real_round",
    title: row.courseName ?? row.fileName ?? formatLabel(row.type),
    dateLabel: dateFormatter.format(row.date),
    shotCount: Number(row.shotCount ?? 0),
    typeLabel: formatLabel(row.type),
    sourceLabel: formatLabel(row.source),
    contextLabel: formatLabel(row.playContext),
    notes: row.notes,
    equipmentNotes: row.equipmentNotes,
  }));
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
