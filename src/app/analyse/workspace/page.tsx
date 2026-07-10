import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, Camera, Save, Trash2, Wrench } from "lucide-react";
import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";

import {
  deleteAnalysisAnnotationAction,
  deleteAnalysisSnapshotAction,
  saveAnalysisAnnotationAction,
  saveAnalysisSnapshotAction,
} from "@/app/analyse/workspace/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { ConfidenceIndicator, DataHealthStatus } from "@/components/app/evidence-status";
import {
  analysisAnnotations,
  analysisSnapshots,
  clubEquipmentHistory,
  clubs,
  importFiles,
  sessions,
  shots,
  teeSets,
} from "@/db/schema";
import { getDb } from "@/db/client";
import {
  analysisAnnotationTypes,
  buildDataQualityIssues,
  type DataQualityIssue,
} from "@/lib/analysis-workspace";
import { confidenceDisplayLabel } from "@/lib/analysis-confidence";
import { analyseEquipmentChange, type EquipmentChangeShot } from "@/lib/equipment-change-analysis";
import { requireCurrentUserId } from "@/lib/current-user";
import { formatClubType } from "@/lib/club-format";
import { isRoundHistorySession } from "@/lib/round-sessions";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export default async function AnalysisWorkspacePage() {
  const data = await getAnalysisWorkspaceData();

  return (
    <PageShell>
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/analyse">
          <ArrowLeft className="size-4" aria-hidden />
          Analyse
        </Link>
      </Button>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Evidence operations</StatusPill>}
        title="Analysis workspace"
        description="Fix weak data, annotate what changed, compare equipment periods and preserve point-in-time evidence."
        metrics={[
          {
            label: "Open data issues",
            value: data.issues.length,
            detail: `${data.highPriorityIssues} high priority`,
          },
        ]}
        actions={
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/analyse/session-impact">Open session impact</Link>
          </Button>
        }
      />

      {!data.storageAvailable ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <h2 className="font-semibold">Analysis storage migration pending</h2>
              <p className="mt-1 text-sm leading-6">
                Data-quality and equipment analysis are available. Apply migration 0041 before
                saving annotations or snapshots.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <nav aria-label="Analysis workspace sections" className="ios-route-tabs flex overflow-x-auto">
        {[
          ["Quality", "#data-quality"],
          ["Notes", "#annotations"],
          ["Equipment", "#equipment-impact"],
          ["Snapshots", "#snapshots"],
        ].map(([label, href], index) => (
          <a
            key={href}
            href={href}
            aria-current={index === 0 ? "page" : undefined}
            className="ios-route-tab focus-aaa inline-flex min-w-fit flex-1 items-center justify-center outline-none"
          >
            {label}
          </a>
        ))}
      </nav>

      <DataQualityInbox issues={data.issues} />
      <AnnotationWorkspace
        storageAvailable={data.storageAvailable}
        sessions={data.sessionOptions}
        annotations={data.annotations}
      />
      <EquipmentImpactWorkspace impacts={data.equipmentImpacts} />
      <SnapshotWorkspace storageAvailable={data.storageAvailable} snapshots={data.snapshots} />
    </PageShell>
  );
}

