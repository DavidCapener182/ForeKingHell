"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { reportServerFailure } from "@/lib/server-observability";
import { requireCurrentUserId } from "@/lib/current-user";
import { GoalProjectError, linkGoalImprovementProject } from "@/lib/goal-improvement-project";
import {
  mutateProductPreferences,
  parseProductPreferences,
  parseSeasonGoal,
  updateProductPreferences,
} from "@/lib/product-preferences";

export async function saveSeasonPlanAction(formData: FormData) {
  try {
    await persistSeasonPlan(formData);
  } catch (error) {
    if (error instanceof GoalFormError) redirect(`/goals?error=${error.code}`);
    throw error;
  }
  redirect("/goals?saved=1");
}

export async function saveSeasonPlanWithStateAction(formData: FormData): Promise<GoalFormResult> {
  return goalFormResult(() => persistSeasonPlan(formData));
}

async function persistSeasonPlan(formData: FormData) {
  const userId = await requireCurrentUserId();
  for (const field of ["outcome", "focus", "successMeasure"]) {
    const value = formData.get(field);
    if (typeof value !== "string" || !value.trim()) failGoal("season_details");
  }
  const frequency = formData.get("weeklySessions");
  if (
    typeof frequency !== "string" ||
    !frequency.trim() ||
    !Number.isInteger(Number(frequency)) ||
    Number(frequency) < 1 ||
    Number(frequency) > 7
  )
    failGoal("season_frequency");
  validateTargetDate(formData.get("targetDate"));
  const parsed = parseProductPreferences({
    seasonPlan: {
      outcome: formData.get("outcome"),
      targetDate: formData.get("targetDate"),
      focus: formData.get("focus"),
      weeklySessions: formData.get("weeklySessions"),
      successMeasure: formData.get("successMeasure"),
    },
  });

  await updateProductPreferences(userId, { seasonPlan: parsed.seasonPlan });
  revalidateGoalViews();
}

async function persistAddedGoal(formData: FormData) {
  const userId = await requireCurrentUserId();
  validateGoalValues(formData);
  const requestedId = formData.get("creationId");
  if (
    requestedId &&
    (typeof requestedId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId))
  )
    failGoal("goal_request");
  const goal = parseSeasonGoal({
    id: requestedId || randomUUID(),
    type: formData.get("type"),
    title: formData.get("title"),
    club: formData.get("club"),
    startingValue: formData.get("startingValue"),
    currentValue: formData.get("currentValue"),
    targetValue: formData.get("targetValue"),
    unit: formData.get("unit"),
    targetDate: formData.get("goalTargetDate"),
    evidenceSource: formData.get("evidenceSource"),
    nextAction: formData.get("nextAction"),
  });
  if (!goal) failGoal("goal_type");

  await mutateProductPreferences(userId, (current) => {
    const existing = current.goals.find((item) => item.id === goal.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(goal)) failGoal("goal_request");
      return {};
    }
    if (current.goals.length >= 12) failGoal("goal_limit");
    return { goals: [...current.goals, goal] };
  });
  revalidateGoalViews();
}

export async function deleteGoalAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const goalId = String(formData.get("goalId") ?? "");
  await mutateProductPreferences(userId, (current) => ({
    goals: current.goals.filter((goal) => goal.id !== goalId),
  }));
  revalidateGoalViews();
}

async function persistUpdatedGoal(formData: FormData) {
  const userId = await requireCurrentUserId();
  validateGoalValues(formData);
  const goalId = String(formData.get("goalId") ?? "");
  const goal = parseSeasonGoal({
    id: goalId,
    type: formData.get("type"),
    title: formData.get("title"),
    club: formData.get("club"),
    startingValue: formData.get("startingValue"),
    currentValue: formData.get("currentValue"),
    targetValue: formData.get("targetValue"),
    unit: formData.get("unit"),
    targetDate: formData.get("goalTargetDate"),
    evidenceSource: formData.get("evidenceSource"),
    nextAction: formData.get("nextAction"),
  });
  if (!goal) failGoal("goal_type");

  await mutateProductPreferences(userId, (current) => {
    if (!current.goals.some((item) => item.id === goalId)) failGoal("goal_not_found");
    return {
      goals: current.goals.map((item) =>
        item.id === goalId ? { ...goal, ...(item.project ? { project: item.project } : {}) } : item,
      ),
    };
  });
  revalidateGoalViews();
}

