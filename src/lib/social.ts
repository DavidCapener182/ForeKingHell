import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  clubs,
  feedCommentReactions,
  feedComments,
  feedItems,
  feedReactions,
  friendRequests,
  friendships,
  moderationEvents,
  socialReports,
  sessions,
  stockYardages,
  userBlocks,
  userFollows,
  userProfiles,
  users,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getOptionalCurrentUserId, requireCurrentUserId } from "@/lib/current-user";
import { calculateUserLevel } from "@/lib/achievements/xp";
import { formatClubType } from "@/lib/club-format";
import { getUserHandicapProfile } from "@/lib/handicap-data";
import type { AchievementUnlockNotification } from "@/lib/achievements/types";

export const socialVisibilityOptions = ["private", "friends", "public"] as const;
export type SocialVisibility = (typeof socialVisibilityOptions)[number];

export type SocialProfileSummary = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  headerImageUrl: string | null;
  bio: string | null;
  homeCourse: string | null;
  primaryLaunchMonitor: string | null;
  handicapBand: string | null;
  publicProfile: boolean;
  friendProfile: boolean;
  leaderboardVisibility: SocialVisibility;
  feedVisibilityDefault: SocialVisibility;
  relationship: "self" | "friend" | "incoming" | "outgoing" | "blocked" | "none";
  isTourPlayer: boolean;
  canReceiveFriendRequests: boolean;
  isFollowing: boolean;
};

export type FeedItemView = {
  id: string;
  userId: string;
  itemType: string;
  headline: string;
  metricLabel: string | null;
  metricValue: string | null;
  context: string | null;
  proofUrl: string | null;
  visibility: SocialVisibility;
  verificationLabel: string;
  createdAt: Date;
  profile: SocialProfileSummary;
  reactionCount: number;
  commentCount: number;
  viewerReacted: boolean;
  viewerCanManage: boolean;
  comments: Array<{
    id: string;
    body: string;
    createdAt: Date;
    likeCount: number;
    viewerLiked: boolean;
    viewerCanDelete: boolean;
    profile: Pick<SocialProfileSummary, "userId" | "username" | "displayName" | "avatarUrl">;
  }>;
};

type ProfileRow = typeof userProfiles.$inferSelect;
type FriendRequestRow = typeof friendRequests.$inferSelect;
type FeedItemRow = typeof feedItems.$inferSelect;

export type ProfileGapRow = {
  clubId: string;
  clubType: string;
  label: string;
  carryMedianYd: number | null;
  totalMedianYd: number | null;
  sampleSize: number;
  confidenceScore: number | null;
};

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const STATUS_UPDATE_MAX_BODY_LENGTH = 800;
const STATUS_UPDATE_MAX_IMAGE_DATA_URL_LENGTH = 650_000;

export async function ensureSocialProfileForUser(userId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const displayName =
    safeSocialDisplayName(user?.name) ||
    safeSocialDisplayName(user?.email?.split("@")[0]) ||
    "ForeKingHell Player";

  if (existing) {
    const needsDisplayRepair = !safeSocialDisplayName(existing.displayName);
    const needsUsernameRepair = isSharedDatabaseArtifact(existing.username);

    if (!needsDisplayRepair && !needsUsernameRepair) {
      return existing;
    }

    const [repaired] = await db
      .update(userProfiles)
      .set({
        ...(needsDisplayRepair ? { displayName } : {}),
        ...(needsUsernameRepair
          ? { username: await uniqueUsername(defaultUsername(displayName, userId)) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();

    return repaired;
  }

  const username = await uniqueUsername(defaultUsername(displayName, userId));
  const now = new Date();
  const [profile] = await db
    .insert(userProfiles)
    .values({
      userId,
      username,
      displayName,
      updatedAt: now,
    })
    .returning();

  return profile;
}

export async function ensureCurrentSocialProfile() {
  const userId = await requireCurrentUserId();
  return ensureSocialProfileForUser(userId);
}

export async function getFriendIds(userId: string) {
  const rows = await getDb()
    .select({
      userAId: friendships.userAId,
      userBId: friendships.userBId,
    })
    .from(friendships)
    .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)));

  return rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId));
}

export async function getFollowingIds(userId: string) {
  const rows = await getDb()
    .select({ followedUserId: userFollows.followedUserId })
    .from(userFollows)
    .where(eq(userFollows.followerUserId, userId));

  return rows.map((row) => row.followedUserId);
}

export async function isFollowing(followerUserId: string, followedUserId: string) {
  if (followerUserId === followedUserId) {
    return false;
  }

  const [row] = await getDb()
    .select({ id: userFollows.id })
    .from(userFollows)
    .where(
      and(
        eq(userFollows.followerUserId, followerUserId),
        eq(userFollows.followedUserId, followedUserId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function areFriends(userAId: string, userBId: string) {
  if (userAId === userBId) {
    return true;
  }

  const [userA, userB] = sortedUserPair(userAId, userBId);
  const [row] = await getDb()
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userAId, userA), eq(friendships.userBId, userB)))
    .limit(1);

  return Boolean(row);
}

export async function isBlockedBetween(userAId: string, userBId: string) {
  if (userAId === userBId) {
    return false;
  }

  const [row] = await getDb()
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerUserId, userAId), eq(userBlocks.blockedUserId, userBId)),
        and(eq(userBlocks.blockerUserId, userBId), eq(userBlocks.blockedUserId, userAId)),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function getBlockedUserIds(userId: string) {
  const rows = await getDb()
    .select({
      blockerUserId: userBlocks.blockerUserId,
      blockedUserId: userBlocks.blockedUserId,
    })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerUserId, userId), eq(userBlocks.blockedUserId, userId)));

  return new Set(
    rows.map((row) => (row.blockerUserId === userId ? row.blockedUserId : row.blockerUserId)),
  );
}

