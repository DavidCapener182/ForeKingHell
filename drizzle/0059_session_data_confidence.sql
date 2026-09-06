-- Additive metadata only. Existing session ownership/RLS continues to apply.
ALTER TABLE "fkh_sessions" ADD COLUMN IF NOT EXISTS "data_confidence_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
