ALTER TABLE "fkh_clubs"
  ADD COLUMN IF NOT EXISTS "bag_section" varchar(40) DEFAULT 'main' NOT NULL,
  ADD COLUMN IF NOT EXISTS "bag_position" integer DEFAULT 100 NOT NULL;

WITH ordered_clubs AS (
  SELECT
    "id",
    CASE
      WHEN "type" = 'driver' THEN 'driver'
      WHEN "type" ~ '^[0-9]+[wh]$' OR "type" IN ('fw', 'hybrid', 'utility') THEN 'woods'
      WHEN "type" ~ '^[0-9]+i$' OR "type" = 'pw' THEN 'irons'
      WHEN "type" IN ('gw', 'aw', 'sw', 'lw') THEN 'wedges'
      WHEN "type" = 'putter' THEN 'putter'
      ELSE 'main'
    END AS "next_section",
    row_number() OVER (
      PARTITION BY "user_id"
      ORDER BY
        CASE
          WHEN "type" = 'driver' THEN 1
          WHEN "type" LIKE '%w' THEN 2
          WHEN "type" LIKE '%h' THEN 3
          WHEN "type" LIKE '%i' THEN 4
          WHEN "type" IN ('pw', 'gw', 'aw', 'sw', 'lw') THEN 5
          WHEN "type" = 'putter' THEN 6
          ELSE 7
        END,
        "type",
        "created_at"
    ) * 10 AS "next_position"
  FROM "fkh_clubs"
)
UPDATE "fkh_clubs"
SET
  "bag_section" = ordered_clubs."next_section",
  "bag_position" = ordered_clubs."next_position"
FROM ordered_clubs
WHERE "fkh_clubs"."id" = ordered_clubs."id"
  AND ("fkh_clubs"."bag_section" = 'main' OR "fkh_clubs"."bag_position" = 100);

CREATE INDEX IF NOT EXISTS "fkh_clubs_user_bag_order_idx"
  ON "fkh_clubs" ("user_id", "bag_section", "bag_position");

CREATE TABLE IF NOT EXISTS "fkh_weather_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "course_id" uuid REFERENCES "fkh_courses"("id") ON DELETE set null,
  "provider" varchar(60) DEFAULT 'open_meteo' NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "elevation_m" double precision,
  "conditions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_weather_snapshots_user_course_idx"
  ON "fkh_weather_snapshots" ("user_id", "course_id");
CREATE INDEX IF NOT EXISTS "fkh_weather_snapshots_user_expires_idx"
  ON "fkh_weather_snapshots" ("user_id", "expires_at");

ALTER TABLE "fkh_weather_snapshots" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_weather_snapshots_owner_all" ON "fkh_weather_snapshots";
CREATE POLICY "fkh_weather_snapshots_owner_all"
  ON "fkh_weather_snapshots"
  FOR ALL
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

CREATE TABLE IF NOT EXISTS "fkh_equipment_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "label" varchar(160) NOT NULL,
  "snapshot_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_equipment_snapshots_user_captured_idx"
  ON "fkh_equipment_snapshots" ("user_id", "captured_at");

ALTER TABLE "fkh_equipment_snapshots" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_equipment_snapshots_owner_all" ON "fkh_equipment_snapshots";
CREATE POLICY "fkh_equipment_snapshots_owner_all"
  ON "fkh_equipment_snapshots"
  FOR ALL
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

CREATE TABLE IF NOT EXISTS "fkh_rivalry_windows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL REFERENCES "fkh_groups"("id") ON DELETE cascade,
  "created_by_user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "title" varchar(180) NOT NULL,
  "period_key" varchar(40) NOT NULL,
  "metric_key" varchar(40) DEFAULT 'net_score' NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_rivalry_windows_group_status_idx"
  ON "fkh_rivalry_windows" ("group_id", "status");
CREATE INDEX IF NOT EXISTS "fkh_rivalry_windows_period_idx"
  ON "fkh_rivalry_windows" ("period_key");

ALTER TABLE "fkh_rivalry_windows" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_rivalry_windows_select_visible_group" ON "fkh_rivalry_windows";
CREATE POLICY "fkh_rivalry_windows_select_visible_group"
  ON "fkh_rivalry_windows"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fkh_groups target_group
      WHERE target_group.id = group_id
        AND public.fkh_can_view_group(target_group)
    )
  );