export async function getFriendsPageData(searchQuery: string | null) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const [friendIds, blockedIds, pendingRequests, followedIds] = await Promise.all([
    getFriendIds(userId),
    getBlockedUserIds(userId),
    getPendingFriendRequestsForUser(userId),
    getFollowingIds(userId),
  ]);
  const followedIdSet = new Set(followedIds);
  const relatedIds = new Set<string>([
    ...friendIds,
    ...pendingRequests.map((request) =>
      request.requesterUserId === userId ? request.recipientUserId : request.requesterUserId,
    ),
  ]);
  const blockedRows = await getDb()
    .select({ blockedUserId: userBlocks.blockedUserId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerUserId, userId));
  const blockedUserIds = blockedRows.map((row) => row.blockedUserId);
  const relatedProfiles =
    relatedIds.size > 0 ? await profilesByUserId([...relatedIds]) : new Map<string, ProfileRow>();
  const searchResults = await searchDiscoverableProfiles({
    viewerUserId: userId,
    query: searchQuery,
    friendIds,
    followedIds: followedIdSet,
    blockedIds,
    pendingRequests,
  });
  const suggestedProfiles = await suggestDiscoverableProfiles({
    viewerUserId: userId,
    friendIds,
    followedIds: followedIdSet,
    blockedIds,
    pendingRequests,
  });
  const blockedProfiles =
    blockedUserIds.length > 0
      ? await profilesByUserId(blockedUserIds)
      : new Map<string, ProfileRow>();

  return {
    profile: profileSummary(profile, "self"),
    friends: friendIds
      .map((friendId) => relatedProfiles.get(friendId))
      .filter((item): item is ProfileRow => Boolean(item))
      .map((row) => profileSummary(row, "friend", { isFollowing: followedIdSet.has(row.userId) })),
    incomingRequests: pendingRequests
      .filter((request) => request.recipientUserId === userId)
      .map((request) => ({
        request,
        profile: profileSummary(relatedProfiles.get(request.requesterUserId), "incoming", {
          isFollowing: followedIdSet.has(request.requesterUserId),
        }),
      }))
      .filter((row) => row.profile),
    outgoingRequests: pendingRequests
      .filter((request) => request.requesterUserId === userId)
      .map((request) => ({
        request,
        profile: profileSummary(relatedProfiles.get(request.recipientUserId), "outgoing", {
          isFollowing: followedIdSet.has(request.recipientUserId),
        }),
      }))
      .filter((row) => row.profile),
    searchResults,
    suggestedProfiles,
    blockedUsers: blockedUserIds
      .map((blockedUserId) => blockedProfiles.get(blockedUserId))
      .filter((row): row is ProfileRow => Boolean(row))
      .map((row) => profileSummary(row, "blocked", { isFollowing: followedIdSet.has(row.userId) })),
  };
}

export async function getProfilePageData(username: string) {
  const viewerUserId = await getOptionalCurrentUserId();
  const viewerProfile = viewerUserId ? await ensureSocialProfileForUser(viewerUserId) : null;
  const [profile] = await getDb()
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.username, normalizeUsername(username)))
    .limit(1);

  if (!profile || !(await canViewProfile(viewerUserId, profile))) {
    return null;
  }

  const [relationship, isFollowingProfile] = viewerUserId
    ? await Promise.all([
        getRelationship(viewerUserId, profile.userId),
        isFollowing(viewerUserId, profile.userId),
      ])
    : ["none" as const, false];
  const recentFeed = viewerUserId
    ? await getVisibleFeedItemsForViewer(viewerUserId, { ownerUserId: profile.userId, limit: 6 })
    : await getPublicFeedItemsForProfile(profile.userId, 6);
  const stats = await getProfileStats(profile.userId, profile.visibilitySettingsJson, relationship);

  return {
    viewerProfile: viewerProfile ? profileSummary(viewerProfile, "self") : null,
    profile: profileSummary(profile, relationship, { isFollowing: isFollowingProfile }),
    stats,
    recentFeed,
  };
}

export async function updateCurrentSocialProfile(input: {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  headerImageUrl?: string | null;
  bio?: string | null;
  homeCourse?: string | null;
  primaryLaunchMonitor?: string | null;
  publicProfile: boolean;
  friendProfile: boolean;
  feedVisibilityDefault: SocialVisibility;
  leaderboardVisibility: SocialVisibility;
  visibilitySettingsJson: NonNullable<ProfileRow["visibilitySettingsJson"]>;
}) {
  const userId = await requireCurrentUserId();
  const current = await ensureSocialProfileForUser(userId);
  const username = normalizeUsername(input.username);

  if (!isValidUsername(username)) {
    throw new Error(
      "Username must be 3-40 characters and use letters, numbers, hyphens or underscores.",
    );
  }

  if (isSharedDatabaseArtifact(username) || isSharedDatabaseArtifact(input.displayName)) {
    throw new Error("Use your ForeKingHell profile name, not a shared workspace label.");
  }

  const [existing] = await getDb()
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(and(eq(userProfiles.username, username), ne(userProfiles.userId, userId)))
    .limit(1);

  if (existing) {
    throw new Error("That username is already taken.");
  }

  await getDb()
    .update(userProfiles)
    .set({
      username,
      displayName: cleanRequired(input.displayName, current.displayName),
      avatarUrl: nullableClean(input.avatarUrl),
      headerImageUrl: nullableClean(input.headerImageUrl),
      bio: nullableClean(input.bio),
      homeCourse: nullableClean(input.homeCourse),
      primaryLaunchMonitor: nullableClean(input.primaryLaunchMonitor),
      publicProfile: input.publicProfile,
      friendProfile: input.friendProfile,
      feedVisibilityDefault: input.feedVisibilityDefault,
      leaderboardVisibility: input.leaderboardVisibility,
      visibilitySettingsJson: {
        ...input.visibilitySettingsJson,
        hiddenFeedTypes: current.visibilitySettingsJson.hiddenFeedTypes ?? [],
      },
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId));

  revalidateSocialPaths();
}

export async function sendFriendRequest(recipientUserId: string, message: string | null) {
  const requesterUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(requesterUserId);

  if (requesterUserId === recipientUserId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  if (await isBlockedBetween(requesterUserId, recipientUserId)) {
    throw new Error("Friend request cannot be sent.");
  }

  if (await areFriends(requesterUserId, recipientUserId)) {
    return;
  }

  const [recipient] = await getDb()
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, recipientUserId))
    .limit(1);

  if (!recipient) {
    throw new Error("Profile not found.");
  }

  if (!canReceiveFriendRequests(recipient)) {
    throw new Error("This player profile can be followed but not added as a friend.");
  }

  const now = new Date();
  await getDb()
    .insert(friendRequests)
    .values({
      requesterUserId,
      recipientUserId,
      status: "pending",
      message: nullableClean(message),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [friendRequests.requesterUserId, friendRequests.recipientUserId],
      set: {
        status: "pending",
        message: nullableClean(message),
        respondedAt: null,
        updatedAt: now,
      },
    });

  revalidateSocialPaths();
}

export async function followUser(followedUserId: string) {
  const followerUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(followerUserId);

  if (followerUserId === followedUserId) {
    throw new Error("You cannot follow yourself.");
  }

  if (await isBlockedBetween(followerUserId, followedUserId)) {
    throw new Error("Profile cannot be followed.");
  }

  const [profile] = await getDb()
    .select({ userId: userProfiles.userId, publicProfile: userProfiles.publicProfile })
    .from(userProfiles)
    .where(eq(userProfiles.userId, followedUserId))
    .limit(1);

  if (!profile || !profile.publicProfile) {
    throw new Error("Profile not found.");
  }

  await getDb()
    .insert(userFollows)
    .values({ followerUserId, followedUserId })
    .onConflictDoNothing({
      target: [userFollows.followerUserId, userFollows.followedUserId],
    });

  revalidateSocialPaths();
}

