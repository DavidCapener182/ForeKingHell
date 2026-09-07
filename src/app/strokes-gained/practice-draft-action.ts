"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentUserId } from "@/lib/current-user";
import { reportServerFailure } from "@/lib/server-observability";
import { validPracticeRecordId } from "@/lib/practice-handoff";
import {
  sgPracticePrescription,
  sgPracticeFingerprint,
  sgPracticePlan,
} from "@/lib/strokes-gained-practice-handoff";
import { getOwnedStrokesGainedPracticeEvents } from "@/lib/strokes-gained-practice-data";
import {
  generatePracticePlan,
  getPracticePlannerContext,
  getSavedPracticePlan,
  savePracticePlanForUser,
} from "@/lib/practice-planner";
export async function createSgPracticeDraftAction(
  _previous: { error: string | null },
  form: FormData,
): Promise<{ error: string | null }> {
  const userId = await requireCurrentUserId();
  const prescription = sgPracticePrescription(String(form.get("category") ?? ""));
  const creationId = String(form.get("creationId") ?? "");
  const fingerprint = String(form.get("fingerprint") ?? "");
  let eventIds: unknown;
  try {
    eventIds = JSON.parse(String(form.get("eventIds") ?? ""));
  } catch {
    return { error: "Refresh the scoring analysis and choose the category again." };
  }
  if (
    !prescription ||
    !validPracticeRecordId(creationId) ||
    !/^[a-f0-9]{64}$/.test(fingerprint) ||
    !Array.isArray(eventIds) ||
    !eventIds.length ||
    eventIds.length > 200 ||
    !eventIds.every((id) => typeof id === "string" && validPracticeRecordId(id)) ||
    new Set(eventIds).size !== eventIds.length
  )
    return { error: "Refresh the scoring analysis and choose the category again." };
  let planId: string;
  try {
    const existing = await getSavedPracticePlan(userId, creationId);
    if (existing) {
      if (
        existing.generation.sgHandoff?.fingerprint !== fingerprint ||
        existing.generation.sgHandoff.category !== prescription.category
      )
        return { error: "This request belongs to another category draft. Refresh the analysis." };
      planId = existing.id;
    } else {
      const events = await getOwnedStrokesGainedPracticeEvents(userId, eventIds);
      if (
        events.length !== eventIds.length ||
        events.some((e) => e.category !== prescription.category) ||
        sgPracticeFingerprint(prescription.category, events) !== fingerprint
      )
        return {
          error:
            "The selected scoring evidence has changed. Refresh the analysis before saving this drill.",
        };
      const context = await getPracticePlannerContext(userId);
      const base = generatePracticePlan(context, {
        sessionType: prescription.sessionType,
        timeMinutes: 15,
        energy: "normal",
        intent: "scoring",
        ...(prescription.balls ? { ballCount: 50 } : {}),
      });
      planId = await savePracticePlanForUser(
        userId,
        sgPracticePlan(base, prescription.category, events),
        { creationId },
      );
    }
  } catch (error) {
    reportServerFailure("sg_practice_draft_failed", error);
    return { error: "We could not confirm the saved draft. Your category is retained; try again." };
  }
  try {
    revalidatePath("/practice");
  } catch (error) {
    reportServerFailure("sg_practice_refresh_after_commit_failed", error);
  }
  redirect(`/practice?planId=${encodeURIComponent(planId)}`);
}
