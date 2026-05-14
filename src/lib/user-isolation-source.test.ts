import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function expectAll(content: string, patterns: string[]) {
  for (const pattern of patterns) {
    expect(content).toContain(pattern);
  }
}

describe("user isolation source guards", () => {
  it("keeps bag index and bag subroutes scoped to the current user", () => {
    expectAll(source("src/app/bag/page.tsx"), [
      "const userId = await requireCurrentUserId();",
      "eq(clubs.userId, userId)",
      "eq(shots.userId, userId)",
      "eq(sessions.userId, userId)",
    ]);

    expectAll(source("src/app/bag/longest/page.tsx"), [
      "const userId = await requireCurrentUserId();",
      "eq(clubs.userId, userId)",
      "eq(shots.userId, userId)",
    ]);

    expectAll(source("src/app/bag/[clubId]/page.tsx"), [
      "const userId = await requireCurrentUserId();",
      "eq(clubs.userId, userId)",
      "eq(shots.userId, userId)",
      "eq(sessions.userId, userId)",
    ]);
  });

  it("keeps rounds and handicap sessions and shot counts scoped to the current user", () => {
    for (const path of ["src/app/rounds/page.tsx", "src/app/handicap/page.tsx"]) {
      expectAll(source(path), [
        "const userId = await requireCurrentUserId();",
        "eq(sessions.userId, userId)",
        "eq(shots.userId, userId)",
      ]);
    }
  });

  it("does not count private course metadata outside the visible course set", () => {
    const coursesPage = source("src/app/courses/page.tsx");

    expectAll(coursesPage, [
      "const visibleCourseIds = courseRows.map((course) => course.id);",
      "inArray(teeSets.courseId, visibleCourseIds)",
      "inArray(holes.courseId, visibleCourseIds)",
    ]);
  });

  it("only queries leaderboard activity for visible leaderboard participants", () => {
    const leaderboardPage = source("src/app/leaderboard/page.tsx");

    expectAll(leaderboardPage, [
      "const visibleIds = visibleProfiles.map((profile) => profile.id);",
      "inArray(xpLedger.userId, visibleIds)",
      "inArray(shots.userId, visibleIds)",
      "inArray(sessions.userId, visibleIds)",
    ]);
    expect(leaderboardPage).not.toContain("inArray(xpLedger.userId, ids)");
    expect(leaderboardPage).not.toContain("inArray(shots.userId, ids)");
    expect(leaderboardPage).not.toContain("inArray(sessions.userId, ids)");
  });

  it("keeps social feed, profile search, and challenge reads behind social visibility helpers", () => {
    const socialSource = source("src/lib/social.ts");
    const challengeSource = source("src/lib/challenges.ts");
    const feedPage = source("src/app/feed/page.tsx");
    const friendsPage = source("src/app/friends/page.tsx");

    expectAll(socialSource, [
      "await requireCurrentUserId()",
      "getBlockedUserIds",
      "canViewFeedItem",
      "canViewProfile",
      "row.publicProfile || (row.friendProfile && friendIdSet.has(row.userId))",
    ]);
    expectAll(challengeSource, [
      "await requireCurrentUserId()",
      "canViewChallenge",
      "await isBlockedBetween(viewerUserId, challenge.creatorUserId)",
      "await areFriends(viewerUserId, challenge.creatorUserId)",
    ]);
    expect(feedPage).toContain("getFeedPageData");
    expect(friendsPage).toContain("getFriendsPageData");
  });

  it("keeps groups, billing, providers, offers, and AI social data user scoped", () => {
    const groupsSource = source("src/lib/groups.ts");
    const billingSource = source("src/lib/billing.ts");
    const providersSource = source("src/lib/provider-integrations.ts");
    const partnersSource = source("src/lib/partners.ts");
    const intelligenceSource = source("src/lib/social-intelligence.ts");
    const exportRoute = source("src/app/api/settings/export/route.ts");
    const settingsActions = source("src/app/settings/actions.ts");
    const partnerActions = source("src/app/partners/actions.ts");

    expectAll(groupsSource, [
      "await requireCurrentUserId()",
      "canViewGroup",
      "isGroupMember",
      "eq(groups.ownerUserId, userId)",
      "eq(groupMemberships.userId, userId)",
    ]);
    expectAll(billingSource, [
      "await requireCurrentUserId()",
      "eq(subscriptions.userId, userId)",
      "eq(entitlements.userId, userId)",
      "eq(billingCustomers.userId, userId)",
    ]);
    expectAll(providersSource, [
      "await requireCurrentUserId()",
      "eq(providerAccounts.userId, userId)",
      "eq(providerSessions.userId, userId)",
      "eq(importJobs.userId, userId)",
    ]);
    expectAll(partnersSource, [
      "await requireCurrentUserId()",
      "eq(offerClicks.userId, userId)",
      "ownerUserId: userId",
    ]);
    expectAll(intelligenceSource, [
      "await requireCurrentUserId()",
      "eq(aiSocialSummaries.userId, userId)",
      "reporterUserId: userId",
      "reportedUserId",
    ]);
    expectAll(exportRoute, [
      "aiSocialSummaries",
      "billingCustomers",
      "groupMemberships",
      "providerSessions",
      "socialReports",
    ]);
    expectAll(settingsActions, [
      "await tx.delete(aiSocialSummaries).where(eq(aiSocialSummaries.userId, userId));",
      "await tx.delete(providerSessions).where(eq(providerSessions.userId, userId));",
      "await tx.delete(groupMemberships).where(eq(groupMemberships.userId, userId));",
      "await tx.delete(billingCustomers).where(eq(billingCustomers.userId, userId));",
    ]);
    expect(partnerActions).toContain("safeExternalUrl");
    expect(partnerActions).toContain("url.protocol === \"https:\" || url.protocol === \"http:\"");
  });

  it("requires auth in app API routes that handle private data or external lookups", () => {
    for (const path of [
      "src/app/api/coach/chat/route.ts",
      "src/app/api/coach/summary/route.ts",
      "src/app/api/courses/osm/holes/route.ts",
      "src/app/api/courses/osm/search/route.ts",
      "src/app/api/offline/imports/route.ts",
      "src/app/api/offline/round-edits/route.ts",
      "src/app/api/scorecard/extract/route.ts",
      "src/app/api/settings/export/route.ts",
    ]) {
      expect(source(path)).toContain("getOptionalCurrentUserId");
    }
  });

  it("does not expose a service-role client behind an ambiguous server-client alias", () => {
    const supabaseServer = source("src/lib/supabase/server.ts");

    expect(supabaseServer).toContain("getSupabaseServiceRoleClient");
    expect(supabaseServer).not.toContain("getSupabaseServerClient = getSupabaseServiceRoleClient");
  });
});
