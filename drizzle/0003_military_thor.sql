ALTER TABLE "fkh_sessions" ADD COLUMN "course_name" varchar(180);--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD COLUMN "scorecard_json" jsonb;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD COLUMN "course_hole_number" integer;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD COLUMN "course_hole_shot_number" integer;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD COLUMN "course_hole_par" integer;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD COLUMN "course_hole_yards" integer;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD COLUMN "distance_remaining_yd" double precision;--> statement-breakpoint
CREATE INDEX "fkh_shots_user_session_hole_idx" ON "fkh_shots" USING btree ("user_id","session_id","course_hole_number");