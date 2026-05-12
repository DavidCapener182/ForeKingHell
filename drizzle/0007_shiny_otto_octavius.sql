CREATE TABLE "fkh_rapsodo_sync_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_kind" varchar(40) NOT NULL,
	"provider_session_id" varchar(180) NOT NULL,
	"provider_session_type" varchar(80),
	"provider_session_mode" varchar(80),
	"session_date" timestamp with time zone,
	"title" varchar(260),
	"raw_metadata_json" jsonb NOT NULL,
	"export_raw_csv_hash" varchar(64),
	"imported_session_id" uuid,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_rapsodo_sync_sessions" ADD CONSTRAINT "fkh_rapsodo_sync_sessions_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_rapsodo_sync_sessions" ADD CONSTRAINT "fkh_rapsodo_sync_sessions_imported_session_id_fkh_sessions_id_fk" FOREIGN KEY ("imported_session_id") REFERENCES "public"."fkh_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_rapsodo_sync_user_provider_idx" ON "fkh_rapsodo_sync_sessions" USING btree ("user_id","provider_kind","provider_session_id");--> statement-breakpoint
CREATE INDEX "fkh_rapsodo_sync_user_seen_idx" ON "fkh_rapsodo_sync_sessions" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "fkh_rapsodo_sync_imported_session_idx" ON "fkh_rapsodo_sync_sessions" USING btree ("imported_session_id");
