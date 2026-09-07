"use server";

import { redirect } from "next/navigation";

import {
  createGroup,
  createGroupPost,
  deleteGroup,
  groupTypes,
  joinGroup,
  joinGroupByInviteCode,
  leaveGroup,
  respondToGroupInvite,
} from "@/lib/groups";
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

export async function acceptGroupInviteAction(formData: FormData) {
  const slug = await respondToGroupInvite(requiredString(formData, "inviteId"), "accepted");
  redirect(`/groups/${slug}?joined=1`);
}

export async function declineGroupInviteAction(formData: FormData) {
  await respondToGroupInvite(requiredString(formData, "inviteId"), "declined");
  redirect("/groups?tab=invites&declined=1");
}

export async function createGroupPostAction(formData: FormData) {
  const slug = requiredString(formData, "slug");
  await createGroupPost(
    requiredString(formData, "groupId"),
    formString(formData, "title"),
    requiredString(formData, "body"),
  );
  redirect(`/groups/${slug}?posted=1`);
}

export async function leaveGroupAction(formData: FormData) {
  await leaveGroup(requiredString(formData, "groupId"));
  redirect("/groups?left=1");
}

export async function deleteGroupAction(formData: FormData) {
  await deleteGroup(requiredString(formData, "groupId"));
  redirect("/groups?deleted=1");
}

type GroupFormResult = { ok: boolean; error?: string; slug?: string };

export async function createGroupFormAction(
  _previous: GroupFormResult,
  formData: FormData,
): Promise<GroupFormResult> {
  try {
    const group = await createGroup({
      name: requiredString(formData, "name"),
      description: formString(formData, "description"),
      groupType: parseGroupType(formString(formData, "groupType")),
      visibility: parseVisibility(formData.get("visibility"), "private"),
      rules: formString(formData, "rules"),
    });
    return { ok: true, slug: group.slug };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create group. Try again.",
    };
  }
}

export async function groupMembershipFormAction(
  _previous: GroupFormResult,
  formData: FormData,
): Promise<GroupFormResult> {
  try {
    switch (requiredString(formData, "operation")) {
      case "join":
        await joinGroup(requiredString(formData, "groupId"), formString(formData, "inviteCode"));
        return { ok: true };
      case "code": {
        const slug = await joinGroupByInviteCode(requiredString(formData, "inviteCode"));
        return { ok: true, slug };
      }
      case "accept": {
        const slug = await respondToGroupInvite(requiredString(formData, "inviteId"), "accepted");
        return { ok: true, slug };
      }
      case "decline":
        await respondToGroupInvite(requiredString(formData, "inviteId"), "declined");
        return { ok: true };
      default:
        throw new Error("Unknown group membership operation.");
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not update group membership. Try again.",
    };
  }
}

export async function groupPostFormAction(
  _previous: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await createGroupPost(
      requiredString(formData, "groupId"),
      formString(formData, "title"),
      requiredString(formData, "body"),
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save post. Try again.",
    };
  }
}

export async function groupDangerFormAction(
  _previous: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const groupId = requiredString(formData, "groupId");
    switch (requiredString(formData, "operation")) {
      case "leave":
        await leaveGroup(groupId);
        break;
      case "delete":
        await deleteGroup(groupId);
        break;
      default:
        throw new Error("Unknown group operation.");
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update group. Try again.",
    };
  }
}

function parseGroupType(value: string | null) {
  return groupTypes.includes(value as (typeof groupTypes)[number])
    ? (value as (typeof groupTypes)[number])
    : "friends";
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
