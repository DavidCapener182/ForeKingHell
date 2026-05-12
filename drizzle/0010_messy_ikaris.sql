CREATE TABLE "fkh_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"resource_type" varchar(40) NOT NULL,
	"resource_id" uuid NOT NULL,
	"title" varchar(220),
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fkh_share_links" ADD CONSTRAINT "fkh_share_links_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_share_links_token_hash_idx" ON "fkh_share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "fkh_share_links_user_resource_idx" ON "fkh_share_links" USING btree ("user_id","resource_type","resource_id");
--> statement-breakpoint
ALTER TABLE "fkh_share_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "fkh_share_links_owner_all" ON "fkh_share_links" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
