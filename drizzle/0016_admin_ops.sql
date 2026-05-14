CREATE TABLE IF NOT EXISTS "fkh_admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"role" varchar(24) DEFAULT 'operator' NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"permissions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fkh_admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE set null,
	"target_user_id" uuid REFERENCES "public"."fkh_users"("id") ON DELETE set null,
	"action" varchar(80) NOT NULL,
	"target_type" varchar(60),
	"target_id" varchar(220),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fkh_admin_users_user_idx" ON "fkh_admin_users" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fkh_admin_users_status_role_idx" ON "fkh_admin_users" USING btree ("status","role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fkh_admin_audit_actor_created_idx" ON "fkh_admin_audit_log" USING btree ("actor_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fkh_admin_audit_target_idx" ON "fkh_admin_audit_log" USING btree ("target_type","target_id");
--> statement-breakpoint
ALTER TABLE "fkh_admin_users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_admin_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "fkh_admin_users_self_select" ON "fkh_admin_users";
--> statement-breakpoint
CREATE POLICY "fkh_admin_users_self_select" ON "fkh_admin_users" FOR SELECT USING ("user_id" = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "fkh_admin_audit_actor_select" ON "fkh_admin_audit_log";
--> statement-breakpoint
CREATE POLICY "fkh_admin_audit_actor_select" ON "fkh_admin_audit_log" FOR SELECT USING ("actor_user_id" = auth.uid());
--> statement-breakpoint
INSERT INTO "fkh_plan_limits" ("plan_key", "limit_key", "limit_value_json")
VALUES
	('full', 'lifetime_full', '{"value":true}'::jsonb),
	('full', 'max_monthly_imports', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('full', 'max_friend_groups', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('full', 'max_private_challenges', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('full', 'can_use_ai_coach', '{"value":true}'::jsonb),
	('full', 'advanced_reports', '{"value":true}'::jsonb),
	('full', 'friend_comparison_insights', '{"value":true}'::jsonb),
	('full', 'challenge_analytics', '{"value":true}'::jsonb),
	('full', 'coach_dashboard', '{"value":true}'::jsonb),
	('full', 'max_player_seats', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('full', 'device_import_square', '{"value":true}'::jsonb),
	('full', 'device_import_trackman', '{"value":true}'::jsonb),
	('full', 'admin_operations', '{"value":true}'::jsonb)
ON CONFLICT ("plan_key","limit_key") DO UPDATE
SET "limit_value_json" = excluded."limit_value_json",
	"updated_at" = now();
