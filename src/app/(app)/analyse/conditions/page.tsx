import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, CloudSun, Database, ShieldAlert } from "lucide-react";

import { AnalysisPageTemplate } from "@/components/app/analysis-page-template";
import { DataWarning, RecommendedAction } from "@/components/app/evidence-status";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db/client";
import { clubs, sessions, shots } from "@/db/schema";
import {
  buildConditionsAnalysis,
  strongestConditionDifference,
  type ConditionShot,
} from "@/lib/conditions-analysis";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ConditionsAnalysisPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const params = await searchParams;
  const data = await getConditionsData(params?.clubId);
  const strongest = strongestConditionDifference(data.breakdowns);

  return (
    <PageShell>
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/analyse">
          <ArrowLeft className="size-4" aria-hidden />
          Analyse
        </Link>
      </Button>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Conditions analysis</StatusPill>}
        title="See when the same club behaves differently"
        description="Compare recorded indoor, outdoor, weather, elevation, surface and ball conditions without silently mixing missing context into the result."
        actions={
          <form action="/analyse/conditions" className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm font-semibold">
              Club
              <select
                name="clubId"
                defaultValue={data.selectedClub?.id ?? ""}
                className="min-h-11 min-w-52 rounded-xl border bg-background px-3"
              >
                {data.clubOptions.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.label} · {club.shotCount} shots
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" className="min-h-11">
              Compare
            </Button>
          </form>
        }
      />

      {data.selectedClub ? (
        <AnalysisPageTemplate
          answer={
            <Card className="premium-card">
              <CardHeader>
                <p className="text-sm font-semibold text-primary">Answer</p>
                <CardTitle className="mt-1 text-2xl">
                  {strongest
                    ? `${strongest.high.label} is associated with ${round(strongest.deltaYd)} yd more carry than ${strongest.low.label}`
                    : `There is not yet a repeatable conditions comparison for ${data.selectedClub.label}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <EvidenceMetric label="Club" value={data.selectedClub.label} />
                <EvidenceMetric label="Measured shots" value={String(data.shotCount)} />
                <EvidenceMetric label="Sessions" value={String(data.sessionCount)} />
              </CardContent>
            </Card>
          }
          dataWarning={
            <DataWarning
              title="Conditions are associations, not causes"
              detail="Venue, strike, target and session intent may move with the recorded condition. Missing metadata stays outside each comparison instead of being guessed."
              action={
                <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-xl">
                  <Link href="/analyse/workspace">Open Data Quality Inbox</Link>
                </Button>
              }
            />
          }
          recommendation={
            <RecommendedAction
              title={strongest ? "Retest the largest difference" : "Record a controlled comparison"}
              detail={
                strongest
                  ? `Use the same ${data.selectedClub.label}, ball, target and warm-up in both conditions before changing the stock number.`
                  : "Import two sessions for the same club with condition metadata and at least six measured shots in each group."
              }
              href="/practice/quick-range"
              actionLabel="Start Quick Range"
            />
          }
        >
          <section className="grid gap-4 xl:grid-cols-2" aria-labelledby="condition-breakdowns">
            <div className="xl:col-span-2">
              <h2 id="condition-breakdowns" className="text-2xl font-semibold tracking-tight">
                Recorded condition breakdowns
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confidence requires repeated evidence: high is 30+ shots across 3+ sessions;
                moderate is 12+ across 2+ sessions.
              </p>
            </div>
            {data.breakdowns.map((breakdown) => (
              <article key={breakdown.dimension} className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{breakdown.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {breakdown.description}
                    </p>
                  </div>
                  <StatusPill tone={breakdown.groups.length >= 2 ? "green" : "amber"}>
                    {breakdown.recordedShots} recorded
                  </StatusPill>
                </div>
                {breakdown.groups.length ? (
                  <div
                    className="mt-4 overflow-hidden rounded-xl border"
                    role="region"
                    aria-label={`${breakdown.label} evidence table`}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Condition</TableHead>
                          <TableHead className="text-right">Carry</TableHead>
                          <TableHead className="text-right">Side</TableHead>
                          <TableHead className="text-right">Evidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {breakdown.groups.map((group) => (
                          <TableRow key={group.label}>
                            <TableCell className="font-medium">{group.label}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatYards(group.meanCarryYd)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatYards(group.meanAbsoluteSideYd)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {group.confidence} · {group.shotCount} shots / {group.sessionCount}{" "}
                              sessions
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    <Database className="mt-0.5 size-5 shrink-0" aria-hidden />
                    No recorded metadata for this condition.
                  </div>
                )}
                <div className="mt-3 flex gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p>
                    {breakdown.caveat} {breakdown.unclassifiedShots} shot
                    {breakdown.unclassifiedShots === 1 ? "" : "s"} excluded as unclassified.
                  </p>
                </div>
              </article>
            ))}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="font-semibold">Need the row-level proof?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open Shots with the same club and inspect the preserved source fields before
                accepting a condition claim.
              </p>
            </div>
            <Button asChild variant="outline" className="min-h-11 shrink-0">
              <Link href={`/shots?clubId=${data.selectedClub.id}`}>
                Inspect raw shots
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </section>
        </AnalysisPageTemplate>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <CloudSun className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Import measured club data first</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Conditions analysis needs a club, a session and measured carry rows. It never invents a
            comparison from manual notes alone.
          </p>
          <Button asChild className="mt-5 min-h-11">
            <Link href="/import">Import a session</Link>
          </Button>
        </div>
      )}
    </PageShell>
  );
}

async function getConditionsData(requestedClubId?: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const rawClubOptions = await db
    .select({
      id: clubs.id,
      type: clubs.type,
      brand: clubs.brand,
      model: clubs.model,
      shotCount: count(shots.id),
    })
    .from(clubs)
    .innerJoin(shots, and(eq(shots.clubId, clubs.id), eq(shots.userId, userId)))
    .where(eq(clubs.userId, userId))
    .groupBy(clubs.id, clubs.type, clubs.brand, clubs.model)
    .orderBy(desc(count(shots.id)));
  const clubOptions = rawClubOptions.map((club) => ({
    id: club.id,
    label: [club.brand, club.model].filter(Boolean).join(" ") || formatClubType(club.type),
    shotCount: Number(club.shotCount),
  }));
  const selectedClub =
    clubOptions.find((club) => club.id === requestedClubId) ?? clubOptions[0] ?? null;

  if (!selectedClub) {
    return { clubOptions, selectedClub: null, shotCount: 0, sessionCount: 0, breakdowns: [] };
  }

  const rows = await db
    .select({
      sessionId: shots.sessionId,
      carryYd: shots.carryYd,
      sideCarryYd: shots.sideCarryYd,
      playContext: shots.playContext,
      location: sessions.location,
      weather: sessions.weatherJson,
      sourceRaw: shots.sourceRawJson,
    })
    .from(shots)
    .innerJoin(sessions, and(eq(shots.sessionId, sessions.id), eq(sessions.userId, userId)))
    .where(and(eq(shots.userId, userId), eq(shots.clubId, selectedClub.id)))
    .orderBy(desc(shots.shotAt))
    .limit(5000);
  const evidence = rows satisfies ConditionShot[];

  return {
    clubOptions,
    selectedClub,
    shotCount: evidence.length,
    sessionCount: new Set(evidence.map((shot) => shot.sessionId)).size,
    breakdowns: buildConditionsAnalysis(evidence),
  };
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/55 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${round(value)} yd`;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
