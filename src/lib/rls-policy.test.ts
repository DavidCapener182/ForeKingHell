import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "drizzle/0008_public_master_mold.sql"), "utf8");
const shareLinkMigration = readFileSync(
  join(process.cwd(), "drizzle/0010_messy_ikaris.sql"),
  "utf8",
);
const socialMigration = readFileSync(
  join(process.cwd(), "drizzle/0014_social_foundations.sql"),
  "utf8",
);
const networkMigration = readFileSync(
  join(process.cwd(), "drizzle/0015_network_growth.sql"),
  "utf8",
);
const adminMigration = readFileSync(join(process.cwd(), "drizzle/0016_admin_ops.sql"), "utf8");
const commentReactionMigration = readFileSync(
  join(process.cwd(), "drizzle/0017_feed_comment_reactions.sql"),
  "utf8",
);
const recordsTournamentsMigration = readFileSync(
  join(process.cwd(), "drizzle/0020_course_records_tournaments.sql"),
  "utf8",
);
const featureFoundationsMigration = readFileSync(
  join(process.cwd(), "drizzle/0022_feature_foundations.sql"),
  "utf8",
);
const securityAdvisorMigration = readFileSync(
  join(process.cwd(), "drizzle/0026_security_advisor_hardening.sql"),
  "utf8",
);
const policyHelperGrantRepair = readFileSync(
  join(process.cwd(), "drizzle/0043_restore_rls_policy_helper_grants.sql"),
  "utf8",
);
const coachPlayerInteractionsMigration = readFileSync(
  join(process.cwd(), "drizzle/0044_coach_player_interactions.sql"),
  "utf8",
);
const speedTrainingMigration = readFileSync(
  join(process.cwd(), "drizzle/0028_speed_training.sql"),
  "utf8",
);
const aiPlatformMigration = readFileSync(
  join(process.cwd(), "drizzle/0029_ai_platform.sql"),
  "utf8",
);
const trainingOverTimeMigration = readFileSync(
  join(process.cwd(), "drizzle/0030_training_over_time.sql"),
  "utf8",
);
const practicePlannerMigration = readFileSync(
  join(process.cwd(), "drizzle/0036_practice_planner.sql"),
  "utf8",
);
const securityBoundaryMigration = readFileSync(
  join(process.cwd(), "drizzle/0039_security_boundary_repairs.sql"),
  "utf8",
);
const integrityLockdownMigration = readFileSync(
  join(process.cwd(), "drizzle/0040_security_integrity_lockdown.sql"),
  "utf8",
);
const shotReviewMigration = readFileSync(
  join(process.cwd(), "drizzle/0056_shot_review_lifecycle.sql"),
  "utf8",
);
const shotReviewRepairMigration = readFileSync(
  join(process.cwd(), "drizzle/0057_shot_review_warm_up_security_repair.sql"),
  "utf8",
);