export async function unfollowUser(followedUserId: string) {
  const followerUserId = await requireCurrentUserId();
  await getDb()
    .delete(userFollows)
    .where(
      and(
        eq(userFollows.followerUserId, followerUserId),
        eq(userFollows.followedUserId, followedUserId),
      ),
    );

  revalidateSocialPaths();
}

export async function acceptFriendRequest(requestId: string) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const now = new Date();
  const [request] = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.id, requestId),
        eq(friendRequests.recipientUserId, userId),
        eq(friendRequests.status, "pending"),
      ),
    )
    .limit(1);

  if (!request || (await isBlockedBetween(request.requesterUserId, request.recipientUserId))) {
    throw new Error("Friend request not found.");
  }

  const requestProfiles = await profilesByUserId([
    request.requesterUserId,
    request.recipientUserId,
  ]);
  if (
    [request.requesterUserId, request.recipientUserId].some(
      (id) => !canReceiveFriendRequests(requestProfiles.get(id)),
    )
  ) {
    throw new Error("This player profile can be followed but not added as a friend.");
  }

  const [userAId, userBId] = sortedUserPair(request.requesterUserId, request.recipientUserId);

  await db.transaction(async (tx) => {
    await tx
      .insert(friendships)
      .values({
        userAId,
        userBId,
        visibilityLevel: "friends",
      })
      .onConflictDoNothing({
        target: [friendships.userAId, friendships.userBId],
      });

    await tx
      .update(friendRequests)
      .set({
        status: "accepted",
        respondedAt: now,
        updatedAt: now,
      })
      .where(eq(friendRequests.id, request.id));
  });

  revalidateSocialPaths();
}

export async function declineFriendRequest(requestId: string) {
  const userId = await requireCurrentUserId();
  await getDb()
    .update(friendRequests)
    .set({
      status: "declined",
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(friendRequests.id, requestId), eq(friendRequests.recipientUserId, userId)));
  revalidateSocialPaths();
}

export async function cancelFriendRequest(requestId: string) {
  const userId = await requireCurrentUserId();
  await getDb()
    .update(friendRequests)
    .set({
      status: "cancelled",
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(friendRequests.id, requestId), eq(friendRequests.requesterUserId, userId)));
  revalidateSocialPaths();
}

export async function removeFriend(friendUserId: string) {
  const userId = await requireCurrentUserId();
  const [userAId, userBId] = sortedUserPair(userId, friendUserId);
  await getDb()
    .delete(friendships)
    .where(and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)));
  revalidateSocialPaths();
}

export async function blockUser(blockedUserId: string) {
  const blockerUserId = await requireCurrentUserId();

  if (blockerUserId === blockedUserId) {
    throw new Error("You cannot block yourself.");
  }

  const [userAId, userBId] = sortedUserPair(blockerUserId, blockedUserId);
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx
      .insert(userBlocks)
      .values({ blockerUserId, blockedUserId })
      .onConflictDoNothing({
        target: [userBlocks.blockerUserId, userBlocks.blockedUserId],
      });
    await tx
      .delete(friendships)
      .where(and(eq(friendships.userAId, userAId), eq(friendships.userBId, userBId)));
    await tx
      .delete(friendRequests)
      .where(
        or(
          and(
            eq(friendRequests.requesterUserId, blockerUserId),
            eq(friendRequests.recipientUserId, blockedUserId),
          ),
          and(
            eq(friendRequests.requesterUserId, blockedUserId),
            eq(friendRequests.recipientUserId, blockerUserId),
          ),
        ),
      );
    await tx
      .delete(userFollows)
      .where(
        or(
          and(
            eq(userFollows.followerUserId, blockerUserId),
            eq(userFollows.followedUserId, blockedUserId),
          ),
          and(
            eq(userFollows.followerUserId, blockedUserId),
            eq(userFollows.followedUserId, blockerUserId),
          ),
        ),
      );
  });

  revalidateSocialPaths();
}

export async function unblockUser(blockedUserId: string) {
  const blockerUserId = await requireCurrentUserId();
  await getDb()
    .delete(userBlocks)
    .where(
      and(eq(userBlocks.blockerUserId, blockerUserId), eq(userBlocks.blockedUserId, blockedUserId)),
    );
  revalidateSocialPaths();
}

