"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUserId } from "@/lib/current-user";
import { recordProductWorkflowEvent } from "@/lib/product-events";
import {
  completePracticePlanForUser,
  completePracticePlanFromSelectedImport,
  generatePracticePlan,
  getPracticePlannerContext,
  savePracticePlanForUser,
  savePracticePlanActivityProgressForUser,
  updatePracticePlanStatusForUser,
  type GeneratePracticePlanOptions,
  type PracticePlan,
  type PracticeResultInput,
} from "@/lib/practice-planner";

export async function generatePracticePlanAction(options: GeneratePracticePlanOptions) {
  const userId = await requireCurrentUserId();
  const context = await getPracticePlannerContext(userId);

  return generatePracticePlan(context, options);
}

export async function savePracticePlanAction(plan: PracticePlan) {
  const userId = await requireCurrentUserId();
  const planId = await savePracticePlanForUser(userId, plan);

  revalidatePracticePlannerSurfaces();
  recordProductWorkflowEvent("practice_plan_saved", {
    durationMinutes: plan.estimatedTimeMinutes,
    source: plan.sessionType,
  });

  return { planId, latestSessionReview: null };
}

export async function saveAndStartPracticePlanAction(plan: PracticePlan) {
  const userId = await requireCurrentUserId();
  const planId = await savePracticePlanForUser(userId, plan);

  await updatePracticePlanStatusForUser(userId, planId, "awaiting_import");
  revalidatePracticePlannerSurfaces({ includePractice: false });
  recordProductWorkflowEvent("practice_plan_started", {
    durationMinutes: plan.estimatedTimeMinutes,
    source: plan.sessionType,
  });

  return { planId, status: "awaiting_import" as const };
}

export async function startPracticePlanAction(planId: string) {
  const userId = await requireCurrentUserId();

  await updatePracticePlanStatusForUser(userId, planId, "awaiting_import");
  revalidatePracticePlannerSurfaces();
  recordProductWorkflowEvent("practice_plan_started", { source: "saved_plan" });

  return { status: "awaiting_import" as const };
}

export async function completePracticeActivityAction(planId: string) {
  const userId = await requireCurrentUserId();

  await updatePracticePlanStatusForUser(userId, planId, "completed");
  revalidatePracticePlannerSurfaces();
  recordProductWorkflowEvent("practice_plan_completed", {
    source: "activity",
    status: "completed",
  });

  return { status: "completed" as const, measuredSuccess: false as const };
}

export async function savePracticeActivityProgressAction(
  planId: string,
  input: { blockIndex: number; completedBlockIds: string[]; note: string },
) {
  const userId = await requireCurrentUserId();
  await savePracticePlanActivityProgressForUser(userId, planId, input);
  return { saved: true as const };
}

export async function linkPracticePlanSessionAction(planId: string, sourceSessionId: string) {
  const userId = await requireCurrentUserId();
  const latestSessionReview = await completePracticePlanFromSelectedImport(
    userId,
    planId,
    sourceSessionId,
  );

  revalidatePracticePlannerSurfaces();

  return {
    latestSessionReview,
    error: latestSessionReview ? null : "That session could not be scored against this plan.",
  };
}

export async function abandonPracticePlanAction(planId: string) {
  const userId = await requireCurrentUserId();

  await updatePracticePlanStatusForUser(userId, planId, "abandoned");
  revalidatePracticePlannerSurfaces();

  return { status: "abandoned" as const };
}

export async function completePracticePlanAction(planId: string, input: PracticeResultInput) {
  const userId = await requireCurrentUserId();
  const result = await completePracticePlanForUser(userId, planId, input);

  revalidatePracticePlannerSurfaces();
  recordProductWorkflowEvent("practice_plan_completed", {
    source: "measured_import",
    status: input.completionStatus,
  });

  return result;
}

function revalidatePracticePlannerSurfaces({ includePractice = true } = {}) {
  if (includePractice) revalidatePath("/practice");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/progress");
  revalidatePath("/stats/training-over-time");
  revalidatePath("/coach");
  revalidatePath("/achievements");
}
