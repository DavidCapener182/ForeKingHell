CREATE TABLE IF NOT EXISTS "fkh_golf_training_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "source_type" varchar(40) DEFAULT 'manual' NOT NULL,
  "source_id" varchar(220),
  "title" varchar(180) NOT NULL,
  "session_date" date NOT NULL,
  "duration_minutes" integer,
  "holes_played" integer,
  "total_swings" integer,
  "full_swings" integer,
  "short_game_swings" integer,
  "putting_swings" integer,
  "walked" boolean,
  "used_cart" boolean,
  "competition" boolean DEFAULT false NOT NULL,
  "rpe" integer NOT NULL,
  "mental_pressure" integer,
  "physical_demand" integer,
  "session_load" numeric(10, 0) NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fkh_golf_training_sessions_source_type_check"
    CHECK ("source_type" IN ('round', 'practice', 'manual', 'launch_monitor', 'imported')),
  CONSTRAINT "fkh_golf_training_sessions_rpe_check"
    CHECK ("rpe" BETWEEN 1 AND 10),
  CONSTRAINT "fkh_golf_training_sessions_mental_pressure_check"
    CHECK ("mental_pressure" IS NULL OR "mental_pressure" BETWEEN 1 AND 10),
  CONSTRAINT "fkh_golf_training_sessions_physical_demand_check"
    CHECK ("physical_demand" IS NULL OR "physical_demand" BETWEEN 1 AND 10)
);

CREATE INDEX IF NOT EXISTS "fkh_golf_training_sessions_user_date_idx"
  ON "fkh_golf_training_sessions" ("user_id", "session_date");

CREATE INDEX IF NOT EXISTS "fkh_golf_training_sessions_source_idx"
  ON "fkh_golf_training_sessions" ("source_type", "source_id");

CREATE UNIQUE INDEX IF NOT EXISTS "fkh_golf_training_sessions_user_source_unique_idx"
  ON "fkh_golf_training_sessions" ("user_id", "source_type", "source_id");

CREATE OR REPLACE VIEW "fkh_golf_training_daily_load"
WITH (security_invoker = true) AS
SELECT
  "user_id",
  "session_date" AS "date",
  COALESCE(SUM("session_load"), 0)::numeric(12, 0) AS "total_session_load",
  COUNT(*)::integer AS "session_count",
  COALESCE(SUM("duration_minutes"), 0)::integer AS "total_minutes",
  COALESCE(SUM("total_swings"), 0)::integer AS "total_swings",
  COALESCE(SUM("holes_played"), 0)::integer AS "holes_played"
FROM "fkh_golf_training_sessions"
GROUP BY "user_id", "session_date";

ALTER TABLE "fkh_golf_training_sessions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_golf_training_sessions_owner_all" ON "fkh_golf_training_sessions";
CREATE POLICY "fkh_golf_training_sessions_owner_all"
  ON "fkh_golf_training_sessions"
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());
