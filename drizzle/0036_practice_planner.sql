CREATE TABLE IF NOT EXISTS "fkh_practice_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "fkh_users"("id") ON DELETE cascade,
  "template_type" varchar(32) DEFAULT 'user' NOT NULL,
  "session_type" varchar(32) NOT NULL,
  "title" varchar(180) NOT NULL,
  "description" text,
  "inputs_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "blocks_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_practice_templates_user_type_idx"
  ON "fkh_practice_templates" ("user_id", "session_type");
CREATE INDEX IF NOT EXISTS "fkh_practice_templates_active_idx"
  ON "fkh_practice_templates" ("active", "template_type");

ALTER TABLE "fkh_practice_templates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_practice_templates_select_owner_or_system" ON "fkh_practice_templates";
CREATE POLICY "fkh_practice_templates_select_owner_or_system"
  ON "fkh_practice_templates"
  FOR SELECT
  USING ("user_id" IS NULL OR (auth.uid() IS NOT NULL AND "user_id" = auth.uid()));

DROP POLICY IF EXISTS "fkh_practice_templates_owner_all" ON "fkh_practice_templates";
CREATE POLICY "fkh_practice_templates_owner_all"
  ON "fkh_practice_templates"
  FOR ALL
  USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());

CREATE TABLE IF NOT EXISTS "fkh_practice_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "template_id" uuid REFERENCES "fkh_practice_templates"("id") ON DELETE set null,
  "source_session_id" uuid REFERENCES "fkh_sessions"("id") ON DELETE set null,
  "session_type" varchar(32) NOT NULL,
  "ball_count" integer,
  "time_minutes" integer NOT NULL,
  "energy_level" varchar(32) NOT NULL,
  "intent" varchar(40) NOT NULL,
  "facility_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "context_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "focus_clubs_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "title" varchar(180) NOT NULL,
  "generated_summary" text NOT NULL,
  "status" varchar(24) DEFAULT 'planned' NOT NULL,
  "practice_score" integer,
  "planned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_practice_plans_user_status_idx"
  ON "fkh_practice_plans" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "fkh_practice_plans_user_planned_idx"
  ON "fkh_practice_plans" ("user_id", "planned_at");
CREATE INDEX IF NOT EXISTS "fkh_practice_plans_source_session_idx"
  ON "fkh_practice_plans" ("source_session_id");

ALTER TABLE "fkh_practice_plans" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_practice_plans_owner_all" ON "fkh_practice_plans";
CREATE POLICY "fkh_practice_plans_owner_all"
  ON "fkh_practice_plans"
  FOR ALL
  USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());

CREATE TABLE IF NOT EXISTS "fkh_practice_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "practice_plan_id" uuid NOT NULL REFERENCES "fkh_practice_plans"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "block_order" integer NOT NULL,
  "block_type" varchar(40) NOT NULL,
  "title" varchar(180) NOT NULL,
  "clubs_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ball_count" integer,
  "time_minutes" integer NOT NULL,
  "goal" text NOT NULL,
  "drill" text NOT NULL,
  "success_criteria" text NOT NULL,
  "record_prompt" text NOT NULL,
  "scoring_rules_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_practice_blocks_plan_order_idx"
  ON "fkh_practice_blocks" ("practice_plan_id", "block_order");
CREATE INDEX IF NOT EXISTS "fkh_practice_blocks_user_idx"
  ON "fkh_practice_blocks" ("user_id");

ALTER TABLE "fkh_practice_blocks" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_practice_blocks_owner_all" ON "fkh_practice_blocks";
CREATE POLICY "fkh_practice_blocks_owner_all"
  ON "fkh_practice_blocks"
  FOR ALL
  USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());

CREATE TABLE IF NOT EXISTS "fkh_practice_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "practice_plan_id" uuid NOT NULL REFERENCES "fkh_practice_plans"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "source_session_id" uuid REFERENCES "fkh_sessions"("id") ON DELETE set null,
  "completion_status" varchar(24) DEFAULT 'complete' NOT NULL,
  "actual_balls" integer,
  "actual_minutes" integer,
  "practice_score" integer DEFAULT 0 NOT NULL,
  "verdict" varchar(80) NOT NULL,
  "next_action" text NOT NULL,
  "notes" text,
  "comparison_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "fkh_practice_results_plan_idx"
  ON "fkh_practice_results" ("practice_plan_id");
CREATE INDEX IF NOT EXISTS "fkh_practice_results_user_created_idx"
  ON "fkh_practice_results" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "fkh_practice_results_source_session_idx"
  ON "fkh_practice_results" ("source_session_id");

ALTER TABLE "fkh_practice_results" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_practice_results_owner_all" ON "fkh_practice_results";
CREATE POLICY "fkh_practice_results_owner_all"
  ON "fkh_practice_results"
  FOR ALL
  USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());

CREATE TABLE IF NOT EXISTS "fkh_practice_block_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "practice_result_id" uuid NOT NULL REFERENCES "fkh_practice_results"("id") ON DELETE cascade,
  "practice_block_id" uuid NOT NULL REFERENCES "fkh_practice_blocks"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "completion_status" varchar(24) DEFAULT 'complete' NOT NULL,
  "actual_balls" integer,
  "actual_minutes" integer,
  "score" integer,
  "passed" boolean DEFAULT false NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "fkh_practice_block_results_result_block_idx"
  ON "fkh_practice_block_results" ("practice_result_id", "practice_block_id");
CREATE INDEX IF NOT EXISTS "fkh_practice_block_results_user_idx"
  ON "fkh_practice_block_results" ("user_id");

ALTER TABLE "fkh_practice_block_results" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_practice_block_results_owner_all" ON "fkh_practice_block_results";
CREATE POLICY "fkh_practice_block_results_owner_all"
  ON "fkh_practice_block_results"
  FOR ALL
  USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());
