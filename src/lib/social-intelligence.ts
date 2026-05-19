import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { aiSocialSummaries, feedItems, moderationEvents, socialReports } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { ensureSocialProfileForUser, parseVisibility, type SocialVisibility } from "@/lib/social";

export async function getSocialIntelligencePageData() {
  const userId = await requireCurrentUserId();
  const [summaries, reports, moderation, recentFeed] = await Promise.all([
    getDb()
      .select()
      .from(aiSocialSummaries)
      .where(eq(aiSocialSummaries.userId, userId))
      .orderBy(desc(aiSocialSummaries.createdAt))
      .limit(20),
    getDb()
      .select()
      .from(socialReports)
      .where(eq(socialReports.reporterUserId, userId))
      .orderBy(desc(socialReports.createdAt))
      .limit(20),
    getDb()
      .select()
      .from(moderationEvents)
      .where(eq(moderationEvents.actorUserId, userId))
      .orderBy(desc(moderationEvents.createdAt))
      .limit(20),
    getDb()
      .select()
      .from(feedItems)
      .where(eq(feedItems.userId, userId))
      .orderBy(desc(feedItems.createdAt))
      .limit(12),
  ]);

  return {
    summaries,
    reports,
    moderation,
    recentFeed,
  };
}

export async function generateSocialSummary(input: {
  summaryType: "import_recap" | "friend_comparison" | "challenge_coach" | "tournament_recap";
  visibility: SocialVisibility;
}) {
  const userId = await requireCurrentUserId();
  const profile = await ensureSocialProfileForUser(userId);
  const recentFeed = await getDb()
    .select()
    .from(feedItems)
    .where(eq(feedItems.userId, userId))
    .orderBy(desc(feedItems.createdAt))
    .limit(8);
  const headline = headlineForSummary(input.summaryType, profile.displayName);
  const body = bodyForSummary(input.summaryType, recentFeed);

  await getDb()
    .insert(aiSocialSummaries)
    .values({
      userId,
      summaryType: input.summaryType,
      headline,
      body,
      evidenceJson: {
        feedItemIds: recentFeed.map((item) => item.id),
        generatedFrom: "rules-v1",
      },
      visibility: parseVisibility(input.visibility, "private"),
      model: "rules-v1",
      updatedAt: new Date(),
    });

  revalidateSocialIntelligence();
}

export async function reportSocialTarget(input: {
  targetType: string;
  targetId: string;
  reason: string;
  details?: string | null;
  reportedUserId?: string | null;
}) {
  const userId = await requireCurrentUserId();
  const severity = classifySeverity(`${input.reason} ${input.details ?? ""}`);

  await getDb().transaction(async (tx) => {
    await tx.insert(socialReports).values({
      reporterUserId: userId,
      reportedUserId: input.reportedUserId ?? null,
      targetType: input.targetType.slice(0, 60),
      targetId: input.targetId.slice(0, 220),
      reason: input.reason.slice(0, 120),
      details: input.details?.slice(0, 1200) ?? null,
    });
    await tx.insert(moderationEvents).values({
      targetType: input.targetType.slice(0, 60),
      targetId: input.targetId.slice(0, 220),
      actorUserId: userId,
      eventType: "user_report",
      severity,
      status: "open",
      reason: input.reason.slice(0, 120),
      metadataJson: {
        reportReason: input.reason,
      },
    });
  });

  revalidateSocialIntelligence();
}

export async function socialSafetyStats() {
  const userId = await requireCurrentUserId();
  const [openReports] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(socialReports)
    .where(eq(socialReports.reporterUserId, userId));

  return {
    reportsCreated: openReports?.value ?? 0,
  };
}

function headlineForSummary(type: string, displayName: string) {
  switch (type) {
    case "friend_comparison":
      return `${displayName}'s friend comparison`;
    case "challenge_coach":
      return `${displayName}'s challenge coach note`;
    case "tournament_recap":
      return `${displayName}'s tournament recap`;
    default:
      return `${displayName}'s latest improvement recap`;
  }
}

function bodyForSummary(type: string, recentFeed: Array<typeof feedItems.$inferSelect>) {
  const latest = recentFeed[0];

  if (!latest) {
    return "Import a Rapsodo session, join a challenge or complete a round to generate a richer social summary.";
  }

  if (type === "challenge_coach") {
    return `Use your latest ${latest.itemType.replace(/_/g, " ")} as the baseline. Keep the attempt verified, avoid chasing distance only, and aim for consistency before one-off speed.`;
  }

  if (type === "friend_comparison") {
    return `Your latest visible signal is ${latest.headline}. Compare patterns by accuracy, consistency and improvement, not just longest drive.`;
  }

  if (type === "tournament_recap") {
    return `Recent social activity is led by ${latest.headline}. Recaps should highlight the winner, most improved player and best verified moment.`;
  }

  return `Latest signal: ${latest.headline}. The next useful social share is a verified PB, challenge attempt or practice milestone with privacy kept at your profile default.`;
}

function classifySeverity(text: string) {
  const lower = text.toLowerCase();

  if (/\b(abuse|threat|hate|harassment|violent|dox|doxx)\b/.test(lower)) {
    return "high";
  }

  if (/\b(spam|scam|fake|cheat|suspicious)\b/.test(lower)) {
    return "medium";
  }

  return "low";
}

function revalidateSocialIntelligence() {
  revalidatePath("/social-intelligence");
  revalidatePath("/feed");
}
