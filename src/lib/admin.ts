import "server-only";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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

type AdminOperationsSnapshot = {
  groups: number;
  friendships: number;
  friendRequests: number;
  comments: number;
  providerAccounts: number;
  importJobs: number;
  sponsors: number;
  partnerOffers: number;
  aiSummaries: number;
  billingFailures: number;
  providerImportFailures: number;
};

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

export async function requireAdminOwner() {
  const admin = await requireAdminUser();

  if (admin.role !== "owner") {
    throw new Error("Owner access is required.");
  }

  return admin;
}

export async function getAdminOverviewData() {
  await requireAdminUser();

  const [metrics, recentUsers, recentAuditRows] = await Promise.all([
    getAdminOverviewMetrics(),
    getRecentAdminOverviewUsers(8),
    getRecentAdminAuditRows(8),
  ]);

  return {
    data: {
      metrics: {
        users: metrics.userCount,
        sessions: metrics.sessionCount,
        shots: metrics.shotCount,
        feedItems: metrics.feedCount,
        challenges: metrics.challengeCount,
        openReports: metrics.openReportCount,
        activeSubscriptions: metrics.activeSubscriptionCount,
        lifetimeGrants: metrics.lifetimeGrantCount,
        usageEvents: metrics.usageEventCount,
      },
      recentUsers,
      recentAuditRows,
    },
    operations: adminOperationsFromMetrics(metrics),
  };
}

export async function getAdminDashboardData() {
  await requireAdminUser();
  const db = getDb();

  const [metrics, recentUsers, recentAuditRows] = await Promise.all([
    getAdminDashboardMetrics(),
    getAdminUsers({ limit: 8 }),
    db
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
      .limit(8),
  ]);

  return {
    metrics: {
      users: metrics.userCount,
      sessions: metrics.sessionCount,
      shots: metrics.shotCount,
      feedItems: metrics.feedCount,
      challenges: metrics.challengeCount,
      openReports: metrics.openReportCount,
      activeSubscriptions: metrics.activeSubscriptionCount,
      lifetimeGrants: metrics.lifetimeGrantCount,
      usageEvents: metrics.usageEventCount,
    },
    recentUsers,
    recentAuditRows,
  };
}

export async function getAdminUsers(
  options: { q?: string; limit?: number } = {},
): Promise<AdminUserListItem[]> {
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
        .where(
          and(
            inArray(subscriptions.userId, ids),
            inArray(subscriptions.status, [...activeSubscriptionStatuses]),
          ),
        )
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
    displayName:
      safeAdminDisplayName(row.profileDisplayName) ??
      safeAdminDisplayName(row.name) ??
      "LM World Tour Player",
    username: row.username && !isSharedDatabaseArtifact(row.username) ? row.username : null,
    adminRole: row.adminStatus === "active" ? row.adminRole : null,
    adminStatus: row.adminStatus,
    activePlan: fullGrantIds.has(row.id) ? "full" : (subscriptionMap.get(row.id) ?? "free"),
    sessionCount: sessionMap.get(row.id) ?? 0,
    feedCount: feedMap.get(row.id) ?? 0,
    createdAt: row.createdAt,
  }));
}

export async function getAdminBillingData() {
  await requireAdminUser();
  const db = getDb();
  const planRows = await db
    .select()
    .from(planLimits)
    .orderBy(planLimits.planKey, planLimits.limitKey);
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
      displayName:
        safeAdminDisplayName(row.profileDisplayName) ??
        safeAdminDisplayName(row.name) ??
        "LM World Tour Player",
    })),
    entitlements: entitlementRows.map((row) => ({
      ...row,
      displayName:
        safeAdminDisplayName(row.profileDisplayName) ??
        safeAdminDisplayName(row.name) ??
        "LM World Tour Player",
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
  const events = await db
    .select()
    .from(moderationEvents)
    .orderBy(desc(moderationEvents.createdAt))
    .limit(80);

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
      creatorDisplayName:
        safeAdminDisplayName(row.creatorProfileName) ??
        safeAdminDisplayName(row.creatorName) ??
        row.creatorEmail ??
        "LM World Tour Player",
      entryCount: entryMap.get(row.id) ?? 0,
      attemptCount: attemptMap.get(row.id) ?? 0,
      resultCount: resultMap.get(row.id) ?? 0,
    })),
  };
}

