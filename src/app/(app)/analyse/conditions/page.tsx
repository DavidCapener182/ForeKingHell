import { directionalMetricSql } from "@/lib/directional-confidence-sql";
import Link from "next/link";
import { and, count, desc, eq, gte, lte, inArray, or, sql } from "drizzle-orm";
import { ArrowLeft, ArrowRight, CloudSun, Database, ShieldAlert } from "lucide-react";

import { ConditionsScope, ConditionProof } from "@/app/analyse/conditions/conditions-controls";
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
  classifyCondition,
  conditionDimensions,
  strongestConditionDifference,
  type ConditionShot,
} from "@/lib/conditions-analysis";
import { formatClubType } from "@/lib/club-format";
import { requireCurrentUserId } from "@/lib/current-user";
import { isShotEvidenceEligible } from "@/lib/shot-review";

export const dynamic = "force-dynamic";

export default async function ConditionsAnalysisPage({
  searchParams,
}: {
  searchParams?: Promise<{
    clubId?: string;
    dimension?: string;
    from?: string;
    to?: string;
    group?: string;
    proofPage?: string;
  }>;
}) {
  const params = await searchParams;
  const from = validDate(params?.from);
  const to = validDate(params?.to);
  const data = await getConditionsData(params?.clubId, from, to);
  const dimension = conditionDimensions.find((value) => value === params?.dimension) ?? "all";
  const breakdowns =
    dimension === "all"
      ? data.breakdowns
      : data.breakdowns.filter((item) => item.dimension === dimension);
  const strongest = strongestConditionDifference(breakdowns);
  const baseQuery = new URLSearchParams({
    clubId: data.selectedClub?.id ?? "",
    dimension,
    from,
    to,
  });
  const evidenceHref = (dim: string, group: string, page = 1) =>
    `/analyse/conditions?${new URLSearchParams({ ...Object.fromEntries(baseQuery), dimension: dim, group, proofPage: String(page) }).toString()}#condition-proof`;
  const proofDimension = conditionDimensions.find((value) => value === dimension);
  const proofRows =
    params?.group && proofDimension
      ? data.evidence.filter(
          (row) => (classifyCondition(row, proofDimension) ?? "unknown") === params.group,
        )
      : [];
  const proofPage = Math.max(
    1,
    Math.min(
      Math.ceil(proofRows.length / 50) || 1,
      Number.parseInt(params?.proofPage ?? "1", 10) || 1,
    ),
  );

  return (
    <PageShell>
      <Button asChild variant="ghost" className="min-h-11 w-fit px-0">
        <Link href="/analyse">
          <ArrowLeft className="size-4" aria-hidden />
          Analyse
        </Link>
      </Button>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Conditions analysis</StatusPill>}
        title="Conditions analysis"
        description="Compare recorded indoor, outdoor, weather, elevation, surface and ball conditions without silently mixing missing context into the result."
      />
      <ConditionsScope
        key={baseQuery.toString()}
        clubs={data.clubOptions}
        clubId={data.selectedClub?.id ?? ""}
        dimension={dimension}
        from={from}
        to={to}
        count={data.shotCount}
      />
      {((params?.from && !from) || (params?.to && !to) || (from && to && from > to)) && (
        <p role="alert" className="text-sm text-destructive">
          Check the date range. Use valid session dates with From before To.
        </p>
      )}

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
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <EvidenceMetric label="Club" value={data.selectedClub.label} />
                  <EvidenceMetric label="Included rows" value={String(data.shotCount)} />
                  <EvidenceMetric label="Sessions" value={String(data.sessionCount)} />
                </dl>
                {strongest && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {strongest.high.label}: {strongest.high.shotCount} rows /{" "}
                    {strongest.high.sessionCount} sessions; {strongest.low.label}:{" "}
                    {strongest.low.shotCount} rows / {strongest.low.sessionCount} sessions.
                    Association only.
                  </p>
                )}
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
              href={`/practice/quick-range?clubId=${data.selectedClub.id}`}
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
            {breakdowns.map((breakdown) => (
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
                    className="mt-4 hidden overflow-hidden rounded-xl border lg:block"
                    role="region"
                    aria-label={`${breakdown.label} evidence table`}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Condition</TableHead>
                          <TableHead className="text-right">Carry (yd)</TableHead>
                          <TableHead className="text-right">Absolute side (yd)</TableHead>
                          <TableHead className="text-right">Evidence</TableHead>
                          <TableHead>Inspect</TableHead>
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
                            <TableCell>
                              <Link
                                className="inline-flex min-h-11 items-center underline"
                                href={evidenceHref(breakdown.dimension, group.label)}
                              >
                                Source rows
                              </Link>
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
                <div className="mt-4 grid gap-2 lg:hidden">
                  {breakdown.groups.map((group) => (
                    <details key={group.label} className="rounded-lg border p-3">
                      <summary className="min-h-11 cursor-pointer text-sm font-medium">
                        {group.label} · {group.shotCount} rows
                      </summary>
                      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt>Mean carry</dt>
                          <dd>{formatYards(group.meanCarryYd)}</dd>
                        </div>
                        <div>
                          <dt>Mean absolute side</dt>
                          <dd>{formatYards(group.meanAbsoluteSideYd)}</dd>
                        </div>
                        <div>
                          <dt>Sessions</dt>
                          <dd>{group.sessionCount}</dd>
                        </div>
                        <div>
                          <dt>Confidence</dt>
                          <dd>{group.confidence}</dd>
                        </div>
                      </dl>
                      <Button asChild variant="outline" className="mt-3">
                        <Link href={evidenceHref(breakdown.dimension, group.label)}>
                          Inspect source rows
                        </Link>
                      </Button>
                    </details>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-dashed p-3 text-sm">
                  <p>
                    Unknown / unrecorded: {breakdown.unclassifiedShots} rows. Kept outside the
                    comparison.
                  </p>
                  {breakdown.unclassifiedShots > 0 && (
                    <Link
                      className="inline-flex min-h-11 items-center underline"
                      href={evidenceHref(breakdown.dimension, "unknown")}
                    >
                      Inspect unknown rows
                    </Link>
                  )}
                </div>
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

          {params?.group && proofDimension && (
            <ConditionProof
              key={`${dimension}:${params.group}:${proofPage}`}
              title={params.group === "unknown" ? "Unknown / unrecorded" : params.group}
              rows={proofRows.slice((proofPage - 1) * 50, proofPage * 50).map((row) => ({
                id: row.id,
                sessionId: row.sessionId,
                clubId: data.selectedClub!.id,
                date: row.date.toLocaleDateString("en-GB"),
                carry: row.carryYd,
                side: row.sideCarryYd,
                context: row.playContext,
                source: row.source,
                raw: {
                  ...row.sourceRaw,
                  ...Object.fromEntries(
                    Object.entries(row.weather ?? {})
                      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
                      .map(([key, value]) => [`Session ${key}`, value]),
                  ),
                },
              }))}
              total={proofRows.length}
              page={proofPage}
              previousHref={
                proofPage > 1 ? evidenceHref(proofDimension, params.group, proofPage - 1) : null
              }
              nextHref={
                proofPage * 50 < proofRows.length
                  ? evidenceHref(proofDimension, params.group, proofPage + 1)
                  : null
              }
            />
          )}
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

async function getConditionsData(requestedClubId?: string, from = "", to = "") {
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
    .innerJoin(
      shots,
      and(eq(shots.clubId, clubs.id), eq(shots.userId, userId), shotEvidenceSqlPredicate()),
    )
    .where(eq(clubs.userId, userId))
    .groupBy(clubs.id, clubs.type, clubs.brand, clubs.model)
    .orderBy(desc(count(shots.id)));
  const clubOptions = rawClubOptions.map((club) => ({
    id: club.id,
    label: [club.brand, club.model].filter(Boolean).join(" ") || formatClubType(club.type),
    shotCount: Number(club.shotCount),
  }));
  const selectedClub = requestedClubId
    ? (clubOptions.find((club) => club.id === requestedClubId) ?? null)
    : (clubOptions[0] ?? null);

  if (!selectedClub) {
    return {
      clubOptions,
      selectedClub: null,
      shotCount: 0,
      sessionCount: 0,
      breakdowns: [],
      evidence: [],
    };
  }

  const rows = await db
    .select({
      id: shots.id,
      date: sessions.date,
      source: sessions.source,
      sessionId: shots.sessionId,
      carryYd: shots.carryYd,
      sideCarryYd: directionalMetricSql(shots.sideCarryYd),
      playContext: shots.playContext,
      location: sessions.location,
      weather: sessions.weatherJson,
      sourceRaw: shots.sourceRawJson,
      reviewStatus: shots.reviewStatus,
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
    })
    .from(shots)
    .innerJoin(sessions, and(eq(shots.sessionId, sessions.id), eq(sessions.userId, userId)))
    .where(
      and(
        eq(shots.userId, userId),
        eq(shots.clubId, selectedClub.id),
        shotEvidenceSqlPredicate(),
        from ? gte(sessions.date, new Date(`${from}T00:00:00Z`)) : undefined,
        to ? lte(sessions.date, new Date(`${to}T23:59:59.999Z`)) : undefined,
      ),
    )
    .orderBy(desc(shots.shotAt))
    .limit(5000);
  const evidence = rows.filter(isShotEvidenceEligible) satisfies ConditionShot[];

  return {
    clubOptions,
    selectedClub,
    shotCount: evidence.length,
    sessionCount: new Set(evidence.map((shot) => shot.sessionId)).size,
    evidence,
    breakdowns: buildConditionsAnalysis(evidence),
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

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}
