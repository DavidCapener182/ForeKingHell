CREATE TABLE "fkh_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"group_type" varchar(40) DEFAULT 'friends' NOT NULL,
	"visibility" varchar(24) DEFAULT 'private' NOT NULL,
	"avatar_url" text,
	"invite_code" varchar(80),
	"rules" text,
	"settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL REFERENCES "public"."fkh_groups"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"role" varchar(24) DEFAULT 'member' NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_group_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL REFERENCES "public"."fkh_groups"("id") ON DELETE cascade,
	"inviter_user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"invitee_user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"invitee_email" varchar(320),
	"token_hash" varchar(128),
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_group_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL REFERENCES "public"."fkh_groups"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"title" varchar(180),
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_group_challenge_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL REFERENCES "public"."fkh_groups"("id") ON DELETE cascade,
	"challenge_id" uuid NOT NULL REFERENCES "public"."fkh_challenges"("id") ON DELETE cascade,
	"created_by_user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"stripe_customer_id" varchar(120),
	"email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"billing_customer_id" uuid REFERENCES "public"."fkh_billing_customers"("id") ON DELETE set null,
	"stripe_subscription_id" varchar(120),
	"plan_key" varchar(40) NOT NULL,
	"status" varchar(32) DEFAULT 'inactive' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"entitlement_key" varchar(80) NOT NULL,
	"value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" varchar(40) DEFAULT 'plan' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"event_type" varchar(80) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"source_id" varchar(220),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_plan_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_key" varchar(40) NOT NULL,
	"limit_key" varchar(80) NOT NULL,
	"limit_value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE set null,
	"name" varchar(160) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"website_url" text,
	"contact_email" varchar(320),
	"status" varchar(32) DEFAULT 'prospect' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_challenge_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL REFERENCES "public"."fkh_challenges"("id") ON DELETE cascade,
	"sponsor_id" uuid REFERENCES "public"."fkh_sponsors"("id") ON DELETE set null,
	"reward_type" varchar(40) DEFAULT 'discount' NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"reward_url" text,
	"coupon_code" varchar(80),
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_partner_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid REFERENCES "public"."fkh_sponsors"("id") ON DELETE set null,
	"title" varchar(160) NOT NULL,
	"description" text,
	"offer_type" varchar(40) DEFAULT 'affiliate' NOT NULL,
	"placement" varchar(80) DEFAULT 'contextual' NOT NULL,
	"target_context" varchar(80),
	"offer_url" text,
	"coupon_code" varchar(80),
	"active" boolean DEFAULT true NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_offer_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL REFERENCES "public"."fkh_partner_offers"("id") ON DELETE cascade,
	"user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE set null,
	"source" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"provider_kind" varchar(40) NOT NULL,
	"provider_account_id" varchar(180),
	"display_name" varchar(160),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_provider_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"provider_account_id" uuid REFERENCES "public"."fkh_provider_accounts"("id") ON DELETE set null,
	"provider_kind" varchar(40) NOT NULL,
	"provider_session_id" varchar(180) NOT NULL,
	"title" varchar(260),
	"session_date" timestamp with time zone,
	"imported_session_id" uuid REFERENCES "public"."fkh_sessions"("id") ON DELETE set null,
	"raw_metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_import_source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"provider_kind" varchar(40) NOT NULL,
	"file_name" varchar(260) NOT NULL,
	"file_size_bytes" integer,
	"raw_hash" varchar(64) NOT NULL,
	"storage_path" text,
	"status" varchar(32) DEFAULT 'saved' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"provider_kind" varchar(40) NOT NULL,
	"source_file_id" uuid REFERENCES "public"."fkh_import_source_files"("id") ON DELETE set null,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"detected_provider_kind" varchar(40),
	"imported_session_id" uuid REFERENCES "public"."fkh_sessions"("id") ON DELETE set null,
	"error_message" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"provider_kind" varchar(40) NOT NULL,
	"mapping_name" varchar(160) NOT NULL,
	"mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_ai_social_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"summary_type" varchar(60) NOT NULL,
	"subject_type" varchar(60),
	"subject_id" varchar(220),
	"headline" varchar(220) NOT NULL,
	"body" text NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" varchar(24) DEFAULT 'private' NOT NULL,
	"model" varchar(80) DEFAULT 'rules-v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_social_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"reported_user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE set null,
	"target_type" varchar(60) NOT NULL,
	"target_id" varchar(220) NOT NULL,
	"reason" varchar(120) NOT NULL,
	"details" text,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" varchar(60) NOT NULL,
	"target_id" varchar(220) NOT NULL,
	"actor_user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE set null,
	"event_type" varchar(60) NOT NULL,
	"severity" varchar(24) DEFAULT 'low' NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"reason" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_groups_slug_idx" ON "fkh_groups" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_groups_invite_code_idx" ON "fkh_groups" USING btree ("invite_code");