export async function getAdminOperationsSnapshot() {
  await requireAdminUser();
  const metrics = await getAdminOperationsMetrics();

  return adminOperationsFromMetrics(metrics);
}

export async function grantLifetimeFullAccessByEmail(email: string) {
  const admin = await requireAdminOwner();
  const target = await findUserByEmail(email);

  if (!target) {
    throw new Error("No user exists for that email address.");
  }

  await grantLifetimeFullAccess(target.id, admin.userId);
  return target;
}

export async function grantAdminAccessByEmail(email: string, role: AdminRole) {
  const admin = role === "owner" ? await requireAdminOwner() : await requireAdminUser();
  const target = await findUserByEmail(email);

  if (!target) {
    throw new Error("No user exists for that email address.");
  }

  const now = new Date();
  await getDb().transaction(async (tx) => {
    if (role === "owner") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('fkh_admin_owner_guard'))`);
    }

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
  const admin = await requireAdminOwner();

  if (targetUserId === admin.userId) {
    throw new Error("You cannot deactivate your own admin access.");
  }

  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('fkh_admin_owner_guard'))`);
    const [target] = await tx
      .select({ role: adminUsers.role, status: adminUsers.status })
      .from(adminUsers)
      .where(eq(adminUsers.userId, targetUserId))
      .limit(1);

    if (!target || target.status !== "active") {
      throw new Error("Active admin access was not found.");
    }

    if (target.role === "owner") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(adminUsers)
        .where(and(eq(adminUsers.role, "owner"), eq(adminUsers.status, "active")));

      if (Number(count ?? 0) <= 1) {
        throw new Error("The last active owner cannot be deactivated.");
      }
    }

    await tx
      .update(adminUsers)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(adminUsers.userId, targetUserId), eq(adminUsers.status, "active")));

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
    await tx
      .update(socialReports)
      .set({ status: "resolved", resolvedAt: now })
      .where(eq(socialReports.id, reportId));
    await tx.insert(adminAuditLog).values({
      actorUserId: admin.userId,
      action: "social_report_resolved",
      targetType: "social_report",
      targetId: reportId,
    });
  });
}

export async function bulkResolveSocialReports(reportIds: string[]) {
  const ids = normalizeAdminIds(reportIds);

  if (ids.length === 0) {
    throw new Error("Select at least one open report.");
  }

  const admin = await requireAdminUser();
  const now = new Date();

  return getDb().transaction(async (tx) => {
    const openReports = await tx
      .select({ id: socialReports.id })
      .from(socialReports)
      .where(and(inArray(socialReports.id, ids), eq(socialReports.status, "open")));
    const openIds = openReports.map((report) => report.id);

    if (openIds.length === 0) {
      throw new Error("No selected open reports could be resolved.");
    }

    await tx
      .update(socialReports)
      .set({ status: "resolved", resolvedAt: now })
      .where(and(inArray(socialReports.id, openIds), eq(socialReports.status, "open")));

    await tx.insert(adminAuditLog).values(
      openIds.map((reportId) => ({
        actorUserId: admin.userId,
        action: "social_report_resolved",
        targetType: "social_report",
        targetId: reportId,
        metadataJson: { bulkCount: openIds.length },
      })),
    );

    return openIds.length;
  });
}

export async function resolveModerationEvent(eventId: string) {
  const admin = await requireAdminUser();
  const now = new Date();

  await getDb().transaction(async (tx) => {
    await tx
      .update(moderationEvents)
      .set({ status: "resolved", resolvedAt: now })
      .where(eq(moderationEvents.id, eventId));
    await tx.insert(adminAuditLog).values({
      actorUserId: admin.userId,
      action: "moderation_event_resolved",
      targetType: "moderation_event",
      targetId: eventId,
    });
  });
}

