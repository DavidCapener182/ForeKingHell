import { eq, inArray, or } from "drizzle-orm";

import {
  accountInvitations,
  accountMemberships,
  achievementProgress,
  achievementSyncState,
  aiSocialSummaries,
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
  courses,
  entitlements,
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
  moderationEvents,
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
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const db = getDb();
  const [
    profileRows,
    clubRows,
    sessionRows,
    importRowRows,
    importFileRows,
    shotRows,
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
    membershipRows,
    invitationRows,
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
    aiSocialSummaryRows,
    socialReportRows,
    moderationEventRows,
    createdCourseRows,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(clubs).where(eq(clubs.userId, userId)),
    db.select().from(sessions).where(eq(sessions.userId, userId)),
    db.select().from(importRows).where(eq(importRows.userId, userId)),
    db.select().from(importFiles).where(eq(importFiles.userId, userId)),
    db.select().from(shots).where(eq(shots.userId, userId)),
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
    db.select().from(accountMemberships).where(orOwnerOrMember(userId)),
    db.select().from(accountInvitations).where(eq(accountInvitations.ownerUserId, userId)),
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
    db
      .select()
      .from(userBlocks)
      .where(or(eq(userBlocks.blockerUserId, userId), eq(userBlocks.blockedUserId, userId))),
    db
      .select()
      .from(userFollows)
      .where(or(eq(userFollows.followerUserId, userId), eq(userFollows.followedUserId, userId))),
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
    db.select().from(aiSocialSummaries).where(eq(aiSocialSummaries.userId, userId)),
    db
      .select()
      .from(socialReports)
      .where(
        or(eq(socialReports.reporterUserId, userId), eq(socialReports.reportedUserId, userId)),
      ),
    db
      .select()
      .from(moderationEvents)
      .where(or(eq(moderationEvents.actorUserId, userId), eq(moderationEvents.targetId, userId))),
    db.select().from(courses).where(eq(courses.createdByUserId, userId)),
  ]);

  const courseIds = createdCourseRows.map((course) => course.id);
  const groupIds = groupRows.map((group) => group.id);
  const challengeIds = challengeRows.map((challenge) => challenge.id);
  const sponsorIds = sponsorRows.map((sponsor) => sponsor.id);
  const [
    teeSetRows,
    holeRows,
    ownedGroupMembershipRows,
    ownedGroupInviteRows,
    ownedGroupPostRows,
    ownedGroupChallengeLinkRows,
    challengeRewardRows,
    sponsorChallengeRewardRows,
    partnerOfferRows,
  ] =
    courseIds.length > 0
      ? await Promise.all([
          db.select().from(teeSets).where(inArray(teeSets.courseId, courseIds)),
          db.select().from(holes).where(inArray(holes.courseId, courseIds)),
          groupIds.length > 0
            ? db.select().from(groupMemberships).where(inArray(groupMemberships.groupId, groupIds))
            : Promise.resolve([]),
          groupIds.length > 0
            ? db.select().from(groupInvites).where(inArray(groupInvites.groupId, groupIds))
            : Promise.resolve([]),
          groupIds.length > 0
            ? db.select().from(groupPosts).where(inArray(groupPosts.groupId, groupIds))
            : Promise.resolve([]),
          groupIds.length > 0
            ? db
                .select()
                .from(groupChallengeLinks)
                .where(inArray(groupChallengeLinks.groupId, groupIds))
            : Promise.resolve([]),
          challengeIds.length > 0
            ? db
                .select()
                .from(challengeRewards)
                .where(inArray(challengeRewards.challengeId, challengeIds))
            : Promise.resolve([]),
          sponsorIds.length > 0
            ? db
                .select()
                .from(challengeRewards)
                .where(inArray(challengeRewards.sponsorId, sponsorIds))
            : Promise.resolve([]),
          sponsorIds.length > 0
            ? db.select().from(partnerOffers).where(inArray(partnerOffers.sponsorId, sponsorIds))
            : Promise.resolve([]),
        ])
      : await Promise.all([
          Promise.resolve([]),
          Promise.resolve([]),
          groupIds.length > 0
            ? db.select().from(groupMemberships).where(inArray(groupMemberships.groupId, groupIds))
            : Promise.resolve([]),
          groupIds.length > 0
            ? db.select().from(groupInvites).where(inArray(groupInvites.groupId, groupIds))
            : Promise.resolve([]),
          groupIds.length > 0
            ? db.select().from(groupPosts).where(inArray(groupPosts.groupId, groupIds))
            : Promise.resolve([]),
          groupIds.length > 0
            ? db
                .select()
                .from(groupChallengeLinks)
                .where(inArray(groupChallengeLinks.groupId, groupIds))
            : Promise.resolve([]),
          challengeIds.length > 0
            ? db
                .select()
                .from(challengeRewards)
                .where(inArray(challengeRewards.challengeId, challengeIds))
            : Promise.resolve([]),
          sponsorIds.length > 0
            ? db
                .select()
                .from(challengeRewards)
                .where(inArray(challengeRewards.sponsorId, sponsorIds))
            : Promise.resolve([]),
          sponsorIds.length > 0
            ? db.select().from(partnerOffers).where(inArray(partnerOffers.sponsorId, sponsorIds))
            : Promise.resolve([]),
        ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    userId,
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
      accountMemberships: membershipRows,
      accountInvitations: invitationRows,
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
      groupMemberships: uniqueById([...groupMembershipRows, ...ownedGroupMembershipRows]),
      groupInvites: uniqueById([...groupInviteRows, ...ownedGroupInviteRows]),
      groupPosts: uniqueById([...groupPostRows, ...ownedGroupPostRows]),
      groupChallengeLinks: uniqueById([...groupChallengeLinkRows, ...ownedGroupChallengeLinkRows]),
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
      aiSocialSummaries: aiSocialSummaryRows,
      socialReports: socialReportRows,
      moderationEvents: moderationEventRows,
      courses: createdCourseRows,
      teeSets: teeSetRows,
      holes: holeRows,
    },
  };

  return Response.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="lm-world-tour-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

function orOwnerOrMember(userId: string) {
  return or(
    eq(accountMemberships.ownerUserId, userId),
    eq(accountMemberships.memberUserId, userId),
  );
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}
