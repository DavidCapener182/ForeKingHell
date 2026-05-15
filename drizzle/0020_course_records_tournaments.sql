CREATE TABLE "fkh_course_provider_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "provider_kind" varchar(40) NOT NULL,
  "provider_course_id" varchar(180),
  "provider_course_name" varchar(220) NOT NULL,
  "provider_tee_name" varchar(120),
  "normalised_name" varchar(220) NOT NULL,
  "confidence_score" double precision DEFAULT 0.6 NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_record_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(80) NOT NULL,
  "name" varchar(160) NOT NULL,
  "description" text,
  "record_type" varchar(60) NOT NULL,
  "metric_kind" varchar(40) DEFAULT 'score' NOT NULL,
  "scoring_direction" varchar(12) DEFAULT 'asc' NOT NULL,
  "scope_default" varchar(24) DEFAULT 'public' NOT NULL,
  "verification_required" varchar(40) DEFAULT 'silver' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "tee_set_id" uuid,
  "group_id" uuid,
  "created_by_user_id" uuid,
  "record_type" varchar(60) NOT NULL,
  "scope" varchar(24) DEFAULT 'public' NOT NULL,
  "period" varchar(24) DEFAULT 'all_time' NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "verification_required" varchar(40) DEFAULT 'silver' NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "best_result_id" uuid,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_record_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "record_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "tee_set_id" uuid,
  "user_id" uuid NOT NULL,
  "session_id" uuid,
  "round_id" uuid,
  "challenge_id" uuid,
  "score" integer,
  "net_score" integer,
  "stableford_points" integer,
  "metric_value" double precision NOT NULL,
  "metric_label" varchar(80) NOT NULL,
  "verification_status" varchar(40) DEFAULT 'pending_evidence' NOT NULL,
  "verification_tier" varchar(24) DEFAULT 'unverified' NOT NULL,
  "source_kind" varchar(60) DEFAULT 'manual' NOT NULL,
  "proof_status" varchar(40) DEFAULT 'pending_evidence' NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_record_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "record_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "best_attempt_id" uuid,
  "rank" integer,
  "metric_value" double precision NOT NULL,
  "score_label" varchar(120) NOT NULL,
  "verification_status" varchar(40) DEFAULT 'pending_evidence' NOT NULL,
  "verification_tier" varchar(24) DEFAULT 'unverified' NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "tie_breaker_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_record_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL,
  "evidence_type" varchar(60) NOT NULL,
  "storage_path" text,
  "import_source_file_id" uuid,
  "rapsodo_sync_session_id" uuid,
  "csv_hash" varchar(64),
  "extracted_scorecard_total" integer,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "review_status" varchar(40) DEFAULT 'pending' NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_course_record_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL,
  "reporter_user_id" uuid,
  "flag_type" varchar(60) NOT NULL,
  "reason" text,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_tournaments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(180) NOT NULL,
  "description" text,
  "course_id" uuid,
  "tee_set_id" uuid,
  "format" varchar(40) DEFAULT 'two_round_open' NOT NULL,
  "visibility" varchar(24) DEFAULT 'friends' NOT NULL,
  "status" varchar(24) DEFAULT 'open' NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "round_count" integer DEFAULT 2 NOT NULL,
  "verification_policy" varchar(40) DEFAULT 'silver' NOT NULL,
  "screenshot_required" boolean DEFAULT false NOT NULL,
  "direct_rapsodo_required" boolean DEFAULT false NOT NULL,
  "cut_rule_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "playoff_rule_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "group_id" uuid,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_rounds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "round_number" integer NOT NULL,
  "title" varchar(160),
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "status" varchar(24) DEFAULT 'scheduled' NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" varchar(24) DEFAULT 'entered' NOT NULL,
  "seed" integer,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "withdrawn_at" timestamp with time zone,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "entry_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "round_number" integer NOT NULL,
  "session_id" uuid,
  "scorecard_session_id" uuid,
  "gross_score" integer NOT NULL,
  "net_score" integer,
  "stableford_points" integer,
  "rapsodo_sync_session_id" uuid,
  "import_source_file_id" uuid,
  "scorecard_screenshot_path" text,
  "extracted_scorecard_total" integer,
  "verification_status" varchar(40) DEFAULT 'pending_evidence' NOT NULL,
  "verification_tier" varchar(24) DEFAULT 'unverified' NOT NULL,
  "proof_status" varchar(40) DEFAULT 'pending_evidence' NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL,
  "evidence_type" varchar(60) NOT NULL,
  "storage_path" text,
  "import_source_file_id" uuid,
  "rapsodo_sync_session_id" uuid,
  "csv_hash" varchar(64),
  "extracted_scorecard_total" integer,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "review_status" varchar(40) DEFAULT 'pending' NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_standings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "entry_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "gross_total" integer DEFAULT 0 NOT NULL,
  "net_total" integer,
  "stableford_total" integer,
  "rounds_completed" integer DEFAULT 0 NOT NULL,
  "rank" integer,
  "tie_breaker_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "inviter_user_id" uuid NOT NULL,
  "invitee_user_id" uuid,
  "invitee_email" varchar(320),
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_tournament_prizes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "sponsor_id" uuid,
  "title" varchar(160) NOT NULL,
  "description" text,
  "prize_type" varchar(40) DEFAULT 'badge' NOT NULL,
  "rank_start" integer,
  "rank_end" integer,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_course_provider_aliases" ADD CONSTRAINT "fkh_course_provider_aliases_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_records" ADD CONSTRAINT "fkh_course_records_category_id_fkh_course_record_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fkh_course_record_categories"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_records" ADD CONSTRAINT "fkh_course_records_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_records" ADD CONSTRAINT "fkh_course_records_tee_set_id_fkh_tee_sets_id_fk" FOREIGN KEY ("tee_set_id") REFERENCES "public"."fkh_tee_sets"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_records" ADD CONSTRAINT "fkh_course_records_group_id_fkh_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."fkh_groups"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_records" ADD CONSTRAINT "fkh_course_records_created_by_user_id_fkh_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_record_id_fkh_course_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."fkh_course_records"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_category_id_fkh_course_record_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fkh_course_record_categories"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_tee_set_id_fkh_tee_sets_id_fk" FOREIGN KEY ("tee_set_id") REFERENCES "public"."fkh_tee_sets"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_session_id_fkh_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_round_id_fkh_sessions_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_attempts" ADD CONSTRAINT "fkh_course_record_attempts_challenge_id_fkh_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."fkh_challenges"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_results" ADD CONSTRAINT "fkh_course_record_results_record_id_fkh_course_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."fkh_course_records"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_results" ADD CONSTRAINT "fkh_course_record_results_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_results" ADD CONSTRAINT "fkh_course_record_results_best_attempt_id_fkh_course_record_attempts_id_fk" FOREIGN KEY ("best_attempt_id") REFERENCES "public"."fkh_course_record_attempts"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_evidence" ADD CONSTRAINT "fkh_course_record_evidence_attempt_id_fkh_course_record_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."fkh_course_record_attempts"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_evidence" ADD CONSTRAINT "fkh_course_record_evidence_import_source_file_id_fkh_import_source_files_id_fk" FOREIGN KEY ("import_source_file_id") REFERENCES "public"."fkh_import_source_files"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_evidence" ADD CONSTRAINT "fkh_course_record_evidence_rapsodo_sync_session_id_fkh_rapsodo_sync_sessions_id_fk" FOREIGN KEY ("rapsodo_sync_session_id") REFERENCES "public"."fkh_rapsodo_sync_sessions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_evidence" ADD CONSTRAINT "fkh_course_record_evidence_reviewed_by_fkh_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."fkh_users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_flags" ADD CONSTRAINT "fkh_course_record_flags_attempt_id_fkh_course_record_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."fkh_course_record_attempts"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_course_record_flags" ADD CONSTRAINT "fkh_course_record_flags_reporter_user_id_fkh_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournaments" ADD CONSTRAINT "fkh_tournaments_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournaments" ADD CONSTRAINT "fkh_tournaments_tee_set_id_fkh_tee_sets_id_fk" FOREIGN KEY ("tee_set_id") REFERENCES "public"."fkh_tee_sets"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournaments" ADD CONSTRAINT "fkh_tournaments_created_by_user_id_fkh_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournaments" ADD CONSTRAINT "fkh_tournaments_group_id_fkh_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."fkh_groups"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_rounds" ADD CONSTRAINT "fkh_tournament_rounds_tournament_id_fkh_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."fkh_tournaments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_entries" ADD CONSTRAINT "fkh_tournament_entries_tournament_id_fkh_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."fkh_tournaments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_entries" ADD CONSTRAINT "fkh_tournament_entries_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_submissions" ADD CONSTRAINT "fkh_tournament_submissions_tournament_id_fkh_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."fkh_tournaments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_submissions" ADD CONSTRAINT "fkh_tournament_submissions_entry_id_fkh_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."fkh_tournament_entries"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_submissions" ADD CONSTRAINT "fkh_tournament_submissions_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_submissions" ADD CONSTRAINT "fkh_tournament_submissions_session_id_fkh_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_submissions" ADD CONSTRAINT "fkh_tournament_submissions_scorecard_session_id_fkh_sessions_id_fk" FOREIGN KEY ("scorecard_session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_submissions" ADD CONSTRAINT "fkh_tournament_submissions_rapsodo_sync_session_id_fkh_rapsodo_sync_sessions_id_fk" FOREIGN KEY ("rapsodo_sync_session_id") REFERENCES "public"."fkh_rapsodo_sync_sessions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_submissions" ADD CONSTRAINT "fkh_tournament_submissions_import_source_file_id_fkh_import_source_files_id_fk" FOREIGN KEY ("import_source_file_id") REFERENCES "public"."fkh_import_source_files"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_evidence" ADD CONSTRAINT "fkh_tournament_evidence_submission_id_fkh_tournament_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."fkh_tournament_submissions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_evidence" ADD CONSTRAINT "fkh_tournament_evidence_import_source_file_id_fkh_import_source_files_id_fk" FOREIGN KEY ("import_source_file_id") REFERENCES "public"."fkh_import_source_files"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_evidence" ADD CONSTRAINT "fkh_tournament_evidence_rapsodo_sync_session_id_fkh_rapsodo_sync_sessions_id_fk" FOREIGN KEY ("rapsodo_sync_session_id") REFERENCES "public"."fkh_rapsodo_sync_sessions"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_evidence" ADD CONSTRAINT "fkh_tournament_evidence_reviewed_by_fkh_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."fkh_users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_standings" ADD CONSTRAINT "fkh_tournament_standings_tournament_id_fkh_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."fkh_tournaments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_standings" ADD CONSTRAINT "fkh_tournament_standings_entry_id_fkh_tournament_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."fkh_tournament_entries"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_standings" ADD CONSTRAINT "fkh_tournament_standings_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_comments" ADD CONSTRAINT "fkh_tournament_comments_tournament_id_fkh_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."fkh_tournaments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_comments" ADD CONSTRAINT "fkh_tournament_comments_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_invites" ADD CONSTRAINT "fkh_tournament_invites_tournament_id_fkh_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."fkh_tournaments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_invites" ADD CONSTRAINT "fkh_tournament_invites_inviter_user_id_fkh_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_invites" ADD CONSTRAINT "fkh_tournament_invites_invitee_user_id_fkh_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_prizes" ADD CONSTRAINT "fkh_tournament_prizes_tournament_id_fkh_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."fkh_tournaments"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fkh_tournament_prizes" ADD CONSTRAINT "fkh_tournament_prizes_sponsor_id_fkh_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."fkh_sponsors"("id") ON DELETE set null;
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_course_provider_aliases_provider_idx" ON "fkh_course_provider_aliases" USING btree ("provider_kind","provider_course_id","provider_course_name","provider_tee_name");
--> statement-breakpoint
CREATE INDEX "fkh_course_provider_aliases_course_idx" ON "fkh_course_provider_aliases" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_provider_aliases_normalised_idx" ON "fkh_course_provider_aliases" USING btree ("normalised_name");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_course_record_categories_slug_idx" ON "fkh_course_record_categories" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_categories_type_idx" ON "fkh_course_record_categories" USING btree ("record_type");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_categories_active_sort_idx" ON "fkh_course_record_categories" USING btree ("active","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_course_records_unique_scope_idx" ON "fkh_course_records" USING btree ("category_id","course_id","tee_set_id","scope","period","group_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_records_course_scope_idx" ON "fkh_course_records" USING btree ("course_id","scope","period");
--> statement-breakpoint
CREATE INDEX "fkh_course_records_best_idx" ON "fkh_course_records" USING btree ("best_result_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_records_group_idx" ON "fkh_course_records" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_attempts_record_user_idx" ON "fkh_course_record_attempts" USING btree ("record_id","user_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_attempts_course_user_idx" ON "fkh_course_record_attempts" USING btree ("course_id","user_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_attempts_session_idx" ON "fkh_course_record_attempts" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_attempts_status_idx" ON "fkh_course_record_attempts" USING btree ("verification_status");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_course_record_results_record_user_idx" ON "fkh_course_record_results" USING btree ("record_id","user_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_results_record_rank_idx" ON "fkh_course_record_results" USING btree ("record_id","rank");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_results_user_idx" ON "fkh_course_record_results" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_evidence_attempt_idx" ON "fkh_course_record_evidence" USING btree ("attempt_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_evidence_csv_hash_idx" ON "fkh_course_record_evidence" USING btree ("csv_hash");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_evidence_review_idx" ON "fkh_course_record_evidence" USING btree ("review_status");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_flags_attempt_idx" ON "fkh_course_record_flags" USING btree ("attempt_id");
--> statement-breakpoint
CREATE INDEX "fkh_course_record_flags_status_idx" ON "fkh_course_record_flags" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "fkh_tournaments_creator_idx" ON "fkh_tournaments" USING btree ("created_by_user_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournaments_course_status_idx" ON "fkh_tournaments" USING btree ("course_id","status");
--> statement-breakpoint
CREATE INDEX "fkh_tournaments_visibility_status_idx" ON "fkh_tournaments" USING btree ("visibility","status");
--> statement-breakpoint
CREATE INDEX "fkh_tournaments_group_idx" ON "fkh_tournaments" USING btree ("group_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_tournament_rounds_number_idx" ON "fkh_tournament_rounds" USING btree ("tournament_id","round_number");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_rounds_status_idx" ON "fkh_tournament_rounds" USING btree ("tournament_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_tournament_entries_tournament_user_idx" ON "fkh_tournament_entries" USING btree ("tournament_id","user_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_entries_user_idx" ON "fkh_tournament_entries" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_entries_status_idx" ON "fkh_tournament_entries" USING btree ("tournament_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_tournament_submissions_entry_round_idx" ON "fkh_tournament_submissions" USING btree ("entry_id","round_number");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_submissions_tournament_round_idx" ON "fkh_tournament_submissions" USING btree ("tournament_id","round_number");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_submissions_status_idx" ON "fkh_tournament_submissions" USING btree ("verification_status");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_submissions_session_idx" ON "fkh_tournament_submissions" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_evidence_submission_idx" ON "fkh_tournament_evidence" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_evidence_csv_hash_idx" ON "fkh_tournament_evidence" USING btree ("csv_hash");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_evidence_review_idx" ON "fkh_tournament_evidence" USING btree ("review_status");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_tournament_standings_entry_idx" ON "fkh_tournament_standings" USING btree ("entry_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_standings_rank_idx" ON "fkh_tournament_standings" USING btree ("tournament_id","rank");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_standings_user_idx" ON "fkh_tournament_standings" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_comments_tournament_created_idx" ON "fkh_tournament_comments" USING btree ("tournament_id","created_at");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_comments_user_idx" ON "fkh_tournament_comments" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_tournament_invites_tournament_invitee_idx" ON "fkh_tournament_invites" USING btree ("tournament_id","invitee_user_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_invites_invitee_status_idx" ON "fkh_tournament_invites" USING btree ("invitee_user_id","status");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_invites_email_idx" ON "fkh_tournament_invites" USING btree ("invitee_email");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_prizes_tournament_idx" ON "fkh_tournament_prizes" USING btree ("tournament_id");
--> statement-breakpoint
CREATE INDEX "fkh_tournament_prizes_sponsor_idx" ON "fkh_tournament_prizes" USING btree ("sponsor_id");
--> statement-breakpoint
INSERT INTO "fkh_course_record_categories" ("slug", "name", "description", "record_type", "metric_kind", "scoring_direction", "verification_required", "sort_order", "metadata_json")
VALUES
  ('best-gross-score', 'Best gross score', 'Lowest verified gross score for a course and tee set.', 'best_gross_score', 'strokes', 'asc', 'silver', 10, '{"unit":"strokes"}'::jsonb),
  ('best-net-score', 'Best net score', 'Lowest verified net score for a course and tee set.', 'best_net_score', 'strokes', 'asc', 'silver', 20, '{"unit":"strokes"}'::jsonb),
  ('best-stableford', 'Best Stableford', 'Highest verified Stableford points total.', 'best_stableford', 'points', 'desc', 'silver', 30, '{"unit":"pts"}'::jsonb),
  ('best-front-nine', 'Best front nine', 'Lowest verified front-nine score.', 'best_front_nine', 'strokes', 'asc', 'silver', 40, '{"unit":"strokes"}'::jsonb),
  ('best-back-nine', 'Best back nine', 'Lowest verified back-nine score.', 'best_back_nine', 'strokes', 'asc', 'silver', 50, '{"unit":"strokes"}'::jsonb),
  ('lowest-differential', 'Lowest differential', 'Lowest handicap differential for the tee set.', 'lowest_differential', 'differential', 'asc', 'silver', 60, '{"unit":"diff"}'::jsonb),
  ('most-birdies', 'Most birdies', 'Most birdies in one verified round.', 'most_birdies', 'count', 'desc', 'silver', 70, '{"unit":"birdies"}'::jsonb),
  ('fewest-putts', 'Fewest putts', 'Fewest putts in one verified round.', 'fewest_putts', 'count', 'asc', 'silver', 80, '{"unit":"putts"}'::jsonb),
  ('longest-drive', 'Longest drive', 'Longest verified drive on this course.', 'longest_drive', 'yards', 'desc', 'gold', 90, '{"unit":"yd"}'::jsonb),
  ('closest-to-pin', 'Closest to pin', 'Closest verified approach to the pin.', 'closest_to_pin', 'yards', 'asc', 'gold', 100, '{"unit":"yd"}'::jsonb),
  ('best-hole-score', 'Best hole score', 'Best score on any mapped hole.', 'best_hole_score', 'strokes', 'asc', 'silver', 110, '{"unit":"strokes"}'::jsonb),
  ('wedge-ladder', 'Wedge ladder', 'Best verified wedge ladder score.', 'wedge_ladder', 'score', 'asc', 'gold', 120, '{"unit":"error"}'::jsonb),
  ('seven-iron-consistency', '7-iron consistency', 'Tightest verified 7-iron carry pattern.', 'seven_iron_consistency', 'yards', 'asc', 'gold', 130, '{"unit":"yd spread"}'::jsonb)
ON CONFLICT ("slug") DO UPDATE
SET "name" = excluded."name",
    "description" = excluded."description",
    "record_type" = excluded."record_type",
    "metric_kind" = excluded."metric_kind",
    "scoring_direction" = excluded."scoring_direction",
    "verification_required" = excluded."verification_required",
    "sort_order" = excluded."sort_order",
    "metadata_json" = excluded."metadata_json",
    "active" = true,
    "updated_at" = now();
--> statement-breakpoint
INSERT INTO "fkh_plan_limits" ("plan_key", "limit_key", "limit_value_json")
VALUES
  ('free', 'monthly_course_record_attempts', '{"value":5,"label":"5 verified/public attempts"}'::jsonb),
  ('free', 'can_join_public_records', '{"value":true,"label":"Public records and monthly boards"}'::jsonb),
  ('plus', 'private_course_record_boards', '{"value":true,"label":"Private friend boards"}'::jsonb),
  ('plus', 'private_friend_tournaments', '{"value":true,"label":"Private friend tournaments"}'::jsonb),
  ('pro', 'ai_record_strategy', '{"value":true,"label":"AI record strategy"}'::jsonb),
  ('pro', 'advanced_verification_analytics', '{"value":true,"label":"Advanced verification analytics"}'::jsonb),
  ('coach', 'host_major_tournaments', '{"value":true,"label":"Major-style tournament hosting"}'::jsonb),
  ('coach', 'evidence_review_queue', '{"value":true,"label":"Evidence review queue"}'::jsonb)
ON CONFLICT ("plan_key","limit_key") DO UPDATE
SET "limit_value_json" = excluded."limit_value_json",
    "updated_at" = now();
--> statement-breakpoint
ALTER TABLE "fkh_course_provider_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_course_record_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_course_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_course_record_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_course_record_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_course_record_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_course_record_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournaments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_rounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_standings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_tournament_prizes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_view_course_record(record_row public.fkh_course_records)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT record_row.scope = 'public'
    OR (
      record_row.scope = 'private'
      AND record_row.created_by_user_id = auth.uid()
    )
    OR record_row.created_by_user_id = auth.uid()
    OR (
      record_row.scope = 'friends'
      AND record_row.created_by_user_id IS NOT NULL
      AND public.fkh_are_friends(auth.uid(), record_row.created_by_user_id)
    )
    OR (
      record_row.scope = 'group'
      AND record_row.group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.fkh_group_memberships membership
        WHERE membership.group_id = record_row.group_id
          AND membership.user_id = auth.uid()
          AND membership.status = 'active'
      )
    );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_view_tournament(tournament_row public.fkh_tournaments)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT tournament_row.visibility = 'public'
    OR tournament_row.created_by_user_id = auth.uid()
    OR (
      tournament_row.visibility = 'friends'
      AND public.fkh_are_friends(auth.uid(), tournament_row.created_by_user_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.fkh_tournament_entries entry
      WHERE entry.tournament_id = tournament_row.id
        AND entry.user_id = auth.uid()
    )
    OR (
      tournament_row.visibility = 'group'
      AND tournament_row.group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.fkh_group_memberships membership
        WHERE membership.group_id = tournament_row.group_id
          AND membership.user_id = auth.uid()
          AND membership.status = 'active'
      )
    );
$$;
--> statement-breakpoint
CREATE POLICY "fkh_course_provider_aliases_select_visible_course"
ON "fkh_course_provider_aliases" FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.fkh_courses course
    WHERE course.id = course_id
      AND public.fkh_can_read_course(course)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_course_record_categories_select_active"
ON "fkh_course_record_categories" FOR SELECT
USING (active = true);
--> statement-breakpoint
CREATE POLICY "fkh_course_records_select_visible"
ON "fkh_course_records" FOR SELECT
USING (public.fkh_can_view_course_record(fkh_course_records));
--> statement-breakpoint
CREATE POLICY "fkh_course_records_insert_self"
ON "fkh_course_records" FOR INSERT
WITH CHECK (created_by_user_id = auth.uid() OR scope = 'public');
--> statement-breakpoint
CREATE POLICY "fkh_course_record_attempts_select_visible_record_or_self"
ON "fkh_course_record_attempts" FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.fkh_course_records record
    WHERE record.id = record_id
      AND public.fkh_can_view_course_record(record)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_course_record_attempts_insert_self"
ON "fkh_course_record_attempts" FOR INSERT
WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_course_record_results_select_visible_record"
ON "fkh_course_record_results" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fkh_course_records record
    WHERE record.id = record_id
      AND public.fkh_can_view_course_record(record)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_course_record_evidence_select_attempt_owner_or_admin"
ON "fkh_course_record_evidence" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fkh_course_record_attempts attempt
    WHERE attempt.id = attempt_id
      AND attempt.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.fkh_entitlements entitlement
    WHERE entitlement.user_id = auth.uid()
      AND entitlement.entitlement_key IN ('admin_operations','evidence_review_queue','lifetime_full')
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_course_record_evidence_insert_attempt_owner"
ON "fkh_course_record_evidence" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fkh_course_record_attempts attempt
    WHERE attempt.id = attempt_id
      AND attempt.user_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_course_record_flags_owner_insert"
ON "fkh_course_record_flags" FOR INSERT
WITH CHECK (reporter_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_course_record_flags_owner_select"
ON "fkh_course_record_flags" FOR SELECT
USING (reporter_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_tournaments_select_visible"
ON "fkh_tournaments" FOR SELECT
USING (public.fkh_can_view_tournament(fkh_tournaments));
--> statement-breakpoint
CREATE POLICY "fkh_tournaments_insert_self"
ON "fkh_tournaments" FOR INSERT
WITH CHECK (created_by_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_tournament_rounds_select_visible_tournament"
ON "fkh_tournament_rounds" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fkh_tournaments tournament
    WHERE tournament.id = tournament_id
      AND public.fkh_can_view_tournament(tournament)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_entries_select_visible_tournament_or_self"
ON "fkh_tournament_entries" FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.fkh_tournaments tournament
    WHERE tournament.id = tournament_id
      AND public.fkh_can_view_tournament(tournament)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_entries_insert_self"
ON "fkh_tournament_entries" FOR INSERT
WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_tournament_submissions_select_visible_tournament_or_self"
ON "fkh_tournament_submissions" FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.fkh_tournaments tournament
    WHERE tournament.id = tournament_id
      AND public.fkh_can_view_tournament(tournament)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_submissions_insert_self"
ON "fkh_tournament_submissions" FOR INSERT
WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_tournament_evidence_select_submission_owner_or_admin"
ON "fkh_tournament_evidence" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fkh_tournament_submissions submission
    WHERE submission.id = submission_id
      AND submission.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.fkh_entitlements entitlement
    WHERE entitlement.user_id = auth.uid()
      AND entitlement.entitlement_key IN ('admin_operations','evidence_review_queue','lifetime_full')
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_evidence_insert_submission_owner"
ON "fkh_tournament_evidence" FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fkh_tournament_submissions submission
    WHERE submission.id = submission_id
      AND submission.user_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_standings_select_visible_tournament"
ON "fkh_tournament_standings" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fkh_tournaments tournament
    WHERE tournament.id = tournament_id
      AND public.fkh_can_view_tournament(tournament)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_comments_select_visible_tournament"
ON "fkh_tournament_comments" FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.fkh_tournaments tournament
    WHERE tournament.id = tournament_id
      AND public.fkh_can_view_tournament(tournament)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_comments_insert_self_visible_tournament"
ON "fkh_tournament_comments" FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.fkh_tournaments tournament
    WHERE tournament.id = tournament_id
      AND public.fkh_can_view_tournament(tournament)
  )
);
--> statement-breakpoint
CREATE POLICY "fkh_tournament_invites_select_self"
ON "fkh_tournament_invites" FOR SELECT
USING (inviter_user_id = auth.uid() OR invitee_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_tournament_prizes_select_visible_tournament"
ON "fkh_tournament_prizes" FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fkh_tournaments tournament
    WHERE tournament.id = tournament_id
      AND public.fkh_can_view_tournament(tournament)
  )
);