function validateGoalValues(formData: FormData) {
  for (const field of ["startingValue", "currentValue", "targetValue"]) {
    const value = formData.get(field);
    if (typeof value !== "string" || !value.trim() || !Number.isFinite(Number(value) * 10)) {
      failGoal("goal_values");
    }
  }
  validateTargetDate(formData.get("goalTargetDate"));
}

function validateTargetDate(date: FormDataEntryValue | null) {
  if (date !== null && typeof date !== "string") failGoal("goal_date");
  if (
    typeof date === "string" &&
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  ) {
    failGoal("goal_date");
  }
}

export type GoalFormResult = { ok: true } | { ok: false; error: string; code?: string };

export async function addGoalAction(formData: FormData) {
  await saveGoalWithRedirect(() => persistAddedGoal(formData));
}

export async function updateGoalAction(formData: FormData) {
  await saveGoalWithRedirect(() => persistUpdatedGoal(formData));
}

export async function addGoalWithStateAction(formData: FormData): Promise<GoalFormResult> {
  return goalFormResult(() => persistAddedGoal(formData));
}

export async function updateGoalWithStateAction(formData: FormData): Promise<GoalFormResult> {
  return goalFormResult(() => persistUpdatedGoal(formData));
}

export async function deleteGoalWithStateAction(formData: FormData): Promise<GoalFormResult> {
  return goalFormResult(() => deleteGoalAction(formData));
}

export async function saveGoalProjectWithStateAction(formData: FormData): Promise<GoalFormResult> {
  return goalFormResult(async () => {
    const userId = await requireCurrentUserId();
    const goalId = formData.get("goalId");
    const baseline = formData.get("baselineSessionId");
    const plans = formData.getAll("practicePlanId");
    if (
      typeof goalId !== "string" ||
      (baseline !== null && typeof baseline !== "string") ||
      plans.some((id) => typeof id !== "string")
    )
      throw new GoalProjectError("Choose a goal, baseline and saved practice plans.");
    await linkGoalImprovementProject({
      userId,
      goalId,
      baselineSessionId: typeof baseline === "string" && baseline ? baseline : null,
      practicePlanIds: plans.filter((id): id is string => typeof id === "string" && Boolean(id)),
    });
    revalidateGoalViews();
  });
}

async function saveGoalWithRedirect(save: () => Promise<void>) {
  try {
    await save();
  } catch (error) {
    if (error instanceof GoalFormError) redirect(`/goals?error=${error.code}`);
    throw error;
  }
  redirect("/goals?saved=goal");
}

async function goalFormResult(save: () => Promise<void>): Promise<GoalFormResult> {
  try {
    await save();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof GoalProjectError)
      return { ok: false, code: "goal_project", error: error.message };
    if (error instanceof GoalFormError)
      return { ok: false, code: error.code, error: error.message };
    reportServerFailure("goal_save_failed", error);
    return {
      ok: false,
      code: "goal_save_failed",
      error: "We could not confirm the save. Please try again.",
    };
  }
}

const goalErrors = {
  goal_type: "Choose a valid goal type.",
  goal_values: "Enter valid numbers for starting, current and target values.",
  goal_date: "Choose a valid target date, or leave it blank.",
  goal_limit: "You already have 12 goals. Delete one before adding another.",
  goal_request:
    "This goal request has already been used or is invalid. Refresh to edit the saved goal, or open a new goal form.",
  goal_not_found: "That goal could not be found in your account. Refresh and try again.",
  season_frequency: "Choose a whole number from 1 to 7 for weekly practice sessions.",
  season_details: "Add an outcome, a practice focus and a success measure.",
};
class GoalFormError extends Error {
  constructor(readonly code: keyof typeof goalErrors) {
    super(goalErrors[code]);
  }
}
function failGoal(code: keyof typeof goalErrors): never {
  throw new GoalFormError(code);
}

function revalidateGoalViews() {
  for (const path of [
    "/goals",
    "/today",
    "/progress",
    "/dashboard",
    "/coach/workspace",
    "/practice/quick-range",
  ])
    revalidatePath(path);
}
