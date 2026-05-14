import "server-only";

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  challengeTemplates,
  challenges,
  groupChallengeLinks,
  groupMemberships,
  groupPosts,
  groups,
  userProfiles,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { createFeedItem, ensureSocialProfileForUser, parseVisibility, type SocialVisibility } from "@/lib/social";

export const groupTypes = [
  "friends",
  "society",
  "rapsodo_league",
  "club",
  "coach_stable",
  "simulator_venue",
  "brand",
] as const;

export type GroupType = (typeof groupTypes)[number];

type GroupRow = typeof groups.$inferSelect;
type GroupMembershipRow = typeof groupMemberships.$inferSelect;

export type GroupListItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  groupType: GroupType;
  visibility: SocialVisibility;
  memberCount: number;
  postCount: number;
  challengeCount: number;
  viewerRole: string | null;
  inviteCode: string | null;
};

export type GroupDetailData = {
  group: GroupListItem & {
    ownerUserId: string;
    rules: string | null;
  };
  posts: Array<{
    id: string;
    title: string | null;
    body: string;
    pinned: boolean;
    createdAt: Date;
    profile: {
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
  challenges: Array<{
    id: string;
    title: string;
    templateName: string;
    status: string;
  }>;
  canPost: boolean;
};

export async function getGroupsPageData() {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const memberships = await getDb()
    .select()
    .from(groupMemberships)
    .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.status, "active")));
  const memberGroupIds = memberships.map((membership) => membership.groupId);
  const rows = await getDb()
    .select()
    .from(groups)
    .where(
      memberGroupIds.length > 0
        ? or(eq(groups.visibility, "public"), eq(groups.ownerUserId, userId), inArray(groups.id, memberGroupIds))
        : or(eq(groups.visibility, "public"), eq(groups.ownerUserId, userId)),
    )
    .orderBy(desc(groups.createdAt))
    .limit(80);
  const hydrated = await hydrateGroupList(rows, memberships);

  return {
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    groups: hydrated,
    mine: hydrated.filter((group) => group.viewerRole),
    discoverable: hydrated.filter((group) => !group.viewerRole && group.visibility === "public"),
    groupTypes,
  };
}

export async function getGroupDetailData(slug: string): Promise<GroupDetailData | null> {
  const userId = await requireCurrentUserId();
  await ensureSocialProfileForUser(userId);
  const [group] = await getDb().select().from(groups).where(eq(groups.slug, normalizeGroupSlug(slug))).limit(1);

  if (!group || !(await canViewGroup(userId, group))) {
    return null;
  }

  const memberships = await getDb()
    .select()
    .from(groupMemberships)
    .where(eq(groupMemberships.groupId, group.id));
  const [listItem] = await hydrateGroupList([group], memberships);
  const postRows = await getDb()
    .select()
    .from(groupPosts)
    .where(and(eq(groupPosts.groupId, group.id), sql`${groupPosts.deletedAt} IS NULL`))
    .orderBy(desc(groupPosts.pinned), desc(groupPosts.createdAt))
    .limit(40);
  const profileMap = await profilesByUserId([...new Set(postRows.map((post) => post.userId))]);
  const challengeRows = await getDb()
    .select({
      id: challenges.id,
      title: challenges.title,
      status: challenges.status,
      templateName: challengeTemplates.name,
    })
    .from(groupChallengeLinks)
    .innerJoin(challenges, eq(groupChallengeLinks.challengeId, challenges.id))
    .leftJoin(challengeTemplates, eq(challenges.templateId, challengeTemplates.id))
    .where(eq(groupChallengeLinks.groupId, group.id))
    .orderBy(desc(groupChallengeLinks.createdAt))
    .limit(12);
  const viewerMembership = memberships.find((membership) => membership.userId === userId && membership.status === "active");

  return {
    group: {
      ...listItem,
      ownerUserId: group.ownerUserId,
      rules: group.rules,
    },
    posts: postRows
      .map((post) => {
        const profile = profileMap.get(post.userId);
        return profile
          ? {
              id: post.id,
              title: post.title,
              body: post.body,
              pinned: post.pinned,
              createdAt: post.createdAt,
              profile,
            }
          : null;
      })
      .filter((post): post is NonNullable<typeof post> => Boolean(post)),
    challenges: challengeRows.map((challenge) => ({
      id: challenge.id,
      title: challenge.title,
      status: challenge.status,
      templateName: challenge.templateName ?? "Challenge",
    })),
    canPost: group.ownerUserId === userId || Boolean(viewerMembership),
  };
}

export async function createGroup(input: {
  name: string;
  description?: string | null;
  groupType: GroupType;
  visibility: SocialVisibility;
  rules?: string | null;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const name = cleanRequired(input.name, "New group").slice(0, 160);
  const slug = await uniqueGroupSlug(name);
  const inviteCode = `${slug}-${randomBytes(3).toString("hex")}`;
  const now = new Date();
  const visibility = parseVisibility(input.visibility, "private");
  const groupType = groupTypes.includes(input.groupType) ? input.groupType : "friends";
  const [group] = await getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(groups)
      .values({
        ownerUserId: userId,
        slug,
        name,
        description: nullableClean(input.description),
        groupType,
        visibility,
        inviteCode,
        rules: nullableClean(input.rules),
        updatedAt: now,
      })
      .returning();
    await tx.insert(groupMemberships).values({
      groupId: created.id,
      userId,
      role: "admin",
      status: "active",
      updatedAt: now,
    });
    return [created];
  });

  await createFeedItem({
    userId,
    itemType: "group_created",
    headline: `${profile.displayName} created ${group.name}`,
    metricLabel: "Group",
    metricValue: labelForGroupType(groupType),
    context: group.description,
    proofUrl: `/groups/${group.slug}`,
    sourceType: "group",
    sourceId: group.id,
    visibility,
    verificationLabel: "Manual",
    dedupeKey: `group-created:${group.id}`,
  });

  revalidateGroups();
  return group;
}

