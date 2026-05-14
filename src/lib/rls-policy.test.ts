import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "drizzle/0008_public_master_mold.sql"), "utf8");
const shareLinkMigration = readFileSync(join(process.cwd(), "drizzle/0010_messy_ikaris.sql"), "utf8");
const socialMigration = readFileSync(join(process.cwd(), "drizzle/0014_social_foundations.sql"), "utf8");
const networkMigration = readFileSync(join(process.cwd(), "drizzle/0015_network_growth.sql"), "utf8");
const adminMigration = readFileSync(join(process.cwd(), "drizzle/0016_admin_ops.sql"), "utf8");
const commentReactionMigration = readFileSync(join(process.cwd(), "drizzle/0017_feed_comment_reactions.sql"), "utf8");

describe("RLS migration", () => {
  it("enables RLS on user-owned roadmap tables", () => {
    for (const table of [
      "fkh_users",
      "fkh_clubs",
      "fkh_sessions",
      "fkh_import_files",
      "fkh_shots",
      "fkh_ball_models",
      "fkh_club_equipment_history",
      "fkh_strokes_gained_shot_events",
      "fkh_account_memberships",
      "fkh_account_invitations",
    ]) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
  });

  it("creates membership-aware helper policies", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.fkh_can_access_user");
    expect(migration).toContain("membership.role = ANY(allowed_roles)");
    expect(migration).toContain("ARRAY['coach','viewer','editor']");
    expect(migration).toContain("ARRAY['editor']");
  });

  it("keeps shared courses readable while private courses stay owner controlled", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.fkh_can_read_course");
    expect(migration).toContain("course_row.visibility = 'shared'");
    expect(migration).toContain("CREATE POLICY \"fkh_courses_update_owned\"");
  });

  it("protects private share link records behind owner RLS", () => {
    expect(shareLinkMigration).toContain('ALTER TABLE "fkh_share_links" ENABLE ROW LEVEL SECURITY');
    expect(shareLinkMigration).toContain('CREATE POLICY "fkh_share_links_owner_all"');
    expect(shareLinkMigration).toContain('"user_id" = auth.uid()');
  });

  it("enables RLS and social visibility helpers for friend/feed/challenge tables", () => {
    for (const table of [
      "fkh_user_profiles",
      "fkh_friend_requests",
      "fkh_friendships",
      "fkh_user_blocks",
      "fkh_feed_items",
      "fkh_feed_reactions",
      "fkh_feed_comments",
      "fkh_challenges",
      "fkh_challenge_entries",
      "fkh_challenge_attempts",
      "fkh_challenge_results",
    ]) {
      expect(socialMigration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }

    expect(socialMigration).toContain("CREATE OR REPLACE FUNCTION public.fkh_are_friends");
    expect(socialMigration).toContain("CREATE OR REPLACE FUNCTION public.fkh_has_social_block");
    expect(socialMigration).toContain("CREATE OR REPLACE FUNCTION public.fkh_can_view_feed_item");
    expect(socialMigration).toContain("CREATE POLICY \"fkh_feed_items_select_visible\"");
    expect(socialMigration).toContain("CREATE POLICY \"fkh_user_blocks_owner_all\"");
  });

  it("enables RLS for groups, billing, providers, partners, and moderation tables", () => {
    for (const table of [
      "fkh_groups",
      "fkh_group_memberships",
      "fkh_group_invites",
      "fkh_group_posts",
      "fkh_group_challenge_links",
      "fkh_billing_customers",
      "fkh_subscriptions",
      "fkh_entitlements",
      "fkh_usage_events",
      "fkh_sponsors",
      "fkh_challenge_rewards",
      "fkh_partner_offers",
      "fkh_offer_clicks",
      "fkh_provider_accounts",
      "fkh_provider_sessions",
      "fkh_import_source_files",
      "fkh_import_jobs",
      "fkh_import_mappings",
      "fkh_ai_social_summaries",
      "fkh_social_reports",
      "fkh_moderation_events",
    ]) {
      expect(networkMigration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }

    expect(networkMigration).toContain("CREATE OR REPLACE FUNCTION public.fkh_can_view_group");
    expect(networkMigration).toContain("CREATE OR REPLACE FUNCTION public.fkh_can_view_ai_summary");
    expect(networkMigration).toContain("CREATE POLICY \"fkh_groups_select_visible\"");
    expect(networkMigration).toContain("CREATE POLICY \"fkh_billing_customers_owner_all\"");
    expect(networkMigration).toContain("CREATE POLICY \"fkh_provider_sessions_owner_all\"");
    expect(networkMigration).toContain("CREATE POLICY \"fkh_partner_offers_select_active\"");
    expect(networkMigration).toContain("CREATE POLICY \"fkh_social_reports_insert_reporter\"");
  });

  it("enables RLS for admin operation tables", () => {
    for (const table of ["fkh_admin_users", "fkh_admin_audit_log"]) {
      expect(adminMigration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }

    expect(adminMigration).toContain('CREATE POLICY "fkh_admin_users_self_select"');
    expect(adminMigration).toContain('CREATE POLICY "fkh_admin_audit_actor_select"');
    expect(adminMigration).toContain("('full', 'lifetime_full'");
    expect(adminMigration).toContain("('full', 'admin_operations'");
  });

  it("keeps feed comment reactions behind visible comment RLS", () => {
    expect(commentReactionMigration).toContain('ALTER TABLE "fkh_feed_comment_reactions" ENABLE ROW LEVEL SECURITY');
    expect(commentReactionMigration).toContain('CREATE POLICY "fkh_feed_comment_reactions_select_visible_comment"');
    expect(commentReactionMigration).toContain('CREATE POLICY "fkh_feed_comment_reactions_insert_self_visible_comment"');
    expect(commentReactionMigration).toContain('CREATE POLICY "fkh_feed_comment_reactions_delete_self"');
    expect(commentReactionMigration).toContain("public.fkh_can_view_feed_item(item)");
    expect(commentReactionMigration).toContain('"user_id" = auth.uid()');
  });
});
