CREATE TABLE IF NOT EXISTS "fkh_course_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL,
  "hole_number" integer,
  "feature_type" varchar(32) NOT NULL,
  "geometry_json" jsonb NOT NULL,
  "source" varchar(32) DEFAULT 'osm' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "fkh_course_features" ADD CONSTRAINT "fkh_course_features_course_id_fkh_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."fkh_courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "fkh_course_features_course_idx" ON "fkh_course_features" ("course_id");
CREATE INDEX IF NOT EXISTS "fkh_course_features_course_hole_idx" ON "fkh_course_features" ("course_id", "hole_number");
CREATE INDEX IF NOT EXISTS "fkh_course_features_type_idx" ON "fkh_course_features" ("feature_type");
