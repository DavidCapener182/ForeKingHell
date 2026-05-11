CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TABLE "fkh_clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"brand" varchar(120),
	"model" varchar(160),
	"normalized_club_key" varchar(260) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" varchar(40) NOT NULL,
	"type" varchar(40) NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"location" varchar(180),
	"notes" text,
	"raw_upload_id" varchar(160),
	"file_name" varchar(260),
	"file_size_bytes" integer,
	"raw_csv_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"club_type" varchar(40) NOT NULL,
	"shot_number" integer,
	"carry_m" double precision,
	"total_m" double precision,
	"ball_speed_mph" double precision,
	"club_speed_mph" double precision,
	"launch_angle_deg" double precision,
	"launch_direction_deg" double precision,
	"apex_m" double precision,
	"side_carry_m" double precision,
	"attack_angle_deg" double precision,
	"club_path_deg" double precision,
	"descent_angle_deg" double precision,
	"smash_factor" double precision,
	"spin_rate" double precision,
	"spin_axis" double precision,
	"shot_shape" varchar(40),
	"shot_category" varchar(40) DEFAULT 'full' NOT NULL,
	"quality_tag" varchar(40),
	"club_data_est_type" varchar(80),
	"source_raw_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_stock_yardages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"club_id" uuid NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sample_size" integer NOT NULL,
	"carry_median_m" double precision,
	"carry_mean_m" double precision,
	"carry_p75_m" double precision,
	"carry_p25_m" double precision,
	"total_median_m" double precision,
	"dispersion_left_m" double precision,
	"dispersion_right_m" double precision,
	"confidence_score" double precision,
	"recommended_play_number_m" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320),
	"name" varchar(160),
	"preferred_units" varchar(16) DEFAULT 'meters' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_clubs" ADD CONSTRAINT "fkh_clubs_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD CONSTRAINT "fkh_sessions_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD CONSTRAINT "fkh_shots_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD CONSTRAINT "fkh_shots_session_id_fkh_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_shots" ADD CONSTRAINT "fkh_shots_club_id_fkh_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."fkh_clubs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" ADD CONSTRAINT "fkh_stock_yardages_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_stock_yardages" ADD CONSTRAINT "fkh_stock_yardages_club_id_fkh_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."fkh_clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_clubs_user_normalized_key_idx" ON "fkh_clubs" USING btree ("user_id","normalized_club_key");--> statement-breakpoint
CREATE INDEX "fkh_clubs_user_type_idx" ON "fkh_clubs" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "fkh_sessions_user_date_idx" ON "fkh_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "fkh_sessions_user_source_idx" ON "fkh_sessions" USING btree ("user_id","source");--> statement-breakpoint
CREATE INDEX "fkh_shots_user_session_idx" ON "fkh_shots" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE INDEX "fkh_shots_user_club_idx" ON "fkh_shots" USING btree ("user_id","club_id");--> statement-breakpoint
CREATE INDEX "fkh_shots_user_category_idx" ON "fkh_shots" USING btree ("user_id","shot_category");--> statement-breakpoint
CREATE INDEX "fkh_stock_yardages_user_club_idx" ON "fkh_stock_yardages" USING btree ("user_id","club_id");--> statement-breakpoint
CREATE INDEX "fkh_stock_yardages_calculated_at_idx" ON "fkh_stock_yardages" USING btree ("calculated_at");
