ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "address" varchar(260);
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "longitude" double precision;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_place_id" varchar(180);
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "canonical_course_id" uuid;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "website_url" text;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_maps_url" text;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_rating" double precision;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_user_ratings_total" integer;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_types_json" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_opening_hours_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_attributions_json" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "fkh_courses" ADD COLUMN IF NOT EXISTS "google_enriched_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "fkh_courses_google_place_idx" ON "fkh_courses" ("google_place_id");
CREATE INDEX IF NOT EXISTS "fkh_courses_canonical_idx" ON "fkh_courses" ("canonical_course_id");
