CREATE TABLE IF NOT EXISTS "fkh_speed_training_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "source" varchar(40) DEFAULT 'manual' NOT NULL,
  "provider_kind" varchar(40),
  "provider_session_id" varchar(180),
  "session_date" timestamp with time zone NOT NULL,
  "title" varchar(180),
  "club_id" uuid REFERENCES "fkh_clubs"("id") ON DELETE set null,
  "implement_kind" varchar(40) DEFAULT 'club' NOT NULL,
  "implement_label" varchar(160),
  "speed_system" varchar(80),
  "handedness" varchar(40) DEFAULT 'dominant' NOT NULL,
  "swing_count" integer DEFAULT 0 NOT NULL,
  "min_speed_mph" double precision,
  "avg_speed_mph" double precision,
  "max_speed_mph" double precision,
  "target_speed_mph" double precision,
  "raw_export_hash" varchar(64),
  "notes" text,
  "raw_metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fkh_speed_training_swings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "speed_session_id" uuid NOT NULL REFERENCES "fkh_speed_training_sessions"("id") ON DELETE cascade,
  "swing_number" integer NOT NULL,
  "club_speed_mph" double precision NOT NULL,
  "swing_side" varchar(40),
  "source_raw_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fkh_speed_training_goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "goal_key" varchar(96) NOT NULL,
  "club_id" uuid REFERENCES "fkh_clubs"("id") ON DELETE cascade,
  "target_speed_mph" double precision NOT NULL,
  "target_date" date,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_speed_training_sessions_user_date_idx" ON "fkh_speed_training_sessions" ("user_id", "session_date");
CREATE INDEX IF NOT EXISTS "fkh_speed_training_sessions_user_source_idx" ON "fkh_speed_training_sessions" ("user_id", "source");
CREATE UNIQUE INDEX IF NOT EXISTS "fkh_speed_training_sessions_provider_idx" ON "fkh_speed_training_sessions" ("user_id", "provider_kind", "provider_session_id");
CREATE UNIQUE INDEX IF NOT EXISTS "fkh_speed_training_swings_session_number_idx" ON "fkh_speed_training_swings" ("speed_session_id", "swing_number");
CREATE INDEX IF NOT EXISTS "fkh_speed_training_swings_user_session_idx" ON "fkh_speed_training_swings" ("user_id", "speed_session_id");
CREATE INDEX IF NOT EXISTS "fkh_speed_training_swings_user_created_idx" ON "fkh_speed_training_swings" ("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "fkh_speed_training_goals_user_key_idx" ON "fkh_speed_training_goals" ("user_id", "goal_key");
CREATE INDEX IF NOT EXISTS "fkh_speed_training_goals_user_club_idx" ON "fkh_speed_training_goals" ("user_id", "club_id");

ALTER TABLE "fkh_speed_training_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_speed_training_swings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_speed_training_goals" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_speed_training_sessions_owner_all" ON "fkh_speed_training_sessions";
CREATE POLICY "fkh_speed_training_sessions_owner_all"
  ON "fkh_speed_training_sessions"
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

DROP POLICY IF EXISTS "fkh_speed_training_swings_owner_all" ON "fkh_speed_training_swings";
CREATE POLICY "fkh_speed_training_swings_owner_all"
  ON "fkh_speed_training_swings"
  USING ("user_id" = auth.uid())
  WITH CHECK (
    "user_id" = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "fkh_speed_training_sessions" session_row
      WHERE session_row."id" = "speed_session_id"
        AND session_row."user_id" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fkh_speed_training_goals_owner_all" ON "fkh_speed_training_goals";
CREATE POLICY "fkh_speed_training_goals_owner_all"
  ON "fkh_speed_training_goals"
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());
