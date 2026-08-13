import "server-only";

import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  challengeTemplates,
  challenges,
  groupChallengeLinks,
  groupMemberships,
  groupPosts,
  groups,
  leaderboardSnapshots,
  rivalryWindows,
  sessions,
  userProfiles,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  createFeedItem,
  ensureSocialProfileForUser,
  parseVisibility,
  type SocialVisibility,
} from "@/lib/social";
import {
  buildRivalryPairings,
  buildRivalryStandings,
  endOfIsoWeek,
  startOfIsoWeek,
  weekPeriodKey,
  type RivalryPairingSummary,
  type RivalryStanding,
} from "@/lib/rivalries";

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

export type GroupLinkedChallengeItem = {
  id: string;
  title: string;
  templateName: string;
  status: string;
  groupId: string;
  groupName: string;
  groupSlug: string;
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
  members: Array<{
    userId: string;
    role: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
  rivalry: {
    title: string;
    periodKey: string;
    startsAt: Date;
    endsAt: Date;
    sourceLabel: string;
    snapshotAt: Date | null;
    standings: RivalryStanding[];
    pairings: RivalryPairingSummary[];
  };
  canPost: boolean;
  canAdmin: boolean;
  isOwner: boolean;
};

export type GroupInvitePreview = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: SocialVisibility;
  memberCount: number;
  viewerRole: string | null;
  inviteCode: string;
};

export async function getGroupsPageData(inviteCode?: string | null) {
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
        ? or(
            eq(groups.visibility, "public"),
            eq(groups.ownerUserId, userId),
            inArray(groups.id, memberGroupIds),
          )
        : or(eq(groups.visibility, "public"), eq(groups.ownerUserId, userId)),
    )
    .orderBy(desc(groups.createdAt))
    .limit(80);
  const [hydrated, linkedChallenges] = await Promise.all([
    hydrateGroupList(rows, memberships),
    getLinkedGroupChallenges(rows),
  ]);
  const invitePreview = inviteCode
    ? await getGroupInvitePreview(inviteCode, userId, memberships)
    : null;

  return {
    profile: {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    groups: hydrated,
    mine: hydrated.filter((group) => group.viewerRole),
    discoverable: hydrated.filter((group) => !group.viewerRole && group.visibility === "public"),
    linkedChallenges,
    groupTypes,
    invitePreview,
  };
}

export async function getGroupDetailData(slug: string): Promise<GroupDetailData | null> {
  const userId = await requireCurrentUserId();
  await ensureSocialProfileForUser(userId);
  const [group] = await getDb()
    .select()
    .from(groups)
    .where(eq(groups.slug, normalizeGroupSlug(slug)))
    .limit(1);

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
  const memberProfileMap = await profilesByUserId([
    ...new Set(memberships.map((membership) => membership.userId)),
  ]);
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
  const viewerMembership = memberships.find(
    (membership) => membership.userId === userId && membership.status === "active",
  );
  const canAdmin = group.ownerUserId === userId || viewerMembership?.role === "admin";
  const members = memberships
    .map((membership) => {
      const profile = memberProfileMap.get(membership.userId);

      return profile
        ? {
            userId: membership.userId,
            role: membership.role,
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }
        : null;
    })
    .filter((member): member is NonNullable<typeof member> => Boolean(member));
  const rivalry = await getCurrentGroupRivalry(group.id, members);

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
    members,
    rivalry,
    canPost: group.ownerUserId === userId || Boolean(viewerMembership),
    canAdmin,
    isOwner: group.ownerUserId === userId,
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

export async function joinGroupByInviteCode(inviteCode: string) {
  const code = cleanRequired(inviteCode, "");
  const [group] = await getDb().select().from(groups).where(eq(groups.inviteCode, code)).limit(1);

  if (!group) {
    throw new Error("Invite code not found.");
  }

  await joinGroup(group.id, code);
  return group.slug;
}

export async function leaveGroup(groupId: string) {
  const userId = await requireCurrentUserId();
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId)).limit(1);

  if (!group) {
    throw new Error("Group not found.");
  }

  if (group.ownerUserId === userId) {
    throw new Error("The group owner must delete the group or transfer ownership before leaving.");
  }

  const [membership] = await getDb()
    .update(groupMemberships)
    .set({ status: "left", updatedAt: new Date() })
    .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)))
    .returning({ id: groupMemberships.id });

  if (!membership) {
    throw new Error("You are not an active member of this group.");
  }

  revalidateGroups(group.slug);
}

export async function deleteGroup(groupId: string) {
  const userId = await requireCurrentUserId();
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId)).limit(1);

  if (!group) {
    throw new Error("Group not found.");
  }

  if (group.ownerUserId !== userId) {
    throw new Error("Only the group owner can delete this group.");
  }

  await getDb()
    .delete(groups)
    .where(and(eq(groups.id, groupId), eq(groups.ownerUserId, userId)));
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

  await getDb()
    .insert(groupPosts)
    .values({
      groupId: group.id,
      userId,
      title: nullableClean(title)?.slice(0, 180) ?? null,
      body: cleanBody.slice(0, 2000),
      updatedAt: new Date(),
    });
  revalidateGroups(group.slug);
}

