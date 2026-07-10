import { and, asc, eq, gt, inArray, or } from "drizzle-orm";

import {
  accountMemberships,
  achievementProgress,
  achievementSyncState,
  aiGenerationCache,
  aiSocialSummaries,
  aiUsageEvents,
  ballModels,
  billingCustomers,
  challengeAttempts,
  challengeComments,
  challengeEntries,
  challengeInvites,
  challengeRewards,
  challengeResults,
  challenges,
  clubEquipmentHistory,
  clubs,
  contentExports,
  courses,
  entitlements,
  equipmentSnapshots,
  feedCommentReactions,
  feedComments,
  feedItems,
  feedReactions,
  friendRequests,
  friendships,
  groupChallengeLinks,
  groupInvites,
  groupMemberships,
  groupPosts,
  groups,
  holes,
  importFiles,
  importJobs,
  importMappings,
  importRows,
  importSourceFiles,
  offerClicks,
  partnerOffers,
  providerAccounts,
  providerSessions,
  rapsodoSyncSessions,
  sessions,
  shareLinks,
  shots,
  socialReports,
  sponsors,
  stockYardages,
  strokesGainedShotEvents,
  subscriptions,
  teeSets,
  usageEvents,
  userAchievements,
  userBlocks,
  userFollows,
  userProfiles,
  users,
  weatherSnapshots,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { createPersonalDataExport } from "@/lib/personal-data-export";

export const dynamic = "force-dynamic";

const SHOT_PAGE_LIMIT = 5_000;

export async function GET(request?: Request) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const shotCursor = parseShotCursor(request);
  const exportedAt = new Date();

  const db = getDb();
  const [
    profileRows,
    clubRows,
    sessionRows,
    importRowRows,
    importFileRows,
    stockYardageRows,
    ballModelRows,
    clubEquipmentRows,
    strokesGainedRows,
    achievementRows,
    xpRows,
    progressRows,
    syncStateRows,
    rapsodoRows,
    shareLinkRows,
    contentExportRows,
    weatherSnapshotRows,
    equipmentSnapshotRows,
    membershipRows,
    socialProfileRows,
    friendRequestRows,
    friendshipRows,
    blockRows,
    followRows,
    feedItemRows,
    feedReactionRows,
    feedCommentReactionRows,
    feedCommentRows,
    challengeRows,
    challengeEntryRows,
    challengeAttemptRows,
    challengeResultRows,
    challengeCommentRows,
    challengeInviteRows,
    groupRows,
    groupMembershipRows,
    groupInviteRows,
    groupPostRows,
    groupChallengeLinkRows,
    billingCustomerRows,
    subscriptionRows,
    entitlementRows,
    usageEventRows,
    sponsorRows,
    offerClickRows,
    providerAccountRows,
    providerSessionRows,
    importSourceFileRows,
    importJobRows,
    importMappingRows,
    aiUsageEventRows,
    aiGenerationCacheRows,
    aiSocialSummaryRows,
    socialReportRows,
    createdCourseRows,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(clubs).where(eq(clubs.userId, userId)),
    db.select().from(sessions).where(eq(sessions.userId, userId)),
    db.select().from(importRows).where(eq(importRows.userId, userId)),
    db.select().from(importFiles).where(eq(importFiles.userId, userId)),
    db.select().from(stockYardages).where(eq(stockYardages.userId, userId)),
    db.select().from(ballModels).where(eq(ballModels.userId, userId)),
    db.select().from(clubEquipmentHistory).where(eq(clubEquipmentHistory.userId, userId)),
    db.select().from(strokesGainedShotEvents).where(eq(strokesGainedShotEvents.userId, userId)),
    db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
    db.select().from(xpLedger).where(eq(xpLedger.userId, userId)),
    db.select().from(achievementProgress).where(eq(achievementProgress.userId, userId)),
    db.select().from(achievementSyncState).where(eq(achievementSyncState.userId, userId)),
    db.select().from(rapsodoSyncSessions).where(eq(rapsodoSyncSessions.userId, userId)),
    db.select().from(shareLinks).where(eq(shareLinks.userId, userId)),
    db.select().from(contentExports).where(eq(contentExports.userId, userId)),
    db.select().from(weatherSnapshots).where(eq(weatherSnapshots.userId, userId)),
    db.select().from(equipmentSnapshots).where(eq(equipmentSnapshots.userId, userId)),
    db.select().from(accountMemberships).where(eq(accountMemberships.memberUserId, userId)),
    db.select().from(userProfiles).where(eq(userProfiles.userId, userId)),
    db
      .select()
      .from(friendRequests)
      .where(
        or(eq(friendRequests.requesterUserId, userId), eq(friendRequests.recipientUserId, userId)),
      ),
    db
      .select()
      .from(friendships)
      .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))),
    db.select().from(userBlocks).where(eq(userBlocks.blockerUserId, userId)),
    db.select().from(userFollows).where(eq(userFollows.followerUserId, userId)),
    db.select().from(feedItems).where(eq(feedItems.userId, userId)),
    db.select().from(feedReactions).where(eq(feedReactions.userId, userId)),
    db.select().from(feedCommentReactions).where(eq(feedCommentReactions.userId, userId)),
    db.select().from(feedComments).where(eq(feedComments.userId, userId)),
    db.select().from(challenges).where(eq(challenges.creatorUserId, userId)),
    db.select().from(challengeEntries).where(eq(challengeEntries.userId, userId)),
    db.select().from(challengeAttempts).where(eq(challengeAttempts.userId, userId)),
    db.select().from(challengeResults).where(eq(challengeResults.userId, userId)),
    db.select().from(challengeComments).where(eq(challengeComments.userId, userId)),
    db
      .select()
      .from(challengeInvites)
      .where(
        or(eq(challengeInvites.inviterUserId, userId), eq(challengeInvites.inviteeUserId, userId)),
      ),
    db.select().from(groups).where(eq(groups.ownerUserId, userId)),
    db.select().from(groupMemberships).where(eq(groupMemberships.userId, userId)),
    db
      .select()
      .from(groupInvites)
      .where(or(eq(groupInvites.inviterUserId, userId), eq(groupInvites.inviteeUserId, userId))),
    db.select().from(groupPosts).where(eq(groupPosts.userId, userId)),
    db.select().from(groupChallengeLinks).where(eq(groupChallengeLinks.createdByUserId, userId)),
    db.select().from(billingCustomers).where(eq(billingCustomers.userId, userId)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db.select().from(entitlements).where(eq(entitlements.userId, userId)),
    db.select().from(usageEvents).where(eq(usageEvents.userId, userId)),
    db.select().from(sponsors).where(eq(sponsors.ownerUserId, userId)),
    db.select().from(offerClicks).where(eq(offerClicks.userId, userId)),
    db.select().from(providerAccounts).where(eq(providerAccounts.userId, userId)),
    db.select().from(providerSessions).where(eq(providerSessions.userId, userId)),
    db.select().from(importSourceFiles).where(eq(importSourceFiles.userId, userId)),
    db.select().from(importJobs).where(eq(importJobs.userId, userId)),
    db.select().from(importMappings).where(eq(importMappings.userId, userId)),
    db.select().from(aiUsageEvents).where(eq(aiUsageEvents.userId, userId)),
    db.select().from(aiGenerationCache).where(eq(aiGenerationCache.userId, userId)),
    db.select().from(aiSocialSummaries).where(eq(aiSocialSummaries.userId, userId)),
    db.select().from(socialReports).where(eq(socialReports.reporterUserId, userId)),
    db.select().from(courses).where(eq(courses.createdByUserId, userId)),
  ]);

  const shotPageRows = await db
    .select()
    .from(shots)
    .where(
      shotCursor
        ? and(eq(shots.userId, userId), gt(shots.id, shotCursor))
        : eq(shots.userId, userId),
    )
    .orderBy(asc(shots.id))
    .limit(SHOT_PAGE_LIMIT + 1);
  const hasMoreShots = shotPageRows.length > SHOT_PAGE_LIMIT;
  const shotRows = shotPageRows.slice(0, SHOT_PAGE_LIMIT);
  const nextShotCursor = hasMoreShots ? (shotRows.at(-1)?.id ?? null) : null;

  const courseIds = createdCourseRows.map((course) => course.id);
  const challengeIds = challengeRows.map((challenge) => challenge.id);
  const sponsorIds = sponsorRows.map((sponsor) => sponsor.id);
  const [teeSetRows, holeRows, challengeRewardRows, sponsorChallengeRewardRows, partnerOfferRows] =
    await Promise.all([
      courseIds.length > 0
        ? db.select().from(teeSets).where(inArray(teeSets.courseId, courseIds))
        : Promise.resolve([]),
      courseIds.length > 0
        ? db.select().from(holes).where(inArray(holes.courseId, courseIds))
        : Promise.resolve([]),
      challengeIds.length > 0
        ? db
            .select()
            .from(challengeRewards)
            .where(inArray(challengeRewards.challengeId, challengeIds))
        : Promise.resolve([]),
      sponsorIds.length > 0
        ? db.select().from(challengeRewards).where(inArray(challengeRewards.sponsorId, sponsorIds))
        : Promise.resolve([]),
      sponsorIds.length > 0
        ? db.select().from(partnerOffers).where(inArray(partnerOffers.sponsorId, sponsorIds))
        : Promise.resolve([]),
    ]);

  const payload = createPersonalDataExport({
    userId,
    exportedAt,
    profile: profileRows[0] ?? null,
    data: {
      clubs: clubRows,
      sessions: sessionRows,
      importRows: importRowRows,
      importFiles: importFileRows,
      shots: shotRows,
      stockYardages: stockYardageRows,
      ballModels: ballModelRows,
      clubEquipmentHistory: clubEquipmentRows,
      strokesGainedShotEvents: strokesGainedRows,
      userAchievements: achievementRows,
      xpLedger: xpRows,
      achievementProgress: progressRows,
      achievementSyncState: syncStateRows,
      rapsodoSyncSessions: rapsodoRows,
      shareLinks: shareLinkRows,
      contentExports: contentExportRows,
      weatherSnapshots: weatherSnapshotRows,
      equipmentSnapshots: equipmentSnapshotRows,
      accountMemberships: membershipRows,
      socialProfile: socialProfileRows[0] ?? null,
      friendRequests: friendRequestRows,
      friendships: friendshipRows,
      userBlocks: blockRows,
      userFollows: followRows,
      feedItems: feedItemRows,
      feedReactions: feedReactionRows,
      feedCommentReactions: feedCommentReactionRows,
      feedComments: feedCommentRows,
      challenges: challengeRows,
      challengeEntries: challengeEntryRows,
      challengeAttempts: challengeAttemptRows,
      challengeResults: challengeResultRows,
      challengeComments: challengeCommentRows,
      challengeInvites: challengeInviteRows,
      challengeRewards: uniqueById([...challengeRewardRows, ...sponsorChallengeRewardRows]),
      groups: groupRows,
      groupMemberships: groupMembershipRows,
      groupInvites: groupInviteRows,
      groupPosts: groupPostRows,
      groupChallengeLinks: groupChallengeLinkRows,
      billingCustomers: billingCustomerRows,
      subscriptions: subscriptionRows,
      entitlements: entitlementRows,
      usageEvents: usageEventRows,
      sponsors: sponsorRows,
      partnerOffers: partnerOfferRows,
      offerClicks: offerClickRows,
      providerAccounts: providerAccountRows,
      providerSessions: providerSessionRows,
      importSourceFiles: importSourceFileRows,
      importJobs: importJobRows,
      importMappings: importMappingRows,
      aiUsageEvents: aiUsageEventRows,
      aiGenerationCache: aiGenerationCacheRows,
      aiSocialSummaries: aiSocialSummaryRows,
      socialReports: socialReportRows,
      courses: createdCourseRows,
      teeSets: teeSetRows,
      holes: holeRows,
    },
  });

  const paginatedPayload = {
    ...payload,
    pagination: {
      shots: {
        limit: SHOT_PAGE_LIMIT,
        cursor: shotCursor,
        nextCursor: nextShotCursor,
        hasMore: hasMoreShots,
        nextPath: nextShotCursor
          ? `/api/settings/export?shotCursor=${encodeURIComponent(nextShotCursor)}`
          : null,
      },
    },
  };

  return Response.json(paginatedPayload, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="forekinghell-personal-export-${exportedAt.toISOString().slice(0, 10)}.json"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseShotCursor(request?: Request) {
  if (!request) return null;

  const value = new URL(request.url).searchParams.get("shotCursor")?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}
