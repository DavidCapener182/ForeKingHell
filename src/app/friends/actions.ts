"use server";

import { redirect } from "next/navigation";

import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
} from "@/lib/social";

export async function sendFriendRequestAction(formData: FormData) {
  await sendFriendRequest(requiredString(formData, "recipientUserId"), nullableString(formData, "message"));
  redirect(safeNext(formData, "/friends?request=sent"));
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
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
