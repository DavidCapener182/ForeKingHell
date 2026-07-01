"use server";

import { and, eq, gt, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  accountInvitations,
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
  usageEvents,
  userAchievements,
  userBlocks,
  userFollows,
  userProfiles,
  users,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getCurrentUser, requireCurrentUserId } from "@/lib/current-user";
import {
  createInvitationToken,
  getInvitationExpiry,
  hashInvitationToken,
  normalizeInvitationEmail,
  parseCollaborationRole,
} from "@/lib/collaboration";
import {
  parseDashboardPins,
  parsePreferredUnits,
  parsePrivacySettings,
  parseTableDensity,
  parseTheme,
} from "@/lib/user-settings";

export async function createInvitationAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const invitedEmail = normalizeInvitationEmail(formData.get("invitedEmail"));
  const role = parseCollaborationRole(formData.get("role"));

  if (currentUser.email?.toLowerCase() === invitedEmail) {
    redirect("/settings?inviteError=self");
  }

  const db = getDb();
  const token = createInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const now = new Date();

  await db.insert(accountInvitations).values({
    ownerUserId: currentUser.id,
    invitedEmail,
    role,
    tokenHash,
    status: "pending",
    expiresAt: getInvitationExpiry(now),
    updatedAt: now,
  });

  revalidatePath("/settings");
  redirect(`/settings?invite=${encodeURIComponent(token)}`);
}

export async function acceptInvitationAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  const token = nullableString(formData, "token");

  if (!token) {
    redirect("/settings?inviteError=invalid");
  }

  if (!currentUser) {
    redirect(`/login?next=/settings/invitations/${encodeURIComponent(token)}`);
  }

  const db = getDb();
  const tokenHash = hashInvitationToken(token);
  const now = new Date();
  const [invitation] = await db
    .select()
    .from(accountInvitations)
    .where(
      and(
        eq(accountInvitations.tokenHash, tokenHash),
        eq(accountInvitations.status, "pending"),
        gt(accountInvitations.expiresAt, now),
      ),
    )
    .limit(1);

  if (!invitation) {
    redirect("/settings?inviteError=invalid");
  }

  if (currentUser.email?.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
    redirect("/settings?inviteError=email");
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(accountMemberships)
      .values({
        ownerUserId: invitation.ownerUserId,
        memberUserId: currentUser.id,
        role: invitation.role,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [accountMemberships.ownerUserId, accountMemberships.memberUserId],
        set: {
          role: invitation.role,
          updatedAt: now,
        },
      });

    await tx
      .update(accountInvitations)
      .set({
        status: "accepted",
        acceptedByUserId: currentUser.id,
        acceptedAt: now,
        updatedAt: now,
      })
      .where(eq(accountInvitations.id, invitation.id));
  });

  revalidatePath("/settings");
  redirect("/settings?inviteAccepted=1");
}

export async function cancelInvitationAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const invitationId = nullableString(formData, "invitationId");

  if (!invitationId) {
    redirect("/settings");
  }

  await getDb()
    .update(accountInvitations)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(accountInvitations.id, invitationId), eq(accountInvitations.ownerUserId, userId)),
    );

  revalidatePath("/settings");
  redirect("/settings?inviteCancelled=1");
}

export async function removeMembershipAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const membershipId = nullableString(formData, "membershipId");

  if (!membershipId) {
    redirect("/settings");
  }

  await getDb()
    .delete(accountMemberships)
    .where(
      and(eq(accountMemberships.id, membershipId), eq(accountMemberships.ownerUserId, userId)),
    );

  revalidatePath("/settings");
  redirect("/settings?memberRemoved=1");
}