async function hydrateGroupList(
  groupRows: GroupRow[],
  memberships: GroupMembershipRow[],
): Promise<GroupListItem[]> {
  if (groupRows.length === 0) {
    return [];
  }

  const groupIds = groupRows.map((group) => group.id);
  const [memberCounts, postCounts, challengeCounts] = await Promise.all([
    getDb()
      .select({ groupId: groupMemberships.groupId, value: sql<number>`count(*)::int` })
      .from(groupMemberships)
      .where(
        and(inArray(groupMemberships.groupId, groupIds), eq(groupMemberships.status, "active")),
      )
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

async function getLinkedGroupChallenges(
  groupRows: GroupRow[],
): Promise<GroupLinkedChallengeItem[]> {
  if (groupRows.length === 0) {
    return [];
  }

  const groupsById = new Map(groupRows.map((group) => [group.id, group]));
  const rows = await getDb()
    .select({
      groupId: groupChallengeLinks.groupId,
      id: challenges.id,
      title: challenges.title,
      status: challenges.status,
      templateName: challengeTemplates.name,
    })
    .from(groupChallengeLinks)
    .innerJoin(challenges, eq(groupChallengeLinks.challengeId, challenges.id))
    .leftJoin(challengeTemplates, eq(challenges.templateId, challengeTemplates.id))
    .where(
      inArray(
        groupChallengeLinks.groupId,
        groupRows.map((group) => group.id),
      ),
    )
    .orderBy(desc(groupChallengeLinks.createdAt))
    .limit(60);

  return rows.flatMap((row) => {
    const group = groupsById.get(row.groupId);

    return group
      ? [
          {
            id: row.id,
            title: row.title,
            templateName: row.templateName ?? "Challenge",
            status: row.status,
            groupId: row.groupId,
            groupName: group.name,
            groupSlug: group.slug,
          },
        ]
      : [];
  });
}

async function getCurrentGroupRivalry(
  groupId: string,
  members: GroupDetailData["members"],
): Promise<GroupDetailData["rivalry"]> {
  const now = new Date();
  const startsAt = startOfIsoWeek(now);
  const endsAt = endOfIsoWeek(now);
  const periodKey = weekPeriodKey(now);
  const memberIds = members.map((member) => member.userId);
  const db = getDb();
  const [roundRows, latestSnapshot, activeWindow] = await Promise.all([
    memberIds.length > 0
      ? db
          .select({
            userId: sessions.userId,
            date: sessions.date,
            scorecardJson: sessions.scorecardJson,
          })
          .from(sessions)
          .where(
            and(
              inArray(sessions.userId, memberIds),
              gte(sessions.date, startsAt),
              lte(sessions.date, endsAt),
              or(eq(sessions.playContext, "on_course"), eq(sessions.type, "real_round")),
            ),
          )
          .orderBy(desc(sessions.date))
          .limit(200)
      : Promise.resolve([]),
    db
      .select()
      .from(leaderboardSnapshots)
      .where(
        and(
          eq(leaderboardSnapshots.groupId, groupId),
          eq(leaderboardSnapshots.snapshotType, "weekly_rivalry"),
          eq(leaderboardSnapshots.periodKey, periodKey),
        ),
      )
      .orderBy(desc(leaderboardSnapshots.calculatedAt))
      .limit(1),
    db
      .select()
      .from(rivalryWindows)
      .where(
        and(
          eq(rivalryWindows.groupId, groupId),
          eq(rivalryWindows.periodKey, periodKey),
          eq(rivalryWindows.status, "active"),
        ),
      )
      .orderBy(desc(rivalryWindows.createdAt))
      .limit(1),
  ]);
  const standings = buildRivalryStandings({
    members,
    rounds: roundRows,
  });

  return {
    title: activeWindow[0]?.title ?? "Weekly rivalry",
    periodKey,
    startsAt,
    endsAt,
    sourceLabel: latestSnapshot[0] ? "Live week + saved snapshot" : "Live week",
    snapshotAt: latestSnapshot[0]?.calculatedAt ?? null,
    standings,
    pairings: buildRivalryPairings(standings),
  };
}

async function getGroupInvitePreview(
  inviteCode: string,
  userId: string,
  memberships: GroupMembershipRow[],
): Promise<GroupInvitePreview | null> {
  const [group] = await getDb()
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, cleanRequired(inviteCode, "")))
    .limit(1);

  if (!group) {
    return null;
  }

  const [item] = await hydrateGroupList([group], memberships);

  if (!item || (group.visibility !== "public" && group.inviteCode !== inviteCode)) {
    return null;
  }

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    visibility: item.visibility,
    memberCount: item.memberCount,
    viewerRole:
      memberships.find(
        (membership) => membership.userId === userId && membership.groupId === group.id,
      )?.role ?? null,
    inviteCode: group.inviteCode ?? inviteCode,
  };
}

async function canViewGroup(userId: string, group: GroupRow) {
  return (
    group.visibility === "public" ||
    group.ownerUserId === userId ||
    (await isGroupMember(userId, group.id))
  );
}

async function getVisibleGroupForUser(groupId: string, userId: string) {
  const [group] = await getDb().select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return group && (await canViewGroup(userId, group)) ? group : null;
}

async function isGroupMember(userId: string, groupId: string) {
  const [row] = await getDb()
    .select({ id: groupMemberships.id })
    .from(groupMemberships)
    .where(
      and(
        eq(groupMemberships.userId, userId),
        eq(groupMemberships.groupId, groupId),
        eq(groupMemberships.status, "active"),
      ),
    )
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
    const [existing] = await getDb()
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.slug, slug))
      .limit(1);

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
