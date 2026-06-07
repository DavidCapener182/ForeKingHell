CREATE TABLE IF NOT EXISTS "fkh_ai_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "feature_key" varchar(80) NOT NULL,
  "plan_key_snapshot" varchar(40) NOT NULL,
  "model" varchar(80) NOT NULL,
  "status" varchar(32) DEFAULT 'success' NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "ai_credits" integer DEFAULT 0 NOT NULL,
  "request_hash" varchar(64),
  "response_id" varchar(120),
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fkh_ai_generation_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "feature_key" varchar(80) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "model" varchar(80) NOT NULL,
  "response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_ai_usage_events_user_feature_created_idx"
  ON "fkh_ai_usage_events" ("user_id", "feature_key", "created_at");
CREATE INDEX IF NOT EXISTS "fkh_ai_usage_events_user_created_idx"
  ON "fkh_ai_usage_events" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "fkh_ai_usage_events_request_hash_idx"
  ON "fkh_ai_usage_events" ("request_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "fkh_ai_generation_cache_user_feature_hash_model_idx"
  ON "fkh_ai_generation_cache" ("user_id", "feature_key", "request_hash", "model");
CREATE INDEX IF NOT EXISTS "fkh_ai_generation_cache_user_feature_created_idx"
  ON "fkh_ai_generation_cache" ("user_id", "feature_key", "created_at");
CREATE INDEX IF NOT EXISTS "fkh_ai_generation_cache_expires_idx"
  ON "fkh_ai_generation_cache" ("expires_at");

ALTER TABLE "fkh_ai_usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_ai_generation_cache" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_ai_usage_events_owner_all" ON "fkh_ai_usage_events";
CREATE POLICY "fkh_ai_usage_events_owner_all"
  ON "fkh_ai_usage_events"
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

DROP POLICY IF EXISTS "fkh_ai_generation_cache_owner_all" ON "fkh_ai_generation_cache";
CREATE POLICY "fkh_ai_generation_cache_owner_all"
  ON "fkh_ai_generation_cache"
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

INSERT INTO "fkh_plan_limits" ("plan_key", "limit_key", "limit_value_json")
VALUES
  ('free', 'ai_monthly_credits', '{"value":0}'::jsonb),
  ('free', 'ai_daily_chat_messages', '{"value":0}'::jsonb),
  ('free', 'ai_scorecard_extracts_monthly', '{"value":0}'::jsonb),
  ('plus', 'ai_monthly_credits', '{"value":10}'::jsonb),
  ('plus', 'ai_daily_chat_messages', '{"value":0}'::jsonb),
  ('plus', 'ai_scorecard_extracts_monthly', '{"value":2}'::jsonb),
  ('pro', 'ai_monthly_credits', '{"value":100}'::jsonb),
  ('pro', 'ai_daily_chat_messages', '{"value":30}'::jsonb),
  ('pro', 'ai_scorecard_extracts_monthly', '{"value":10}'::jsonb),
  ('coach', 'ai_monthly_credits', '{"value":300}'::jsonb),
  ('coach', 'ai_daily_chat_messages', '{"value":60}'::jsonb),
  ('coach', 'ai_scorecard_extracts_monthly', '{"value":25}'::jsonb),
  ('full', 'ai_monthly_credits', '{"value":1000,"label":"Internal safety cap"}'::jsonb),
  ('full', 'ai_daily_chat_messages', '{"value":100}'::jsonb),
  ('full', 'ai_scorecard_extracts_monthly', '{"value":50}'::jsonb)
ON CONFLICT ("plan_key","limit_key") DO UPDATE
SET "limit_value_json" = excluded."limit_value_json",
  "updated_at" = now();
