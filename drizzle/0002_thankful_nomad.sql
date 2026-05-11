CREATE TABLE "fkh_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"row_type" varchar(40) NOT NULL,
	"source_raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_shots" RENAME COLUMN "carry_m" TO "carry_yd";--> statement-breakpoint
ALTER TABLE "fkh_shots" RENAME COLUMN "total_m" TO "total_yd";--> statement-breakpoint
ALTER TABLE "fkh_shots" RENAME COLUMN "apex_m" TO "apex_ft";--> statement-breakpoint
ALTER TABLE "fkh_shots" RENAME COLUMN "side_carry_m" TO "side_carry_yd";--> statement-breakpoint
UPDATE "fkh_shots"
SET
  "carry_yd" = CASE WHEN "carry_yd" IS NULL THEN NULL ELSE "carry_yd" / 0.9144 END,
  "total_yd" = CASE WHEN "total_yd" IS NULL THEN NULL ELSE "total_yd" / 0.9144 END,
  "apex_ft" = CASE WHEN "apex_ft" IS NULL THEN NULL ELSE "apex_ft" / 0.3048 END,
  "side_carry_yd" = CASE WHEN "side_carry_yd" IS NULL THEN NULL ELSE "side_carry_yd" / 0.9144 END;--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "carry_median_m" TO "carry_median_yd";--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "carry_mean_m" TO "carry_mean_yd";--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "carry_p75_m" TO "carry_p75_yd";--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "carry_p25_m" TO "carry_p25_yd";--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "total_median_m" TO "total_median_yd";--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "dispersion_left_m" TO "dispersion_left_yd";--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "dispersion_right_m" TO "dispersion_right_yd";--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" RENAME COLUMN "recommended_play_number_m" TO "recommended_play_number_yd";--> statement-breakpoint
UPDATE "fkh_stock_yardages"
SET
  "carry_median_yd" = CASE WHEN "carry_median_yd" IS NULL THEN NULL ELSE "carry_median_yd" / 0.9144 END,
  "carry_mean_yd" = CASE WHEN "carry_mean_yd" IS NULL THEN NULL ELSE "carry_mean_yd" / 0.9144 END,
  "carry_p75_yd" = CASE WHEN "carry_p75_yd" IS NULL THEN NULL ELSE "carry_p75_yd" / 0.9144 END,
  "carry_p25_yd" = CASE WHEN "carry_p25_yd" IS NULL THEN NULL ELSE "carry_p25_yd" / 0.9144 END,
  "total_median_yd" = CASE WHEN "total_median_yd" IS NULL THEN NULL ELSE "total_median_yd" / 0.9144 END,
  "dispersion_left_yd" = CASE WHEN "dispersion_left_yd" IS NULL THEN NULL ELSE "dispersion_left_yd" / 0.9144 END,
  "dispersion_right_yd" = CASE WHEN "dispersion_right_yd" IS NULL THEN NULL ELSE "dispersion_right_yd" / 0.9144 END,
  "recommended_play_number_yd" = CASE WHEN "recommended_play_number_yd" IS NULL THEN NULL ELSE "recommended_play_number_yd" / 0.9144 END;--> statement-breakpoint
ALTER TABLE "fkh_users" ALTER COLUMN "preferred_units" SET DEFAULT 'yards';--> statement-breakpoint
UPDATE "fkh_users" SET "preferred_units" = 'yards';--> statement-breakpoint
ALTER TABLE "fkh_import_rows" ADD CONSTRAINT "fkh_import_rows_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_import_rows" ADD CONSTRAINT "fkh_import_rows_session_id_fkh_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fkh_import_rows_user_session_idx" ON "fkh_import_rows" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "fkh_import_rows_row_type_idx" ON "fkh_import_rows" USING btree ("row_type");