export async function bulkResolveModerationEvents(eventIds: string[]) {
  const ids = normalizeAdminIds(eventIds);

  if (ids.length === 0) {
    throw new Error("Select at least one open moderation event.");
  }

  const admin = await requireAdminUser();
  const now = new Date();

  return getDb().transaction(async (tx) => {
    const openEvents = await tx
      .select({ id: moderationEvents.id })
      .from(moderationEvents)
      .where(and(inArray(moderationEvents.id, ids), eq(moderationEvents.status, "open")));
    const openIds = openEvents.map((event) => event.id);

    if (openIds.length === 0) {
      throw new Error("No selected open moderation events could be resolved.");
    }

    await tx
      .update(moderationEvents)
      .set({ status: "resolved", resolvedAt: now })
      .where(and(inArray(moderationEvents.id, openIds), eq(moderationEvents.status, "open")));

    await tx.insert(adminAuditLog).values(
      openIds.map((eventId) => ({
        actorUserId: admin.userId,
        action: "moderation_event_resolved",
        targetType: "moderation_event",
        targetId: eventId,
        metadataJson: { bulkCount: openIds.length },
      })),
    );

    return openIds.length;
  });
}

function normalizeAdminIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 100);
}

async function grantLifetimeFullAccess(targetUserId: string, actorUserId: string) {
  const now = new Date();
  const db = getDb();

  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
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

async function getAdminDashboardMetrics() {
  const rows = await getDb().execute<{
    userCount: number;
    sessionCount: number;
    shotCount: number;
    feedCount: number;
    challengeCount: number;
    openReportCount: number;
    activeSubscriptionCount: number;
    lifetimeGrantCount: number;
    usageEventCount: number;
  }>(sql`
    select
      (select count(*)::int from ${users}) as "userCount",
      (select count(*)::int from ${sessions}) as "sessionCount",
      (select count(*)::int from ${shots}) as "shotCount",
      (select count(*)::int from ${feedItems}) as "feedCount",
      (select count(*)::int from ${challenges}) as "challengeCount",
      (select count(*)::int from ${socialReports} where ${socialReports.status} = 'open') as "openReportCount",
      (select count(*)::int from ${subscriptions} where ${subscriptions.status} in ('active', 'trialing')) as "activeSubscriptionCount",
      (select count(*)::int from ${entitlements} where ${entitlements.entitlementKey} = 'lifetime_full' and ${entitlements.valueJson}->>'value' = 'true') as "lifetimeGrantCount",
      (select count(*)::int from ${usageEvents}) as "usageEventCount"
  `);
  const row = rows[0];

  return {
    userCount: Number(row?.userCount ?? 0),
    sessionCount: Number(row?.sessionCount ?? 0),
    shotCount: Number(row?.shotCount ?? 0),
    feedCount: Number(row?.feedCount ?? 0),
    challengeCount: Number(row?.challengeCount ?? 0),
    openReportCount: Number(row?.openReportCount ?? 0),
    activeSubscriptionCount: Number(row?.activeSubscriptionCount ?? 0),
    lifetimeGrantCount: Number(row?.lifetimeGrantCount ?? 0),
    usageEventCount: Number(row?.usageEventCount ?? 0),
  };
}

async function getAdminOverviewMetrics() {
  const rows = await getDb().execute<{
    userCount: number;
    sessionCount: number;
    shotCount: number;
    feedCount: number;
    challengeCount: number;
    openReportCount: number;
    activeSubscriptionCount: number;
    lifetimeGrantCount: number;
    usageEventCount: number;
    groupCount: number;
    friendshipCount: number;
    friendRequestCount: number;
    commentCount: number;
    providerAccountCount: number;
    importJobCount: number;
    sponsorCount: number;
    partnerOfferCount: number;
    aiSummaryCount: number;
    billingFailureCount: number;
    providerImportFailureCount: number;
  }>(sql`
    select
      (select count(*)::int from ${users}) as "userCount",
      (select count(*)::int from ${sessions}) as "sessionCount",
      (select count(*)::int from ${shots}) as "shotCount",
      (select count(*)::int from ${feedItems}) as "feedCount",
      (select count(*)::int from ${challenges}) as "challengeCount",
      (select count(*)::int from ${socialReports} where ${socialReports.status} = 'open') as "openReportCount",
      (select count(*)::int from ${subscriptions} where ${subscriptions.status} in ('active', 'trialing')) as "activeSubscriptionCount",
      (select count(*)::int from ${entitlements} where ${entitlements.entitlementKey} = 'lifetime_full' and ${entitlements.valueJson}->>'value' = 'true') as "lifetimeGrantCount",
      (select count(*)::int from ${usageEvents}) as "usageEventCount",
      (select count(*)::int from ${groups}) as "groupCount",
      (select count(*)::int from ${friendships}) as "friendshipCount",
      (select count(*)::int from ${friendRequests}) as "friendRequestCount",
      (select count(*)::int from ${feedComments}) as "commentCount",
      (select count(*)::int from ${providerAccounts}) as "providerAccountCount",
      (select count(*)::int from ${importJobs}) as "importJobCount",
      (select count(*)::int from ${sponsors}) as "sponsorCount",
      (select count(*)::int from ${partnerOffers}) as "partnerOfferCount",
      (select count(*)::int from ${aiSocialSummaries}) as "aiSummaryCount",
      (select count(*)::int from ${subscriptions} where ${subscriptions.status} in ('past_due', 'unpaid', 'incomplete_expired')) as "billingFailureCount",
      (select count(*)::int from ${importJobs} where ${importJobs.status} = 'failed') as "providerImportFailureCount"
  `);
  const row = rows[0];

  return {
    userCount: Number(row?.userCount ?? 0),
    sessionCount: Number(row?.sessionCount ?? 0),
    shotCount: Number(row?.shotCount ?? 0),
    feedCount: Number(row?.feedCount ?? 0),
    challengeCount: Number(row?.challengeCount ?? 0),
    openReportCount: Number(row?.openReportCount ?? 0),
    activeSubscriptionCount: Number(row?.activeSubscriptionCount ?? 0),
    lifetimeGrantCount: Number(row?.lifetimeGrantCount ?? 0),
    usageEventCount: Number(row?.usageEventCount ?? 0),
    groupCount: Number(row?.groupCount ?? 0),
    friendshipCount: Number(row?.friendshipCount ?? 0),
    friendRequestCount: Number(row?.friendRequestCount ?? 0),
    commentCount: Number(row?.commentCount ?? 0),
    providerAccountCount: Number(row?.providerAccountCount ?? 0),
    importJobCount: Number(row?.importJobCount ?? 0),
    sponsorCount: Number(row?.sponsorCount ?? 0),
    partnerOfferCount: Number(row?.partnerOfferCount ?? 0),
    aiSummaryCount: Number(row?.aiSummaryCount ?? 0),
    billingFailureCount: Number(row?.billingFailureCount ?? 0),
    providerImportFailureCount: Number(row?.providerImportFailureCount ?? 0),
  };
}

async function getAdminOperationsMetrics() {
  const rows = await getDb().execute<{
    groupCount: number;
    friendshipCount: number;
    friendRequestCount: number;
    commentCount: number;
    providerAccountCount: number;
    importJobCount: number;
    sponsorCount: number;
    partnerOfferCount: number;
    aiSummaryCount: number;
    billingFailureCount: number;
    providerImportFailureCount: number;
  }>(sql`
    select
      (select count(*)::int from ${groups}) as "groupCount",
      (select count(*)::int from ${friendships}) as "friendshipCount",
      (select count(*)::int from ${friendRequests}) as "friendRequestCount",
      (select count(*)::int from ${feedComments}) as "commentCount",
      (select count(*)::int from ${providerAccounts}) as "providerAccountCount",
      (select count(*)::int from ${importJobs}) as "importJobCount",
      (select count(*)::int from ${sponsors}) as "sponsorCount",
      (select count(*)::int from ${partnerOffers}) as "partnerOfferCount",
      (select count(*)::int from ${aiSocialSummaries}) as "aiSummaryCount",
      (select count(*)::int from ${subscriptions} where ${subscriptions.status} in ('past_due', 'unpaid', 'incomplete_expired')) as "billingFailureCount",
      (select count(*)::int from ${importJobs} where ${importJobs.status} = 'failed') as "providerImportFailureCount"
  `);
  const row = rows[0];

  return {
    groupCount: Number(row?.groupCount ?? 0),
    friendshipCount: Number(row?.friendshipCount ?? 0),
    friendRequestCount: Number(row?.friendRequestCount ?? 0),
    commentCount: Number(row?.commentCount ?? 0),
    providerAccountCount: Number(row?.providerAccountCount ?? 0),
    importJobCount: Number(row?.importJobCount ?? 0),
    sponsorCount: Number(row?.sponsorCount ?? 0),
    partnerOfferCount: Number(row?.partnerOfferCount ?? 0),
    aiSummaryCount: Number(row?.aiSummaryCount ?? 0),
    billingFailureCount: Number(row?.billingFailureCount ?? 0),
    providerImportFailureCount: Number(row?.providerImportFailureCount ?? 0),
  };
}

async function getRecentAdminOverviewUsers(limit: number): Promise<AdminUserListItem[]> {
  const db = getDb();
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
        .where(
          and(
            inArray(subscriptions.userId, ids),
            inArray(subscriptions.status, [...activeSubscriptionStatuses]),
          ),
        )
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
  const subscriptionMap = new Map<string, string>();
  const sessionMap = new Map(sessionCounts.map((row) => [row.userId, row.count]));
  const feedMap = new Map(feedCounts.map((row) => [row.userId, row.count]));

  for (const subscription of activeSubscriptions) {
    if (!subscriptionMap.has(subscription.userId)) {
      subscriptionMap.set(subscription.userId, subscription.planKey);
    }
  }

  const fullGrantIds = new Set(fullEntitlements.map((row) => row.userId));

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName:
      safeAdminDisplayName(row.profileDisplayName) ??
      safeAdminDisplayName(row.name) ??
      "LM World Tour Player",
    username: row.username && !isSharedDatabaseArtifact(row.username) ? row.username : null,
    adminRole: row.adminStatus === "active" ? row.adminRole : null,
    adminStatus: row.adminStatus,
    activePlan: fullGrantIds.has(row.id) ? "full" : (subscriptionMap.get(row.id) ?? "free"),
    sessionCount: sessionMap.get(row.id) ?? 0,
    feedCount: feedMap.get(row.id) ?? 0,
    createdAt: row.createdAt,
  }));
}

async function getRecentAdminAuditRows(limit: number) {
  return getDb()
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
    .limit(limit);
}

function adminOperationsFromMetrics(metrics: {
  groupCount: number;
  friendshipCount: number;
  friendRequestCount: number;
  commentCount: number;
  providerAccountCount: number;
  importJobCount: number;
  sponsorCount: number;
  partnerOfferCount: number;
  aiSummaryCount: number;
  billingFailureCount: number;
  providerImportFailureCount: number;
}): AdminOperationsSnapshot {
  return {
    groups: metrics.groupCount,
    friendships: metrics.friendshipCount,
    friendRequests: metrics.friendRequestCount,
    comments: metrics.commentCount,
    providerAccounts: metrics.providerAccountCount,
    importJobs: metrics.importJobCount,
    sponsors: metrics.sponsorCount,
    partnerOffers: metrics.partnerOfferCount,
    aiSummaries: metrics.aiSummaryCount,
    billingFailures: metrics.billingFailureCount,
    providerImportFailures: metrics.providerImportFailureCount,
  };
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
