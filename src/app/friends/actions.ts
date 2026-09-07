"use server";

import { redirect } from "next/navigation";

import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  followUser,
  removeFriend,
  sendFriendRequest,
  unfollowUser,
  unblockUser,
} from "@/lib/social";

export async function sendFriendRequestAction(formData: FormData) {
  await sendFriendRequest(
    requiredString(formData, "recipientUserId"),
    nullableString(formData, "message"),
  );
  redirect(safeNext(formData, "/friends?request=sent"));
}

export async function followUserAction(formData: FormData) {
  await followUser(requiredString(formData, "followedUserId"));
  redirect(safeNext(formData, "/friends?follow=added"));
}

export async function unfollowUserAction(formData: FormData) {
  await unfollowUser(requiredString(formData, "followedUserId"));
  redirect(safeNext(formData, "/friends?follow=removed"));
}

export async function acceptFriendRequestAction(formData: FormData) {
  await acceptFriendRequest(requiredString(formData, "requestId"));
  redirect(safeNext(formData, "/friends?request=accepted"));
}

export async function declineFriendRequestAction(formData: FormData) {
  await declineFriendRequest(requiredString(formData, "requestId"));
  redirect(safeNext(formData, "/friends?request=declined"));
}

export async function cancelFriendRequestAction(formData: FormData) {
  await cancelFriendRequest(requiredString(formData, "requestId"));
  redirect(safeNext(formData, "/friends?request=cancelled"));
}

export async function removeFriendAction(formData: FormData) {
  await removeFriend(requiredString(formData, "friendUserId"));
  redirect(safeNext(formData, "/friends?friend=removed"));
}

export async function blockUserAction(formData: FormData) {
  await blockUser(requiredString(formData, "blockedUserId"));
  redirect(safeNext(formData, "/friends?user=blocked"));
}

export async function unblockUserAction(formData: FormData) {
  await unblockUser(requiredString(formData, "blockedUserId"));
  redirect(safeNext(formData, "/friends?user=unblocked"));
}

export async function relationshipFormAction(
  _previous: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const operation = requiredString(formData, "operation");
    switch (operation) {
      case "request":
        await sendFriendRequest(
          requiredString(formData, "recipientUserId"),
          nullableString(formData, "message"),
        );
        break;
      case "accept":
        await acceptFriendRequest(requiredString(formData, "requestId"));
        break;
      case "decline":
        await declineFriendRequest(requiredString(formData, "requestId"));
        break;
      case "cancel":
        await cancelFriendRequest(requiredString(formData, "requestId"));
        break;
      case "remove":
        await removeFriend(requiredString(formData, "friendUserId"));
        break;
      case "block":
        await blockUser(requiredString(formData, "blockedUserId"));
        break;
      case "unblock":
        await unblockUser(requiredString(formData, "blockedUserId"));
        break;
      default:
        throw new Error("Unknown relationship operation.");
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update relationship. Try again.",
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

function safeNext(formData: FormData, fallback: string) {
  const value = nullableString(formData, "next");
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\x00-\x1f\x7f]/.test(value)
    ? value
    : fallback;
}
