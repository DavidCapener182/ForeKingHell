"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUserId } from "@/lib/current-user";
import {
  getProductPreferences,
  parseProductPreferences,
  parseSeasonGoal,
  updateProductPreferences,
} from "@/lib/product-preferences";

export async function saveSeasonPlanAction(formData: FormData) {
  const userId = await requireCurrentUserId();
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
  revalidatePath("/goals");
  revalidatePath("/today");
  redirect("/goals?saved=1");
}

export async function addGoalAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const current = await getProductPreferences(userId);
  const goal = parseSeasonGoal({
    id: randomUUID(),
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
  if (!goal) redirect("/goals?error=goal_type");

  await updateProductPreferences(userId, { goals: [...current.goals, goal].slice(-12) });
  revalidatePath("/goals");
  revalidatePath("/today");
  redirect("/goals?saved=goal");
}

export async function deleteGoalAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const goalId = String(formData.get("goalId") ?? "");
  const current = await getProductPreferences(userId);
  await updateProductPreferences(userId, {
    goals: current.goals.filter((goal) => goal.id !== goalId),
  });
  revalidatePath("/goals");
  revalidatePath("/today");
}

export async function updateGoalAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const current = await getProductPreferences(userId);
  const goalId = String(formData.get("goalId") ?? "");
  const existing = current.goals.find((goal) => goal.id === goalId);
  if (!existing) redirect("/goals?error=goal_not_found");
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
  if (!goal) redirect("/goals?error=goal_type");

  await updateProductPreferences(userId, {
    goals: current.goals.map((item) => (item.id === goalId ? goal : item)),
  });
  revalidatePath("/goals");
  revalidatePath("/today");
  redirect("/goals?saved=goal");
}
