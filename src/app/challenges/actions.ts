"use server";

import { redirect } from "next/navigation";

import {
  addChallengeComment,
  createChallenge,
  inviteFriendToChallenge,
  joinChallenge,
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
    inviteeUserIds: formData.getAll("inviteeUserIds").filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  });

  redirect(`/challenges/${challengeId}`);
}

export async function joinChallengeAction(formData: FormData) {
  const challengeId = requiredString(formData, "challengeId");
  await joinChallenge(challengeId);
  redirect(`/challenges/${challengeId}`);
}

export async function addChallengeCommentAction(formData: FormData) {
  const challengeId = requiredString(formData, "challengeId");
  await addChallengeComment(challengeId, requiredString(formData, "body"));
  redirect(`/challenges/${challengeId}`);
}

export async function inviteFriendToChallengeAction(formData: FormData) {
  const challengeId = requiredString(formData, "challengeId");
  await inviteFriendToChallenge(challengeId, requiredString(formData, "inviteeUserId"));
  redirect(`/challenges/${challengeId}?invite=sent`);
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
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