export async function getFeedPageData() {
  const viewerUserId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(viewerUserId);
  const [friendIds, publicProfileCount, totalXp, items] = await Promise.all([
    getFriendIds(viewerUserId),
    getDb()
      .select({ value: sql<number>`count(*)::int` })
      .from(userProfiles)
      .where(eq(userProfiles.publicProfile, true))
      .then((rows) => rows[0]?.value ?? 0),
    getDb()
      .select({ value: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
      .from(xpLedger)
      .where(eq(xpLedger.userId, viewerUserId))
      .then((rows) => rows[0]?.value ?? 0),
    getVisibleFeedItemsForViewer(viewerUserId, { limit: 40 }),
  ]);

  return {
    viewerUserId,
    profile: profileSummary(profile, "self"),
    friendCount: friendIds.length,
    publicProfileCount,
    totalXp,
    items,
  };
}

export async function getDashboardFeedPreview(limit = 20) {
  const viewerUserId = await requireCurrentUserId();
  await ensureSocialProfileForUser(viewerUserId);
  return getVisibleFeedItemsForViewer(viewerUserId, { limit });
}

export async function getVisibleFeedItemsForViewer(
  viewerUserId: string,
  options: { ownerUserId?: string; limit?: number } = {},
) {
  const [friendIds, blockedIds, hiddenTypes] = await Promise.all([
    getFriendIds(viewerUserId),
    getBlockedUserIds(viewerUserId),
    getHiddenFeedTypes(viewerUserId),
  ]);
  const socialIds = new Set([viewerUserId, ...friendIds]);
  const hiddenTypeSet = new Set(hiddenTypes);
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 80);
  const rows = await getDb()
    .select()
    .from(feedItems)
    .where(
      and(
        ne(feedItems.itemType, "import_summary"),
        options.ownerUserId
          ? eq(feedItems.userId, options.ownerUserId)
          : or(inArray(feedItems.userId, [...socialIds]), eq(feedItems.visibility, "public")),
      ),
    )
    .orderBy(desc(feedItems.createdAt))
    .limit(limit * 3);
  const visible = rows
    .filter((item) => canViewFeedItem(item, viewerUserId, socialIds, blockedIds, hiddenTypeSet))
    .slice(0, limit);

  return hydrateFeedItems(visible, viewerUserId);
}

export async function getPublicFeedItemsForProfile(ownerUserId: string, limit = 6) {
  const rows = await getDb()
    .select()
    .from(feedItems)
    .where(
      and(
        eq(feedItems.userId, ownerUserId),
        eq(feedItems.visibility, "public"),
        ne(feedItems.itemType, "import_summary"),
      ),
    )
    .orderBy(desc(feedItems.createdAt))
    .limit(Math.min(Math.max(limit, 1), 20));

  return hydrateFeedItems(rows, "");
}

export async function addFeedReaction(feedItemId: string) {
  const userId = await requireCurrentUserId();
  const item = await getVisibleFeedItem(feedItemId, userId);

  if (!item) {
    throw new Error("Feed item not found.");
  }

  await getDb()
    .insert(feedReactions)
    .values({
      feedItemId,
      userId,
      reactionType: "kudos",
    })
    .onConflictDoNothing({
      target: [feedReactions.feedItemId, feedReactions.userId, feedReactions.reactionType],
    });

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function removeFeedReaction(feedItemId: string) {
  const userId = await requireCurrentUserId();
  await getDb()
    .delete(feedReactions)
    .where(
      and(
        eq(feedReactions.feedItemId, feedItemId),
        eq(feedReactions.userId, userId),
        eq(feedReactions.reactionType, "kudos"),
      ),
    );

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function addFeedComment(feedItemId: string, body: string) {
  const userId = await requireCurrentUserId();
  const item = await getVisibleFeedItem(feedItemId, userId);
  const cleanBody = cleanRequired(body, "");

  if (!item) {
    throw new Error("Feed item not found.");
  }

  if (!cleanBody) {
    throw new Error("Comment cannot be empty.");
  }

  await getDb()
    .insert(feedComments)
    .values({
      feedItemId,
      userId,
      body: cleanBody.slice(0, 1200),
      updatedAt: new Date(),
    });

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function deleteFeedComment(commentId: string) {
  const userId = await requireCurrentUserId();
  const [comment] = await getDb()
    .select()
    .from(feedComments)
    .where(
      and(
        eq(feedComments.id, commentId),
        eq(feedComments.userId, userId),
        sql`${feedComments.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  if (!comment) {
    throw new Error("Comment not found.");
  }

  await getDb()
    .update(feedComments)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(feedComments.id, commentId), eq(feedComments.userId, userId)));

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function addFeedCommentReaction(commentId: string) {
  const userId = await requireCurrentUserId();
  const comment = await getVisibleFeedComment(commentId, userId);

  if (!comment) {
    throw new Error("Comment not found.");
  }

  await getDb()
    .insert(feedCommentReactions)
    .values({
      feedCommentId: commentId,
      userId,
      reactionType: "like",
    })
    .onConflictDoNothing({
      target: [
        feedCommentReactions.feedCommentId,
        feedCommentReactions.userId,
        feedCommentReactions.reactionType,
      ],
    });

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function removeFeedCommentReaction(commentId: string) {
  const userId = await requireCurrentUserId();
  await getDb()
    .delete(feedCommentReactions)
    .where(
      and(
        eq(feedCommentReactions.feedCommentId, commentId),
        eq(feedCommentReactions.userId, userId),
        eq(feedCommentReactions.reactionType, "like"),
      ),
    );

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function updateFeedItemVisibility(feedItemId: string, visibility: SocialVisibility) {
  const userId = await requireCurrentUserId();
  const [item] = await getDb()
    .select()
    .from(feedItems)
    .where(and(eq(feedItems.id, feedItemId), eq(feedItems.userId, userId)))
    .limit(1);

  if (!item) {
    throw new Error("Feed item not found.");
  }

  await getDb()
    .update(feedItems)
    .set({
      visibility: parseVisibility(visibility, parseVisibility(item.visibility)),
      updatedAt: new Date(),
    })
    .where(and(eq(feedItems.id, feedItemId), eq(feedItems.userId, userId)));

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath(`/profile/${item.userId}`);
}

export async function deleteFeedItem(feedItemId: string) {
  const userId = await requireCurrentUserId();
  const [item] = await getDb()
    .select()
    .from(feedItems)
    .where(and(eq(feedItems.id, feedItemId), eq(feedItems.userId, userId)))
    .limit(1);

  if (!item) {
    throw new Error("Feed item not found.");
  }

  await getDb()
    .delete(feedItems)
    .where(and(eq(feedItems.id, feedItemId), eq(feedItems.userId, userId)));

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath(`/profile/${item.userId}`);
}

export async function hideFeedItem(feedItemId: string) {
  const userId = await requireCurrentUserId();
  const item = await getVisibleFeedItem(feedItemId, userId);

  if (!item) {
    throw new Error("Feed item not found.");
  }

  const hiddenBy = new Set(hiddenByUserIds(item.metadataJson));
  hiddenBy.add(userId);

  await getDb()
    .update(feedItems)
    .set({
      metadataJson: {
        ...item.metadataJson,
        hiddenByUserIds: [...hiddenBy],
      },
      updatedAt: new Date(),
    })
    .where(eq(feedItems.id, item.id));

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function hideFeedItemType(feedItemId: string) {
  const userId = await requireCurrentUserId();
  const item = await getVisibleFeedItem(feedItemId, userId);

  if (!item) {
    throw new Error("Feed item not found.");
  }

  const [profile] = await getDb()
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  const settings = profile?.visibilitySettingsJson ?? {};
  const hiddenFeedTypes = new Set(
    Array.isArray(settings.hiddenFeedTypes) ? settings.hiddenFeedTypes : [],
  );
  hiddenFeedTypes.add(item.itemType);

  await getDb()
    .update(userProfiles)
    .set({
      visibilitySettingsJson: {
        ...settings,
        hiddenFeedTypes: [...hiddenFeedTypes].slice(0, 40),
      },
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId));

  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export async function reportFeedItem(feedItemId: string, reason = "feed_report") {
  const userId = await requireCurrentUserId();
  const item = await getVisibleFeedItem(feedItemId, userId);

  if (!item) {
    throw new Error("Feed item not found.");
  }

  await getDb().transaction(async (tx) => {
    await tx.insert(socialReports).values({
      reporterUserId: userId,
      reportedUserId: item.userId === userId ? null : item.userId,
      targetType: "feed_item",
      targetId: item.id,
      reason: reason.slice(0, 120),
      details: item.headline,
    });
    await tx.insert(moderationEvents).values({
      targetType: "feed_item",
      targetId: item.id,
      actorUserId: userId,
      eventType: "user_report",
      severity: reason.toLowerCase().includes("cheat") ? "medium" : "low",
      status: "open",
      reason: reason.slice(0, 120),
      metadataJson: {
        headline: item.headline,
        ownerUserId: item.userId,
      },
    });
  });

  revalidatePath("/feed");
  revalidatePath("/social-intelligence");
}

export async function muteFeedItemUser(feedItemId: string) {
  const userId = await requireCurrentUserId();
  const item = await getVisibleFeedItem(feedItemId, userId);

  if (!item || item.userId === userId) {
    throw new Error("Feed item not found.");
  }

  await blockUser(item.userId);
}

export async function createStatusUpdate(input: {
  body: string;
  imageDataUrl?: string | null;
  visibility?: SocialVisibility | null;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const body = cleanStatusUpdateBody(input.body);
  const imageDataUrl = cleanStatusUpdateImage(input.imageDataUrl);

  if (!body && !imageDataUrl) {
    throw new Error("Write an update or add an image before posting.");
  }

  await createFeedItem({
    userId,
    itemType: "status_update",
    headline: statusUpdateHeadline(body, Boolean(imageDataUrl)),
    context: body,
    proofUrl: imageDataUrl,
    sourceType: "status_update",
    sourceId: randomUUID(),
    visibility: parseVisibility(
      input.visibility,
      parseVisibility(profile.feedVisibilityDefault, "private"),
    ),
    verificationLabel: "Player post",
    metadataJson: {
      kind: "status_update",
      hasImage: Boolean(imageDataUrl),
    },
  });

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath(`/profile/${profile.username}`);
}

export async function createFeedItem(input: {
  userId: string;
  itemType: string;
  headline: string;
  metricLabel?: string | null;
  metricValue?: string | null;
  context?: string | null;
  proofUrl?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  visibility?: SocialVisibility | null;
  verificationLabel?: string | null;
  dedupeKey?: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  const profile = await ensureSocialProfileForUser(input.userId);
  const visibility = input.visibility ?? parseVisibility(profile.feedVisibilityDefault, "private");
  const now = new Date();
  const values = {
    userId: input.userId,
    itemType: input.itemType,
    headline: input.headline.slice(0, 220),
    metricLabel: nullableClean(input.metricLabel)?.slice(0, 80) ?? null,
    metricValue: nullableClean(input.metricValue)?.slice(0, 120) ?? null,
    context: nullableClean(input.context),
    proofUrl: nullableClean(input.proofUrl),
    sourceType: nullableClean(input.sourceType)?.slice(0, 60) ?? null,
    sourceId: nullableClean(input.sourceId)?.slice(0, 220) ?? null,
    visibility,
    verificationLabel: nullableClean(input.verificationLabel)?.slice(0, 80) ?? "Unverified",
    dedupeKey: nullableClean(input.dedupeKey)?.slice(0, 260) ?? null,
    metadataJson: input.metadataJson ?? {},
    updatedAt: now,
  };

  if (values.dedupeKey) {
    await getDb()
      .insert(feedItems)
      .values(values)
      .onConflictDoUpdate({
        target: [feedItems.userId, feedItems.dedupeKey],
        set: {
          headline: values.headline,
          metricLabel: values.metricLabel,
          metricValue: values.metricValue,
          context: values.context,
          proofUrl: values.proofUrl,
          visibility: values.visibility,
          verificationLabel: values.verificationLabel,
          metadataJson: values.metadataJson,
          updatedAt: now,
        },
      });
  } else {
    await getDb().insert(feedItems).values(values);
  }
}

export async function recordImportFeedItems(input: {
  userId: string;
  sessionId: string;
  fileName: string;
  source: string;
  shotCount: number;
  rawRowCount: number;
  longestShotNotifications: Array<{
    clubType: string;
    clubLabel: string;
    shotDistanceYd: number;
    previousDistanceYd: number;
    distanceType: "total" | "carry";
    shotNumber: number | null;
    sessionId: string;
    clubId: string;
  }>;
  achievementUnlockNotifications: AchievementUnlockNotification[];
}) {
  const profile = await ensureSocialProfileForUser(input.userId);
  const visibility = parseVisibility(profile.feedVisibilityDefault, "private");
  const verificationLabel = verificationLabelForImportSource(input.source);

  for (const pb of input.longestShotNotifications) {
    await createFeedItem({
      userId: input.userId,
      itemType: "new_pb",
      headline: `${profile.displayName} hit a new ${pb.clubLabel} PB`,
      metricLabel: pb.distanceType === "carry" ? "Carry" : "Total",
      metricValue: `${numberFormatter.format(pb.shotDistanceYd)} yd`,
      context: `Previous best: ${numberFormatter.format(pb.previousDistanceYd)} yd`,
      proofUrl: `/bag/${pb.clubId}`,
      sourceType: "shot",
      sourceId: `${input.sessionId}:${pb.shotNumber ?? "unknown"}:${pb.clubType}`,
      visibility,
      verificationLabel,
      dedupeKey: `new-pb:${input.sessionId}:${pb.clubType}:${pb.shotDistanceYd}`,
      metadataJson: { clubType: pb.clubType, distanceType: pb.distanceType },
    });

    if (pb.clubType.toLowerCase() === "driver") {
      await createFeedItem({
        userId: input.userId,
        itemType: "longest_drive",
        headline: `${profile.displayName} set a longest-drive marker`,
        metricLabel: "Driver",
        metricValue: `${numberFormatter.format(pb.shotDistanceYd)} yd`,
        context: `${pb.distanceType === "carry" ? "Carry" : "Total"} distance from import`,
        proofUrl: `/bag/${pb.clubId}`,
        sourceType: "shot",
        sourceId: `${input.sessionId}:${pb.shotNumber ?? "unknown"}:driver`,
        visibility,
        verificationLabel,
        dedupeKey: `longest-drive:${input.sessionId}:${pb.shotDistanceYd}`,
      });
    }
  }

  for (const achievement of input.achievementUnlockNotifications) {
    await createFeedItem({
      userId: input.userId,
      itemType: "achievement_unlock",
      headline: `${profile.displayName} unlocked "${achievement.name}"`,
      metricLabel: "Achievement",
      metricValue: `+${achievement.xpAwarded} XP`,
      context: achievement.description,
      proofUrl: "/achievements",
      sourceType: "achievement",
      sourceId: achievement.achievementId,
      visibility,
      verificationLabel,
      dedupeKey: `achievement:${achievement.achievementId}`,
      metadataJson: {
        tier: achievement.tier,
        unlockedAt: achievement.unlockedAt,
      },
    });
  }

  await recordLevelUpFeedItem(input.userId, visibility);
}

export async function recordRoundCompletedFeedItem(input: {
  userId: string;
  sessionId: string;
  courseName: string | null;
  score: number | null;
  source: string;
}) {
  const profile = await ensureSocialProfileForUser(input.userId);
  const visibility = parseVisibility(profile.feedVisibilityDefault, "private");
  await createFeedItem({
    userId: input.userId,
    itemType: "round_completed",
    headline: `${profile.displayName} completed a round`,
    metricLabel: input.courseName ?? "Round",
    metricValue: input.score === null ? "Logged" : `${input.score}`,
    context: input.courseName ?? "Manual round",
    proofUrl: `/rounds/${input.sessionId}`,
    sourceType: "session",
    sourceId: input.sessionId,
    visibility,
    verificationLabel: input.source === "manual" ? "Manual" : "Verified import",
    dedupeKey: `round-completed:${input.sessionId}`,
  });
}

export function parseVisibility(
  value: unknown,
  fallback: SocialVisibility = "private",
): SocialVisibility {
  return socialVisibilityOptions.includes(value as SocialVisibility)
    ? (value as SocialVisibility)
    : fallback;
}

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidUsername(value: string) {
  return /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/.test(value) || /^[a-z0-9]{3}$/.test(value);
}

export function defaultProfileVisibilitySettings() {
  return {
    rounds: "private",
    pbs: "friends",
    bag: "private",
    achievements: "friends",
    handicap: "private",
    practice: "friends",
    exactShots: "private",
  } satisfies NonNullable<ProfileRow["visibilitySettingsJson"]>;
}

async function recordLevelUpFeedItem(userId: string, visibility: SocialVisibility) {
  const [{ totalXp }] = await getDb()
    .select({
      totalXp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int`,
    })
    .from(xpLedger)
    .where(eq(xpLedger.userId, userId));
  const total = Number(totalXp ?? 0);
  const level = calculateUserLevel(total);

  if (level.level <= 1) {
    return;
  }

  const profile = await ensureSocialProfileForUser(userId);
  await createFeedItem({
    userId,
    itemType: "level_up",
    headline: `${profile.displayName} reached level ${level.level}`,
    metricLabel: "XP",
    metricValue: `${total}`,
    context: `${Math.max(0, level.nextLevelXp - total)} XP to the next level`,
    proofUrl: "/achievements",
    sourceType: "xp",
    sourceId: `level-${level.level}`,
    visibility,
    verificationLabel: "Verified import",
    dedupeKey: `level-up:${level.level}`,
  });
}

async function getVisibleFeedItem(feedItemId: string, viewerUserId: string) {
  const [item] = await getDb()
    .select()
    .from(feedItems)
    .where(eq(feedItems.id, feedItemId))
    .limit(1);

  if (!item) {
    return null;
  }

  const [friendIds, blockedIds, hiddenTypes] = await Promise.all([
    getFriendIds(viewerUserId),
    getBlockedUserIds(viewerUserId),
    getHiddenFeedTypes(viewerUserId),
  ]);
  const socialIds = new Set([viewerUserId, ...friendIds]);
  return canViewFeedItem(item, viewerUserId, socialIds, blockedIds, new Set(hiddenTypes))
    ? item
    : null;
}

async function getVisibleFeedComment(commentId: string, viewerUserId: string) {
  const [row] = await getDb()
    .select({
      comment: feedComments,
      item: feedItems,
    })
    .from(feedComments)
    .innerJoin(feedItems, eq(feedComments.feedItemId, feedItems.id))
    .where(and(eq(feedComments.id, commentId), sql`${feedComments.deletedAt} IS NULL`))
    .limit(1);

  if (!row) {
    return null;
  }

  const [friendIds, blockedIds, hiddenTypes] = await Promise.all([
    getFriendIds(viewerUserId),
    getBlockedUserIds(viewerUserId),
    getHiddenFeedTypes(viewerUserId),
  ]);
  const socialIds = new Set([viewerUserId, ...friendIds]);
  return canViewFeedItem(row.item, viewerUserId, socialIds, blockedIds, new Set(hiddenTypes))
    ? row.comment
    : null;
}

async function hydrateFeedItems(
  items: FeedItemRow[],
  viewerUserId: string,
): Promise<FeedItemView[]> {
  if (items.length === 0) {
    return [];
  }

  const itemIds = items.map((item) => item.id);
  const profileMap = await profilesByUserId([...new Set(items.map((item) => item.userId))]);
  const [reactionRows, commentRows] = await Promise.all([
    getDb().select().from(feedReactions).where(inArray(feedReactions.feedItemId, itemIds)),
    getDb()
      .select()
      .from(feedComments)
      .where(and(inArray(feedComments.feedItemId, itemIds), sql`${feedComments.deletedAt} IS NULL`))
      .orderBy(desc(feedComments.createdAt)),
  ]);
  const commentReactionRows =
    commentRows.length > 0
      ? await getDb()
          .select()
          .from(feedCommentReactions)
          .where(
            inArray(
              feedCommentReactions.feedCommentId,
              commentRows.map((comment) => comment.id),
            ),
          )
      : [];
  const commentProfileMap = await profilesByUserId([
    ...new Set(commentRows.map((comment) => comment.userId)),
  ]);
  const reactionsByItem = new Map<string, typeof reactionRows>();
  const commentsByItem = new Map<string, typeof commentRows>();
  const commentReactionsByComment = new Map<string, typeof commentReactionRows>();

  for (const reaction of reactionRows) {
    reactionsByItem.set(reaction.feedItemId, [
      ...(reactionsByItem.get(reaction.feedItemId) ?? []),
      reaction,
    ]);
  }

  for (const comment of commentRows) {
    commentsByItem.set(comment.feedItemId, [
      ...(commentsByItem.get(comment.feedItemId) ?? []),
      comment,
    ]);
  }

  for (const reaction of commentReactionRows) {
    commentReactionsByComment.set(reaction.feedCommentId, [
      ...(commentReactionsByComment.get(reaction.feedCommentId) ?? []),
      reaction,
    ]);
  }

  return items
    .map((item) => {
      const profile = profileMap.get(item.userId);

      if (!profile) {
        return null;
      }

      const reactions = reactionsByItem.get(item.id) ?? [];
      const comments = (commentsByItem.get(item.id) ?? []).slice(0, 3).reverse();

      return {
        id: item.id,
        userId: item.userId,
        itemType: item.itemType,
        headline: item.headline,
        metricLabel: item.metricLabel,
        metricValue: item.metricValue,
        context: item.context,
        proofUrl: item.proofUrl,
        visibility: parseVisibility(item.visibility),
        verificationLabel: item.verificationLabel,
        createdAt: item.createdAt,
        profile: profileSummary(profile, item.userId === viewerUserId ? "self" : "friend"),
        reactionCount: reactions.length,
        commentCount: commentsByItem.get(item.id)?.length ?? 0,
        viewerReacted: reactions.some((reaction) => reaction.userId === viewerUserId),
        viewerCanManage: item.userId === viewerUserId,
        comments: comments
          .map((comment) => {
            const commentProfile = commentProfileMap.get(comment.userId);

            if (!commentProfile) {
              return null;
            }

            return {
              id: comment.id,
              body: comment.body,
              createdAt: comment.createdAt,
              likeCount: commentReactionsByComment.get(comment.id)?.length ?? 0,
              viewerLiked:
                commentReactionsByComment
                  .get(comment.id)
                  ?.some((reaction) => reaction.userId === viewerUserId) ?? false,
              viewerCanDelete: comment.userId === viewerUserId,
              profile: {
                userId: commentProfile.userId,
                username: commentProfile.username,
                displayName: commentProfile.displayName,
                avatarUrl: commentProfile.avatarUrl,
              },
            };
          })
          .filter((comment): comment is NonNullable<typeof comment> => Boolean(comment)),
      };
    })
    .filter((item): item is FeedItemView => Boolean(item));
}

function canViewFeedItem(
  item: FeedItemRow,
  viewerUserId: string,
  socialIds: Set<string>,
  blockedIds: Set<string>,
  hiddenTypes: Set<string> = new Set(),
) {
  if (blockedIds.has(item.userId)) {
    return false;
  }

  if (hiddenTypes.has(item.itemType)) {
    return false;
  }

  if (hiddenByUserIds(item.metadataJson).includes(viewerUserId)) {
    return false;
  }

  if (item.userId === viewerUserId) {
    return true;
  }

  if (item.visibility === "public") {
    return true;
  }

  return item.visibility === "friends" && socialIds.has(item.userId);
}

async function canViewProfile(viewerUserId: string | null, profile: ProfileRow) {
  if (!viewerUserId) {
    return profile.publicProfile;
  }

  if (profile.userId === viewerUserId) {
    return true;
  }

  if (await isBlockedBetween(viewerUserId, profile.userId)) {
    return false;
  }

  return (
    profile.publicProfile ||
    (profile.friendProfile && (await areFriends(viewerUserId, profile.userId)))
  );
}

async function searchDiscoverableProfiles(input: {
  viewerUserId: string;
  query: string | null;
  friendIds: string[];
  followedIds: Set<string>;
  blockedIds: Set<string>;
  pendingRequests: FriendRequestRow[];
}) {
  const query = normalizeUsername(input.query ?? "");

  if (query.length < 2) {
    return [];
  }

  const rows = await getDb()
    .select()
    .from(userProfiles)
    .where(
      or(ilike(userProfiles.username, `${query}%`), ilike(userProfiles.displayName, `%${query}%`)),
    )
    .limit(20);
  const friendIdSet = new Set(input.friendIds);

  return rows
    .filter((row) => row.userId !== input.viewerUserId)
    .filter((row) => !input.blockedIds.has(row.userId))
    .filter((row) => row.publicProfile || (row.friendProfile && friendIdSet.has(row.userId)))
    .map((row) =>
      profileSummary(
        row,
        relationshipFromContext(row.userId, input.viewerUserId, friendIdSet, input.pendingRequests),
        {
          isFollowing: input.followedIds.has(row.userId),
        },
      ),
    )
    .filter((profile) => profile.relationship !== "blocked");
}

async function suggestDiscoverableProfiles(input: {
  viewerUserId: string;
  friendIds: string[];
  followedIds: Set<string>;
  blockedIds: Set<string>;
  pendingRequests: FriendRequestRow[];
}) {
  const rows = await getDb()
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.publicProfile, true))
    .orderBy(desc(userProfiles.updatedAt))
    .limit(24);
  const friendIdSet = new Set(input.friendIds);
  const pendingIds = new Set(
    input.pendingRequests.map((request) =>
      request.requesterUserId === input.viewerUserId
        ? request.recipientUserId
        : request.requesterUserId,
    ),
  );

  return rows
    .filter((row) => row.userId !== input.viewerUserId)
    .filter((row) => !friendIdSet.has(row.userId))
    .filter((row) => !input.blockedIds.has(row.userId))
    .filter((row) => !pendingIds.has(row.userId))
    .slice(0, 6)
    .map((row) => profileSummary(row, "none", { isFollowing: input.followedIds.has(row.userId) }));
}

async function getPendingFriendRequestsForUser(userId: string) {
  return getDb()
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "pending"),
        or(eq(friendRequests.requesterUserId, userId), eq(friendRequests.recipientUserId, userId)),
      ),
    )
    .orderBy(desc(friendRequests.createdAt));
}

