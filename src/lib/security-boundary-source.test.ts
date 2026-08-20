import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("security boundary source guards", () => {
  it("keeps owner delegation, deactivation, and lifetime grants owner-only", () => {
    const admin = source("src/lib/admin.ts");

    expect(admin).toContain("export async function requireAdminOwner()");
    expect(admin).toContain(
      'const admin = role === "owner" ? await requireAdminOwner() : await requireAdminUser();',
    );
    expect(admin).toContain("const admin = await requireAdminOwner();");
    expect(admin).toContain("The last active owner cannot be deactivated.");
    expect(admin).toContain("pg_advisory_xact_lock");
  });

  it("authorizes course feature regeneration and exact tee ownership", () => {
    const route = source("src/app/api/courses/[courseId]/features/ensure/route.ts");
    const actions = source("src/app/courses/actions.ts");

    expect(route).toContain("course.createdByUserId !== userId");
    expect(route).toContain("eq(adminUsers.status,");
    expect(route).toContain('keyPrefix: "course-feature-regeneration"');
    expect(actions).toContain("eq(teeSets.id, teeSetId)");
    expect(actions).toContain("eq(teeSets.courseId, courseId)");
    expect(actions).toContain("Tee set not found for this course.");
  });

  it("requires an owned ball model before equipment history is stored", () => {
    const actions = source("src/app/equipment/actions.ts");

    expect(actions).toContain("eq(ballModels.id, ballModelId)");
    expect(actions).toContain("eq(ballModels.userId, userId)");
    expect(actions).toContain("Ball model not found for this account.");
  });

  it("keeps player comparison explicit, field-scoped, and block-aware", () => {
    const compare = source("src/lib/compare-data.ts");

    expect(compare).toContain("canUseProfileForPlayerCompare");
    expect(compare).toContain("settings.allowCompare !== true");
    expect(compare).toContain('["exactShots", "rounds", "bag", "handicap"]');
    expect(compare).toContain("input.blockedIds.has(input.profile.userId)");
    expect(compare).toContain("eq(tournamentStandings.userId, viewerUserId)");
    expect(compare).toContain("eq(tournamentSubmissions.userId, viewerUserId)");
  });

  it("locks identity links to server writes and same-email canonical identities", () => {
    const migration = source("drizzle/0040_security_integrity_lockdown.sql");
    const currentUser = source("src/lib/current-user.ts");

    expect(migration).toContain("REVOKE ALL PRIVILEGES ON TABLE public.fkh_user_identity_links");
    expect(migration).toContain("fkh_validate_identity_link_emails");
    expect(migration).toContain("IF NEW.status = 'active' THEN");
    expect(migration).toContain("SET status = 'invalid_email'");
    expect(currentUser).toContain("lower(coalesce(${users.email}, '')) = lower(${authUser.email})");
  });

  it("keeps course follows visible and personal without mutating the global alias catalogue", () => {
    const features = source("src/lib/feature-ideas.ts");
    const followFunction = features.slice(
      features.indexOf("export async function followCourse"),
      features.indexOf("export async function updateFeaturePreferences"),
    );

    expect(followFunction).toContain('eq(courses.visibility, "shared")');
    expect(followFunction).toContain("eq(courses.createdByUserId, userId)");
    expect(followFunction).not.toContain(".insert(courseProviderAliases)");
    expect(features).toContain("const visibleFollows = follows.filter");
  });

  it("makes webhook state replay-safe and AI credit reservations atomic", () => {
    const stripe = source("src/lib/stripe-webhook.ts");
    const aiUsage = source("src/lib/ai/usage.ts");

    expect(stripe).toContain("claimEvent");
    expect(stripe).toContain('reason: "duplicate_event"');
    expect(stripe).toContain("lastStripeEventCreatedAt");
    expect(stripe).toContain('"stale_event_ignored"');
    expect(aiUsage).toContain("pg_advisory_xact_lock");
    expect(aiUsage).toContain('status: "reserved"');
    expect(aiUsage).toContain("finalizeAiCreditReservation");
  });

  it("keeps ordinary billing reads compatible while webhook columns are deployed", () => {
    const billing = source("src/lib/billing.ts");

    expect(billing).toContain("planKey: subscriptions.planKey");
    expect(billing).toContain("status: subscriptions.status");
    expect(billing).not.toContain(".select()\n    .from(subscriptions)");
  });

  it("routes shot imports, reviews, and destructive cleanup through the server database", () => {
    const databaseClient = source("src/db/client.ts");
    const reviewActions = source("src/app/(app)/shots/actions.ts");
    const importStore = source("src/lib/imports/save-rapsodo-import.ts");
    const settingsActions = source("src/app/settings/actions.ts");

    expect(databaseClient).toContain('import "server-only"');
    expect(databaseClient).toContain("process.env.DATABASE_URL");
    expect(reviewActions).toContain('import { getDb } from "@/db/client"');
    expect(reviewActions).toContain("getDb().transaction(async (tx) =>");
    expect(reviewActions).toContain(".update(shots)");
    expect(reviewActions).toContain("tx.insert(shotReviewEvents)");
    expect(importStore).toContain('import { getDb } from "@/db/client"');
    expect(importStore).toContain("db.transaction(async (tx) =>");
    expect(importStore).toContain("tx.insert(shots)");
    expect(importStore).toContain("tx.insert(shotReviewEvents)");
    expect(settingsActions).toContain('import { getDb } from "@/db/client"');
    expect(settingsActions).toContain("await tx.delete(shots)");
    expect(settingsActions).toContain("await tx.delete(sessions)");
  });

  it("builds external links only from a configured trusted origin", () => {
    const origin = source("src/lib/site-origin.ts");
    const login = source("src/app/login/actions.ts");

    expect(origin).toContain("NEXT_PUBLIC_SITE_URL");
    expect(origin).toContain("VERCEL_PROJECT_PRODUCTION_URL");
    expect(origin).not.toContain("x-forwarded-host");
    expect(login).toContain("getSiteOrigin()");
    expect(login).not.toContain("x-forwarded-host");
  });
});
