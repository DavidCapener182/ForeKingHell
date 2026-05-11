ALTER TABLE "fkh_shots" ADD COLUMN "shot_at" timestamp with time zone;--> statement-breakpoint
UPDATE "fkh_shots"
SET "shot_at" = "fkh_sessions"."date"
FROM "fkh_sessions"
WHERE "fkh_shots"."session_id" = "fkh_sessions"."id";--> statement-breakpoint
ALTER TABLE "fkh_shots" ALTER COLUMN "shot_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "fkh_shots_user_shot_at_idx" ON "fkh_shots" USING btree ("user_id","shot_at");
