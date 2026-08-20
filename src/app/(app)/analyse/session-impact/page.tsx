import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { SessionImpactClient } from "@/app/analyse/session-impact/session-impact-client";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { formatClubType } from "@/lib/club-format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ sessionId?: string | string[] }>;

export default async function SessionImpactPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const data = await getSessionImpactData(requestedId);

  return (
    <PageShell>
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/analyse">
          <ArrowLeft className="size-4" aria-hidden />
          Analyse
        </Link>
      </Button>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Reversible analysis</StatusPill>}
        title="Session impact"
        description="See exactly how selected shots and robust filters change the story without deleting or rewriting the source session."
        metrics={
          data.session
            ? [
                { label: "Session", value: data.session.label, detail: data.session.dateLabel },
                {
                  label: "Evidence shots",
                  value: data.shots.length,
                  detail: data.session.sourceLabel,
                },
              ]
            : undefined
        }
        actions={
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/sessions">
              <CalendarDays className="size-4" aria-hidden />
              Choose session
            </Link>
          </Button>
        }
      />
      <SessionImpactClient shots={data.shots} />
    </PageShell>
  );
}

async function getSessionImpactData(requestedId?: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [session] = await db
    .select({
      id: sessions.id,
      date: sessions.date,
      type: sessions.type,
      source: sessions.source,
      fileName: sessions.fileName,
      courseName: sessions.courseName,
    })
    .from(sessions)
    .where(
      requestedId
        ? and(eq(sessions.id, requestedId), eq(sessions.userId, userId))
        : eq(sessions.userId, userId),
    )
    .orderBy(desc(sessions.date))
    .limit(1);

  if (!session) return { session: null, shots: [] };

  const rows = await db
    .select({
      id: shots.id,
      shotNumber: shots.shotNumber,
      clubType: shots.clubType,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideYd: shots.sideCarryYd,
      reviewStatus: shots.reviewStatus,
      qualityTag: shots.qualityTag,
      shotCategory: shots.shotCategory,
    })
    .from(shots)
    .where(
      and(eq(shots.userId, userId), eq(shots.sessionId, session.id), shotEvidenceSqlPredicate()),
    )
    .orderBy(asc(shots.shotNumber))
    .limit(5_000);

  return {
    session: {
      id: session.id,
      label: session.courseName ?? session.fileName ?? formatLabel(session.type),
      dateLabel: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(session.date),
      sourceLabel: formatLabel(session.source),
    },
    shots: rows.map((shot) => ({
      ...shot,
      clubLabel: formatClubType(shot.clubType),
      sessionSource: session.source,
    })),
  };
}

function shotEvidenceSqlPredicate() {
  return and(
    inArray(shots.reviewStatus, ["included", "restored"]),
    or(
      eq(shots.reviewStatus, "restored"),
      and(
        eq(shots.reviewStatus, "included"),
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'`,
        sql`lower(trim(coalesce(${shots.qualityTag}, ''))) not in ('exclude', 'excluded', 'delete', 'deleted', 'calibration', 'warm-up', 'warmup', 'warm_up', 'bad-data', 'bad_data', 'invalid', 'launch-monitor-error', 'misread', 'fat', 'mishit', 'thin', 'top')`,
        sql`lower(trim(coalesce(${shots.shotCategory}, ''))) not in ('warm-up', 'warmup', 'warm_up')`,
      ),
    ),
  );
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