DROP POLICY IF EXISTS "fkh_rivalry_windows_insert_manager" ON "fkh_rivalry_windows";
CREATE POLICY "fkh_rivalry_windows_insert_manager"
  ON "fkh_rivalry_windows"
  FOR INSERT
  WITH CHECK ("created_by_user_id" = auth.uid() AND public.fkh_can_manage_group("group_id", auth.uid()));

DROP POLICY IF EXISTS "fkh_rivalry_windows_update_manager" ON "fkh_rivalry_windows";
CREATE POLICY "fkh_rivalry_windows_update_manager"
  ON "fkh_rivalry_windows"
  FOR UPDATE
  USING (public.fkh_can_manage_group("group_id", auth.uid()))
  WITH CHECK (public.fkh_can_manage_group("group_id", auth.uid()));

CREATE TABLE IF NOT EXISTS "fkh_rivalry_pairings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "window_id" uuid NOT NULL REFERENCES "fkh_rivalry_windows"("id") ON DELETE cascade,
  "group_id" uuid NOT NULL REFERENCES "fkh_groups"("id") ON DELETE cascade,
  "user_a_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "user_b_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "user_a_score" double precision,
  "user_b_score" double precision,
  "winner_user_id" uuid REFERENCES "fkh_users"("id") ON DELETE set null,
  "summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "calculated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_rivalry_pairings_window_idx"
  ON "fkh_rivalry_pairings" ("window_id");
CREATE INDEX IF NOT EXISTS "fkh_rivalry_pairings_group_idx"
  ON "fkh_rivalry_pairings" ("group_id");
CREATE INDEX IF NOT EXISTS "fkh_rivalry_pairings_players_idx"
  ON "fkh_rivalry_pairings" ("user_a_id", "user_b_id");

ALTER TABLE "fkh_rivalry_pairings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_rivalry_pairings_select_visible_group" ON "fkh_rivalry_pairings";
CREATE POLICY "fkh_rivalry_pairings_select_visible_group"
  ON "fkh_rivalry_pairings"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fkh_groups target_group
      WHERE target_group.id = group_id
        AND public.fkh_can_view_group(target_group)
    )
  );

DROP POLICY IF EXISTS "fkh_rivalry_pairings_manager_all" ON "fkh_rivalry_pairings";
CREATE POLICY "fkh_rivalry_pairings_manager_all"
  ON "fkh_rivalry_pairings"
  FOR ALL
  USING (public.fkh_can_manage_group("group_id", auth.uid()))
  WITH CHECK (public.fkh_can_manage_group("group_id", auth.uid()));

CREATE TABLE IF NOT EXISTS "fkh_leaderboard_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL REFERENCES "fkh_groups"("id") ON DELETE cascade,
  "window_id" uuid REFERENCES "fkh_rivalry_windows"("id") ON DELETE set null,
  "snapshot_type" varchar(40) DEFAULT 'weekly_rivalry' NOT NULL,
  "period_key" varchar(40) NOT NULL,
  "standings_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_leaderboard_snapshots_group_period_idx"
  ON "fkh_leaderboard_snapshots" ("group_id", "period_key");
CREATE INDEX IF NOT EXISTS "fkh_leaderboard_snapshots_window_idx"
  ON "fkh_leaderboard_snapshots" ("window_id");

ALTER TABLE "fkh_leaderboard_snapshots" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_leaderboard_snapshots_select_visible_group" ON "fkh_leaderboard_snapshots";
CREATE POLICY "fkh_leaderboard_snapshots_select_visible_group"
  ON "fkh_leaderboard_snapshots"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fkh_groups target_group
      WHERE target_group.id = group_id
        AND public.fkh_can_view_group(target_group)
    )
  );

DROP POLICY IF EXISTS "fkh_leaderboard_snapshots_manager_all" ON "fkh_leaderboard_snapshots";
CREATE POLICY "fkh_leaderboard_snapshots_manager_all"
  ON "fkh_leaderboard_snapshots"
  FOR ALL
  USING (public.fkh_can_manage_group("group_id", auth.uid()))
  WITH CHECK (public.fkh_can_manage_group("group_id", auth.uid()));
