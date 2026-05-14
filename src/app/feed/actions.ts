"use server";

import {
  addFeedComment,
  addFeedCommentReaction,
  addFeedReaction,
  deleteFeedComment,
  removeFeedCommentReaction,
  removeFeedReaction,
} from "@/lib/social";

export async function addFeedReactionAction(formData: FormData) {
  await addFeedReaction(requiredString(formData, "feedItemId"));
}

export async function removeFeedReactionAction(formData: FormData) {
  await removeFeedReaction(requiredString(formData, "feedItemId"));
}

export async function addFeedCommentAction(formData: FormData) {
  await addFeedComment(requiredString(formData, "feedItemId"), requiredString(formData, "body"));
}

export async function deleteFeedCommentAction(formData: FormData) {
  await deleteFeedComment(requiredString(formData, "commentId"));
}

export async function addFeedCommentReactionAction(formData: FormData) {
  await addFeedCommentReaction(requiredString(formData, "commentId"));
}

export async function removeFeedCommentReactionAction(formData: FormData) {
  await removeFeedCommentReaction(requiredString(formData, "commentId"));
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}