describe("RLS migration", () => {
  it("keeps shot review events owner-readable and server-write-only", () => {
    expect(shotReviewMigration).toContain(
      "ALTER TABLE public.fkh_shot_review_events ENABLE ROW LEVEL SECURITY",
    );
    expect(shotReviewMigration).toContain(
      "ALTER TABLE public.fkh_shot_review_events FORCE ROW LEVEL SECURITY",
    );
    expect(shotReviewMigration).toContain("fkh_shot_review_events_owner_select");
    expect(shotReviewMigration).toContain("user_id = (SELECT auth.uid())");
    expect(shotReviewMigration).not.toContain("CREATE POLICY fkh_shot_review_events_owner_insert");
    expect(shotReviewMigration).toContain(
      "REVOKE ALL ON TABLE public.fkh_shot_review_events FROM PUBLIC, anon, authenticated",
    );
    expect(shotReviewMigration).toContain(
      "GRANT SELECT ON TABLE public.fkh_shot_review_events TO authenticated",
    );
    expect(shotReviewMigration).not.toMatch(/GRANT\s+[^;]*INSERT[^;]*fkh_shot_review_events/i);
    expect(shotReviewRepairMigration).toContain(
      "DROP POLICY IF EXISTS fkh_shot_review_events_owner_insert",
    );
    expect(shotReviewRepairMigration).toContain(
      "REVOKE INSERT ON TABLE public.fkh_shot_review_events",
    );
    expect(shotReviewRepairMigration).toContain(
      "GRANT SELECT ON TABLE public.fkh_shot_review_events TO authenticated",
    );
    expect(shotReviewMigration).not.toContain("fkh_shot_review_events_owner_update");
    expect(shotReviewMigration).not.toContain("fkh_shot_review_events_owner_delete");
  });

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
    expect(migration).toContain('CREATE POLICY "fkh_courses_update_owned"');
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
    expect(socialMigration).toContain('CREATE POLICY "fkh_feed_items_select_visible"');
    expect(socialMigration).toContain('CREATE POLICY "fkh_user_blocks_owner_all"');
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
    expect(networkMigration).toContain('CREATE POLICY "fkh_groups_select_visible"');
    expect(networkMigration).toContain('CREATE POLICY "fkh_billing_customers_owner_all"');
    expect(networkMigration).toContain('CREATE POLICY "fkh_provider_sessions_owner_all"');
    expect(networkMigration).toContain('CREATE POLICY "fkh_partner_offers_select_active"');
    expect(networkMigration).toContain('CREATE POLICY "fkh_social_reports_insert_reporter"');
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
    expect(commentReactionMigration).toContain(
      'ALTER TABLE "fkh_feed_comment_reactions" ENABLE ROW LEVEL SECURITY',
    );
    expect(commentReactionMigration).toContain(
      'CREATE POLICY "fkh_feed_comment_reactions_select_visible_comment"',
    );
    expect(commentReactionMigration).toContain(
      'CREATE POLICY "fkh_feed_comment_reactions_insert_self_visible_comment"',
    );
    expect(commentReactionMigration).toContain(
      'CREATE POLICY "fkh_feed_comment_reactions_delete_self"',
    );
    expect(commentReactionMigration).toContain("public.fkh_can_view_feed_item(item)");
    expect(commentReactionMigration).toContain('"user_id" = auth.uid()');
  });

  it("enables RLS for course records and major-style tournament tables", () => {
    for (const table of [
      "fkh_course_provider_aliases",
      "fkh_course_record_categories",
      "fkh_course_records",
      "fkh_course_record_attempts",
      "fkh_course_record_results",
      "fkh_course_record_evidence",
      "fkh_course_record_flags",
      "fkh_tournaments",
      "fkh_tournament_rounds",
      "fkh_tournament_entries",
      "fkh_tournament_submissions",
      "fkh_tournament_evidence",
      "fkh_tournament_standings",
      "fkh_tournament_comments",
      "fkh_tournament_invites",
      "fkh_tournament_prizes",
    ]) {
      expect(recordsTournamentsMigration).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }

    expect(recordsTournamentsMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.fkh_can_view_course_record",
    );
    expect(recordsTournamentsMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.fkh_can_view_tournament",
    );
    expect(recordsTournamentsMigration).toContain(
      'CREATE POLICY "fkh_course_records_select_visible"',
    );
    expect(recordsTournamentsMigration).toContain('CREATE POLICY "fkh_tournaments_select_visible"');
  });

  it("scopes private, friend, group and evidence-backed competition data", () => {
    expect(recordsTournamentsMigration).toContain("record_row.scope = 'public'");
    expect(recordsTournamentsMigration).toContain("record_row.scope = 'friends'");
    expect(recordsTournamentsMigration).toContain("record_row.scope = 'group'");
    expect(recordsTournamentsMigration).toContain("record_row.scope = 'private'");
    expect(recordsTournamentsMigration).toContain("membership.group_id = record_row.group_id");
    expect(recordsTournamentsMigration).toContain("membership.group_id = tournament_row.group_id");
    expect(recordsTournamentsMigration).toContain(
      'CREATE POLICY "fkh_course_record_attempts_select_visible_record_or_self"',
    );
    expect(recordsTournamentsMigration).toContain(
      'CREATE POLICY "fkh_tournament_submissions_select_visible_tournament_or_self"',
    );
    expect(recordsTournamentsMigration).toContain(
      'CREATE POLICY "fkh_course_record_evidence_select_attempt_owner_or_admin"',
    );
    expect(recordsTournamentsMigration).toContain(
      'CREATE POLICY "fkh_tournament_evidence_select_submission_owner_or_admin"',
    );
    expect(recordsTournamentsMigration).toContain("public.fkh_can_read_course(course)");
  });

  it("keeps feature idea state user-owned behind RLS", () => {
    for (const table of [
      "fkh_shot_saved_views",
      "fkh_practice_sessions",
      "fkh_course_record_goals",
      "fkh_course_follows",
      "fkh_user_feature_preferences",
      "fkh_weekly_recaps",
    ]) {
      expect(featureFoundationsMigration).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }

    expect(featureFoundationsMigration).toContain(
      'CREATE POLICY "fkh_practice_sessions_owner_all"',
    );
    expect(featureFoundationsMigration).toContain(
      'CREATE POLICY "fkh_course_record_goals_owner_all"',
    );
    expect(featureFoundationsMigration).toContain(
      'CREATE POLICY "fkh_user_feature_preferences_owner_all"',
    );
    expect(featureFoundationsMigration).toContain("auth.uid() IS NOT NULL");
    expect(featureFoundationsMigration).toContain('"user_id" = auth.uid()');
  });

  it("keeps practice planner plans, blocks, results and templates user-owned behind RLS", () => {
    for (const table of [
      "fkh_practice_templates",
      "fkh_practice_plans",
      "fkh_practice_blocks",
      "fkh_practice_results",
      "fkh_practice_block_results",
    ]) {
      expect(practicePlannerMigration).toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }

    for (const policy of [
      "fkh_practice_templates_owner_all",
      "fkh_practice_plans_owner_all",
      "fkh_practice_blocks_owner_all",
      "fkh_practice_results_owner_all",
      "fkh_practice_block_results_owner_all",
    ]) {
      expect(practicePlannerMigration).toContain(`CREATE POLICY "${policy}"`);
    }

    expect(practicePlannerMigration).toContain(
      'CREATE POLICY "fkh_practice_templates_select_owner_or_system"',
    );
    expect(practicePlannerMigration).toContain('"user_id" IS NULL');
    expect(practicePlannerMigration).toContain('"user_id" = auth.uid()');
  });

  it("hardens advisor-flagged functions, extension schema, and avatar listing", () => {
    expect(securityAdvisorMigration).toContain(
      "ALTER FUNCTION public.fkh_can_view_course_record(public.fkh_course_records) SET search_path = public",
    );
    expect(securityAdvisorMigration).toContain(
      "ALTER FUNCTION public.fkh_can_view_tournament(public.fkh_tournaments) SET search_path = public",
    );
    expect(securityAdvisorMigration).toContain("ALTER EXTENSION citext SET SCHEMA extensions");
    expect(securityAdvisorMigration).toContain(
      'DROP POLICY IF EXISTS "Anyone can select from avatars" ON storage.objects',
    );
    expect(securityAdvisorMigration).toContain(
      'DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects',
    );

    for (const signature of [
      "public.fkh_are_friends(uuid, uuid)",
      "public.fkh_can_access_user(uuid, text[])",
      "public.fkh_can_manage_group(uuid, uuid)",
      "public.fkh_can_read_course(public.fkh_courses)",
      "public.fkh_can_view_ai_summary(public.fkh_ai_social_summaries)",
      "public.fkh_can_view_challenge(public.fkh_challenges)",
      "public.fkh_can_view_feed_item(public.fkh_feed_items)",
      "public.fkh_can_view_group(public.fkh_groups)",
      "public.fkh_can_view_social_profile(public.fkh_user_profiles)",
      "public.fkh_can_write_course(public.fkh_courses)",
      "public.fkh_has_social_block(uuid, uuid)",
      "public.fkh_is_group_member(uuid, uuid)",
    ]) {
      expect(securityAdvisorMigration).toContain(
        `REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC`,
      );
      expect(securityAdvisorMigration).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO anon, authenticated`,
      );
    }

    expect(securityAdvisorMigration).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC",
    );
  });

  it("keeps speed training sessions, swings, and goals user-owned behind RLS", () => {
    for (const table of [
      "fkh_speed_training_sessions",
      "fkh_speed_training_swings",
      "fkh_speed_training_goals",
    ]) {
      expect(speedTrainingMigration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }

    expect(speedTrainingMigration).toContain(
      'CREATE POLICY "fkh_speed_training_sessions_owner_all"',
    );
    expect(speedTrainingMigration).toContain('CREATE POLICY "fkh_speed_training_swings_owner_all"');
    expect(speedTrainingMigration).toContain('CREATE POLICY "fkh_speed_training_goals_owner_all"');
    expect(speedTrainingMigration).toContain('"user_id" = auth.uid()');
    expect(speedTrainingMigration).toContain('session_row."id" = "speed_session_id"');
    expect(speedTrainingMigration).toContain('session_row."user_id" = auth.uid()');
  });

  it("keeps AI usage and generation cache user-owned behind RLS", () => {
    for (const table of ["fkh_ai_usage_events", "fkh_ai_generation_cache"]) {
      expect(aiPlatformMigration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }

    expect(aiPlatformMigration).toContain('CREATE POLICY "fkh_ai_usage_events_owner_all"');
    expect(aiPlatformMigration).toContain('CREATE POLICY "fkh_ai_generation_cache_owner_all"');
    expect(aiPlatformMigration).toContain('"user_id" = auth.uid()');
    expect(aiPlatformMigration).toContain("'ai_monthly_credits'");
  });

  it("keeps golf training load sessions user-owned behind RLS", () => {
    expect(trainingOverTimeMigration).toContain(
      'ALTER TABLE "fkh_golf_training_sessions" ENABLE ROW LEVEL SECURITY',
    );
    expect(trainingOverTimeMigration).toContain(
      'CREATE POLICY "fkh_golf_training_sessions_owner_all"',
    );
    expect(trainingOverTimeMigration).toContain('"user_id" = auth.uid()');
    expect(trainingOverTimeMigration).toContain("WITH (security_invoker = true)");
  });

  it("prevents client-created billing, friendship and group-admin trust", () => {
    expect(securityBoundaryMigration).toContain(
      'DROP POLICY IF EXISTS "fkh_subscriptions_owner_insert"',
    );
    expect(securityBoundaryMigration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.fkh_subscriptions FROM anon, authenticated",
    );
    expect(securityBoundaryMigration).toContain(
      'DROP POLICY IF EXISTS "fkh_friendships_insert_participant"',
    );
    expect(securityBoundaryMigration).toContain(
      'DROP POLICY IF EXISTS "fkh_group_memberships_insert_self_or_manager"',
    );
    expect(securityBoundaryMigration).toContain(
      'CREATE POLICY "fkh_group_memberships_insert_manager"',
    );
  });

  it("binds relationship helpers to the authenticated actor", () => {
    for (const helper of [
      "fkh_are_friends",
      "fkh_has_social_block",
      "fkh_is_group_member",
      "fkh_can_manage_group",
    ]) {
      expect(securityBoundaryMigration).toContain(`FUNCTION public.${helper}`);
    }

    expect(securityBoundaryMigration).toContain("target_user_id = (SELECT auth.uid())");
    expect(securityBoundaryMigration).toContain(
      "viewer_id = (SELECT auth.uid()) OR subject_id = (SELECT auth.uid())",
    );
  });

  it("keeps editor-owned and relationship scope columns immutable", () => {
    expect(securityBoundaryMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.fkh_reject_scope_reassignment()",
    );

    for (const trigger of [
      "fkh_shots_owner_immutable",
      "fkh_sessions_owner_immutable",
      "fkh_friend_requests_scope_immutable",
      "fkh_challenge_entries_scope_immutable",
      "fkh_challenge_invites_scope_immutable",
      "fkh_group_memberships_scope_immutable",
    ]) {
      expect(securityBoundaryMigration).toContain(`CREATE TRIGGER ${trigger}`);
    }
  });

  it("makes canonical identity, quota, reward, provenance and practice state server maintained", () => {
    expect(integrityLockdownMigration).toContain(
      "ALTER TABLE public.fkh_user_identity_links ENABLE ROW LEVEL SECURITY",
    );
    expect(integrityLockdownMigration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.fkh_user_identity_links",
    );

    for (const table of [
      "public.fkh_usage_events",
      "public.fkh_ai_usage_events",
      "public.fkh_ai_generation_cache",
      "public.fkh_user_achievements",
      "public.fkh_xp_ledger",
      "public.fkh_achievement_progress",
      "public.fkh_achievement_sync_state",
      "public.fkh_rapsodo_sync_sessions",
      "public.fkh_challenge_attempts",
      "public.fkh_challenge_results",
      "public.fkh_practice_blocks",
      "public.fkh_practice_results",
      "public.fkh_practice_plan_matches",
      "public.fkh_practice_block_results",
    ]) {
      expect(integrityLockdownMigration).toContain(table);
    }

    expect(integrityLockdownMigration).toContain("fkh_ai_usage_events_credits_nonnegative");
  });

  it("enforces parent ownership for course, equipment, and practice relations", () => {
    for (const trigger of [
      "fkh_holes_validate_tee_course",
      "fkh_equipment_history_validate_ownership",
      "fkh_practice_plans_validate_relations",
      "fkh_practice_blocks_validate_relations",
      "fkh_practice_results_validate_relations",
      "fkh_practice_matches_validate_relations",
      "fkh_practice_block_results_validate_relations",
    ]) {
      expect(integrityLockdownMigration).toContain("CREATE TRIGGER " + trigger);
    }

    expect(integrityLockdownMigration).toContain("tee_set.id = NEW.tee_set_id");
    expect(integrityLockdownMigration).toContain(
      "ball.id = NEW.ball_model_id AND ball.user_id = NEW.user_id",
    );
    expect(integrityLockdownMigration).toContain(
      "block.practice_plan_id = result.practice_plan_id",
    );
  });

  it("keeps policy helpers private from PUBLIC but executable by Supabase API roles", () => {
    for (const helper of [
      "fkh_can_access_user(uuid, text[])",
      "fkh_can_read_course(public.fkh_courses)",
      "fkh_can_view_feed_item(public.fkh_feed_items)",
      "fkh_can_view_course_record(public.fkh_course_records)",
      "fkh_can_view_tournament(public.fkh_tournaments)",
    ]) {
      expect(policyHelperGrantRepair).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${helper} FROM PUBLIC`,
      );
      expect(policyHelperGrantRepair).toContain(
        `GRANT EXECUTE ON FUNCTION public.${helper} TO anon, authenticated`,
      );
    }
  });

  it("keeps Coach Workspace interactions relationship-scoped and visibility-aware", () => {
    expect(coachPlayerInteractionsMigration).toContain(
      "ALTER TABLE public.fkh_coach_player_interactions ENABLE ROW LEVEL SECURITY",
    );
    expect(coachPlayerInteractionsMigration).toContain(
      "ALTER TABLE public.fkh_coach_player_interactions FORCE ROW LEVEL SECURITY",
    );
    expect(coachPlayerInteractionsMigration).toContain(
      "player_user_id = (SELECT auth.uid())\n      AND visibility = 'player_visible'",
    );
    expect(coachPlayerInteractionsMigration).toContain("membership.owner_user_id = player_user_id");
    expect(coachPlayerInteractionsMigration).toContain(
      "membership.member_user_id = (SELECT auth.uid())",
    );
    expect(coachPlayerInteractionsMigration).toContain("membership.role = 'coach'");
    expect(coachPlayerInteractionsMigration).toContain(
      "fkh_coach_player_interactions_coach_insert",
    );
    expect(coachPlayerInteractionsMigration).toContain(
      "fkh_coach_player_interactions_coach_update",
    );
    expect(coachPlayerInteractionsMigration).toContain(
      "fkh_coach_player_interactions_coach_delete",
    );
    expect(coachPlayerInteractionsMigration).not.toContain(
      "fkh_coach_player_interactions_player_update",
    );
    expect(coachPlayerInteractionsMigration).toContain(
      "interaction_type = 'private_note' AND visibility = 'coach_only'",
    );
    expect(coachPlayerInteractionsMigration).toContain("session_row.user_id = NEW.player_user_id");
    expect(coachPlayerInteractionsMigration).toContain(
      "practice_plan.user_id = NEW.player_user_id",
    );
    expect(coachPlayerInteractionsMigration).toContain(
      "REVOKE ALL ON TABLE public.fkh_coach_player_interactions FROM PUBLIC, anon",
    );
  });
});