export async function updateUserSettingsAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const db = getDb();

  await db
    .update(users)
    .set({
      name: nullableString(formData, "name"),
      preferredUnits: parsePreferredUnits(formData.get("preferredUnits")),
      theme: parseTheme(),
      tableDensity: parseTableDensity(formData.get("tableDensity")),
      dashboardPins: parseDashboardPins(formData.getAll("dashboardPins")),
      privacySettingsJson: parsePrivacySettings(formData),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?saved=1");
}

export async function deleteAccountDataAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const confirmation = nullableString(formData, "confirmation")?.toLowerCase();
  const expectedConfirmation = currentUser.email?.toLowerCase() ?? currentUser.id;

  if (confirmation !== expectedConfirmation) {
    redirect("/settings?deleteError=confirmation");
  }

  const userId = currentUser.id;
  const db = getDb();

  await db.transaction(async (tx) => {
    const ownedSponsorRows = await tx
      .select({ id: sponsors.id })
      .from(sponsors)
      .where(eq(sponsors.ownerUserId, userId));
    const ownedSponsorIds = ownedSponsorRows.map((sponsor) => sponsor.id);

    await tx
      .delete(socialReports)
      .where(
        or(eq(socialReports.reporterUserId, userId), eq(socialReports.reportedUserId, userId)),
      );
    await tx
      .delete(moderationEvents)
      .where(or(eq(moderationEvents.actorUserId, userId), eq(moderationEvents.targetId, userId)));
    await tx.delete(aiGenerationCache).where(eq(aiGenerationCache.userId, userId));
    await tx.delete(aiUsageEvents).where(eq(aiUsageEvents.userId, userId));
    await tx.delete(aiSocialSummaries).where(eq(aiSocialSummaries.userId, userId));
    await tx.delete(importJobs).where(eq(importJobs.userId, userId));
    await tx.delete(importSourceFiles).where(eq(importSourceFiles.userId, userId));
    await tx.delete(importMappings).where(eq(importMappings.userId, userId));
    await tx.delete(providerSessions).where(eq(providerSessions.userId, userId));
    await tx.delete(providerAccounts).where(eq(providerAccounts.userId, userId));
    await tx.delete(offerClicks).where(eq(offerClicks.userId, userId));
    if (ownedSponsorIds.length > 0) {
      await tx.delete(partnerOffers).where(inArray(partnerOffers.sponsorId, ownedSponsorIds));
      await tx.delete(challengeRewards).where(inArray(challengeRewards.sponsorId, ownedSponsorIds));
    }
    await tx.delete(sponsors).where(eq(sponsors.ownerUserId, userId));
    await tx.delete(usageEvents).where(eq(usageEvents.userId, userId));
    await tx.delete(entitlements).where(eq(entitlements.userId, userId));
    await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await tx.delete(billingCustomers).where(eq(billingCustomers.userId, userId));
    await tx.delete(groupChallengeLinks).where(eq(groupChallengeLinks.createdByUserId, userId));
    await tx.delete(groupPosts).where(eq(groupPosts.userId, userId));
    await tx
      .delete(groupInvites)
      .where(or(eq(groupInvites.inviterUserId, userId), eq(groupInvites.inviteeUserId, userId)));
    await tx.delete(groupMemberships).where(eq(groupMemberships.userId, userId));
    await tx.delete(groups).where(eq(groups.ownerUserId, userId));
    await tx.delete(challengeComments).where(eq(challengeComments.userId, userId));
    await tx
      .delete(challengeInvites)
      .where(
        or(eq(challengeInvites.inviterUserId, userId), eq(challengeInvites.inviteeUserId, userId)),
      );
    await tx.delete(challengeResults).where(eq(challengeResults.userId, userId));
    await tx.delete(challengeAttempts).where(eq(challengeAttempts.userId, userId));
    await tx.delete(challengeEntries).where(eq(challengeEntries.userId, userId));
    await tx.delete(challenges).where(eq(challenges.creatorUserId, userId));
    await tx.delete(feedCommentReactions).where(eq(feedCommentReactions.userId, userId));
    await tx.delete(feedReactions).where(eq(feedReactions.userId, userId));
    await tx.delete(feedComments).where(eq(feedComments.userId, userId));
    await tx.delete(feedItems).where(eq(feedItems.userId, userId));
    await tx
      .delete(friendRequests)
      .where(
        or(eq(friendRequests.requesterUserId, userId), eq(friendRequests.recipientUserId, userId)),
      );
    await tx
      .delete(friendships)
      .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)));
    await tx
      .delete(userBlocks)
      .where(or(eq(userBlocks.blockerUserId, userId), eq(userBlocks.blockedUserId, userId)));
    await tx
      .delete(userFollows)
      .where(or(eq(userFollows.followerUserId, userId), eq(userFollows.followedUserId, userId)));
    await tx.delete(userProfiles).where(eq(userProfiles.userId, userId));
    await tx.delete(shareLinks).where(eq(shareLinks.userId, userId));
    await tx.delete(strokesGainedShotEvents).where(eq(strokesGainedShotEvents.userId, userId));
    await tx.delete(importFiles).where(eq(importFiles.userId, userId));
    await tx.delete(importRows).where(eq(importRows.userId, userId));
    await tx.delete(userAchievements).where(eq(userAchievements.userId, userId));
    await tx.delete(xpLedger).where(eq(xpLedger.userId, userId));
    await tx.delete(achievementProgress).where(eq(achievementProgress.userId, userId));
    await tx.delete(achievementSyncState).where(eq(achievementSyncState.userId, userId));
    await tx.delete(rapsodoSyncSessions).where(eq(rapsodoSyncSessions.userId, userId));
    await tx.delete(stockYardages).where(eq(stockYardages.userId, userId));
    await tx.delete(clubEquipmentHistory).where(eq(clubEquipmentHistory.userId, userId));
    await tx.delete(ballModels).where(eq(ballModels.userId, userId));
    await tx.delete(shots).where(eq(shots.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(clubs).where(eq(clubs.userId, userId));
    await tx
      .delete(courses)
      .where(and(eq(courses.createdByUserId, userId), eq(courses.visibility, "private")));
    await tx.delete(accountInvitations).where(eq(accountInvitations.ownerUserId, userId));
    await tx.delete(accountMemberships).where(eq(accountMemberships.ownerUserId, userId));
    await tx.delete(accountMemberships).where(eq(accountMemberships.memberUserId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });

  revalidatePath("/", "layout");
  redirect("/settings?deleted=1");
}

function nullableString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
