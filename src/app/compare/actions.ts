"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { analysisSnapshots } from "@/db/schema";
import { buildAnalysisSnapshot } from "@/lib/analysis-workspace";
import {
  defaultClubCompareFilters,
  getClubCompareData,
  getPlayerCompareData,
} from "@/lib/compare-data";
import { requireCurrentUserId } from "@/lib/current-user";

const compareViews = new Set(["progress", "clubs", "players"]);

export async function saveWorkspaceComparisonAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const view = clean(formData.get("view"), 24);
  if (!compareViews.has(view)) throw new Error("Choose a supported comparison view.");

  const focusId = clean(formData.get("focusId"), 80);
  const baselineId = clean(formData.get("baselineId"), 80);
  const notes = clean(formData.get("notes"), 4_000);
  const comparison = await comparisonSnapshot(view, focusId, baselineId);
  const snapshot = buildAnalysisSnapshot({
    name: clean(formData.get("name"), 180) || comparison.defaultName,
    filters: comparison.filters,
    chartState: {
      view: "workspace_comparison",
      compareView: view,
    },
    selectedMetrics: comparison.selectedMetrics,
    notes,
    summary: comparison.summary,
    sourceDataThrough: null,
  });

  await getDb()
    .insert(analysisSnapshots)
    .values({ userId, ...snapshot });
  revalidatePath("/compare");
}

export async function deleteWorkspaceComparisonAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const snapshotId = clean(formData.get("snapshotId"), 80);
  if (!/^[0-9a-f-]{36}$/i.test(snapshotId)) throw new Error("Invalid comparison.");

  await getDb()
    .delete(analysisSnapshots)
    .where(and(eq(analysisSnapshots.id, snapshotId), eq(analysisSnapshots.userId, userId)));
  revalidatePath("/compare");
}

async function comparisonSnapshot(view: string, focusId: string, baselineId: string) {
  if (view === "clubs") {
    const data = await getClubCompareData({ clubAId: focusId, clubBId: baselineId });
    if (!data.clubA || !data.clubB) throw new Error("Choose two clubs with comparison data.");
    return {
      defaultName: `${data.clubA.label} vs ${data.clubB.label}`,
      filters: data.filters,
      selectedMetrics: [
        "carry",
        "total",
        "ball_speed",
        "offline",
        "shot_cone",
        "playable_rate",
        "big_miss_rate",
        "launch",
      ],
      summary: {
        focusLabel: data.clubA.label,
        baselineLabel: data.clubB.label,
        focusShots: data.clubA.stockShots,
        baselineShots: data.clubB.stockShots,
        delta: data.delta,
      },
    };
  }

  if (view === "players") {
    const data = await getPlayerCompareData({ playerAId: focusId, playerBId: baselineId });
    if (!data.playerA || !data.playerB) throw new Error("Choose two visible players.");
    return {
      defaultName: `${data.playerA.displayName} vs ${data.playerB.displayName}`,
      filters: data.filters,
      selectedMetrics: [
        "handicap",
        "best_score",
        "scoring_average",
        "driver_carry",
        "seven_iron_carry",
        "offline",
        "playable_rate",
      ],
      summary: {
        focusLabel: data.playerA.displayName,
        baselineLabel: data.playerB.displayName,
        focusRounds: data.playerA.rounds,
        baselineRounds: data.playerB.rounds,
        delta: data.delta,
      },
    };
  }

  const data = await getClubCompareData(defaultClubCompareFilters());
  const comparison =
    focusId === "last-30" || baselineId === "previous-30"
      ? data.progress.previousMonth
      : data.progress.previousWeek;
  return {
    defaultName: `${comparison.focus.label} vs ${comparison.label}`,
    filters: { focusId, baselineId, mode: comparison.mode },
    selectedMetrics: [
      "carry",
      "ball_speed",
      "launch",
      "offline",
      "shot_cone",
      "playable_rate",
      "big_miss_rate",
    ],
    summary: {
      focusLabel: comparison.focus.label,
      baselineLabel: comparison.label,
      focusShots: comparison.focus.stockShots,
      baselineShots: comparison.baseline.stockShots,
      verdict: comparison.benefit.verdict,
      summary: comparison.benefit.summary,
      delta: comparison.delta,
    },
  };
}

function clean(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}
