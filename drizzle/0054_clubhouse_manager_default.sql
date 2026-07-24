ALTER TABLE "fkh_users"
ALTER COLUMN "theme" SET DEFAULT 'clubhouse';

UPDATE "fkh_users"
SET "theme" = 'clubhouse', "updated_at" = now()
WHERE "theme" = 'system';
