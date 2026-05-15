"use server";

import {
  addFeedComment,
  addFeedCommentReaction,
  addFeedReaction,
  deleteFeedComment,
  hideFeedItem,
  muteFeedItemType,
  removeFeedCommentReaction,
  removeFeedReaction,
  reportFeedItem,
  updateFeedItemVisibility,
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

export async function updateFeedItemVisibilityAction(formData: FormData) {
  const visibility = requiredString(formData, "visibility");
  if (visibility !== "private" && visibility !== "friends" && visibility !== "public") {
    throw new Error("Invalid visibility.");
  }

  await updateFeedItemVisibility(requiredString(formData, "feedItemId"), visibility);
}

export async function hideFeedItemAction(formData: FormData) {
  await hideFeedItem(requiredString(formData, "feedItemId"));
}

export async function muteFeedItemTypeAction(formData: FormData) {
  await muteFeedItemType(requiredString(formData, "feedItemId"));
}

export async function reportFeedItemAction(formData: FormData) {
  await reportFeedItem(requiredString(formData, "feedItemId"), optionalString(formData, "reason") ?? "feed_safety");
}

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
