"use server";

import { randomUUID } from "node:crypto";

import { and, eq, gt, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  accountInvitations,
  accountMemberships,
  achievementProgress,
  achievementSyncState,
  analysisAnnotations,
  analysisSnapshots,
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
  coachPlayerInteractions,
  contentExports,
  courses,
  entitlements,
  feedCommentReactions,
  feedComments,
  feedItems,
  feedReactions,
  friendRequests,
  friendships,
  golfTrainingSessions,
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
  offerClicks,
  offlineOperations,
  partnerOffers,
  providerAccounts,
  providerSessions,
  practiceBlockResults,
  practiceBlocks,
  practicePlanMatches,
  practicePlans,
  practiceResults,
  practiceSessions,
  rapsodoSyncSessions,
  sessions,
  shareLinks,
  shotSavedViews,
  shots,
  speedTrainingGoals,
  speedTrainingSessions,
  speedTrainingSwings,
  sponsors,
  stockYardages,
  strokesGainedShotEvents,
  subscriptions,
  tournamentComments,
  tournamentEntries,
  tournamentStandings,
  tournamentSubmissions,
  usageEvents,
  userAchievements,
  userBlocks,
  userFeaturePreferences,
  userFollows,
  userProfiles,
  users,
  weatherSnapshots,
  weeklyRecaps,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { isRecentSignIn } from "@/lib/account-deletion";
import { getCurrentUser, requireCurrentUserId } from "@/lib/current-user";
import {
  clearSupabaseAuthCookies,
  createSupabaseServerClient,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
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
    redirect("/settings?section=sharing&inviteError=self");
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
  redirect(`/settings?section=sharing&invite=${encodeURIComponent(token)}`);
}

export async function acceptInvitationAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  const token = nullableString(formData, "token");

  if (!token) {
    redirect("/settings?section=sharing&inviteError=invalid");
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
    redirect("/settings?section=sharing&inviteError=invalid");
  }

  if (currentUser.email?.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
    redirect("/settings?section=sharing&inviteError=email");
  }

  const invitationAccepted = await db.transaction(async (tx) => {
    const claimNow = new Date();
    const claimedInvitations = await tx
      .update(accountInvitations)
      .set({
        status: "accepted",
        acceptedByUserId: currentUser.id,
        acceptedAt: claimNow,
        updatedAt: claimNow,
      })
      .where(
        and(
          eq(accountInvitations.id, invitation.id),
          eq(accountInvitations.tokenHash, tokenHash),
          eq(accountInvitations.status, "pending"),
          gt(accountInvitations.expiresAt, claimNow),
        ),
      )
      .returning({ id: accountInvitations.id });

    if (claimedInvitations.length === 0) {
      return false;
    }

    await tx
      .insert(accountMemberships)
      .values({
        ownerUserId: invitation.ownerUserId,
        memberUserId: currentUser.id,
        role: invitation.role,
        updatedAt: claimNow,
      })
      .onConflictDoUpdate({
        target: [accountMemberships.ownerUserId, accountMemberships.memberUserId],
        set: {
          role: invitation.role,
          updatedAt: claimNow,
        },
      });

    return true;
  });

  if (!invitationAccepted) {
    redirect("/settings?section=sharing&inviteError=invalid");
  }

  revalidatePath("/settings");
  redirect("/settings?section=sharing&inviteAccepted=1");
}

export async function cancelInvitationAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const invitationId = nullableString(formData, "invitationId");

  if (!invitationId) {
    redirect("/settings?section=sharing");
  }

  await getDb()
    .update(accountInvitations)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(accountInvitations.id, invitationId), eq(accountInvitations.ownerUserId, userId)),
    );

  revalidatePath("/settings");
  redirect("/settings?section=sharing&inviteCancelled=1");
}

export async function removeMembershipAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const membershipId = nullableString(formData, "membershipId");

  if (!membershipId) {
    redirect("/settings?section=sharing");
  }

  await getDb()
    .delete(accountMemberships)
    .where(
      and(eq(accountMemberships.id, membershipId), eq(accountMemberships.ownerUserId, userId)),
    );

  revalidatePath("/settings");
  redirect("/settings?section=sharing&memberRemoved=1");
}

export async function updateUserSettingsAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const section = settingsFormSection(formData.get("settingsSection"));
  const patch =
    section === "appearance"
      ? {
          theme: parseTheme(formData.get("theme")),
          tableDensity: parseTableDensity(formData.get("tableDensity")),
          updatedAt: new Date(),
        }
      : section === "privacy"
        ? {
            privacySettingsJson: parsePrivacySettings(formData),
            updatedAt: new Date(),
          }
        : {
            name: nullableString(formData, "name"),
            preferredUnits: parsePreferredUnits(formData.get("preferredUnits")),
            dashboardPins: parseDashboardPins(formData.getAll("dashboardPins")),
            updatedAt: new Date(),
          };

  await db.update(users).set(patch).where(eq(users.id, userId));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(`/settings?section=${section}&saved=1`);
}

