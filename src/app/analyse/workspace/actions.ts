"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { reportServerFailure } from "@/lib/server-observability";
import { and, count, eq, gte, lte, max, sql } from "drizzle-orm";

import { analysisAnnotations, analysisSnapshots, sessions, shots } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { buildAnalysisSnapshot, validateAnalysisAnnotation } from "@/lib/analysis-workspace";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveAnalysisAnnotationAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = cleanUuid(formData.get("sessionId"));
  const rangeFrom = parseDate(formData.get("rangeFrom"));
  const rangeTo = parseDate(formData.get("rangeTo"), true);
  const annotation = validateAnalysisAnnotation({
    annotationType: textValue(formData.get("annotationType")),
    title: textValue(formData.get("title")),
    body: textValue(formData.get("body")),
    rangeFrom,
    rangeTo,
  });

  if (sessionId) {
    const [ownedSession] = await getDb()
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1);
    if (!ownedSession) throw new Error("Session not found for this account.");
  }

  await getDb()
    .insert(analysisAnnotations)
    .values({
      userId,
      sessionId,
      ...annotation,
      contextJson: {
        environment: cleanChoice(formData.get("environment"), [
          "range",
          "simulator",
          "course",
          "mat",
          "grass",
        ]),
      },
      updatedAt: new Date(),
    });

  refreshWorkspaceAfterCommit();
}

export async function deleteAnalysisAnnotationAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const annotationId = cleanUuid(formData.get("annotationId"));
  if (!annotationId) throw new Error("Invalid annotation.");

  const deleted = await getDb()
    .delete(analysisAnnotations)
    .where(and(eq(analysisAnnotations.id, annotationId), eq(analysisAnnotations.userId, userId)))
    .returning({ id: analysisAnnotations.id });
  if (!deleted.length) throw new Error("Annotation unavailable or already deleted.");
  refreshWorkspaceAfterCommit();
}

export async function saveAnalysisSnapshotAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const club = cleanText(formData.get("club"), 40);
  const from = parseDate(formData.get("from"));
  const to = parseDate(formData.get("to"), true);
  if (from && to && to < from) throw new Error("Snapshot end date cannot precede start date.");
  const clauses = [eq(shots.userId, userId), shotEvidenceSqlPredicate()];
  if (club) clauses.push(eq(shots.clubType, club));
  if (from) clauses.push(gte(shots.shotAt, from));
  if (to) clauses.push(lte(shots.shotAt, to));
  const [summary] = await getDb()
    .select({
      shotCount: count(shots.id),
      sessionCount: sql<number>`count(distinct ${shots.sessionId})::int`,
      carryMedianYd: sql<
        number | null
      >`percentile_cont(0.5) within group (order by ${shots.carryYd})::float`,
      offlineMedianYd: sql<
        number | null
      >`percentile_cont(0.5) within group (order by ${shots.sideCarryYd})::float`,
      sourceDataThrough: max(shots.shotAt),
    })
    .from(shots)
    .where(and(...clauses));
  const snapshot = buildAnalysisSnapshot({
    name: textValue(formData.get("name")),
    filters: {
      club: club || null,
      from: dateInputValue(from),
      to: dateInputValue(to),
    },
    chartState: {
      view: cleanChoice(formData.get("chartView"), ["dispersion", "flight", "trend", "table"]),
    },
    selectedMetrics: formData.getAll("metrics").map(textValue),
    notes: cleanText(formData.get("notes"), 4_000),
    summary: {
      shotCount: Number(summary?.shotCount ?? 0),
      sessionCount: Number(summary?.sessionCount ?? 0),
      carryMedianYd: numberOrNull(summary?.carryMedianYd),
      offlineMedianYd: numberOrNull(summary?.offlineMedianYd),
    },
    sourceDataThrough: summary?.sourceDataThrough ?? null,
  });

  await getDb()
    .insert(analysisSnapshots)
    .values({ userId, ...snapshot });
  refreshWorkspaceAfterCommit();
}

export async function deleteAnalysisSnapshotAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const snapshotId = cleanUuid(formData.get("snapshotId"));
  if (!snapshotId) throw new Error("Invalid snapshot.");

  const deleted = await getDb()
    .delete(analysisSnapshots)
    .where(and(eq(analysisSnapshots.id, snapshotId), eq(analysisSnapshots.userId, userId)))
    .returning({ id: analysisSnapshots.id });
  if (!deleted.length) throw new Error("Snapshot unavailable or already deleted.");
  refreshWorkspaceAfterCommit();
}

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return textValue(value).trim().slice(0, maxLength);
}

function cleanUuid(value: FormDataEntryValue | null) {
  const text = textValue(value).trim();
  if (text && !uuidPattern.test(text)) throw new Error("Invalid record ID.");
  return text || null;
}

function cleanChoice(value: FormDataEntryValue | null, choices: string[]) {
  const text = textValue(value).trim();
  return choices.includes(text) ? text : null;
}

function parseDate(value: FormDataEntryValue | null, endOfDay = false) {
  const text = textValue(value).trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("Enter a valid date.");
  const parsed = new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text)
    throw new Error("Enter a valid date.");
  return parsed;
}

function dateInputValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

export type WorkspaceFormResult = { ok: true } | { ok: false; error: string };
async function workspaceResult(action: () => Promise<void>): Promise<WorkspaceFormResult> {
  try {
    await action();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : "";
    const validation =
      /^(Session not found for this account\.|Invalid (annotation|snapshot|record ID)\.|Enter a valid date\.|(Annotation|Snapshot) unavailable or already deleted\.|Snapshot end date cannot precede start date\.|Choose a supported annotation type\.|Annotation title and note are required\.|Annotation end date cannot be before its start date\.|Snapshot name is required\.)$/;
    if (validation.test(message)) return { ok: false, error: message };
    reportServerFailure("analysis_workspace_save_failed", error);
    return {
      ok: false,
      error: "We could not confirm this change. Your entries are still here; please try again.",
    };
  }
}
function refreshWorkspaceAfterCommit() {
  try {
    revalidatePath("/analyse/workspace");
  } catch (error) {
    reportServerFailure("analysis_workspace_refresh_after_commit_failed", error);
  }
}
export async function saveAnalysisAnnotationWithStateAction(
  formData: FormData,
): Promise<WorkspaceFormResult> {
  return workspaceResult(() => saveAnalysisAnnotationAction(formData));
}
export async function deleteAnalysisAnnotationWithStateAction(
  formData: FormData,
): Promise<WorkspaceFormResult> {
  return workspaceResult(() => deleteAnalysisAnnotationAction(formData));
}
export async function saveAnalysisSnapshotWithStateAction(
  formData: FormData,
): Promise<WorkspaceFormResult> {
  return workspaceResult(() => saveAnalysisSnapshotAction(formData));
}
export async function deleteAnalysisSnapshotWithStateAction(
  formData: FormData,
): Promise<WorkspaceFormResult> {
  return workspaceResult(() => deleteAnalysisSnapshotAction(formData));
}
