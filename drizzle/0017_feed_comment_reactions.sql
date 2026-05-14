CREATE TABLE IF NOT EXISTS "fkh_feed_comment_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_comment_id" uuid NOT NULL REFERENCES "public"."fkh_feed_comments"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."fkh_users"("id") ON DELETE cascade,
	"reaction_type" varchar(40) DEFAULT 'like' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fkh_feed_comment_reactions_comment_user_type_idx" ON "fkh_feed_comment_reactions" USING btree ("feed_comment_id","user_id","reaction_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fkh_feed_comment_reactions_comment_idx" ON "fkh_feed_comment_reactions" USING btree ("feed_comment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fkh_feed_comment_reactions_user_idx" ON "fkh_feed_comment_reactions" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "fkh_feed_comment_reactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "fkh_feed_comment_reactions_select_visible_comment" ON "fkh_feed_comment_reactions";
--> statement-breakpoint
CREATE POLICY "fkh_feed_comment_reactions_select_visible_comment" ON "fkh_feed_comment_reactions" FOR SELECT USING (
	EXISTS (
		SELECT 1
		FROM public.fkh_feed_comments comment
		JOIN public.fkh_feed_items item ON item.id = comment.feed_item_id
		WHERE comment.id = feed_comment_id
			AND comment.deleted_at IS NULL
			AND public.fkh_can_view_feed_item(item)
	)
);
--> statement-breakpoint
DROP POLICY IF EXISTS "fkh_feed_comment_reactions_insert_self_visible_comment" ON "fkh_feed_comment_reactions";
--> statement-breakpoint
CREATE POLICY "fkh_feed_comment_reactions_insert_self_visible_comment" ON "fkh_feed_comment_reactions" FOR INSERT WITH CHECK (
	"user_id" = auth.uid()
	AND EXISTS (
		SELECT 1
		FROM public.fkh_feed_comments comment
		JOIN public.fkh_feed_items item ON item.id = comment.feed_item_id
		WHERE comment.id = feed_comment_id
			AND comment.deleted_at IS NULL
			AND public.fkh_can_view_feed_item(item)
	)
);
--> statement-breakpoint
DROP POLICY IF EXISTS "fkh_feed_comment_reactions_delete_self" ON "fkh_feed_comment_reactions";
--> statement-breakpoint
CREATE POLICY "fkh_feed_comment_reactions_delete_self" ON "fkh_feed_comment_reactions" FOR DELETE USING ("user_id" = auth.uid());