--> statement-breakpoint
CREATE INDEX "fkh_groups_owner_idx" ON "fkh_groups" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "fkh_groups_visibility_type_idx" ON "fkh_groups" USING btree ("visibility","group_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_group_memberships_group_user_idx" ON "fkh_group_memberships" USING btree ("group_id","user_id");
--> statement-breakpoint
CREATE INDEX "fkh_group_memberships_user_idx" ON "fkh_group_memberships" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "fkh_group_memberships_group_role_idx" ON "fkh_group_memberships" USING btree ("group_id","role");
--> statement-breakpoint
CREATE INDEX "fkh_group_invites_group_idx" ON "fkh_group_invites" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX "fkh_group_invites_invitee_status_idx" ON "fkh_group_invites" USING btree ("invitee_user_id","status");
--> statement-breakpoint
CREATE INDEX "fkh_group_invites_email_idx" ON "fkh_group_invites" USING btree ("invitee_email");
--> statement-breakpoint
CREATE INDEX "fkh_group_posts_group_created_idx" ON "fkh_group_posts" USING btree ("group_id","created_at");
--> statement-breakpoint
CREATE INDEX "fkh_group_posts_user_idx" ON "fkh_group_posts" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_group_challenge_links_group_challenge_idx" ON "fkh_group_challenge_links" USING btree ("group_id","challenge_id");
--> statement-breakpoint
CREATE INDEX "fkh_group_challenge_links_challenge_idx" ON "fkh_group_challenge_links" USING btree ("challenge_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_billing_customers_user_idx" ON "fkh_billing_customers" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_billing_customers_stripe_idx" ON "fkh_billing_customers" USING btree ("stripe_customer_id");
--> statement-breakpoint
CREATE INDEX "fkh_subscriptions_user_status_idx" ON "fkh_subscriptions" USING btree ("user_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_subscriptions_stripe_idx" ON "fkh_subscriptions" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_entitlements_user_key_idx" ON "fkh_entitlements" USING btree ("user_id","entitlement_key");
--> statement-breakpoint
CREATE INDEX "fkh_entitlements_user_source_idx" ON "fkh_entitlements" USING btree ("user_id","source");
--> statement-breakpoint
CREATE INDEX "fkh_usage_events_user_type_created_idx" ON "fkh_usage_events" USING btree ("user_id","event_type","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_plan_limits_plan_key_idx" ON "fkh_plan_limits" USING btree ("plan_key","limit_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_sponsors_slug_idx" ON "fkh_sponsors" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "fkh_sponsors_owner_idx" ON "fkh_sponsors" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "fkh_challenge_rewards_challenge_idx" ON "fkh_challenge_rewards" USING btree ("challenge_id");
--> statement-breakpoint
CREATE INDEX "fkh_challenge_rewards_sponsor_idx" ON "fkh_challenge_rewards" USING btree ("sponsor_id");
--> statement-breakpoint
CREATE INDEX "fkh_partner_offers_active_context_idx" ON "fkh_partner_offers" USING btree ("active","target_context");
--> statement-breakpoint
CREATE INDEX "fkh_partner_offers_sponsor_idx" ON "fkh_partner_offers" USING btree ("sponsor_id");
--> statement-breakpoint
CREATE INDEX "fkh_offer_clicks_offer_created_idx" ON "fkh_offer_clicks" USING btree ("offer_id","created_at");
--> statement-breakpoint
CREATE INDEX "fkh_offer_clicks_user_idx" ON "fkh_offer_clicks" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_provider_accounts_user_provider_account_idx" ON "fkh_provider_accounts" USING btree ("user_id","provider_kind","provider_account_id");
--> statement-breakpoint
CREATE INDEX "fkh_provider_accounts_user_provider_idx" ON "fkh_provider_accounts" USING btree ("user_id","provider_kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_provider_sessions_user_provider_session_idx" ON "fkh_provider_sessions" USING btree ("user_id","provider_kind","provider_session_id");
--> statement-breakpoint
CREATE INDEX "fkh_provider_sessions_user_seen_idx" ON "fkh_provider_sessions" USING btree ("user_id","last_seen_at");
--> statement-breakpoint
CREATE INDEX "fkh_provider_sessions_imported_idx" ON "fkh_provider_sessions" USING btree ("imported_session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_import_source_files_user_hash_idx" ON "fkh_import_source_files" USING btree ("user_id","raw_hash");
--> statement-breakpoint
CREATE INDEX "fkh_import_source_files_user_created_idx" ON "fkh_import_source_files" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "fkh_import_jobs_user_status_idx" ON "fkh_import_jobs" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "fkh_import_jobs_provider_idx" ON "fkh_import_jobs" USING btree ("provider_kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_import_mappings_user_provider_name_idx" ON "fkh_import_mappings" USING btree ("user_id","provider_kind","mapping_name");
--> statement-breakpoint
CREATE INDEX "fkh_import_mappings_user_provider_idx" ON "fkh_import_mappings" USING btree ("user_id","provider_kind");
--> statement-breakpoint
CREATE INDEX "fkh_ai_social_summaries_user_type_idx" ON "fkh_ai_social_summaries" USING btree ("user_id","summary_type");
--> statement-breakpoint
CREATE INDEX "fkh_ai_social_summaries_subject_idx" ON "fkh_ai_social_summaries" USING btree ("subject_type","subject_id");
--> statement-breakpoint
CREATE INDEX "fkh_social_reports_reporter_idx" ON "fkh_social_reports" USING btree ("reporter_user_id");
--> statement-breakpoint
CREATE INDEX "fkh_social_reports_target_idx" ON "fkh_social_reports" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE INDEX "fkh_social_reports_status_idx" ON "fkh_social_reports" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "fkh_moderation_events_target_idx" ON "fkh_moderation_events" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE INDEX "fkh_moderation_events_status_severity_idx" ON "fkh_moderation_events" USING btree ("status","severity");
--> statement-breakpoint
CREATE INDEX "fkh_moderation_events_actor_idx" ON "fkh_moderation_events" USING btree ("actor_user_id");
--> statement-breakpoint
INSERT INTO "fkh_plan_limits" ("plan_key", "limit_key", "limit_value_json")
VALUES
	('free', 'max_monthly_imports', '{"value":5}'::jsonb),
	('free', 'max_friend_groups', '{"value":1}'::jsonb),
	('free', 'max_private_challenges', '{"value":0}'::jsonb),
	('free', 'can_use_ai_coach', '{"value":false}'::jsonb),
	('plus', 'max_monthly_imports', '{"value":999999}'::jsonb),
	('plus', 'max_friend_groups', '{"value":8}'::jsonb),
	('plus', 'max_private_challenges', '{"value":12}'::jsonb),
	('plus', 'advanced_reports', '{"value":true}'::jsonb),
	('pro', 'can_use_ai_coach', '{"value":true}'::jsonb),
	('pro', 'friend_comparison_insights', '{"value":true}'::jsonb),
	('pro', 'challenge_analytics', '{"value":true}'::jsonb),
	('coach', 'coach_dashboard', '{"value":true}'::jsonb),
	('coach', 'max_player_seats', '{"value":25}'::jsonb)
ON CONFLICT ("plan_key","limit_key") DO UPDATE
SET "limit_value_json" = excluded."limit_value_json",
	"updated_at" = now();
--> statement-breakpoint
INSERT INTO "fkh_sponsors" ("name", "slug", "website_url", "status", "metadata_json")
VALUES
	('ForeKingHell Partners', 'forekinghell-partners', 'https://forekinghell.app', 'active', '{"internal":true}'::jsonb)
ON CONFLICT ("slug") DO UPDATE
SET "name" = excluded."name",
	"website_url" = excluded."website_url",
	"status" = excluded."status",
	"updated_at" = now();
--> statement-breakpoint
INSERT INTO "fkh_partner_offers" ("sponsor_id", "title", "description", "offer_type", "placement", "target_context", "offer_url", "coupon_code", "active", "metadata_json")
SELECT sponsor.id, 'Marked ball reminder', 'Spin data works best when your launch monitor can read compatible marked balls.', 'affiliate', 'contextual', 'spin_missing', sponsor.website_url, NULL, true, '{"safeDefault":true}'::jsonb
FROM "fkh_sponsors" sponsor
WHERE sponsor.slug = 'forekinghell-partners';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_is_group_member(target_group_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fkh_group_memberships membership
    WHERE membership.group_id = target_group_id
      AND membership.user_id = target_user_id
      AND membership.status = 'active'
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_manage_group(target_group_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fkh_groups target_group
    WHERE target_group.id = target_group_id
      AND target_group.owner_user_id = target_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.fkh_group_memberships membership
    WHERE membership.group_id = target_group_id
      AND membership.user_id = target_user_id
      AND membership.status = 'active'
      AND membership.role IN ('admin','moderator')
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_view_group(group_row public.fkh_groups)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      group_row.visibility = 'public'
      OR group_row.owner_user_id = auth.uid()
      OR public.fkh_is_group_member(group_row.id, auth.uid())
    );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_view_ai_summary(summary_row public.fkh_ai_social_summaries)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.fkh_has_social_block(auth.uid(), summary_row.user_id)
    AND (
      summary_row.user_id = auth.uid()
      OR summary_row.visibility = 'public'
      OR (summary_row.visibility = 'friends' AND public.fkh_are_friends(auth.uid(), summary_row.user_id))
    );
$$;
--> statement-breakpoint
ALTER TABLE "fkh_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_group_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_group_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_group_posts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_group_challenge_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_billing_customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_entitlements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_usage_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_plan_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_sponsors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenge_rewards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_partner_offers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_offer_clicks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_provider_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_provider_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_import_source_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_import_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_import_mappings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_ai_social_summaries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_social_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_moderation_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "fkh_groups_select_visible" ON "fkh_groups" FOR SELECT USING (public.fkh_can_view_group(fkh_groups));
--> statement-breakpoint
CREATE POLICY "fkh_groups_insert_owner" ON "fkh_groups" FOR INSERT WITH CHECK ("owner_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_groups_update_manager" ON "fkh_groups" FOR UPDATE USING (public.fkh_can_manage_group(id, auth.uid())) WITH CHECK (public.fkh_can_manage_group(id, auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_groups_delete_owner" ON "fkh_groups" FOR DELETE USING ("owner_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_group_memberships_select_visible_group" ON "fkh_group_memberships" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_groups target_group WHERE target_group.id = group_id AND public.fkh_can_view_group(target_group)));
--> statement-breakpoint
CREATE POLICY "fkh_group_memberships_insert_self_or_manager" ON "fkh_group_memberships" FOR INSERT WITH CHECK ("user_id" = auth.uid() OR public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_memberships_update_manager" ON "fkh_group_memberships" FOR UPDATE USING (public.fkh_can_manage_group("group_id", auth.uid())) WITH CHECK (public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_memberships_delete_self_or_manager" ON "fkh_group_memberships" FOR DELETE USING ("user_id" = auth.uid() OR public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_invites_select_related" ON "fkh_group_invites" FOR SELECT USING ("inviter_user_id" = auth.uid() OR "invitee_user_id" = auth.uid() OR public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_invites_insert_manager" ON "fkh_group_invites" FOR INSERT WITH CHECK ("inviter_user_id" = auth.uid() AND public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_invites_update_related" ON "fkh_group_invites" FOR UPDATE USING ("inviter_user_id" = auth.uid() OR "invitee_user_id" = auth.uid() OR public.fkh_can_manage_group("group_id", auth.uid())) WITH CHECK ("inviter_user_id" = auth.uid() OR "invitee_user_id" = auth.uid() OR public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_posts_select_visible_group" ON "fkh_group_posts" FOR SELECT USING ("deleted_at" IS NULL AND EXISTS (SELECT 1 FROM public.fkh_groups target_group WHERE target_group.id = group_id AND public.fkh_can_view_group(target_group)));
--> statement-breakpoint
CREATE POLICY "fkh_group_posts_insert_member" ON "fkh_group_posts" FOR INSERT WITH CHECK ("user_id" = auth.uid() AND public.fkh_is_group_member("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_posts_update_owner_or_manager" ON "fkh_group_posts" FOR UPDATE USING ("user_id" = auth.uid() OR public.fkh_can_manage_group("group_id", auth.uid())) WITH CHECK ("user_id" = auth.uid() OR public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_group_challenge_links_select_visible_group" ON "fkh_group_challenge_links" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_groups target_group WHERE target_group.id = group_id AND public.fkh_can_view_group(target_group)));
--> statement-breakpoint
CREATE POLICY "fkh_group_challenge_links_insert_manager" ON "fkh_group_challenge_links" FOR INSERT WITH CHECK ("created_by_user_id" = auth.uid() AND public.fkh_can_manage_group("group_id", auth.uid()));
--> statement-breakpoint
CREATE POLICY "fkh_billing_customers_owner_all" ON "fkh_billing_customers" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_subscriptions_owner_select" ON "fkh_subscriptions" FOR SELECT USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_subscriptions_owner_insert" ON "fkh_subscriptions" FOR INSERT WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_entitlements_owner_select" ON "fkh_entitlements" FOR SELECT USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_usage_events_owner_all" ON "fkh_usage_events" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_plan_limits_select_authenticated" ON "fkh_plan_limits" FOR SELECT USING (auth.uid() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY "fkh_sponsors_select_authenticated" ON "fkh_sponsors" FOR SELECT USING (auth.uid() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY "fkh_sponsors_owner_write" ON "fkh_sponsors" FOR ALL USING ("owner_user_id" = auth.uid()) WITH CHECK ("owner_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_rewards_select_visible_challenge" ON "fkh_challenge_rewards" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_partner_offers_select_active" ON "fkh_partner_offers" FOR SELECT USING (auth.uid() IS NOT NULL AND "active" = true);
--> statement-breakpoint
CREATE POLICY "fkh_offer_clicks_insert_self" ON "fkh_offer_clicks" FOR INSERT WITH CHECK ("user_id" = auth.uid() OR "user_id" IS NULL);
--> statement-breakpoint
CREATE POLICY "fkh_offer_clicks_select_self" ON "fkh_offer_clicks" FOR SELECT USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_provider_accounts_owner_all" ON "fkh_provider_accounts" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_provider_sessions_owner_all" ON "fkh_provider_sessions" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_import_source_files_owner_all" ON "fkh_import_source_files" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_import_jobs_owner_all" ON "fkh_import_jobs" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_import_mappings_owner_all" ON "fkh_import_mappings" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_ai_social_summaries_select_visible" ON "fkh_ai_social_summaries" FOR SELECT USING (public.fkh_can_view_ai_summary(fkh_ai_social_summaries));
--> statement-breakpoint
CREATE POLICY "fkh_ai_social_summaries_owner_all" ON "fkh_ai_social_summaries" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_social_reports_select_reporter" ON "fkh_social_reports" FOR SELECT USING ("reporter_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_social_reports_insert_reporter" ON "fkh_social_reports" FOR INSERT WITH CHECK ("reporter_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_moderation_events_select_actor" ON "fkh_moderation_events" FOR SELECT USING ("actor_user_id" = auth.uid());