async function getRelationship(
  viewerUserId: string,
  subjectUserId: string,
): Promise<SocialProfileSummary["relationship"]> {
  if (viewerUserId === subjectUserId) {
    return "self";
  }

  if (await isBlockedBetween(viewerUserId, subjectUserId)) {
    return "blocked";
  }

  if (await areFriends(viewerUserId, subjectUserId)) {
    return "friend";
  }

  const [request] = await getDb()
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, "pending"),
        or(
          and(
            eq(friendRequests.requesterUserId, viewerUserId),
            eq(friendRequests.recipientUserId, subjectUserId),
          ),
          and(
            eq(friendRequests.requesterUserId, subjectUserId),
            eq(friendRequests.recipientUserId, viewerUserId),
          ),
        ),
      ),
    )
    .limit(1);

  if (!request) {
    return "none";
  }

  return request.requesterUserId === viewerUserId ? "outgoing" : "incoming";
}

async function getProfileStats(
  userId: string,
  visibilitySettings: ProfileRow["visibilitySettingsJson"],
  relationship: SocialProfileSummary["relationship"],
) {
  const canSeePublic = relationship === "self" || relationship === "friend";
  const canSeeRounds = canSeePublic || visibilitySettings?.rounds === "public";
  const canSeeBag = canSeePublic || visibilitySettings?.bag === "public";
  const canSeeHandicap = canSeePublic || visibilitySettings?.handicap === "public";
  const [roundCountRow, gapRows, handicapProfile] = await Promise.all([
    canSeeRounds
      ? getDb()
          .select({ value: sql<number>`count(*)::int` })
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, userId),
              or(eq(sessions.type, "real_round"), eq(sessions.type, "round")),
            ),
          )
          .then((rows) => rows[0]?.value ?? 0)
      : Promise.resolve(null),
    canSeeBag
      ? getDb()
          .select({
            clubId: clubs.id,
            clubType: clubs.type,
            brand: clubs.brand,
            model: clubs.model,
            carryMedianYd: stockYardages.carryMedianYd,
            totalMedianYd: stockYardages.totalMedianYd,
            sampleSize: stockYardages.sampleSize,
            confidenceScore: stockYardages.confidenceScore,
            calculatedAt: stockYardages.calculatedAt,
          })
          .from(stockYardages)
          .innerJoin(clubs, eq(stockYardages.clubId, clubs.id))
          .where(and(eq(stockYardages.userId, userId), eq(clubs.active, true)))
          .orderBy(desc(stockYardages.calculatedAt), desc(stockYardages.carryMedianYd))
          .then((rows) => {
            const latestByClubId = new Map<string, (typeof rows)[number]>();

            for (const row of rows) {
              if (!latestByClubId.has(row.clubId)) {
                latestByClubId.set(row.clubId, row);
              }
            }

            return [...latestByClubId.values()]
              .filter(
                (row) =>
                  typeof row.carryMedianYd === "number" &&
                  row.sampleSize >= 5 &&
                  typeof row.confidenceScore === "number" &&
                  row.confidenceScore >= 30,
              )
              .sort((left, right) => (right.carryMedianYd ?? 0) - (left.carryMedianYd ?? 0))
              .map((row) => ({
                clubId: row.clubId,
                clubType: row.clubType,
                label: [formatClubType(row.clubType), row.brand, row.model]
                  .filter(Boolean)
                  .join(" - "),
                carryMedianYd: row.carryMedianYd,
                totalMedianYd: row.totalMedianYd,
                sampleSize: row.sampleSize,
                confidenceScore: row.confidenceScore,
              }));
          })
      : Promise.resolve([] satisfies ProfileGapRow[]),
    canSeeHandicap ? getUserHandicapProfile(userId) : Promise.resolve(null),
  ]);

  return {
    rounds: roundCountRow,
    gapLadder: gapRows,
    handicapBand: handicapProfile?.band ?? null,
    handicapEstimate: handicapProfile?.displayValue ?? null,
  };
}

