UPDATE "fkh_users"
SET "theme" = 'light', "updated_at" = now()
WHERE "theme" <> 'light';

ALTER TABLE "fkh_users"
ALTER COLUMN "theme" SET DEFAULT 'light';
