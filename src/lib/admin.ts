import "server-only";

import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";

import {
  adminAuditLog,
  adminUsers,
  aiSocialSummaries,
  billingCustomers,
  challengeAttempts,
  challengeEntries,
  challengeResults,
  challengeTemplates,
  challenges,
  entitlements,
  feedComments,
  feedItems,
  friendRequests,
  friendships,
  groups,
  importJobs,
  moderationEvents,
  partnerOffers,
  planLimits,
  providerAccounts,
  sessions,
  shots,
  socialReports,
  sponsors,
  subscriptions,
  usageEvents,
  userProfiles,
  users,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getOptionalCurrentUserId, requireCurrentUserId } from "@/lib/current-user";
import { lifetimeFullEntitlements } from "@/lib/billing";

export type AdminRole = "owner" | "operator";

export type AdminUserListItem = {
  id: string;
  email: string | null;
  displayName: string;
  username: string | null;
  adminRole: string | null;
  adminStatus: string | null;
  activePlan: string;
  sessionCount: number;
  feedCount: number;
  createdAt: Date;
};

const activeSubscriptionStatuses = ["active", "trialing"] as const;

export async function isCurrentUserAdmin() {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return false;
  }

  const [admin] = await getDb()
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(and(eq(adminUsers.userId, userId), eq(adminUsers.status, "active")))
    .limit(1);

  return Boolean(admin);
}

export async function requireAdminUser() {
  const userId = await requireCurrentUserId();
  const [admin] = await getDb()
    .select({
      id: adminUsers.id,
      userId: adminUsers.userId,
      role: adminUsers.role,
      status: adminUsers.status,
      permissionsJson: adminUsers.permissionsJson,
    })
    .from(adminUsers)
    .where(and(eq(adminUsers.userId, userId), eq(adminUsers.status, "active")))
    .limit(1);

  if (!admin) {
    redirect("/dashboard");
  }

  return admin;
}

export async function getAdminDashboardData() {
  await requireAdminUser();
  const db = getDb();

  const userCount = await countRows(users);
  const sessionCount = await countRows(sessions);
  const shotCount = await countRows(shots);
  const feedCount = await countRows(feedItems);
  const challengeCount = await countRows(challenges);
  const openReportCount = await countRows(socialReports, eq(socialReports.status, "open"));
  const activeSubscriptionCount = await countRows(subscriptions, inArray(subscriptions.status, [...activeSubscriptionStatuses]));
  const lifetimeGrantCount = await countRows(entitlements, and(eq(entitlements.entitlementKey, "lifetime_full"), sql`${entitlements.valueJson}->>'value' = 'true'`));
  const usageEventCount = await countRows(usageEvents);
  const recentUsers = await getAdminUsers({ limit: 8 });
  const recentAuditRows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      createdAt: adminAuditLog.createdAt,
      actorEmail: users.email,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.actorUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(8);

  return {
    metrics: {
      users: userCount,
      sessions: sessionCount,
      shots: shotCount,
      feedItems: feedCount,
      challenges: challengeCount,
      openReports: openReportCount,
      activeSubscriptions: activeSubscriptionCount,
      lifetimeGrants: lifetimeGrantCount,
      usageEvents: usageEventCount,
    },
    recentUsers,
    recentAuditRows,
  };
}

