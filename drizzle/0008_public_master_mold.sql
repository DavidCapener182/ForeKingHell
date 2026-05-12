CREATE TABLE "fkh_account_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"invited_email" varchar(320) NOT NULL,
	"role" varchar(24) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_account_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"member_user_id" uuid NOT NULL,
	"role" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_ball_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand" varchar(120),
	"model" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_club_equipment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"ball_model_id" uuid,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"loft_deg" double precision,
	"lie_deg" double precision,
	"shaft" varchar(180),
	"swing_weight" varchar(40),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_import_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"source" varchar(40) NOT NULL,
	"file_name" varchar(260) NOT NULL,
	"file_size_bytes" integer,
	"raw_csv_hash" varchar(64) NOT NULL,
	"parse_version" varchar(80) DEFAULT 'rapsodo-v1' NOT NULL,
	"status" varchar(32) DEFAULT 'saved' NOT NULL,
	"duplicate_of_file_id" uuid,
	"reprocessed_from_file_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_strokes_gained_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(40) NOT NULL,
	"lie" varchar(40) NOT NULL,
	"distance_start_yd" integer NOT NULL,
	"distance_end_yd" integer NOT NULL,
	"expected_strokes" double precision NOT NULL,
	"source" varchar(80) DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_strokes_gained_shot_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"shot_id" uuid,
	"hole_number" integer,
	"stroke_number" integer,
	"category" varchar(40) NOT NULL,
	"start_lie" varchar(40) NOT NULL,
	"end_lie" varchar(40),
	"start_distance_yd" double precision,
	"end_distance_yd" double precision,
	"penalty_strokes" double precision DEFAULT 0 NOT NULL,
	"strokes_gained" double precision,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_courses" ADD COLUMN "visibility" varchar(24) DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "fkh_courses" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "fkh_users" ADD COLUMN "theme" varchar(16) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "fkh_users" ADD COLUMN "table_density" varchar(16) DEFAULT 'comfortable' NOT NULL;--> statement-breakpoint