export async function deleteAccountDataAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const confirmation = nullableString(formData, "confirmation")?.toLowerCase();
  const expectedConfirmation = currentUser.email?.toLowerCase() ?? currentUser.id;

  if (confirmation !== expectedConfirmation) {
    redirect("/settings?section=danger&deleteError=confirmation#danger-zone");
  }

  if (!isRecentSignIn(currentUser.lastSignInAt)) {
    redirect(
      "/login?reason=reauth_required&next=/settings%3Fsection%3Ddanger%26reauth%3D1%23danger-zone",
    );
  }

  const userId = currentUser.id;
  const authUserId = currentUser.authUserId ?? currentUser.id;
  const db = getDb();

  const supabase = await createSupabaseServerClient();
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) {
    throw new Error("Active sessions could not be revoked before account deletion.");
  }

  await db.transaction(async (tx) => {
    const ownedSponsorRows = await tx
      .select({ id: sponsors.id })
      .from(sponsors)
      .where(eq(sponsors.ownerUserId, userId));
    const ownedSponsorIds = ownedSponsorRows.map((sponsor) => sponsor.id);

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

  const { error: authDeleteError } =
    await getSupabaseServiceRoleClient().auth.admin.deleteUser(authUserId);
  if (authDeleteError) {
    throw new Error("The authentication identity could not be deleted.");
  }

  await clearSupabaseAuthCookies();

  revalidatePath("/", "layout");
  redirect(`/login?accountDeleted=1&receipt=${encodeURIComponent(randomUUID())}`);
}

export async function resetGolfDataAction(formData: FormData) {
  const userId = await requireCurrentUserId();
  if (nullableString(formData, "confirmation") !== "RESET") {
    redirect("/settings?section=danger&resetError=confirmation#danger-zone");
  }

  await getDb().transaction(async (tx) => {
    await tx
      .delete(coachPlayerInteractions)
      .where(eq(coachPlayerInteractions.playerUserId, userId));
    await tx.delete(offlineOperations).where(eq(offlineOperations.userId, userId));
    await tx.delete(weeklyRecaps).where(eq(weeklyRecaps.userId, userId));
    await tx.delete(practiceBlockResults).where(eq(practiceBlockResults.userId, userId));
    await tx.delete(practicePlanMatches).where(eq(practicePlanMatches.userId, userId));
    await tx.delete(practiceResults).where(eq(practiceResults.userId, userId));
    await tx.delete(practiceBlocks).where(eq(practiceBlocks.userId, userId));
    await tx.delete(practicePlans).where(eq(practicePlans.userId, userId));
    await tx.delete(practiceSessions).where(eq(practiceSessions.userId, userId));
    await tx.delete(golfTrainingSessions).where(eq(golfTrainingSessions.userId, userId));
    await tx.delete(speedTrainingSwings).where(eq(speedTrainingSwings.userId, userId));
    await tx.delete(speedTrainingGoals).where(eq(speedTrainingGoals.userId, userId));
    await tx.delete(speedTrainingSessions).where(eq(speedTrainingSessions.userId, userId));
    await tx.delete(tournamentComments).where(eq(tournamentComments.userId, userId));
    await tx.delete(tournamentStandings).where(eq(tournamentStandings.userId, userId));
    await tx.delete(tournamentSubmissions).where(eq(tournamentSubmissions.userId, userId));
    await tx.delete(tournamentEntries).where(eq(tournamentEntries.userId, userId));
    await tx.delete(analysisAnnotations).where(eq(analysisAnnotations.userId, userId));
    await tx.delete(analysisSnapshots).where(eq(analysisSnapshots.userId, userId));
    await tx.delete(shotSavedViews).where(eq(shotSavedViews.userId, userId));
    await tx.delete(contentExports).where(eq(contentExports.userId, userId));
    await tx.delete(weatherSnapshots).where(eq(weatherSnapshots.userId, userId));
    await tx.delete(feedCommentReactions).where(eq(feedCommentReactions.userId, userId));
    await tx.delete(feedReactions).where(eq(feedReactions.userId, userId));
    await tx.delete(feedComments).where(eq(feedComments.userId, userId));
    await tx.delete(feedItems).where(eq(feedItems.userId, userId));
    await tx.delete(strokesGainedShotEvents).where(eq(strokesGainedShotEvents.userId, userId));
    await tx.delete(userAchievements).where(eq(userAchievements.userId, userId));
    await tx.delete(xpLedger).where(eq(xpLedger.userId, userId));
    await tx.delete(achievementProgress).where(eq(achievementProgress.userId, userId));
    await tx.delete(achievementSyncState).where(eq(achievementSyncState.userId, userId));
    await tx.delete(rapsodoSyncSessions).where(eq(rapsodoSyncSessions.userId, userId));
    await tx.delete(stockYardages).where(eq(stockYardages.userId, userId));
    await tx.delete(clubEquipmentHistory).where(eq(clubEquipmentHistory.userId, userId));
    await tx.delete(ballModels).where(eq(ballModels.userId, userId));
    await tx.delete(importFiles).where(eq(importFiles.userId, userId));
    await tx.delete(importRows).where(eq(importRows.userId, userId));
    await tx.delete(shots).where(eq(shots.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(clubs).where(eq(clubs.userId, userId));
    await tx
      .update(users)
      .set({ onboardingCompletedAt: null, dashboardPins: [], updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.delete(userFeaturePreferences).where(eq(userFeaturePreferences.userId, userId));
  });

  revalidatePath("/", "layout");
  redirect("/settings?section=danger&reset=1#danger-zone");
}

function nullableString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function settingsFormSection(value: FormDataEntryValue | null) {
  return value === "appearance" || value === "privacy" ? value : "general";
}
