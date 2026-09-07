"use server";
import { reportServerFailure } from "@/lib/server-observability";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProgressData } from "@/lib/progress-data";
import { buildCoachSummary, buildCoachDrillChallenges } from "@/lib/coach";
import { coachPracticeFingerprint, coachPracticePlan } from "@/lib/coach-practice-handoff";
import {
  generatePracticePlan,
  getPracticePlannerContext,
  getSavedPracticePlan,
  savePracticePlanForUser,
} from "@/lib/practice-planner";
import { validPracticeRecordId } from "@/lib/practice-handoff";
export async function createCoachPracticeDraftAction(
  _previous: { error: string | null },
  form: FormData,
): Promise<{ error: string | null }> {
  const userId = await requireCurrentUserId();
  const clubId = String(form.get("clubId") ?? "");
  const creationId = String(form.get("creationId") ?? "");
  const fingerprint = String(form.get("fingerprint") ?? "");
  if (
    !validPracticeRecordId(clubId) ||
    !validPracticeRecordId(creationId) ||
    !/^[a-f0-9]{64}$/.test(fingerprint)
  )
    return { error: "Refresh Coach and choose the drill again." };
  let planId: string;
  try {
    const existing = await getSavedPracticePlan(userId, creationId);
    if (existing) {
      if (
        existing.generation.coachHandoff?.fingerprint !== fingerprint ||
        existing.generation.coachHandoff.clubId !== clubId
      )
        return {
          error: "This draft request belongs to another drill. Refresh Coach and try again.",
        };
      planId = existing.id;
    } else {
      const data = await getProgressData(userId);
      const coach = buildCoachSummary(data.clubs);
      const card = coach.clubCards.find((item) => item.clubId === clubId);
      const drill = card
        ? buildCoachDrillChallenges({ ...coach, clubCards: [card] })[0]
        : undefined;
      if (!card || !drill || coachPracticeFingerprint(card, drill) !== fingerprint)
        return {
          error:
            "This coaching evidence has changed. Refresh Coach to review the current drill and target.",
        };
      const context = await getPracticePlannerContext(userId);
      const base = generatePracticePlan(context, {
        focusClub: card.clubType,
        sessionType: "range",
        ballCount: 50,
        timeMinutes: 30,
        energy: "normal",
        intent: "latest_weakness",
      });
      planId = await savePracticePlanForUser(userId, coachPracticePlan(base, card, drill), {
        creationId,
      });
    }
  } catch {
    return {
      error: "The coaching draft could not be saved. Your selected drill is retained; try again.",
    };
  }
  try {
    revalidatePath("/practice");
  } catch (error) {
    reportServerFailure("coach_practice_refresh_after_commit_failed", error);
  }
  redirect(`/practice?planId=${encodeURIComponent(planId)}`);
}