async function profilesByUserId(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const rows = await getDb()
    .select()
    .from(userProfiles)
    .where(inArray(userProfiles.userId, userIds));
  return new Map(rows.map((row) => [row.userId, row]));
}

async function uniqueUsername(base: string) {
  const db = getDb();
  let candidate = normalizeUsername(base);

  if (!isValidUsername(candidate)) {
    candidate = `player-${Math.random().toString(36).slice(2, 8)}`;
  }

  for (let index = 0; index < 10; index += 1) {
    const username = index === 0 ? candidate : `${candidate.slice(0, 33)}-${index}`;
    const [existing] = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.username, username))
      .limit(1);

    if (!existing) {
      return username;
    }
  }

  return `${candidate.slice(0, 30)}-${Date.now().toString(36).slice(-6)}`;
}

function profileSummary(
  profile: ProfileRow | undefined,
  relationship: SocialProfileSummary["relationship"],
  options: { isFollowing?: boolean } = {},
): SocialProfileSummary {
  if (!profile) {
    throw new Error("Profile not found.");
  }

  const isTourPlayer = isTourPlayerProfile(profile);

  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    headerImageUrl: profile.headerImageUrl,
    bio: profile.bio,
    homeCourse: profile.homeCourse,
    primaryLaunchMonitor: profile.primaryLaunchMonitor,
    handicapBand: profile.handicapBand,
    publicProfile: profile.publicProfile,
    friendProfile: profile.friendProfile,
    leaderboardVisibility: parseVisibility(profile.leaderboardVisibility),
    feedVisibilityDefault: parseVisibility(profile.feedVisibilityDefault),
    relationship,
    isTourPlayer,
    canReceiveFriendRequests: canReceiveFriendRequests(profile),
    isFollowing: options.isFollowing ?? false,
  };
}

