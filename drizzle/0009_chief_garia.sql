ALTER TABLE "fkh_sessions" ADD COLUMN "round_status" varchar(24) DEFAULT 'complete' NOT NULL;--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD COLUMN "weather_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fkh_sessions" ADD COLUMN "equipment_notes" text;