export async function joinGroup(groupId: string, inviteCode?: string | null) {
  const userId = await requireCurrentUserId();
  await ensureSocialProfileForUser(userId);
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId)).limit(1);

  if (!group) {
    throw new Error("Group not found.");
  }

  if (group.visibility !== "public" && group.inviteCode !== inviteCode) {
    throw new Error("This group requires an invite link.");
  }

  await getDb()
    .insert(groupMemberships)
    .values({
      groupId: group.id,
      userId,
      role: "member",
      status: "active",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [groupMemberships.groupId, groupMemberships.userId],
      set: {
        status: "active",
        updatedAt: new Date(),
      },
    });
  revalidateGroups(group.slug);
}

export async function createGroupPost(groupId: string, title: string | null, body: string) {
  const userId = await requireCurrentUserId();
  const group = await getVisibleGroupForUser(groupId, userId);
  const cleanBody = cleanRequired(body, "");

  if (!group) {
    throw new Error("Group not found.");
  }

  if (!(await isGroupMember(userId, group.id))) {
    throw new Error("Join the group before posting.");
  }

  if (!cleanBody) {
    throw new Error("Post body cannot be empty.");
  }

  await getDb().insert(groupPosts).values({
    groupId: group.id,
    userId,
    title: nullableClean(title)?.slice(0, 180) ?? null,
    body: cleanBody.slice(0, 2000),
    updatedAt: new Date(),
  });
  revalidateGroups(group.slug);
}

async function hydrateGroupList(groupRows: GroupRow[], memberships: GroupMembershipRow[]): Promise<GroupListItem[]> {
  if (groupRows.length === 0) {
    return [];
  }

  const groupIds = groupRows.map((group) => group.id);
  const [memberCounts, postCounts, challengeCounts] = await Promise.all([
    getDb()
      .select({ groupId: groupMemberships.groupId, value: sql<number>`count(*)::int` })
      .from(groupMemberships)
      .where(and(inArray(groupMemberships.groupId, groupIds), eq(groupMemberships.status, "active")))
      .groupBy(groupMemberships.groupId),
    getDb()
      .select({ groupId: groupPosts.groupId, value: sql<number>`count(*)::int` })
      .from(groupPosts)
      .where(and(inArray(groupPosts.groupId, groupIds), sql`${groupPosts.deletedAt} IS NULL`))
      .groupBy(groupPosts.groupId),
    getDb()
      .select({ groupId: groupChallengeLinks.groupId, value: sql<number>`count(*)::int` })
      .from(groupChallengeLinks)
      .where(inArray(groupChallengeLinks.groupId, groupIds))
      .groupBy(groupChallengeLinks.groupId),
  ]);
  const memberCountMap = new Map(memberCounts.map((row) => [row.groupId, row.value]));
  const postCountMap = new Map(postCounts.map((row) => [row.groupId, row.value]));
  const challengeCountMap = new Map(challengeCounts.map((row) => [row.groupId, row.value]));
  const membershipMap = new Map(memberships.map((membership) => [membership.groupId, membership]));

  return groupRows.map((group) => ({
    id: group.id,
    slug: group.slug,
    name: group.name,
    description: group.description,
    groupType: parseGroupType(group.groupType),
    visibility: parseVisibility(group.visibility),
    memberCount: memberCountMap.get(group.id) ?? 0,
    postCount: postCountMap.get(group.id) ?? 0,
    challengeCount: challengeCountMap.get(group.id) ?? 0,
    viewerRole: membershipMap.get(group.id)?.role ?? null,
    inviteCode: group.inviteCode,
  }));
}

async function canViewGroup(userId: string, group: GroupRow) {
  return group.visibility === "public" || group.ownerUserId === userId || (await isGroupMember(userId, group.id));
}

async function getVisibleGroupForUser(groupId: string, userId: string) {
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return group && (await canViewGroup(userId, group)) ? group : null;
}

async function isGroupMember(userId: string, groupId: string) {
  const [row] = await getDb()
    .select({ id: groupMemberships.id })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.groupId, groupId), eq(groupMemberships.status, "active")))
    .limit(1);
  return Boolean(row);
}

async function profilesByUserId(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { username: string; displayName: string; avatarUrl: string | null }>();
  }

  const rows = await getDb()
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, userIds));

  return new Map(rows.map((row) => [row.userId, row]));
}

async function uniqueGroupSlug(name: string) {
  const base = normalizeGroupSlug(name) || `group-${randomBytes(3).toString("hex")}`;

  for (let index = 0; index < 12; index += 1) {
    const slug = index === 0 ? base : `${base.slice(0, 68)}-${index}`;
    const [existing] = await getDb().select({ id: groups.id }).from(groups).where(eq(groups.slug, slug)).limit(1);

    if (!existing) {
      return slug;
    }
  }

  return `${base.slice(0, 64)}-${randomBytes(3).toString("hex")}`;
}

function normalizeGroupSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseGroupType(value: string): GroupType {
  return groupTypes.includes(value as GroupType) ? (value as GroupType) : "friends";
}

function labelForGroupType(value: GroupType) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nullableClean(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanRequired(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function revalidateGroups(slug?: string) {
  revalidatePath("/groups");
  revalidatePath("/feed");
  revalidatePath("/dashboard");

  if (slug) {
    revalidatePath(`/groups/${slug}`);
  }
}
