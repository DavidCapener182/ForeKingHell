INSERT INTO "fkh_strokes_gained_baselines" (
  "category",
  "lie",
  "distance_start_yd",
  "distance_end_yd",
  "expected_strokes",
  "source"
)
VALUES
  ('tee', 'tee', 0, 180, 3.1, 'default'),
  ('tee', 'tee', 181, 240, 3.5, 'default'),
  ('tee', 'tee', 241, 320, 4.0, 'default'),
  ('tee', 'tee', 321, 450, 4.6, 'default'),
  ('tee', 'tee', 451, 620, 5.4, 'default'),
  ('approach', 'fairway', 0, 60, 2.6, 'default'),
  ('approach', 'fairway', 61, 100, 2.9, 'default'),
  ('approach', 'fairway', 101, 140, 3.2, 'default'),
  ('approach', 'fairway', 141, 180, 3.5, 'default'),
  ('approach', 'fairway', 181, 230, 3.9, 'default'),
  ('approach', 'fairway', 231, 320, 4.4, 'default'),
  ('approach', 'rough', 0, 60, 2.8, 'default'),
  ('approach', 'rough', 61, 100, 3.1, 'default'),
  ('approach', 'rough', 101, 140, 3.4, 'default'),
  ('approach', 'rough', 141, 180, 3.7, 'default'),
  ('approach', 'rough', 181, 230, 4.1, 'default'),
  ('approach', 'rough', 231, 320, 4.7, 'default'),
  ('short_game', 'fairway', 0, 30, 2.3, 'default'),
  ('short_game', 'fairway', 31, 60, 2.6, 'default'),
  ('short_game', 'fairway', 61, 100, 2.9, 'default'),
  ('short_game', 'rough', 0, 30, 2.5, 'default'),
  ('short_game', 'rough', 31, 60, 2.8, 'default'),
  ('short_game', 'rough', 61, 100, 3.1, 'default'),
  ('putting', 'green', 0, 3, 1.1, 'default'),
  ('putting', 'green', 4, 10, 1.6, 'default'),
  ('putting', 'green', 11, 30, 2.0, 'default'),
  ('putting', 'green', 31, 80, 2.5, 'default'),
  ('putting', 'holed', 0, 0, 0, 'default')
ON CONFLICT ("category", "lie", "distance_start_yd", "distance_end_yd", "source") DO NOTHING;
--> statement-breakpoint
WITH source_shots AS (
  SELECT
    shot."id" AS "shot_id",
    shot."user_id",
    shot."session_id",
    shot."course_hole_number" AS "hole_number",
    shot."course_hole_shot_number" AS "stroke_number",
    shot."course_hole_yards",
    shot."distance_remaining_yd",
    shot."shot_category",
    shot."club_type",
    shot."carry_yd",
    shot."total_yd",
    COALESCE(shot."total_yd", shot."carry_yd", 0) AS "shot_distance_yd",
    COALESCE(shot."side_carry_yd", 0) AS "side_yardage"
  FROM "fkh_shots" shot
  WHERE shot."course_hole_number" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "fkh_strokes_gained_shot_events" event
      WHERE event."shot_id" = shot."id"
    )
),
distance_state AS (
  SELECT
    source_shots.*,
    CASE
      WHEN source_shots."stroke_number" = 1 AND source_shots."course_hole_yards" IS NOT NULL
        THEN source_shots."course_hole_yards"::double precision
      ELSE GREATEST(0, COALESCE(source_shots."distance_remaining_yd", 0) + source_shots."shot_distance_yd")
    END AS "start_distance_yd",
    GREATEST(0, COALESCE(source_shots."distance_remaining_yd", 0)) AS "end_distance_yd"
  FROM source_shots
),
classified AS (
  SELECT
    distance_state.*,
    CASE
      WHEN distance_state."stroke_number" = 1 THEN 'tee'
      WHEN distance_state."shot_category" IN ('chip', 'pitch') OR distance_state."start_distance_yd" <= 100 THEN 'short_game'
      ELSE 'approach'
    END AS "category",
    CASE
      WHEN distance_state."stroke_number" = 1 THEN 'tee'
      WHEN distance_state."start_distance_yd" <= 30 THEN 'green'
      WHEN abs(distance_state."side_yardage") > 25 THEN 'rough'
      ELSE 'fairway'
    END AS "start_lie",
    CASE
      WHEN distance_state."end_distance_yd" <= 0 THEN 'holed'
      WHEN distance_state."end_distance_yd" <= 30 THEN 'green'
      WHEN abs(distance_state."side_yardage") > 25 THEN 'rough'
      ELSE 'fairway'
    END AS "end_lie"
  FROM distance_state
),
valued AS (
  SELECT
    classified.*,
    CASE
      WHEN classified."end_lie" IN ('green', 'holed') THEN 'putting'
      WHEN classified."end_distance_yd" <= 100 THEN 'short_game'
      ELSE 'approach'
    END AS "end_category"
  FROM classified
)
INSERT INTO "fkh_strokes_gained_shot_events" (
  "user_id",
  "session_id",
  "shot_id",
  "hole_number",
  "stroke_number",
  "category",
  "start_lie",
  "end_lie",
  "start_distance_yd",
  "end_distance_yd",
  "penalty_strokes",
  "strokes_gained",
  "metadata_json"
)
SELECT
  valued."user_id",
  valued."session_id",
  valued."shot_id",
  valued."hole_number",
  valued."stroke_number",
  valued."category",
  valued."start_lie",
  valued."end_lie",
  round(valued."start_distance_yd"::numeric, 1)::double precision,
  round(valued."end_distance_yd"::numeric, 1)::double precision,
  0,
  CASE
    WHEN start_bucket."expected_strokes" IS NULL OR end_bucket."expected_strokes" IS NULL THEN NULL
    ELSE round((start_bucket."expected_strokes" - 1 - end_bucket."expected_strokes")::numeric, 1)::double precision
  END,
  jsonb_build_object(
    'source', 'mapped-shot-backfill',
    'clubType', valued."club_type",
    'carryYd', valued."carry_yd",
    'totalYd', valued."total_yd",
    'shotCategory', valued."shot_category"
  )
FROM valued
LEFT JOIN "fkh_strokes_gained_baselines" start_bucket
  ON start_bucket."source" = 'default'
  AND start_bucket."category" = valued."category"
  AND start_bucket."lie" = valued."start_lie"
  AND valued."start_distance_yd" BETWEEN start_bucket."distance_start_yd" AND start_bucket."distance_end_yd"
LEFT JOIN "fkh_strokes_gained_baselines" end_bucket
  ON end_bucket."source" = 'default'
  AND end_bucket."category" = valued."end_category"
  AND end_bucket."lie" = valued."end_lie"
  AND valued."end_distance_yd" BETWEEN end_bucket."distance_start_yd" AND end_bucket."distance_end_yd";
