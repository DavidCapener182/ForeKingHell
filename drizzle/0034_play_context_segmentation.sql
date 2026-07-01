ALTER TABLE "fkh_sessions"
  ADD COLUMN IF NOT EXISTS "play_context" varchar(32) DEFAULT 'unknown' NOT NULL;

ALTER TABLE "fkh_import_rows"
  ADD COLUMN IF NOT EXISTS "play_context" varchar(32) DEFAULT 'unknown' NOT NULL;

ALTER TABLE "fkh_import_files"
  ADD COLUMN IF NOT EXISTS "play_context" varchar(32) DEFAULT 'unknown' NOT NULL;

ALTER TABLE "fkh_shots"
  ADD COLUMN IF NOT EXISTS "play_context" varchar(32) DEFAULT 'unknown' NOT NULL;

ALTER TABLE "fkh_stock_yardages"
  ADD COLUMN IF NOT EXISTS "play_context" varchar(32) DEFAULT 'unknown' NOT NULL;

UPDATE "fkh_sessions"
SET "play_context" = CASE
  WHEN "type" = 'real_round' THEN 'on_course'
  WHEN "type" IN ('simulator', 'simulated_course') THEN 'simulator'
  WHEN "type" = 'range' OR lower("source") IN ('rapsodo', 'r-cloud', 'rcloud') THEN 'practice_bay'
  ELSE 'unknown'
END
WHERE "play_context" = 'unknown';

UPDATE "fkh_shots"
SET "play_context" = "fkh_sessions"."play_context"
FROM "fkh_sessions"
WHERE "fkh_shots"."session_id" = "fkh_sessions"."id"
  AND "fkh_shots"."play_context" = 'unknown';

UPDATE "fkh_import_rows"
SET "play_context" = "fkh_sessions"."play_context"
FROM "fkh_sessions"
WHERE "fkh_import_rows"."session_id" = "fkh_sessions"."id"
  AND "fkh_import_rows"."play_context" = 'unknown';

UPDATE "fkh_import_files"
SET "play_context" = "fkh_sessions"."play_context"
FROM "fkh_sessions"
WHERE "fkh_import_files"."session_id" = "fkh_sessions"."id"
  AND "fkh_import_files"."play_context" = 'unknown';

UPDATE "fkh_stock_yardages"
SET "play_context" = 'practice_bay'
WHERE "play_context" = 'unknown';

CREATE INDEX IF NOT EXISTS "fkh_sessions_user_context_date_idx"
  ON "fkh_sessions" ("user_id", "play_context", "date");

CREATE INDEX IF NOT EXISTS "fkh_import_rows_user_context_idx"
  ON "fkh_import_rows" ("user_id", "play_context");

CREATE INDEX IF NOT EXISTS "fkh_import_files_user_context_created_idx"
  ON "fkh_import_files" ("user_id", "play_context", "created_at");

CREATE INDEX IF NOT EXISTS "fkh_shots_user_context_club_idx"
  ON "fkh_shots" ("user_id", "play_context", "club_id");

CREATE INDEX IF NOT EXISTS "fkh_stock_yardages_user_context_club_idx"
  ON "fkh_stock_yardages" ("user_id", "play_context", "club_id");
