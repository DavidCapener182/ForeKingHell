CREATE TABLE "fkh_shot_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"filter_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_key" varchar(60) DEFAULT 'recent' NOT NULL,
	"visibility" varchar(24) DEFAULT 'private' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" varchar(60) DEFAULT 'coach' NOT NULL,
	"source_id" varchar(220),
	"club_id" uuid,
	"club_type" varchar(40),
	"title" varchar(180) NOT NULL,
	"focus_area" varchar(80) DEFAULT 'practice' NOT NULL,
	"status" varchar(24) DEFAULT 'planned' NOT NULL,
	"planned_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"target_shots" integer DEFAULT 12 NOT NULL,
	"recorded_shots" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_record_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"target_user_id" uuid,
	"target_value" double precision,
	"target_label" varchar(120),
	"notify_when_beaten" boolean DEFAULT true NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"notify_records" boolean DEFAULT true NOT NULL,
	"provider_aliases_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_user_feature_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"auto_share_rounds" boolean DEFAULT false NOT NULL,
	"auto_share_pbs" boolean DEFAULT false NOT NULL,
	"auto_share_achievements" boolean DEFAULT false NOT NULL,
	"auto_share_practice" boolean DEFAULT false NOT NULL,
	"public_share_preview" boolean DEFAULT false NOT NULL,
	"featured_record_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"highlight_settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_weekly_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"headline" varchar(220) NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" varchar(24) DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_shot_saved_views" ADD CONSTRAINT "fkh_shot_saved_views_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_practice_sessions" ADD CONSTRAINT "fkh_practice_sessions_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_practice_sessions" ADD CONSTRAINT "fkh_practice_sessions_club_id_fkh_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."fkh_clubs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_goals" ADD CONSTRAINT "fkh_course_record_goals_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_goals" ADD CONSTRAINT "fkh_course_record_goals_record_id_fkh_course_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."fkh_course_records"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_goals" ADD CONSTRAINT "fkh_course_record_goals_target_user_id_fkh_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_course_follows" ADD CONSTRAINT "fkh_course_follows_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_course_follows" ADD CONSTRAINT "fkh_course_follows_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_user_feature_preferences" ADD CONSTRAINT "fkh_user_feature_preferences_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fkh_weekly_recaps" ADD CONSTRAINT "fkh_weekly_recaps_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_shot_saved_views_user_name_idx" ON "fkh_shot_saved_views" USING btree ("user_id","name");
--> statement-breakpoint
CREATE INDEX "fkh_shot_saved_views_user_pinned_idx" ON "fkh_shot_saved_views" USING btree ("user_id","pinned");
--> statement-breakpoint
CREATE INDEX "fkh_practice_sessions_user_status_idx" ON "fkh_practice_sessions" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "fkh_practice_sessions_user_planned_idx" ON "fkh_practice_sessions" USING btree ("user_id","planned_at");
--> statement-breakpoint
CREATE INDEX "fkh_practice_sessions_source_idx" ON "fkh_practice_sessions" USING btree ("source_type","source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_course_record_goals_user_record_idx" ON "fkh_course_record_goals" USING btree ("user_id","record_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_goals_user_status_idx" ON "fkh_course_record_goals" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_goals_target_idx" ON "fkh_course_record_goals" USING btree ("target_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_course_follows_user_course_idx" ON "fkh_course_follows" USING btree ("user_id","course_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_follows_course_idx" ON "fkh_course_follows" USING btree ("course_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_weekly_recaps_user_week_idx" ON "fkh_weekly_recaps" USING btree ("user_id","week_start");
--> statement-breakpoint
CREATE INDEX "fkh_weekly_recaps_user_created_idx" ON "fkh_weekly_recaps" USING btree ("user_id","created_at");
--> statement-breakpoint
ALTER TABLE "fkh_shot_saved_views" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_practice_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_course_follows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_user_feature_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_weekly_recaps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "fkh_shot_saved_views_owner_all" ON "fkh_shot_saved_views" FOR ALL USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid()) WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_practice_sessions_owner_all" ON "fkh_practice_sessions" FOR ALL USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid()) WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_course_record_goals_owner_all" ON "fkh_course_record_goals" FOR ALL USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid()) WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_course_follows_owner_all" ON "fkh_course_follows" FOR ALL USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid()) WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_user_feature_preferences_owner_all" ON "fkh_user_feature_preferences" FOR ALL USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid()) WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_weekly_recaps_owner_all" ON "fkh_weekly_recaps" FOR ALL USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid()) WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());
