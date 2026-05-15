"use server";

import { redirect } from "next/navigation";

import { createGroup, createGroupPost, groupTypes, joinGroup, joinGroupByInviteCode } from "@/lib/groups";
import { parseVisibility } from "@/lib/social";

export async function createGroupAction(formData: FormData) {
  const group = await createGroup({
    name: requiredString(formData, "name"),
    description: formString(formData, "description"),
    groupType: parseGroupType(formString(formData, "groupType")),
    visibility: parseVisibility(formData.get("visibility"), "private"),
    rules: formString(formData, "rules"),
  });

  redirect(`/groups/${group.slug}?created=1`);
}

export async function joinGroupAction(formData: FormData) {
  await joinGroup(requiredString(formData, "groupId"), formString(formData, "inviteCode"));
  redirect(`/groups?joined=1`);
}

export async function joinGroupByInviteCodeAction(formData: FormData) {
  const slug = await joinGroupByInviteCode(requiredString(formData, "inviteCode"));
  redirect(`/groups/${slug}?joined=1`);
}

export async function createGroupPostAction(formData: FormData) {
  const slug = requiredString(formData, "slug");
  await createGroupPost(requiredString(formData, "groupId"), formString(formData, "title"), requiredString(formData, "body"));
  redirect(`/groups/${slug}?posted=1`);
}

function parseGroupType(value: string | null) {
  return groupTypes.includes(value as (typeof groupTypes)[number]) ? (value as (typeof groupTypes)[number]) : "friends";
}

function requiredString(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
