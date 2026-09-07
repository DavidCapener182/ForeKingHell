"use server";

import { redirect } from "next/navigation";

import {
  addChallengeComment,
  createChallenge,
  inviteFriendToChallenge,
  joinChallenge,
  leaveChallenge,
} from "@/lib/challenges";
import { parseVisibility } from "@/lib/social";

export async function createChallengeAction(formData: FormData) {
  const challengeId = await createChallenge({
    templateId: requiredString(formData, "templateId"),
    title: requiredString(formData, "title"),
    description: nullableString(formData, "description"),
    visibility: parseVisibility(formData.get("visibility"), "friends"),
    startsAt: dateFromForm(formData, "startsAt"),
    endsAt: dateFromForm(formData, "endsAt"),
    inviteeUserIds: formData
      .getAll("inviteeUserIds")
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  });

  redirect(`/challenges/${challengeId}`);
}

export async function joinChallengeAction(formData: FormData) {
  const challengeId = requiredString(formData, "challengeId");
  await joinChallenge(challengeId);
  redirect(`/challenges/${challengeId}`);
}

export async function leaveChallengeAction(formData: FormData) {
  const challengeId = requiredString(formData, "challengeId");
  await leaveChallenge(challengeId);
  redirect("/challenges?tab=active");
}

export async function addChallengeCommentAction(formData: FormData) {
  const challengeId = requiredString(formData, "challengeId");
  await addChallengeComment(challengeId, requiredString(formData, "body"));
  redirect(`/challenges/${challengeId}?tab=chat`);
}

export async function inviteFriendToChallengeAction(formData: FormData) {
  const challengeId = requiredString(formData, "challengeId");
  await inviteFriendToChallenge(challengeId, requiredString(formData, "inviteeUserId"));
  redirect(`/challenges/${challengeId}?invite=sent`);
}

export async function addChallengeCommentFormAction(
  _previousState: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await addChallengeComment(
      requiredString(formData, "challengeId"),
      requiredString(formData, "body"),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save comment." };
  }
}

export async function inviteFriendToChallengeFormAction(
  _previousState: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await inviteFriendToChallenge(
      requiredString(formData, "challengeId"),
      requiredString(formData, "inviteeUserId"),
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save invitation.",
    };
  }
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function nullableString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateFromForm(formData: FormData, key: string) {
  const value = nullableString(formData, key);

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${key} must be a valid date.`);
  }
  return parsed;
}