function isTourPlayerProfile(profile: ProfileRow | undefined) {
  const settings = profile?.visibilitySettingsJson;
  return Boolean(
    settings?.tourPlayer ||
    settings?.profileKind === "tour-player" ||
    profile?.username.startsWith("tour-"),
  );
}

function canReceiveFriendRequests(profile: ProfileRow | undefined) {
  if (!profile || isTourPlayerProfile(profile)) {
    return false;
  }

  return profile.visibilitySettingsJson?.allowFriendRequests !== false;
}

function hiddenByUserIds(metadata: Record<string, unknown>) {
  return Array.isArray(metadata.hiddenByUserIds)
    ? metadata.hiddenByUserIds.filter((value): value is string => typeof value === "string")
    : [];
}

async function getHiddenFeedTypes(userId: string) {
  const [profile] = await getDb()
    .select({ visibilitySettingsJson: userProfiles.visibilitySettingsJson })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const hidden = profile?.visibilitySettingsJson.hiddenFeedTypes;
  return Array.isArray(hidden)
    ? hidden.filter((value): value is string => typeof value === "string")
    : [];
}

function relationshipFromContext(
  subjectUserId: string,
  viewerUserId: string,
  friendIds: Set<string>,
  requests: FriendRequestRow[],
): SocialProfileSummary["relationship"] {
  if (subjectUserId === viewerUserId) {
    return "self";
  }

  if (friendIds.has(subjectUserId)) {
    return "friend";
  }

  const request = requests.find(
    (item) =>
      (item.requesterUserId === viewerUserId && item.recipientUserId === subjectUserId) ||
      (item.requesterUserId === subjectUserId && item.recipientUserId === viewerUserId),
  );

  if (!request) {
    return "none";
  }

  return request.requesterUserId === viewerUserId ? "outgoing" : "incoming";
}

