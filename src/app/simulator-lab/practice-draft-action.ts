"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentUserId } from "@/lib/current-user";
import { reportServerFailure } from "@/lib/server-observability";
import { validPracticeRecordId } from "@/lib/practice-handoff";
import { getRangeRealityHandicapData } from "@/lib/reality-handicap";
import {
  simulatorPracticeFingerprint,
  simulatorPracticePlan,
} from "@/lib/simulator-practice-handoff";
import {
  generatePracticePlan,
  getPracticePlannerContext,
  getSavedPracticePlan,
  savePracticePlanForUser,
} from "@/lib/practice-planner";
export async function createSimulatorPracticeDraftAction(
  _previous: { error: string | null },
  form: FormData,
): Promise<{ error: string | null }> {
  const owner = await requireCurrentUserId();
  const creationId = String(form.get("creationId") ?? "");
  const prescriptionId = String(form.get("prescriptionId") ?? "");
  const fingerprint = String(form.get("fingerprint") ?? "");
  if (
    !validPracticeRecordId(creationId) ||
    !["primary-club", "secondary-club", "transfer"].includes(prescriptionId) ||
    !/^[a-f0-9]{64}$/.test(fingerprint)
  )
    return { error: "Refresh the Lab and choose the prescription again." };
  let planId: string;
  try {
    const existing = await getSavedPracticePlan(owner, creationId);
    if (existing) {
      if (
        existing.generation.simulatorHandoff?.fingerprint !== fingerprint ||
        existing.generation.simulatorHandoff.prescriptionId !== prescriptionId
      )
        return { error: "This request belongs to another prescription. Refresh the Lab." };
      planId = existing.id;
    } else {
      const reality = await getRangeRealityHandicapData(owner);
      const item = reality.prescriptions.find((p) => p.id === prescriptionId);
      if (
        !item ||
        !reality.evidence?.sampleSize ||
        simulatorPracticeFingerprint(reality, prescriptionId) !== fingerprint
      )
        return {
          error: "The range evidence has changed. Refresh the Lab before saving this drill.",
        };
      const context = await getPracticePlannerContext(owner);
      const base = generatePracticePlan(context, {
        sessionType: "range",
        timeMinutes: 15,
        energy: "normal",
        intent: "scoring",
        ballCount: 50,
      });
      planId = await savePracticePlanForUser(owner, simulatorPracticePlan(base, reality, item), {
        creationId,
      });
    }
  } catch (error) {
    reportServerFailure("simulator_practice_draft_failed", error);
    return {
      error: "We could not confirm the saved draft. Your prescription is retained; try again.",
    };
  }
  try {
    revalidatePath("/practice");
  } catch (error) {
    reportServerFailure("simulator_practice_refresh_after_commit_failed", error);
  }
  redirect(`/practice?planId=${encodeURIComponent(planId)}`);
}
