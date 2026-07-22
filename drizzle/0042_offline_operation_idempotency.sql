CREATE TABLE IF NOT EXISTS "fkh_offline_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
  "operation_id" varchar(128) NOT NULL,
  "operation_kind" varchar(32) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "response_status" integer,
  "response_json" jsonb,
  "claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fkh_offline_operations_status_check"
    CHECK ("status" IN ('pending', 'completed', 'failed_transient', 'failed_permanent')),
  CONSTRAINT "fkh_offline_operations_attempt_count_check" CHECK ("attempt_count" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fkh_offline_operations_user_operation_idx"
  ON "fkh_offline_operations" ("user_id", "operation_id");

CREATE INDEX IF NOT EXISTS "fkh_offline_operations_status_updated_idx"
  ON "fkh_offline_operations" ("status", "updated_at");

ALTER TABLE "fkh_offline_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fkh_offline_operations" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fkh_offline_operations" FROM PUBLIC;
REVOKE ALL ON TABLE "fkh_offline_operations" FROM anon;
REVOKE ALL ON TABLE "fkh_offline_operations" FROM authenticated;

COMMENT ON TABLE "fkh_offline_operations" IS
  'Server-maintained idempotency ledger for account-bound offline mutation replay.';

ALTER TABLE "fkh_sessions"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
