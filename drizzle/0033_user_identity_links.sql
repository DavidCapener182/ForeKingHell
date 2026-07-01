CREATE TABLE IF NOT EXISTS "fkh_user_identity_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "canonical_user_id" uuid NOT NULL,
  "linked_user_id" uuid NOT NULL,
  "link_type" varchar(32) DEFAULT 'manual' NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fkh_user_identity_links_canonical_user_id_fkh_users_id_fk"
    FOREIGN KEY ("canonical_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
  CONSTRAINT "fkh_user_identity_links_linked_user_id_fkh_users_id_fk"
    FOREIGN KEY ("linked_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "fkh_user_identity_links_linked_idx"
  ON "fkh_user_identity_links" ("linked_user_id");

CREATE INDEX IF NOT EXISTS "fkh_user_identity_links_canonical_status_idx"
  ON "fkh_user_identity_links" ("canonical_user_id", "status");