ALTER TABLE "fkh_users" ADD COLUMN "dashboard_pins" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fkh_users" ADD COLUMN "privacy_settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fkh_users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fkh_account_invitations" ADD CONSTRAINT "fkh_account_invitations_owner_user_id_fkh_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_account_invitations" ADD CONSTRAINT "fkh_account_invitations_accepted_by_user_id_fkh_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_account_memberships" ADD CONSTRAINT "fkh_account_memberships_owner_user_id_fkh_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_account_memberships" ADD CONSTRAINT "fkh_account_memberships_member_user_id_fkh_users_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_ball_models" ADD CONSTRAINT "fkh_ball_models_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_club_equipment_history" ADD CONSTRAINT "fkh_club_equipment_history_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_club_equipment_history" ADD CONSTRAINT "fkh_club_equipment_history_club_id_fkh_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."fkh_clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_club_equipment_history" ADD CONSTRAINT "fkh_club_equipment_history_ball_model_id_fkh_ball_models_id_fk" FOREIGN KEY ("ball_model_id") REFERENCES "public"."fkh_ball_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_import_files" ADD CONSTRAINT "fkh_import_files_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_import_files" ADD CONSTRAINT "fkh_import_files_session_id_fkh_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_strokes_gained_shot_events" ADD CONSTRAINT "fkh_strokes_gained_shot_events_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_strokes_gained_shot_events" ADD CONSTRAINT "fkh_strokes_gained_shot_events_session_id_fkh_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_strokes_gained_shot_events" ADD CONSTRAINT "fkh_strokes_gained_shot_events_shot_id_fkh_shots_id_fk" FOREIGN KEY ("shot_id") REFERENCES "public"."fkh_shots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_account_invitations_token_hash_idx" ON "fkh_account_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "fkh_account_invitations_owner_idx" ON "fkh_account_invitations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "fkh_account_invitations_email_idx" ON "fkh_account_invitations" USING btree ("invited_email");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_account_memberships_owner_member_idx" ON "fkh_account_memberships" USING btree ("owner_user_id","member_user_id");--> statement-breakpoint
CREATE INDEX "fkh_account_memberships_member_idx" ON "fkh_account_memberships" USING btree ("member_user_id");--> statement-breakpoint
CREATE INDEX "fkh_account_memberships_owner_role_idx" ON "fkh_account_memberships" USING btree ("owner_user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_ball_models_user_model_idx" ON "fkh_ball_models" USING btree ("user_id","brand","model");--> statement-breakpoint
CREATE INDEX "fkh_ball_models_user_active_idx" ON "fkh_ball_models" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "fkh_club_equipment_user_club_idx" ON "fkh_club_equipment_history" USING btree ("user_id","club_id");--> statement-breakpoint
CREATE INDEX "fkh_club_equipment_effective_idx" ON "fkh_club_equipment_history" USING btree ("club_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_import_files_user_hash_idx" ON "fkh_import_files" USING btree ("user_id","raw_csv_hash");--> statement-breakpoint
CREATE INDEX "fkh_import_files_user_created_idx" ON "fkh_import_files" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fkh_import_files_session_idx" ON "fkh_import_files" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "fkh_import_files_duplicate_idx" ON "fkh_import_files" USING btree ("duplicate_of_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_sg_baselines_bucket_idx" ON "fkh_strokes_gained_baselines" USING btree ("category","lie","distance_start_yd","distance_end_yd","source");--> statement-breakpoint
CREATE INDEX "fkh_sg_events_user_session_idx" ON "fkh_strokes_gained_shot_events" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "fkh_sg_events_user_category_idx" ON "fkh_strokes_gained_shot_events" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "fkh_sg_events_shot_idx" ON "fkh_strokes_gained_shot_events" USING btree ("shot_id");--> statement-breakpoint
ALTER TABLE "fkh_courses" ADD CONSTRAINT "fkh_courses_created_by_user_id_fkh_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fkh_courses_created_by_idx" ON "fkh_courses" USING btree ("created_by_user_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_access_user(owner_id uuid, allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.fkh_account_memberships membership
      WHERE membership.owner_user_id = owner_id
        AND membership.member_user_id = auth.uid()
        AND membership.role = ANY(allowed_roles)
    );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_read_course(course_row public.fkh_courses)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    course_row.visibility = 'shared'
    OR course_row.created_by_user_id = auth.uid()
    OR public.fkh_can_access_user(course_row.created_by_user_id, ARRAY['coach','viewer','editor']);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_write_course(course_row public.fkh_courses)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT course_row.created_by_user_id = auth.uid();
$$;
--> statement-breakpoint
ALTER TABLE "fkh_users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_account_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_account_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_clubs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_courses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_tee_sets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_holes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_import_rows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_import_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_shots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_ball_models" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_club_equipment_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_user_achievements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_xp_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_achievement_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_achievement_sync_state" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_rapsodo_sync_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_strokes_gained_baselines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_strokes_gained_shot_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "fkh_users_select_accessible" ON "fkh_users" FOR SELECT USING (public.fkh_can_access_user(id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_users_insert_self" ON "fkh_users" FOR INSERT WITH CHECK (id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_users_update_self" ON "fkh_users" FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_account_memberships_select_related" ON "fkh_account_memberships" FOR SELECT USING (owner_user_id = auth.uid() OR member_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_account_memberships_owner_write" ON "fkh_account_memberships" FOR ALL USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_account_invitations_select_related" ON "fkh_account_invitations" FOR SELECT USING (owner_user_id = auth.uid() OR lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
--> statement-breakpoint
CREATE POLICY "fkh_account_invitations_owner_write" ON "fkh_account_invitations" FOR ALL USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_courses_select_accessible" ON "fkh_courses" FOR SELECT USING (public.fkh_can_read_course(fkh_courses));
--> statement-breakpoint
CREATE POLICY "fkh_courses_insert_owned" ON "fkh_courses" FOR INSERT WITH CHECK (created_by_user_id = auth.uid() OR (visibility = 'shared' AND created_by_user_id IS NULL));
--> statement-breakpoint
CREATE POLICY "fkh_courses_update_owned" ON "fkh_courses" FOR UPDATE USING (public.fkh_can_write_course(fkh_courses)) WITH CHECK (created_by_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_courses_delete_owned" ON "fkh_courses" FOR DELETE USING (public.fkh_can_write_course(fkh_courses));
--> statement-breakpoint
CREATE POLICY "fkh_tee_sets_select_course_access" ON "fkh_tee_sets" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_courses course WHERE course.id = course_id AND public.fkh_can_read_course(course)));
--> statement-breakpoint
CREATE POLICY "fkh_tee_sets_write_course_owner" ON "fkh_tee_sets" FOR ALL USING (EXISTS (SELECT 1 FROM public.fkh_courses course WHERE course.id = course_id AND public.fkh_can_write_course(course))) WITH CHECK (EXISTS (SELECT 1 FROM public.fkh_courses course WHERE course.id = course_id AND public.fkh_can_write_course(course)));
--> statement-breakpoint
CREATE POLICY "fkh_holes_select_course_access" ON "fkh_holes" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_courses course WHERE course.id = course_id AND public.fkh_can_read_course(course)));
--> statement-breakpoint
CREATE POLICY "fkh_holes_write_course_owner" ON "fkh_holes" FOR ALL USING (EXISTS (SELECT 1 FROM public.fkh_courses course WHERE course.id = course_id AND public.fkh_can_write_course(course))) WITH CHECK (EXISTS (SELECT 1 FROM public.fkh_courses course WHERE course.id = course_id AND public.fkh_can_write_course(course)));
--> statement-breakpoint
CREATE POLICY "fkh_sg_baselines_select_authenticated" ON "fkh_strokes_gained_baselines" FOR SELECT USING (auth.uid() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY "fkh_clubs_select_accessible" ON "fkh_clubs" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_clubs_insert_owner" ON "fkh_clubs" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_clubs_update_owner_or_editor" ON "fkh_clubs" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_clubs_delete_owner" ON "fkh_clubs" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_sessions_select_accessible" ON "fkh_sessions" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_sessions_insert_owner" ON "fkh_sessions" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_sessions_update_owner_or_editor" ON "fkh_sessions" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_sessions_delete_owner" ON "fkh_sessions" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_import_rows_select_accessible" ON "fkh_import_rows" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_import_rows_insert_owner" ON "fkh_import_rows" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_import_rows_update_owner_or_editor" ON "fkh_import_rows" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_import_rows_delete_owner" ON "fkh_import_rows" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_import_files_select_accessible" ON "fkh_import_files" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_import_files_insert_owner" ON "fkh_import_files" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_import_files_update_owner_or_editor" ON "fkh_import_files" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_import_files_delete_owner" ON "fkh_import_files" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_shots_select_accessible" ON "fkh_shots" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_shots_insert_owner" ON "fkh_shots" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_shots_update_owner_or_editor" ON "fkh_shots" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_shots_delete_owner" ON "fkh_shots" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_stock_yardages_select_accessible" ON "fkh_stock_yardages" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_stock_yardages_insert_owner" ON "fkh_stock_yardages" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_stock_yardages_update_owner_or_editor" ON "fkh_stock_yardages" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_stock_yardages_delete_owner" ON "fkh_stock_yardages" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_ball_models_select_accessible" ON "fkh_ball_models" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_ball_models_insert_owner" ON "fkh_ball_models" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_ball_models_update_owner_or_editor" ON "fkh_ball_models" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_ball_models_delete_owner" ON "fkh_ball_models" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_club_equipment_select_accessible" ON "fkh_club_equipment_history" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_club_equipment_insert_owner" ON "fkh_club_equipment_history" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_club_equipment_update_owner_or_editor" ON "fkh_club_equipment_history" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_club_equipment_delete_owner" ON "fkh_club_equipment_history" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_user_achievements_select_accessible" ON "fkh_user_achievements" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_user_achievements_insert_owner" ON "fkh_user_achievements" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_user_achievements_update_owner_or_editor" ON "fkh_user_achievements" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_user_achievements_delete_owner" ON "fkh_user_achievements" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_xp_ledger_select_accessible" ON "fkh_xp_ledger" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_xp_ledger_insert_owner" ON "fkh_xp_ledger" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_xp_ledger_update_owner_or_editor" ON "fkh_xp_ledger" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_xp_ledger_delete_owner" ON "fkh_xp_ledger" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_achievement_progress_select_accessible" ON "fkh_achievement_progress" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_achievement_progress_insert_owner" ON "fkh_achievement_progress" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_achievement_progress_update_owner_or_editor" ON "fkh_achievement_progress" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_achievement_progress_delete_owner" ON "fkh_achievement_progress" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_achievement_sync_select_accessible" ON "fkh_achievement_sync_state" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_achievement_sync_insert_owner" ON "fkh_achievement_sync_state" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_achievement_sync_update_owner_or_editor" ON "fkh_achievement_sync_state" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_achievement_sync_delete_owner" ON "fkh_achievement_sync_state" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_rapsodo_sync_select_accessible" ON "fkh_rapsodo_sync_sessions" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_rapsodo_sync_insert_owner" ON "fkh_rapsodo_sync_sessions" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_rapsodo_sync_update_owner_or_editor" ON "fkh_rapsodo_sync_sessions" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_rapsodo_sync_delete_owner" ON "fkh_rapsodo_sync_sessions" FOR DELETE USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_sg_events_select_accessible" ON "fkh_strokes_gained_shot_events" FOR SELECT USING (public.fkh_can_access_user(user_id, ARRAY['coach','viewer','editor']));
--> statement-breakpoint
CREATE POLICY "fkh_sg_events_insert_owner" ON "fkh_strokes_gained_shot_events" FOR INSERT WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_sg_events_update_owner_or_editor" ON "fkh_strokes_gained_shot_events" FOR UPDATE USING (public.fkh_can_access_user(user_id, ARRAY['editor'])) WITH CHECK (public.fkh_can_access_user(user_id, ARRAY['editor']));
--> statement-breakpoint
CREATE POLICY "fkh_sg_events_delete_owner" ON "fkh_strokes_gained_shot_events" FOR DELETE USING (user_id = auth.uid());
