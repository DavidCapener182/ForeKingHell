CREATE TABLE "fkh_achievement_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" varchar(140) NOT NULL,
	"progress_value" double precision DEFAULT 0 NOT NULL,
	"target_value" double precision DEFAULT 1 NOT NULL,
	"metadata_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_achievement_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"registry_version" varchar(80) NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_shot_count" integer DEFAULT 0 NOT NULL,
	"last_session_count" integer DEFAULT 0 NOT NULL,
	"last_achievement_count" integer DEFAULT 0 NOT NULL,
	"metadata_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "fkh_user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" varchar(140) NOT NULL,
	"first_unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlock_count" integer DEFAULT 1 NOT NULL,
	"source_session_id" uuid,
	"source_shot_id" uuid,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_xp_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(180) NOT NULL,
	"achievement_id" varchar(140),
	"session_id" uuid,
	"shot_id" uuid,
	"dedupe_key" varchar(260) NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_achievement_progress" ADD CONSTRAINT "fkh_achievement_progress_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_achievement_sync_state" ADD CONSTRAINT "fkh_achievement_sync_state_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_user_achievements" ADD CONSTRAINT "fkh_user_achievements_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_user_achievements" ADD CONSTRAINT "fkh_user_achievements_source_session_id_fkh_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_user_achievements" ADD CONSTRAINT "fkh_user_achievements_source_shot_id_fkh_shots_id_fk" FOREIGN KEY ("source_shot_id") REFERENCES "public"."fkh_shots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_xp_ledger" ADD CONSTRAINT "fkh_xp_ledger_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_xp_ledger" ADD CONSTRAINT "fkh_xp_ledger_session_id_fkh_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_xp_ledger" ADD CONSTRAINT "fkh_xp_ledger_shot_id_fkh_shots_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."fkh_shots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_achievement_progress_user_achievement_idx" ON "fkh_achievement_progress" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "fkh_achievement_progress_user_idx" ON "fkh_achievement_progress" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_achievement_sync_state_user_idx" ON "fkh_achievement_sync_state" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_user_achievements_user_achievement_idx" ON "fkh_user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "fkh_user_achievements_user_unlocked_idx" ON "fkh_user_achievements" USING btree ("user_id","last_unlocked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_xp_ledger_user_dedupe_idx" ON "fkh_xp_ledger" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "fkh_xp_ledger_user_created_idx" ON "fkh_xp_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fkh_xp_ledger_user_achievement_idx" ON "fkh_xp_ledger" USING btree ("user_id","achievement_id");