"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { mergeStoredPostRoundReview } from "@/lib/post-round-review";
import { recordProductWorkflowEvent } from "@/lib/product-events";

export async function savePostRoundReviewAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const sessionId = requiredString(formData, "sessionId");
  const [session] = await getDb()
    .select({ id: sessions.id, notes: sessions.notes })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        inArray(sessions.type, ["real_round", "simulated_course"]),
        eq(sessions.roundStatus, "complete"),
      ),
    )
    .limit(1);

  if (!session) throw new Error("Round not found.");

  await getDb()
    .update(sessions)
    .set({
      notes: mergeStoredPostRoundReview(session.notes, {
        feltDifferent: optionalString(formData, "feltDifferent"),
        troubleClub: optionalString(formData, "troubleClub"),
        contextChange: optionalString(formData, "contextChange"),
        shotsToReview: optionalString(formData, "shotsToReview"),
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  revalidatePath("/courses/strategy");
  revalidatePath(`/rounds/${sessionId}`);
  recordProductWorkflowEvent("post_round_review_saved", {
    source: "course_strategy",
    status: "saved",
  });
  const destination = new URLSearchParams({ mode: "post", roundId: sessionId, saved: "1" });
  for (const key of ["courseId", "teeSetId", "hole", "option"]) {
    const value = optionalString(formData, key);
    if (value) destination.set(key, value);
  }
  redirect(`/courses/strategy?${destination}`);
}

export async function savePostRoundReviewWithStateAction(
  _state: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  try {
    await savePostRoundReviewAction(formData);
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Your notes could not be saved. They are still here; try again." };
  }
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, 600) : "";
}
