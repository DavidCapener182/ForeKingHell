"use server";

import { revalidatePath } from "next/cache";
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

  revalidatePath("/analyse/workspace");
}

export async function deleteAnalysisAnnotationAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const annotationId = cleanUuid(formData.get("annotationId"));
  if (!annotationId) throw new Error("Invalid annotation.");

  await getDb()
    .delete(analysisAnnotations)
    .where(and(eq(analysisAnnotations.id, annotationId), eq(analysisAnnotations.userId, userId)));
  revalidatePath("/analyse/workspace");
}

export async function saveAnalysisSnapshotAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const club = cleanText(formData.get("club"), 40);
  const from = parseDate(formData.get("from"));
  const to = parseDate(formData.get("to"), true);
  if (from && to && to < from) throw new Error("Snapshot end date cannot precede start date.");
  const clauses = [eq(shots.userId, userId)];
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
  revalidatePath("/analyse/workspace");
}

export async function deleteAnalysisSnapshotAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const snapshotId = cleanUuid(formData.get("snapshotId"));
  if (!snapshotId) throw new Error("Invalid snapshot.");

  await getDb()
    .delete(analysisSnapshots)
    .where(and(eq(analysisSnapshots.id, snapshotId), eq(analysisSnapshots.userId, userId)));
  revalidatePath("/analyse/workspace");
}

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return textValue(value).trim().slice(0, maxLength);
}

function cleanUuid(value: FormDataEntryValue | null) {
  const text = textValue(value).trim();
  return uuidPattern.test(text) ? text : null;
}

function cleanChoice(value: FormDataEntryValue | null, choices: string[]) {
  const text = textValue(value).trim();
  return choices.includes(text) ? text : null;
}

function parseDate(value: FormDataEntryValue | null, endOfDay = false) {
  const text = textValue(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateInputValue(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