function DataQualityInbox({ issues }: { issues: DataQualityIssue[] }) {
  return (
    <section
      id="data-quality"
      aria-labelledby="data-quality-title"
      className="grid scroll-mt-28 gap-3"
    >
      <div>
        <h2 id="data-quality-title" className="text-2xl font-semibold tracking-tight">
          Data-quality inbox
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Every issue has a direct repair path; nothing here silently changes source data.
        </p>
      </div>
      <DataHealthStatus
        issueCount={issues.length}
        highPriorityCount={issues.filter((issue) => issue.severity === "high").length}
      />
      {issues.length > 0 ? (
        <div className="ios-grouped-list overflow-hidden rounded-2xl border border-border bg-card">
          {issues.map((issue) => (
            <Link
              key={issue.key}
              href={issue.href}
              className="ios-grouped-row focus-aaa grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 outline-none"
            >
              <span className={issueSeverityClass(issue.severity)} aria-hidden />
              <span className="min-w-0">
                <span className="block font-semibold">
                  {issue.title} · {issue.count}
                </span>
                <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                  {issue.detail}
                </span>
              </span>
              <span className="text-sm font-semibold text-primary">{issue.action}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AnnotationWorkspace({
  storageAvailable,
  sessions: sessionOptions,
  annotations,
}: {
  storageAvailable: boolean;
  sessions: Array<{ id: string; label: string; date: Date }>;
  annotations: Array<{
    id: string;
    annotationType: string;
    title: string;
    body: string;
    rangeFrom: Date | null;
    rangeTo: Date | null;
    createdAt: Date;
  }>;
}) {
  return (
    <section
      id="annotations"
      aria-labelledby="annotations-title"
      className="grid scroll-mt-28 gap-3"
    >
      <div>
        <h2 id="annotations-title" className="text-2xl font-semibold tracking-tight">
          Analysis notes
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Mark lessons, fatigue, equipment, surface, weather or deliberate technique experiments.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="size-5 text-primary" aria-hidden />
              Add context
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveAnalysisAnnotationAction} className="grid gap-3">
              <FormLabel label="Type">
                <select
                  name="annotationType"
                  required
                  disabled={!storageAvailable}
                  className={fieldClass}
                >
                  {analysisAnnotationTypes.map((type) => (
                    <option key={type} value={type}>
                      {formatLabel(type)}
                    </option>
                  ))}
                </select>
              </FormLabel>
              <FormLabel label="Session (optional)">
                <select name="sessionId" disabled={!storageAvailable} className={fieldClass}>
                  <option value="">Date range only</option>
                  {sessionOptions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {dateFormatter.format(session.date)} · {session.label}
                    </option>
                  ))}
                </select>
              </FormLabel>
              <FormLabel label="Title">
                <input
                  name="title"
                  required
                  maxLength={180}
                  disabled={!storageAvailable}
                  className={fieldClass}
                />
              </FormLabel>
              <div className="grid grid-cols-2 gap-2">
                <FormLabel label="From">
                  <input
                    type="date"
                    name="rangeFrom"
                    disabled={!storageAvailable}
                    className={fieldClass}
                  />
                </FormLabel>
                <FormLabel label="To">
                  <input
                    type="date"
                    name="rangeTo"
                    disabled={!storageAvailable}
                    className={fieldClass}
                  />
                </FormLabel>
              </div>
              <FormLabel label="Environment">
                <select name="environment" disabled={!storageAvailable} className={fieldClass}>
                  <option value="">Not specified</option>
                  {["range", "simulator", "course", "mat", "grass"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </FormLabel>
              <FormLabel label="Note">
                <textarea
                  name="body"
                  required
                  maxLength={4_000}
                  rows={4}
                  disabled={!storageAvailable}
                  className={fieldClass}
                />
              </FormLabel>
              <Button type="submit" disabled={!storageAvailable} className="min-h-11 rounded-xl">
                Save annotation
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="ios-grouped-list self-start overflow-hidden rounded-2xl border border-border bg-card">
          {annotations.length > 0 ? (
            annotations.map((annotation) => (
              <article key={annotation.id} className="ios-grouped-row px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                      {formatLabel(annotation.annotationType)}
                    </p>
                    <h3 className="mt-1 font-semibold">{annotation.title}</h3>
                  </div>
                  <form action={deleteAnalysisAnnotationAction}>
                    <input type="hidden" name="annotationId" value={annotation.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${annotation.title}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </form>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{annotation.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatAnnotationRange(annotation)} · saved{" "}
                  {dateFormatter.format(annotation.createdAt)}
                </p>
              </article>
            ))
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No analysis annotations saved yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EquipmentImpactWorkspace({ impacts }: { impacts: EquipmentImpactView[] }) {
  return (
    <section
      id="equipment-impact"
      aria-labelledby="equipment-impact-title"
      className="grid scroll-mt-28 gap-3"
    >
      <div>
        <h2 id="equipment-impact-title" className="text-2xl font-semibold tracking-tight">
          Equipment change analysis
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Matched before/after windows use trusted shots from the same club slot. Results remain
          observational and do not prove causation.
        </p>
      </div>
      {impacts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {impacts.map((impact) => (
            <Card key={impact.id} className="premium-card">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-primary">{impact.clubLabel}</p>
                    <CardTitle className="mt-1 text-lg">{impact.changeLabel}</CardTitle>
                  </div>
                  <ConfidenceIndicator
                    label={confidenceDisplayLabel(impact.confidence)}
                    detail={impact.comparable ? "Comparable periods" : "More matched shots needed"}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Metric label="Before" value={`${impact.beforeSample} shots`} />
                  <Metric label="After" value={`${impact.afterSample} shots`} />
                  <Metric label="Carry" value={formatDelta(impact.carryDeltaYd, "yd")} />
                  <Metric label="Ball speed" value={formatDelta(impact.ballSpeedDeltaMph, "mph")} />
                  <Metric label="Launch" value={formatDelta(impact.launchDeltaDeg, "deg")} />
                  <Metric label="Spin" value={formatDelta(impact.spinDeltaRpm, "rpm")} />
                  <Metric label="Offline" value={formatDelta(impact.offlineDeltaYd, "yd")} />
                  <Metric
                    label="Repeatability"
                    value={formatDelta(impact.repeatabilityDelta, "pts")}
                  />
                  <Metric label="Strike" value={formatDelta(impact.strikeDelta, "smash")} />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{impact.caveat}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="premium-card">
          <CardContent className="flex items-center gap-3 py-5">
            <Wrench className="size-5 text-primary" aria-hidden />
            <p className="text-sm">
              Add dated equipment history and comparable shots to start a before/after view.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function SnapshotWorkspace({
  storageAvailable,
  snapshots,
}: {
  storageAvailable: boolean;
  snapshots: Array<{
    id: string;
    name: string;
    filtersJson: Record<string, unknown>;
    selectedMetricsJson: string[];
    notes: string | null;
    summaryJson: Record<string, unknown>;
    sourceDataThrough: Date | null;
    capturedAt: Date;
  }>;
}) {
  return (
    <section id="snapshots" aria-labelledby="snapshots-title" className="grid scroll-mt-28 gap-3">
      <div>
        <h2 id="snapshots-title" className="text-2xl font-semibold tracking-tight">
          Analysis snapshots
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Preserve filters, chart state, selected metrics, notes and calculated summary values.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="size-5 text-primary" aria-hidden />
              Capture current evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveAnalysisSnapshotAction} className="grid gap-3">
              <FormLabel label="Snapshot name">
                <input
                  name="name"
                  required
                  maxLength={180}
                  disabled={!storageAvailable}
                  className={fieldClass}
                />
              </FormLabel>
              <div className="grid grid-cols-3 gap-2">
                <FormLabel label="Club">
                  <input
                    name="club"
                    maxLength={40}
                    placeholder="All"
                    disabled={!storageAvailable}
                    className={fieldClass}
                  />
                </FormLabel>
                <FormLabel label="From">
                  <input
                    type="date"
                    name="from"
                    disabled={!storageAvailable}
                    className={fieldClass}
                  />
                </FormLabel>
                <FormLabel label="To">
                  <input
                    type="date"
                    name="to"
                    disabled={!storageAvailable}
                    className={fieldClass}
                  />
                </FormLabel>
              </div>
              <FormLabel label="Chart view">
                <select name="chartView" disabled={!storageAvailable} className={fieldClass}>
                  {["dispersion", "flight", "trend", "table"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </FormLabel>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Metrics</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {["carry", "total", "offline", "ball speed", "launch", "repeatability"].map(
                    (metric) => (
                      <label
                        key={metric}
                        className="flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="metrics"
                          value={metric}
                          disabled={!storageAvailable}
                        />
                        {formatLabel(metric)}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <FormLabel label="Notes">
                <textarea
                  name="notes"
                  maxLength={4_000}
                  rows={3}
                  disabled={!storageAvailable}
                  className={fieldClass}
                />
              </FormLabel>
              <Button type="submit" disabled={!storageAvailable} className="min-h-11 rounded-xl">
                <Save className="size-4" aria-hidden />
                Save snapshot
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="ios-grouped-list self-start overflow-hidden rounded-2xl border border-border bg-card">
          {snapshots.length > 0 ? (
            snapshots.map((snapshot) => (
              <article key={snapshot.id} className="ios-grouped-row px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{snapshot.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Captured {dateFormatter.format(snapshot.capturedAt)} · data through{" "}
                      {snapshot.sourceDataThrough
                        ? dateFormatter.format(snapshot.sourceDataThrough)
                        : "no shots"}
                    </p>
                  </div>
                  <form action={deleteAnalysisSnapshotAction}>
                    <input type="hidden" name="snapshotId" value={snapshot.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${snapshot.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </form>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Metric label="Shots" value={summaryValue(snapshot.summaryJson, "shotCount")} />
                  <Metric
                    label="Sessions"
                    value={summaryValue(snapshot.summaryJson, "sessionCount")}
                  />
                  <Metric
                    label="Carry median"
                    value={summaryMetric(snapshot.summaryJson, "carryMedianYd", "yd")}
                  />
                  <Metric
                    label="Offline median"
                    value={summaryMetric(snapshot.summaryJson, "offlineMedianYd", "yd")}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Metrics: {snapshot.selectedMetricsJson.join(", ") || "none selected"}
                </p>
                {snapshot.notes ? <p className="mt-2 text-sm leading-5">{snapshot.notes}</p> : null}
              </article>
            ))
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No analysis snapshots saved yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

async function getAnalysisWorkspaceData() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [shotSummaryRows, duplicateRows, clubSampleRows, sessionRows, equipmentRows] =
    await Promise.all([
      db
        .select({
          total: count(shots.id),
          unmapped: sql<number>`count(*) filter (where lower(trim(${shots.clubType})) in ('other', 'unknown', 'ot', ''))::int`,
          suspicious: sql<number>`count(*) filter (where ${shots.carryYd} <= 0 or ${shots.carryYd} > 400 or ${shots.totalYd} > 500)::int`,
          carryMedian: sql<
            number | null
          >`percentile_cont(0.5) within group (order by ${shots.carryYd})::float`,
        })
        .from(shots)
        .where(eq(shots.userId, userId)),
      db
        .select({ total: count(importFiles.id) })
        .from(importFiles)
        .where(and(eq(importFiles.userId, userId), isNotNull(importFiles.duplicateOfFileId))),
      db
        .select({
          id: clubs.id,
          type: clubs.type,
          samples: sql<number>`count(${shots.id}) filter (where ${shots.carryYd} > 0)::int`,
        })
        .from(clubs)
        .leftJoin(shots, and(eq(shots.clubId, clubs.id), eq(shots.userId, userId)))
        .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
        .groupBy(clubs.id),
      db
        .select({
          id: sessions.id,
          date: sessions.date,
          type: sessions.type,
          source: sessions.source,
          playContext: sessions.playContext,
          fileName: sessions.fileName,
          courseName: sessions.courseName,
          scorecardJson: sessions.scorecardJson,
          courseRating: teeSets.courseRating,
          slopeRating: teeSets.slopeRating,
        })
        .from(sessions)
        .leftJoin(teeSets, eq(teeSets.id, sessions.teeSetId))
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.date))
        .limit(100),
      db
        .select({
          id: clubEquipmentHistory.id,
          clubId: clubEquipmentHistory.clubId,
          effectiveFrom: clubEquipmentHistory.effectiveFrom,
          loftDeg: clubEquipmentHistory.loftDeg,
          shaft: clubEquipmentHistory.shaft,
          notes: clubEquipmentHistory.notes,
          clubType: clubs.type,
          clubBrand: clubs.brand,
          clubModel: clubs.model,
        })
        .from(clubEquipmentHistory)
        .innerJoin(clubs, and(eq(clubs.id, clubEquipmentHistory.clubId), eq(clubs.userId, userId)))
        .where(eq(clubEquipmentHistory.userId, userId))
        .orderBy(desc(clubEquipmentHistory.effectiveFrom))
        .limit(12),
    ]);
  const equipmentShotRows = equipmentRows.length
    ? await db
        .select({
          sessionId: shots.sessionId,
          clubId: shots.clubId,
          shotAt: shots.shotAt,
          carryYd: shots.carryYd,
          totalYd: shots.totalYd,
          sideYd: shots.sideCarryYd,
          ballSpeedMph: shots.ballSpeedMph,
          launchAngleDeg: shots.launchAngleDeg,
          spinRate: shots.spinRate,
          smashFactor: shots.smashFactor,
          qualityTag: shots.qualityTag,
          shotCategory: shots.shotCategory,
          sessionSource: sessions.source,
          sessionType: sessions.type,
        })
        .from(shots)
        .innerJoin(sessions, and(eq(sessions.id, shots.sessionId), eq(sessions.userId, userId)))
        .where(eq(shots.userId, userId))
        .orderBy(desc(shots.shotAt))
        .limit(2_000)
    : [];

  const shotSummary = shotSummaryRows[0];
  const roundRows = sessionRows.filter((session) => isRoundHistorySession(session));
  const issues = buildDataQualityIssues({
    unmappedClubs: Number(shotSummary?.unmapped ?? 0),
    duplicateImports: Number(duplicateRows[0]?.total ?? 0),
    suspiciousDistances: Number(shotSummary?.suspicious ?? 0),
    likelyUnitMismatch:
      Number(shotSummary?.total ?? 0) >= 10 &&
      (Number(shotSummary?.carryMedian ?? 0) > 350 || Number(shotSummary?.carryMedian ?? 0) < 10),
    incompleteScorecards: roundRows.filter((session) => !completeScorecard(session.scorecardJson))
      .length,
    missingRatingRounds: roundRows.filter(
      (session) => session.courseRating === null || session.slopeRating === null,
    ).length,
    lowSampleClubs: clubSampleRows.filter((club) => Number(club.samples) < 8).length,
    unclassifiedSessions: sessionRows.filter((session) => session.playContext === "unknown").length,
  });

  let storageAvailable = true;
  let annotationRows: Array<typeof analysisAnnotations.$inferSelect> = [];
  let snapshotRows: Array<typeof analysisSnapshots.$inferSelect> = [];
  try {
    [annotationRows, snapshotRows] = await Promise.all([
      db
        .select()
        .from(analysisAnnotations)
        .where(eq(analysisAnnotations.userId, userId))
        .orderBy(desc(analysisAnnotations.createdAt))
        .limit(30),
      db
        .select()
        .from(analysisSnapshots)
        .where(eq(analysisSnapshots.userId, userId))
        .orderBy(desc(analysisSnapshots.capturedAt))
        .limit(20),
    ]);
  } catch (error) {
    if (!isUndefinedTableError(error)) throw error;
    storageAvailable = false;
  }

  const seenEquipmentClubs = new Set<string>();
  const equipmentImpacts = equipmentRows.flatMap((change) => {
    if (seenEquipmentClubs.has(change.clubId)) return [];
    seenEquipmentClubs.add(change.clubId);
    const analysis = analyseEquipmentChange({
      clubId: change.clubId,
      changeAt: change.effectiveFrom,
      shots: equipmentShotRows as EquipmentChangeShot[],
    });
    return [
      {
        id: change.id,
        clubLabel: formatClubType(change.clubType),
        changeLabel:
          [change.clubBrand, change.clubModel, change.shaft, change.notes]
            .filter(Boolean)
            .join(" · ") || `Change on ${dateFormatter.format(change.effectiveFrom)}`,
        comparable: analysis.comparable,
        confidence: analysis.confidence.label,
        beforeSample: analysis.before.sampleSize,
        afterSample: analysis.after.sampleSize,
        carryDeltaYd: analysis.deltas.carryYd,
        ballSpeedDeltaMph: analysis.deltas.ballSpeedMph,
        launchDeltaDeg: analysis.deltas.launchDeg,
        spinDeltaRpm: analysis.deltas.spinRpm,
        offlineDeltaYd: analysis.deltas.offlineYd,
        repeatabilityDelta: analysis.deltas.repeatability,
        strikeDelta: analysis.deltas.strike,
        caveat: analysis.caveat,
      },
    ];
  });

  return {
    storageAvailable,
    issues,
    highPriorityIssues: issues.filter((issue) => issue.severity === "high").length,
    sessionOptions: sessionRows.slice(0, 30).map((session) => ({
      id: session.id,
      date: session.date,
      label: session.courseName ?? session.fileName ?? formatLabel(session.type),
    })),
    annotations: annotationRows,
    snapshots: snapshotRows,
    equipmentImpacts,
  };
}

type EquipmentImpactView = Awaited<
  ReturnType<typeof getAnalysisWorkspaceData>
>["equipmentImpacts"][number];

function completeScorecard(scorecard: Array<{ score?: number | null }> | null) {
  return Boolean(
    scorecard &&
    (scorecard.length === 9 || scorecard.length === 18) &&
    scorecard.every((hole) => typeof hole.score === "number"),
  );
}

function isUndefinedTableError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "42P01" || candidate?.cause?.code === "42P01";
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const fieldClass =
  "focus-aaa min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-55";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function issueSeverityClass(severity: DataQualityIssue["severity"]) {
  return `size-2.5 rounded-full ${severity === "high" ? "bg-red-500" : severity === "medium" ? "bg-amber-500" : "bg-sky-500"}`;
}

function formatDelta(value: number | null, unit: string) {
  return value === null ? "--" : `${value > 0 ? "+" : ""}${numberFormatter.format(value)} ${unit}`;
}

function formatLabel(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAnnotationRange(annotation: { rangeFrom: Date | null; rangeTo: Date | null }) {
  if (!annotation.rangeFrom) return "No date range";
  return annotation.rangeTo
    ? `${dateFormatter.format(annotation.rangeFrom)}–${dateFormatter.format(annotation.rangeTo)}`
    : dateFormatter.format(annotation.rangeFrom);
}

function summaryValue(summary: Record<string, unknown>, key: string) {
  const value = summary[key];
  return typeof value === "number" ? value.toLocaleString("en-GB") : "--";
}

function summaryMetric(summary: Record<string, unknown>, key: string, unit: string) {
  const value = summary[key];
  return typeof value === "number" ? `${numberFormatter.format(value)} ${unit}` : "--";
}
