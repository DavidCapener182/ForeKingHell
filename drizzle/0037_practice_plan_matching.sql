ALTER TABLE "fkh_practice_plans"
  ADD COLUMN IF NOT EXISTS "match_confidence" integer,
  ADD COLUMN IF NOT EXISTS "match_reason" text;

UPDATE "fkh_practice_plans"
SET "status" = CASE
  WHEN "status" = 'active' THEN 'awaiting_import'
  WHEN "status" = 'completed' THEN 'analysed'
  ELSE "status"
END
WHERE "status" IN ('active', 'completed');

CREATE TABLE IF NOT EXISTS "fkh_practice_plan_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "practice_plan_id" uuid NOT NULL REFERENCES "fkh_practice_plans"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "session_id" uuid NOT NULL REFERENCES "fkh_sessions"("id") ON DELETE cascade,
  "match_confidence" integer NOT NULL,
  "match_reason" text NOT NULL,
  "date_score" integer DEFAULT 0 NOT NULL,
  "session_type_score" integer DEFAULT 0 NOT NULL,
  "ball_count_score" integer DEFAULT 0 NOT NULL,
  "focus_club_score" integer DEFAULT 0 NOT NULL,
  "club_mix_score" integer DEFAULT 0 NOT NULL,
  "source_type_score" integer DEFAULT 0 NOT NULL,
  "accepted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "fkh_practice_plan_matches_plan_session_idx"
  ON "fkh_practice_plan_matches" ("practice_plan_id", "session_id");
CREATE INDEX IF NOT EXISTS "fkh_practice_plan_matches_user_created_idx"
  ON "fkh_practice_plan_matches" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "fkh_practice_plan_matches_session_idx"
  ON "fkh_practice_plan_matches" ("session_id");

ALTER TABLE "fkh_practice_plan_matches" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_practice_plan_matches_owner_all" ON "fkh_practice_plan_matches";
CREATE POLICY "fkh_practice_plan_matches_owner_all"
  ON "fkh_practice_plan_matches"
  FOR ALL
  USING (auth.uid() IS NOT NULL AND "user_id" = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND "user_id" = auth.uid());

ALTER TABLE "fkh_practice_block_results"
  ADD COLUMN IF NOT EXISTS "result" varchar(32) DEFAULT 'insufficient_data' NOT NULL,
  ADD COLUMN IF NOT EXISTS "summary" text,
  ADD COLUMN IF NOT EXISTS "linked_shot_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
