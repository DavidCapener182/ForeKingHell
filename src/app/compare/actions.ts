"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { reportServerFailure } from "@/lib/server-observability";
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
  if (!compareViews.has(view))
    throw new WorkspaceComparisonInputError("Choose a supported comparison view.");

  const focusId = clean(formData.get("focusId"), 80);
  const baselineId = clean(formData.get("baselineId"), 80);
  if (
    view !== "progress" &&
    (!uuidPattern.test(focusId) || !uuidPattern.test(baselineId) || focusId === baselineId)
  )
    throw new WorkspaceComparisonInputError("Choose two different available comparison entries.");
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
  refreshComparisonAfterCommit();
}

export async function deleteWorkspaceComparisonAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const snapshotId = clean(formData.get("snapshotId"), 80);
  if (!uuidPattern.test(snapshotId)) throw new WorkspaceComparisonInputError("Invalid comparison.");

  const deleted = await getDb()
    .delete(analysisSnapshots)
    .where(and(eq(analysisSnapshots.id, snapshotId), eq(analysisSnapshots.userId, userId)))
    .returning({ id: analysisSnapshots.id });
  if (!deleted.length)
    throw new WorkspaceComparisonInputError("Comparison unavailable or already deleted.");
  refreshComparisonAfterCommit();
}

async function comparisonSnapshot(view: string, focusId: string, baselineId: string) {
  if (view === "clubs") {
    const data = await getClubCompareData({ clubAId: focusId, clubBId: baselineId });
    if (
      !data.clubA ||
      !data.clubB ||
      data.filters.clubAId !== focusId ||
      data.filters.clubBId !== baselineId
    )
      throw new WorkspaceComparisonInputError("Choose two clubs with comparison data.");
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
    if (
      !data.playerA ||
      !data.playerB ||
      data.filters.playerAId !== focusId ||
      data.filters.playerBId !== baselineId
    )
      throw new WorkspaceComparisonInputError("Choose two visible players.");
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class WorkspaceComparisonInputError extends Error {}
export type WorkspaceComparisonFormResult = { ok: true } | { ok: false; error: string };
async function comparisonResult(
  action: () => Promise<void>,
): Promise<WorkspaceComparisonFormResult> {
  try {
    await action();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof WorkspaceComparisonInputError) return { ok: false, error: error.message };
    reportServerFailure("workspace_comparison_change_failed", error);
    return {
      ok: false,
      error: "We could not confirm this change. Your comparison is still here; please try again.",
    };
  }
}
function refreshComparisonAfterCommit() {
  try {
    revalidatePath("/compare");
  } catch (error) {
    reportServerFailure("workspace_comparison_refresh_after_commit_failed", error);
  }
}
export async function saveWorkspaceComparisonWithStateAction(
  formData: FormData,
): Promise<WorkspaceComparisonFormResult> {
  return comparisonResult(() => saveWorkspaceComparisonAction(formData));
}
export async function deleteWorkspaceComparisonWithStateAction(
  formData: FormData,
): Promise<WorkspaceComparisonFormResult> {
  return comparisonResult(() => deleteWorkspaceComparisonAction(formData));
}