function sortedUserPair(userAId: string, userBId: string) {
  return userAId < userBId ? ([userAId, userBId] as const) : ([userBId, userAId] as const);
}

function defaultUsername(displayName: string, userId: string) {
  return `${displayName}-${userId.slice(0, 8)}`;
}

function nullableClean(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanRequired(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanStatusUpdateBody(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, STATUS_UPDATE_MAX_BODY_LENGTH);
}

function cleanStatusUpdateImage(value: string | null | undefined) {
  const cleaned = nullableClean(value);

  if (!cleaned) {
    return null;
  }

  if (cleaned.length > STATUS_UPDATE_MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("Selected status image is too large.");
  }

  if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(cleaned)) {
    return cleaned;
  }

  throw new Error("Status images must be JPG, PNG or WebP files.");
}

function statusUpdateHeadline(body: string, hasImage: boolean) {
  const firstLine = body
    .split("\n")
    .find((line) => line.trim())
    ?.trim();

  if (firstLine) {
    return firstLine.length > 140 ? `${firstLine.slice(0, 137).trimEnd()}...` : firstLine;
  }

  return hasImage ? "Shared a golf photo" : "Shared a status update";
}

function safeSocialDisplayName(value: string | null | undefined) {
  const cleaned = nullableClean(value);
  return cleaned && !isSharedDatabaseArtifact(cleaned) ? cleaned : null;
}

function isSharedDatabaseArtifact(value: string | null | undefined) {
  return typeof value === "string" && /\bincert\b/i.test(value);
}

function verificationLabelForImportSource(source: string) {
  switch (source) {
    case "rapsodo_cloud":
      return "Rapsodo Cloud";
    case "rapsodo":
      return "Rapsodo CSV";
    case "manual":
      return "Manual";
    default:
      return "Unverified";
  }
}

function revalidateSocialPaths() {
  revalidatePath("/friends");
  revalidatePath("/feed");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
}
