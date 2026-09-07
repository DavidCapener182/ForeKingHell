import { getDirectionAttention } from "@/lib/direction-attention";
import { DirectionAttention } from "@/app/analyse/workspace/direction-attention";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, Camera, Wrench } from "lucide-react";
import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";

import {
  deleteAnalysisAnnotationWithStateAction,
  deleteAnalysisSnapshotWithStateAction,
  saveAnalysisAnnotationWithStateAction,
  saveAnalysisSnapshotWithStateAction,
} from "@/app/analyse/workspace/actions";
import {
  QualityIssues,
  WorkspaceFormSheet,
  WorkspaceDelete,
  WorkspaceDetails,
  WorkspaceChoice,
} from "@/app/analyse/workspace/workspace-controls";
import { UrlTabs } from "@/components/untitled-ui/url-tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { ConfidenceIndicator, DataHealthStatus } from "@/components/app/evidence-status";
import {
  analysisAnnotations,
  analysisSnapshots,
  clubEquipmentHistory,
  clubs,
  importJobs,
  importFiles,
  offlineOperations,
  sessions,
  shots,
  stockYardages,
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
  const [data, directionAttention] = await Promise.all([
    getAnalysisWorkspaceData(),
    getDirectionAttention(),
  ]);

  return (
    <PageShell>
      <Button asChild variant="ghost" className="min-h-11 w-fit px-0">
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
          {
            label: "Direction review sessions",
            value: directionAttention.totalSessions,
            detail: "Alignment and direction flags",
          },
        ]}
        actions={
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/analyse/session-impact">Open session impact</Link>
          </Button>
        }
      />

      {!data.storageAvailable ? (
        <Alert className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)] [&_[data-slot=alert-description]]:text-[var(--status-warning-foreground)]">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>Saving is temporarily unavailable</AlertTitle>
          <AlertDescription>
            Data-quality and equipment analysis remain available. Please retry later to save notes
            or snapshots.
          </AlertDescription>
        </Alert>
      ) : null}

      <UrlTabs
        label="Analysis workspace sections"
        defaultTabKey="quality"
        tabs={[
          {
            id: "quality",
            label: "Quality",
            content: (
              <>
                <DataQualityInbox issues={data.issues} />
                <DirectionAttention data={directionAttention} />
              </>
            ),
          },
          {
            id: "notes",
            label: "Notes",
            content: (
              <AnnotationWorkspace
                storageAvailable={data.storageAvailable}
                sessions={data.sessionOptions}
                annotations={data.annotations}
              />
            ),
          },
          {
            id: "equipment",
            label: "Equipment",
            content: <EquipmentImpactWorkspace impacts={data.equipmentImpacts} />,
          },
          {
            id: "snapshots",
            label: "Snapshots",
            content: (
              <SnapshotWorkspace
                storageAvailable={data.storageAvailable}
                snapshots={data.snapshots}
              />
            ),
          },
        ]}
      />
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
      <QualityIssues issues={issues} />
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
    sessionId: string | null;
    contextJson: Record<string, unknown>;
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
            <WorkspaceFormSheet
              title="Add annotation"
              actionLabel="Save annotation"
              action={saveAnalysisAnnotationWithStateAction}
              disabled={!storageAvailable}
            >
              <FormLabel label="Type">
                <AnalysisSelect
                  name="annotationType"
                  disabled={!storageAvailable}
                  options={analysisAnnotationTypes.map((type) => ({
                    value: type,
                    label: formatLabel(type),
                  }))}
                />
              </FormLabel>
              <FormLabel label="Session (optional)">
                <AnalysisSelect
                  name="sessionId"
                  disabled={!storageAvailable}
                  placeholder="Date range only"
                  options={sessionOptions.map((session) => ({
                    value: session.id,
                    label: `${dateFormatter.format(session.date)} · ${session.label}`,
                  }))}
                />
              </FormLabel>
              <FormLabel label="Title">
                <Input
                  name="title"
                  required
                  maxLength={180}
                  disabled={!storageAvailable}
                  className="min-h-11"
                />
              </FormLabel>
              <div className="grid grid-cols-2 gap-2">
                <FormLabel label="From">
                  <Input
                    type="date"
                    name="rangeFrom"
                    disabled={!storageAvailable}
                    className="min-h-11"
                  />
                </FormLabel>
                <FormLabel label="To">
                  <Input
                    type="date"
                    name="rangeTo"
                    disabled={!storageAvailable}
                    className="min-h-11"
                  />
                </FormLabel>
              </div>
              <FormLabel label="Environment">
                <AnalysisSelect
                  name="environment"
                  disabled={!storageAvailable}
                  placeholder="Not specified"
                  options={["range", "simulator", "course", "mat", "grass"].map((value) => ({
                    value,
                    label: formatLabel(value),
                  }))}
                />
              </FormLabel>
              <FormLabel label="Note">
                <Textarea
                  name="body"
                  required
                  maxLength={4_000}
                  rows={4}
                  disabled={!storageAvailable}
                  className="min-h-11"
                />
              </FormLabel>
            </WorkspaceFormSheet>
          </CardContent>
        </Card>
        <div className="self-start divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {annotations.length > 0 ? (
            annotations.map((annotation) => (
              <article key={annotation.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                      {formatLabel(annotation.annotationType)}
                    </p>
                    <h3 className="mt-1 font-semibold">{annotation.title}</h3>
                  </div>
                  <WorkspaceDelete
                    name={annotation.title}
                    id={annotation.id}
                    field="annotationId"
                    action={deleteAnalysisAnnotationWithStateAction}
                  />
                </div>
                <WorkspaceDetails
                  title={annotation.title}
                  description="Saved annotation and its original evidence scope."
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                    {annotation.body}
                  </p>
                  <p className="mt-3 text-sm">{formatAnnotationRange(annotation)}</p>
                  {annotation.sessionId && (
                    <Button asChild variant="outline" className="mt-3">
                      <Link href={`/sessions/${annotation.sessionId}`}>
                        Open associated session
                      </Link>
                    </Button>
                  )}
                  <EvidenceFields value={annotation.contextJson} />
                </WorkspaceDetails>
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
        <WorkspaceChoice
          items={impacts.map((impact) => ({
            id: impact.id,
            label: `${impact.clubLabel} · ${impact.changeLabel}`,
            content: (
              <Card key={impact.id} className="premium-card">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-primary">{impact.clubLabel}</p>
                      <CardTitle className="mt-1 text-lg">{impact.changeLabel}</CardTitle>
                    </div>
                    <ConfidenceIndicator
                      label={confidenceDisplayLabel(impact.confidence)}
                      detail={
                        impact.comparable ? "Comparable periods" : "More matched shots needed"
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-sm">
                    Change recorded {dateFormatter.format(impact.changeAt)} · {impact.windowDays}
                    -day windows on each side.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Before: {dateFormatter.format(impact.windowFrom)} to change; after: change to{" "}
                    {dateFormatter.format(impact.windowTo)}. Latest change per club; source scan
                    capped at2,000 rows.
                  </p>
                  <figure className="grid gap-3 rounded-lg border p-3">
                    <figcaption className="text-sm font-medium">
                      Median carry · matching {impact.windowDays}-day windows
                    </figcaption>
                    {[
                      { label: "Before", value: impact.beforeCarry },
                      { label: "After", value: impact.afterCarry },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-[4rem_minmax(0,1fr)_5rem] items-center gap-2 text-sm"
                      >
                        <span>{row.label}</span>
                        <span className="h-4 bg-muted" aria-hidden>
                          <span
                            className="block h-full bg-primary"
                            style={{
                              width: `${row.value === null ? 0 : (Math.max(0, row.value) / Math.max(1, impact.beforeCarry ?? 0, impact.afterCarry ?? 0)) * 100}%`,
                            }}
                          />
                        </span>
                        <span className="text-right tabular-nums">
                          {row.value === null ? "—" : `${numberFormatter.format(row.value)} yd`}
                        </span>
                      </div>
                    ))}
                  </figure>
                  <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
                    <div>
                      <dt>Before carry median</dt>
                      <dd>
                        {impact.beforeCarry === null
                          ? "Unavailable"
                          : `${numberFormatter.format(impact.beforeCarry)} yd`}
                      </dd>
                    </div>
                    <div>
                      <dt>After carry median</dt>
                      <dd>
                        {impact.afterCarry === null
                          ? "Unavailable"
                          : `${numberFormatter.format(impact.afterCarry)} yd`}
                      </dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline">
                    <Link
                      href={`/shots?clubId=${impact.clubId}&from=${impact.windowFrom.toISOString().slice(0, 10)}&to=${impact.windowTo.toISOString().slice(0, 10)}`}
                    >
                      Inspect club and window evidence
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric label="Before" value={`${impact.beforeSample} shots`} />
                    <Metric label="After" value={`${impact.afterSample} shots`} />
                    <Metric label="Carry" value={formatDelta(impact.carryDeltaYd, "yd")} />
                    <Metric
                      label="Ball speed"
                      value={formatDelta(impact.ballSpeedDeltaMph, "mph")}
                    />
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
            ),
          }))}
        />
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
    chartStateJson: Record<string, unknown>;
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
            <WorkspaceFormSheet
              title="Create snapshot"
              actionLabel="Save snapshot"
              action={saveAnalysisSnapshotWithStateAction}
              disabled={!storageAvailable}
            >
              <FormLabel label="Snapshot name">
                <Input
                  name="name"
                  required
                  maxLength={180}
                  disabled={!storageAvailable}
                  className="min-h-11"
                />
              </FormLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                <FormLabel label="Club">
                  <Input
                    name="club"
                    maxLength={40}
                    placeholder="All"
                    disabled={!storageAvailable}
                    className="min-h-11"
                  />
                </FormLabel>
                <FormLabel label="From">
                  <Input
                    type="date"
                    name="from"
                    disabled={!storageAvailable}
                    className="min-h-11"
                  />
                </FormLabel>
                <FormLabel label="To">
                  <Input type="date" name="to" disabled={!storageAvailable} className="min-h-11" />
                </FormLabel>
              </div>
              <FormLabel label="Chart view">
                <AnalysisSelect
                  name="chartView"
                  disabled={!storageAvailable}
                  options={["dispersion", "flight", "trend", "table"].map((value) => ({
                    value,
                    label: formatLabel(value),
                  }))}
                />
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
                        <Checkbox name="metrics" value={metric} disabled={!storageAvailable} />
                        {formatLabel(metric)}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <FormLabel label="Notes">
                <Textarea
                  name="notes"
                  maxLength={4_000}
                  rows={3}
                  disabled={!storageAvailable}
                  className="min-h-11"
                />
              </FormLabel>
            </WorkspaceFormSheet>
          </CardContent>
        </Card>
        <div className="self-start divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {snapshots.length > 0 ? (
            snapshots.map((snapshot) => (
              <article key={snapshot.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{snapshot.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Captured {dateFormatter.format(snapshot.capturedAt)} · data through{" "}
                      {snapshot.sourceDataThrough
                        ? dateFormatter.format(snapshot.sourceDataThrough)
                        : "not stored"}
                    </p>
                  </div>
                  <WorkspaceDelete
                    name={snapshot.name}
                    id={snapshot.id}
                    field="snapshotId"
                    action={deleteAnalysisSnapshotWithStateAction}
                  />
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
                <WorkspaceDetails
                  title={snapshot.name}
                  description="Values saved at capture time; this view does not recalculate current evidence."
                >
                  <h4 className="font-semibold">Saved summary</h4>
                  <EvidenceFields value={snapshot.summaryJson} />
                  <h4 className="mt-4 font-semibold">Saved filters</h4>
                  <EvidenceFields value={snapshot.filtersJson} />
                  <h4 className="mt-4 font-semibold">Saved chart scope</h4>
                  <EvidenceFields value={snapshot.chartStateJson} />
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">{snapshot.notes}</p>
                </WorkspaceDetails>
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
  const [
    shotSummaryRows,
    duplicateRows,
    clubSampleRows,
    sessionRows,
    equipmentRows,
    operationalIssueRows,
  ] = await Promise.all([
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
      .leftJoin(
        shots,
        and(eq(shots.clubId, clubs.id), eq(shots.userId, userId), shotEvidenceSqlPredicate()),
      )
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
    db
      .select({
        staleStockYardages: sql<number>`count(distinct ${stockYardages.clubId}) filter (where ${stockYardages.calculatedAt} < now() - interval '90 days')::int`,
        failedProviderSyncs: sql<number>`(select count(*)::int from ${importJobs} where ${importJobs.userId} = ${userId} and ${importJobs.status} in ('failed', 'error'))`,
        failedOfflineActions: sql<number>`(select count(*)::int from ${offlineOperations} where ${offlineOperations.userId} = ${userId} and ${offlineOperations.status} = 'failed_permanent')`,
      })
      .from(stockYardages)
      .where(eq(stockYardages.userId, userId)),
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
          reviewStatus: shots.reviewStatus,
          sessionSource: sessions.source,
          sessionType: sessions.type,
        })
        .from(shots)
        .innerJoin(sessions, and(eq(sessions.id, shots.sessionId), eq(sessions.userId, userId)))
        .where(and(eq(shots.userId, userId), shotEvidenceSqlPredicate()))
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
    staleStockYardages: Number(operationalIssueRows[0]?.staleStockYardages ?? 0),
    failedProviderSyncs: Number(operationalIssueRows[0]?.failedProviderSyncs ?? 0),
    failedOfflineActions: Number(operationalIssueRows[0]?.failedOfflineActions ?? 0),
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
        clubId: change.clubId,
        changeAt: change.effectiveFrom,
        windowDays: analysis.windowDays,
        windowFrom: new Date(change.effectiveFrom.getTime() - analysis.windowDays * 86400000),
        windowTo: new Date(change.effectiveFrom.getTime() + analysis.windowDays * 86400000),
        beforeCarry: analysis.before.carryMedianYd,
        afterCarry: analysis.after.carryMedianYd,
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

function shotEvidenceSqlPredicate() {
  return sql<boolean>`(
    ${shots.reviewStatus} = 'restored'
    or (
      ${shots.reviewStatus} = 'included'
      and lower(trim(coalesce(${shots.qualityTag}, ''))) not like 'exclude%'
      and lower(trim(coalesce(${shots.qualityTag}, ''))) not in (
        'exclude', 'excluded', 'delete', 'deleted', 'calibration', 'warm-up', 'warmup',
        'warm_up', 'bad-data', 'bad_data', 'invalid', 'launch-monitor-error', 'misread',
        'fat', 'mishit', 'thin', 'top'
      )
      and lower(trim(coalesce(${shots.shotCategory}, ''))) not in (
        'warm-up', 'warmup', 'warm_up'
      )
    )
  )`;
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Field>
      <FieldLabel className="grid w-full gap-1.5 text-sm font-medium">
        {label}
        {children}
      </FieldLabel>
    </Field>
  );
}

function AnalysisSelect({
  name,
  disabled,
  placeholder,
  options,
}: {
  name: string;
  disabled?: boolean;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      name={name}
      defaultValue={placeholder ? "" : options[0]?.value}
      disabled={disabled}
      className="min-h-11 w-full rounded-lg border bg-background px-3"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
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

function EvidenceFields({ value }: { value: Record<string, unknown> }) {
  return (
    <dl className="mt-3 grid gap-3 text-sm">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt className="font-medium">{formatLabel(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}</dt>
          <dd className="mt-1 break-words text-muted-foreground">
            {item === null || item === undefined ? (
              "Not stored"
            ) : typeof item === "object" && !Array.isArray(item) ? (
              <EvidenceFields value={item as Record<string, unknown>} />
            ) : Array.isArray(item) ? (
              <ol className="grid gap-2">
                {item.map((entry, index) => (
                  <li key={index}>
                    {entry && typeof entry === "object" ? (
                      <EvidenceFields value={entry as Record<string, unknown>} />
                    ) : (
                      String(entry ?? "Not stored")
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              String(item)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
