CREATE TABLE IF NOT EXISTS "fkh_content_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "fkh_users"("id") ON DELETE cascade,
  "source_type" varchar(60) NOT NULL,
  "source_id" varchar(220) NOT NULL,
  "template_key" varchar(80) DEFAULT 'reel_pb_v1' NOT NULL,
  "platform" varchar(24) DEFAULT 'reel' NOT NULL,
  "format" varchar(24) DEFAULT 'png_9x16' NOT NULL,
  "status" varchar(32) DEFAULT 'ready' NOT NULL,
  "snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "render_config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "storage_path" text,
  "last_rendered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fkh_content_exports_user_created_idx"
  ON "fkh_content_exports" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "fkh_content_exports_source_idx"
  ON "fkh_content_exports" ("source_type", "source_id");

ALTER TABLE "fkh_content_exports" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fkh_content_exports_owner_all" ON "fkh_content_exports";
CREATE POLICY "fkh_content_exports_owner_all"
  ON "fkh_content_exports"
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());
