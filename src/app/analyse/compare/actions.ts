"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { analysisSnapshots } from "@/db/schema";
import { buildAnalysisSnapshot } from "@/lib/analysis-workspace";
import {
  defaultCompareFilters,
  getCompareData,
  type CompareConditionMode,
  type CompareFilters,
} from "@/lib/compare-data";
import { requireCurrentUserId } from "@/lib/current-user";

const conditions = new Set<CompareConditionMode>(["same", "indoor-outdoor", "practice-round"]);

export async function saveSessionComparisonAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const filters = filtersFromForm(formData);
  const data = await getCompareData(filters);
  const snapshot = buildAnalysisSnapshot({
    name: clean(formData.get("name"), 180) || `${data.focus.label} vs ${data.baseline.label}`,
    filters,
    chartState: {
      view: "session_comparison",
      experimentType: clean(formData.get("experimentType"), 60) || "session_vs_session",
      constants: {
        ball: clean(formData.get("ball"), 120),
        location: clean(formData.get("location"), 180),
        target: clean(formData.get("target"), 180),
        warmup: clean(formData.get("warmup"), 180),
        loft: clean(formData.get("loft"), 40),
        shaft: clean(formData.get("shaft"), 120),
      },
    },
    selectedMetrics: ["carry", "ball_speed", "dispersion", "playable_rate"],
    notes: clean(formData.get("notes"), 4_000),
    summary: {
      focusLabel: data.focus.label,
      baselineLabel: data.baseline.label,
      focusShots: data.focus.stockShots,
      baselineShots: data.baseline.stockShots,
      verdict: data.benefit.verdict,
      summary: data.benefit.summary,
      delta: data.delta,
    },
    sourceDataThrough: null,
  });

  await getDb()
    .insert(analysisSnapshots)
    .values({ userId, ...snapshot });
  revalidatePath("/analyse/compare");
  revalidatePath("/analyse/workspace");
}

export async function deleteSessionComparisonAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const snapshotId = clean(formData.get("snapshotId"), 80);
  if (!/^[0-9a-f-]{36}$/i.test(snapshotId)) throw new Error("Invalid comparison.");
  await getDb()
    .delete(analysisSnapshots)
    .where(and(eq(analysisSnapshots.id, snapshotId), eq(analysisSnapshots.userId, userId)));
  revalidatePath("/analyse/compare");
  revalidatePath("/analyse/workspace");
}

function filtersFromForm(formData: FormData): CompareFilters {
  const defaults = defaultCompareFilters();
  const condition = clean(formData.get("condition"), 40) as CompareConditionMode;
  const period = clean(formData.get("period"), 20);
  return {
    ...defaults,
    focus: period === "month" ? "last-30" : "session",
    baseline: period === "month" ? "previous-30" : "previous-session",
    sessionId: clean(formData.get("sessionId"), 80),
    baselineSessionId: clean(formData.get("baselineSessionId"), 80),
    clubId: clean(formData.get("clubId"), 80),
    condition: conditions.has(condition) ? condition : "same",
  };
}

function clean(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
