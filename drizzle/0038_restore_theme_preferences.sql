ALTER TABLE "fkh_users"
ALTER COLUMN "theme" SET DEFAULT 'system';

UPDATE "fkh_users"
SET "theme" = 'system', "updated_at" = now()
WHERE "theme" IS NULL OR "theme" NOT IN ('light', 'dark', 'system');
