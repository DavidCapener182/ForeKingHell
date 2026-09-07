"use server";

import {
  addFeedComment,
  addFeedCommentReaction,
  addFeedReaction,
  createStatusUpdate,
  deleteFeedItem,
  deleteFeedComment,
  hideFeedItem,
  hideFeedItemType,
  muteFeedItemUser,
  parseVisibility,
  reportFeedItem,
  removeFeedCommentReaction,
  removeFeedReaction,
  updateFeedItemVisibility,
} from "@/lib/social";

type StatusUpdateActionState = {
  status: "idle" | "success" | "error";
  message: string;
  resetKey: string;
};

export async function createStatusUpdateAction(
  _previousState: StatusUpdateActionState,
  formData: FormData,
): Promise<StatusUpdateActionState> {
  try {
    await createStatusUpdate({
      body: optionalString(formData, "body") ?? "",
      imageDataUrl: optionalString(formData, "imageDataUrl"),
      visibility: parseVisibility(formData.get("visibility"), "private"),
    });

    return { status: "success", message: "Status update posted.", resetKey: String(Date.now()) };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Status update could not be posted.",
      resetKey: _previousState.resetKey,
    };
  }
}

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
  await updateFeedItemVisibility(
    requiredString(formData, "feedItemId"),
    parseVisibility(formData.get("visibility"), "private"),
  );
}

export async function deleteFeedItemAction(formData: FormData) {
  await deleteFeedItem(requiredString(formData, "feedItemId"));
}

export async function hideFeedItemAction(formData: FormData) {
  await hideFeedItem(requiredString(formData, "feedItemId"));
}

export async function hideFeedItemTypeAction(formData: FormData) {
  await hideFeedItemType(requiredString(formData, "feedItemId"));
}

export async function reportFeedItemAction(formData: FormData) {
  await reportFeedItem(
    requiredString(formData, "feedItemId"),
    optionalString(formData, "reason") ?? "feed_report",
  );
}

export async function muteFeedItemUserAction(formData: FormData) {
  await muteFeedItemUser(requiredString(formData, "feedItemId"));
}

export async function feedInteractionFormAction(
  _previous: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (requiredString(formData, "operation")) {
      case "reaction":
        await addFeedReactionAction(formData);
        break;
      case "unreact":
        await removeFeedReactionAction(formData);
        break;
      case "comment":
        await addFeedCommentAction(formData);
        break;
      case "delete-comment":
        await deleteFeedCommentAction(formData);
        break;
      case "comment-reaction":
        await addFeedCommentReactionAction(formData);
        break;
      case "comment-unreact":
        await removeFeedCommentReactionAction(formData);
        break;
      case "visibility":
        await updateFeedItemVisibilityAction(formData);
        break;
      case "delete":
        await deleteFeedItemAction(formData);
        break;
      case "hide":
        await hideFeedItemAction(formData);
        break;
      case "hide-type":
        await hideFeedItemTypeAction(formData);
        break;
      case "mute":
        await muteFeedItemUserAction(formData);
        break;
      case "report":
        await reportFeedItemAction(formData);
        break;
      default:
        throw new Error("Unknown feed operation.");
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update feed. Try again.",
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

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