export async function getAdminUsers(options: { q?: string; limit?: number } = {}): Promise<AdminUserListItem[]> {
  await requireAdminUser();
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const q = options.q?.trim();
  const where = q
    ? or(
        ilike(users.email, `%${q}%`),
        ilike(users.name, `%${q}%`),
        ilike(userProfiles.username, `%${q}%`),
        ilike(userProfiles.displayName, `%${q}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      username: userProfiles.username,
      profileDisplayName: userProfiles.displayName,
      adminRole: adminUsers.role,
      adminStatus: adminUsers.status,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(adminUsers, eq(adminUsers.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit);

  const ids = rows.map((row) => row.id);
  const sessionCounts = await countByUser(sessions.userId, sessions, ids);
  const feedCounts = await countByUser(feedItems.userId, feedItems, ids);
  const activeSubscriptions = ids.length
    ? await db
        .select({
          userId: subscriptions.userId,
          planKey: subscriptions.planKey,
          status: subscriptions.status,
          createdAt: subscriptions.createdAt,
        })
        .from(subscriptions)
        .where(and(inArray(subscriptions.userId, ids), inArray(subscriptions.status, [...activeSubscriptionStatuses])))
        .orderBy(desc(subscriptions.createdAt))
    : [];
  const fullEntitlements = ids.length
    ? await db
        .select({ userId: entitlements.userId })
        .from(entitlements)
        .where(
          and(
            inArray(entitlements.userId, ids),
            eq(entitlements.entitlementKey, "lifetime_full"),
            sql`${entitlements.valueJson}->>'value' = 'true'`,
          ),
        )
    : [];

  const sessionMap = new Map(sessionCounts.map((row) => [row.userId, row.count]));
  const feedMap = new Map(feedCounts.map((row) => [row.userId, row.count]));
  const subscriptionMap = new Map<string, string>();

  for (const subscription of activeSubscriptions) {
    if (!subscriptionMap.has(subscription.userId)) {
      subscriptionMap.set(subscription.userId, subscription.planKey);
    }
  }

  const fullGrantIds = new Set(fullEntitlements.map((row) => row.userId));

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: safeAdminDisplayName(row.profileDisplayName) ?? safeAdminDisplayName(row.name) ?? "ForeKingHell Player",
    username: row.username && !isSharedDatabaseArtifact(row.username) ? row.username : null,
    adminRole: row.adminStatus === "active" ? row.adminRole : null,
    adminStatus: row.adminStatus,
    activePlan: fullGrantIds.has(row.id) ? "full" : subscriptionMap.get(row.id) ?? "free",
    sessionCount: sessionMap.get(row.id) ?? 0,
    feedCount: feedMap.get(row.id) ?? 0,
    createdAt: row.createdAt,
  }));
}

export async function getAdminBillingData() {
  await requireAdminUser();
  const db = getDb();
  const planRows = await db.select().from(planLimits).orderBy(planLimits.planKey, planLimits.limitKey);
  const subscriptionRows = await db
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      email: users.email,
      name: users.name,
      profileDisplayName: userProfiles.displayName,
      planKey: subscriptions.planKey,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .leftJoin(users, eq(users.id, subscriptions.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, subscriptions.userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(80);
  const entitlementRows = await db
    .select({
      id: entitlements.id,
      userId: entitlements.userId,
      email: users.email,
      name: users.name,
      profileDisplayName: userProfiles.displayName,
      entitlementKey: entitlements.entitlementKey,
      source: entitlements.source,
      valueJson: entitlements.valueJson,
      expiresAt: entitlements.expiresAt,
      updatedAt: entitlements.updatedAt,
    })
    .from(entitlements)
    .leftJoin(users, eq(users.id, entitlements.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, entitlements.userId))
    .orderBy(desc(entitlements.updatedAt))
    .limit(120);

  return {
    planLimits: planRows,
    subscriptions: subscriptionRows.map((row) => ({
      ...row,
      displayName: safeAdminDisplayName(row.profileDisplayName) ?? safeAdminDisplayName(row.name) ?? "ForeKingHell Player",
    })),
    entitlements: entitlementRows.map((row) => ({
      ...row,
      displayName: safeAdminDisplayName(row.profileDisplayName) ?? safeAdminDisplayName(row.name) ?? "ForeKingHell Player",
    })),
  };
}

export async function getAdminModerationData() {
  await requireAdminUser();
  const db = getDb();
  const reports = await db
    .select({
      id: socialReports.id,
      reporterUserId: socialReports.reporterUserId,
      reportedUserId: socialReports.reportedUserId,
      targetType: socialReports.targetType,
      targetId: socialReports.targetId,
      reason: socialReports.reason,
      details: socialReports.details,
      status: socialReports.status,
      createdAt: socialReports.createdAt,
      resolvedAt: socialReports.resolvedAt,
    })
    .from(socialReports)
    .orderBy(desc(socialReports.createdAt))
    .limit(80);
  const events = await db.select().from(moderationEvents).orderBy(desc(moderationEvents.createdAt)).limit(80);

  return { reports, events };
}

export async function getAdminChallengesData() {
  await requireAdminUser();
  const db = getDb();
  const templateRows = await db.select().from(challengeTemplates).orderBy(challengeTemplates.name);
  const challengeRows = await db
    .select({
      id: challenges.id,
      templateId: challenges.templateId,
      creatorUserId: challenges.creatorUserId,
      title: challenges.title,
      visibility: challenges.visibility,
      status: challenges.status,
      startsAt: challenges.startsAt,
      endsAt: challenges.endsAt,
      createdAt: challenges.createdAt,
      templateName: challengeTemplates.name,
      creatorName: users.name,
      creatorProfileName: userProfiles.displayName,
      creatorEmail: users.email,
    })
    .from(challenges)
    .leftJoin(challengeTemplates, eq(challengeTemplates.id, challenges.templateId))
    .leftJoin(users, eq(users.id, challenges.creatorUserId))
    .leftJoin(userProfiles, eq(userProfiles.userId, challenges.creatorUserId))
    .orderBy(desc(challenges.createdAt))
    .limit(80);
  const entryCounts = await countBy(challengeEntries.challengeId, challengeEntries);
  const attemptCounts = await countBy(challengeAttempts.challengeId, challengeAttempts);
  const resultCounts = await countBy(challengeResults.challengeId, challengeResults);

  const entryMap = new Map(entryCounts.map((row) => [row.key, row.count]));
  const attemptMap = new Map(attemptCounts.map((row) => [row.key, row.count]));
  const resultMap = new Map(resultCounts.map((row) => [row.key, row.count]));

  return {
    templates: templateRows,
    challenges: challengeRows.map((row) => ({
      ...row,
      templateName: row.templateName ?? "Custom",
      creatorDisplayName: safeAdminDisplayName(row.creatorProfileName) ?? safeAdminDisplayName(row.creatorName) ?? row.creatorEmail ?? "ForeKingHell Player",
      entryCount: entryMap.get(row.id) ?? 0,
      attemptCount: attemptMap.get(row.id) ?? 0,
      resultCount: resultMap.get(row.id) ?? 0,
    })),
  };
}

export async function getAdminOperationsSnapshot() {
  await requireAdminUser();
  const groupCount = await countRows(groups);
  const friendshipCount = await countRows(friendships);
  const friendRequestCount = await countRows(friendRequests);
  const commentCount = await countRows(feedComments);
  const providerAccountCount = await countRows(providerAccounts);
  const importJobCount = await countRows(importJobs);
  const sponsorCount = await countRows(sponsors);
  const partnerOfferCount = await countRows(partnerOffers);
  const aiSummaryCount = await countRows(aiSocialSummaries);

  return {
    groups: groupCount,
    friendships: friendshipCount,
    friendRequests: friendRequestCount,
    comments: commentCount,
    providerAccounts: providerAccountCount,
    importJobs: importJobCount,
    sponsors: sponsorCount,
    partnerOffers: partnerOfferCount,
    aiSummaries: aiSummaryCount,
  };
}

export async function grantLifetimeFullAccessByEmail(email: string) {
  const admin = await requireAdminUser();
  const target = await findUserByEmail(email);

  if (!target) {
    throw new Error("No user exists for that email address.");
  }

  await grantLifetimeFullAccess(target.id, admin.userId);
  return target;
}

export async function grantAdminAccessByEmail(email: string, role: AdminRole) {
  const admin = await requireAdminUser();
  const target = await findUserByEmail(email);

  if (!target) {
    throw new Error("No user exists for that email address.");
  }

  const now = new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .insert(adminUsers)
      .values({
        userId: target.id,
        role,
        status: "active",
        permissionsJson: role === "owner" ? { all: true } : { operations: true },
        createdByUserId: admin.userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: adminUsers.userId,
        set: {
          role,
          status: "active",
          permissionsJson: role === "owner" ? { all: true } : { operations: true },
          updatedAt: now,
        },
      });

    await tx.insert(adminAuditLog).values({
      actorUserId: admin.userId,
      targetUserId: target.id,
      action: "admin_access_granted",
      targetType: "user",
      targetId: target.id,
      metadataJson: { role },
    });
  });

  return target;
}

export async function deactivateAdminAccess(targetUserId: string) {
  const admin = await requireAdminUser();

  if (targetUserId === admin.userId) {
    throw new Error("You cannot deactivate your own admin access.");
  }

  await getDb().transaction(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(adminUsers.userId, targetUserId));

    await tx.insert(adminAuditLog).values({
      actorUserId: admin.userId,
      targetUserId,
      action: "admin_access_deactivated",
      targetType: "user",
      targetId: targetUserId,
    });
  });
}

export async function resolveSocialReport(reportId: string) {
  const admin = await requireAdminUser();
  const now = new Date();

  await getDb().transaction(async (tx) => {
    await tx.update(socialReports).set({ status: "resolved", resolvedAt: now }).where(eq(socialReports.id, reportId));
    await tx.insert(adminAuditLog).values({
      actorUserId: admin.userId,
      action: "social_report_resolved",
      targetType: "social_report",
      targetId: reportId,
    });
  });
}

export async function resolveModerationEvent(eventId: string) {
  const admin = await requireAdminUser();
  const now = new Date();

  await getDb().transaction(async (tx) => {
    await tx.update(moderationEvents).set({ status: "resolved", resolvedAt: now }).where(eq(moderationEvents.id, eventId));
    await tx.insert(adminAuditLog).values({
      actorUserId: admin.userId,
      action: "moderation_event_resolved",
      targetType: "moderation_event",
      targetId: eventId,
    });
  });
}

async function grantLifetimeFullAccess(targetUserId: string, actorUserId: string) {
  const now = new Date();
  const db = getDb();

  await db.transaction(async (tx) => {
    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, targetUserId)).limit(1);
    const [customer] = await tx
      .insert(billingCustomers)
      .values({
        userId: targetUserId,
        email: user?.email ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: billingCustomers.userId,
        set: {
          email: user?.email ?? null,
          updatedAt: now,
        },
      })
      .returning();

    const [existingFullSubscription] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, targetUserId), eq(subscriptions.planKey, "full")))
      .limit(1);

    if (existingFullSubscription) {
      await tx
        .update(subscriptions)
        .set({
          billingCustomerId: customer.id,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          metadataJson: { source: "lifetime_full", grantedByUserId: actorUserId },
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existingFullSubscription.id));
    } else {
      await tx.insert(subscriptions).values({
        userId: targetUserId,
        billingCustomerId: customer.id,
        planKey: "full",
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        metadataJson: { source: "lifetime_full", grantedByUserId: actorUserId },
        updatedAt: now,
      });
    }

    for (const [entitlementKey, valueJson] of lifetimeFullEntitlements) {
      await tx
        .insert(entitlements)
        .values({
          userId: targetUserId,
          entitlementKey,
          valueJson,
          source: "lifetime",
          expiresAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [entitlements.userId, entitlements.entitlementKey],
          set: {
            valueJson,
            source: "lifetime",
            expiresAt: null,
            updatedAt: now,
          },
        });
    }

    await tx.insert(adminAuditLog).values({
      actorUserId,
      targetUserId,
      action: "lifetime_full_granted",
      targetType: "user",
      targetId: targetUserId,
      metadataJson: { entitlementCount: lifetimeFullEntitlements.length },
    });
  });
}

async function findUserByEmail(email: string) {
  const cleaned = email.trim().toLowerCase();

  if (!cleaned) {
    return null;
  }

  const [user] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(sql`lower(${users.email}) = ${cleaned}`)
    .limit(1);

  return user ?? null;
}

async function countRows(table: AnyPgTable, where?: SQL) {
  const query = getDb().select({ count: sql<number>`count(*)::int` }).from(table);
  const [row] = where ? await query.where(where) : await query;
  return Number(row?.count ?? 0);
}

async function countByUser(column: AnyPgColumn, table: AnyPgTable, userIds: string[]) {
  if (userIds.length === 0) {
    return [] as Array<{ userId: string; count: number }>;
  }

  return getDb()
    .select({
      userId: column,
      count: sql<number>`count(*)::int`,
    })
    .from(table)
    .where(inArray(column, userIds))
    .groupBy(column);
}

async function countBy(column: AnyPgColumn, table: AnyPgTable) {
  return getDb()
    .select({
      key: column,
      count: sql<number>`count(*)::int`,
    })
    .from(table)
    .groupBy(column);
}

function safeAdminDisplayName(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned && !isSharedDatabaseArtifact(cleaned) ? cleaned : null;
}

function isSharedDatabaseArtifact(value: string | null | undefined) {
  return typeof value === "string" && /\bincert\b/i.test(value);
}
