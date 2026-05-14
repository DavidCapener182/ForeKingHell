CREATE TABLE "fkh_user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(40) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"avatar_url" text,
	"bio" text,
	"home_course" varchar(180),
	"primary_launch_monitor" varchar(80),
	"handicap_band" varchar(40),
	"public_profile" boolean DEFAULT false NOT NULL,
	"friend_profile" boolean DEFAULT false NOT NULL,
	"feed_visibility_default" varchar(24) DEFAULT 'private' NOT NULL,
	"leaderboard_visibility" varchar(24) DEFAULT 'private' NOT NULL,
	"visibility_settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"achievement_showcase_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pb_showcase_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"visibility_level" varchar(24) DEFAULT 'friends' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fkh_friendships_distinct_users" CHECK ("user_a_id" <> "user_b_id")
);
--> statement-breakpoint
CREATE TABLE "fkh_user_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"reason" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fkh_user_blocks_distinct_users" CHECK ("blocker_user_id" <> "blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE "fkh_user_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_user_id" uuid NOT NULL,
	"followed_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fkh_user_follows_distinct_users" CHECK ("follower_user_id" <> "followed_user_id")
);
--> statement-breakpoint
CREATE TABLE "fkh_feed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" varchar(60) NOT NULL,
	"headline" varchar(220) NOT NULL,
	"metric_label" varchar(80),
	"metric_value" varchar(120),
	"context" text,
	"proof_url" text,
	"source_type" varchar(60),
	"source_id" varchar(220),
	"visibility" varchar(24) DEFAULT 'private' NOT NULL,
	"verification_label" varchar(80) DEFAULT 'Unverified' NOT NULL,
	"dedupe_key" varchar(260),
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_feed_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reaction_type" varchar(40) DEFAULT 'kudos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_feed_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_challenge_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"challenge_type" varchar(60) NOT NULL,
	"rules_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scoring_direction" varchar(12) DEFAULT 'desc' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"creator_user_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"visibility" varchar(24) DEFAULT 'friends' NOT NULL,
	"status" varchar(24) DEFAULT 'open' NOT NULL,
	"challenge_rules_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_challenge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'joined' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_challenge_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"entry_id" uuid,
	"user_id" uuid NOT NULL,
	"source_type" varchar(60) DEFAULT 'manual' NOT NULL,
	"source_id" varchar(220),
	"metric_value" double precision NOT NULL,
	"metric_label" varchar(80) NOT NULL,
	"verification_label" varchar(80) DEFAULT 'Manual' NOT NULL,
	"notes" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_challenge_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"best_attempt_id" uuid,
	"rank" integer,
	"score" double precision NOT NULL,
	"score_label" varchar(120) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fkh_challenge_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fkh_challenge_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"invitee_user_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fkh_user_profiles" ADD CONSTRAINT "fkh_user_profiles_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_friend_requests" ADD CONSTRAINT "fkh_friend_requests_requester_user_id_fkh_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_friend_requests" ADD CONSTRAINT "fkh_friend_requests_recipient_user_id_fkh_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_friendships" ADD CONSTRAINT "fkh_friendships_user_a_id_fkh_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_friendships" ADD CONSTRAINT "fkh_friendships_user_b_id_fkh_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_user_blocks" ADD CONSTRAINT "fkh_user_blocks_blocker_user_id_fkh_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_user_blocks" ADD CONSTRAINT "fkh_user_blocks_blocked_user_id_fkh_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_user_follows" ADD CONSTRAINT "fkh_user_follows_follower_user_id_fkh_users_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_user_follows" ADD CONSTRAINT "fkh_user_follows_followed_user_id_fkh_users_id_fk" FOREIGN KEY ("followed_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_feed_items" ADD CONSTRAINT "fkh_feed_items_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_feed_reactions" ADD CONSTRAINT "fkh_feed_reactions_feed_item_id_fkh_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."fkh_feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_feed_reactions" ADD CONSTRAINT "fkh_feed_reactions_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_feed_comments" ADD CONSTRAINT "fkh_feed_comments_feed_item_id_fkh_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."fkh_feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_feed_comments" ADD CONSTRAINT "fkh_feed_comments_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenges" ADD CONSTRAINT "fkh_challenges_template_id_fkh_challenge_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."fkh_challenge_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenges" ADD CONSTRAINT "fkh_challenges_creator_user_id_fkh_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_entries" ADD CONSTRAINT "fkh_challenge_entries_challenge_id_fkh_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."fkh_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_entries" ADD CONSTRAINT "fkh_challenge_entries_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_attempts" ADD CONSTRAINT "fkh_challenge_attempts_challenge_id_fkh_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."fkh_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_attempts" ADD CONSTRAINT "fkh_challenge_attempts_entry_id_fkh_challenge_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."fkh_challenge_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_attempts" ADD CONSTRAINT "fkh_challenge_attempts_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_results" ADD CONSTRAINT "fkh_challenge_results_challenge_id_fkh_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."fkh_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_results" ADD CONSTRAINT "fkh_challenge_results_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_results" ADD CONSTRAINT "fkh_challenge_results_best_attempt_id_fkh_challenge_attempts_id_fk" FOREIGN KEY ("best_attempt_id") REFERENCES "public"."fkh_challenge_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_comments" ADD CONSTRAINT "fkh_challenge_comments_challenge_id_fkh_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."fkh_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_comments" ADD CONSTRAINT "fkh_challenge_comments_user_id_fkh_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_invites" ADD CONSTRAINT "fkh_challenge_invites_challenge_id_fkh_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."fkh_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_invites" ADD CONSTRAINT "fkh_challenge_invites_inviter_user_id_fkh_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fkh_challenge_invites" ADD CONSTRAINT "fkh_challenge_invites_invitee_user_id_fkh_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."fkh_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_user_profiles_username_idx" ON "fkh_user_profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "fkh_user_profiles_public_idx" ON "fkh_user_profiles" USING btree ("public_profile");--> statement-breakpoint
CREATE INDEX "fkh_user_profiles_leaderboard_idx" ON "fkh_user_profiles" USING btree ("leaderboard_visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_friend_requests_requester_recipient_idx" ON "fkh_friend_requests" USING btree ("requester_user_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX "fkh_friend_requests_recipient_status_idx" ON "fkh_friend_requests" USING btree ("recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "fkh_friend_requests_requester_status_idx" ON "fkh_friend_requests" USING btree ("requester_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_friendships_pair_idx" ON "fkh_friendships" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "fkh_friendships_user_a_idx" ON "fkh_friendships" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "fkh_friendships_user_b_idx" ON "fkh_friendships" USING btree ("user_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_user_blocks_blocker_blocked_idx" ON "fkh_user_blocks" USING btree ("blocker_user_id","blocked_user_id");--> statement-breakpoint
CREATE INDEX "fkh_user_blocks_blocked_idx" ON "fkh_user_blocks" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_user_follows_follower_followed_idx" ON "fkh_user_follows" USING btree ("follower_user_id","followed_user_id");--> statement-breakpoint
CREATE INDEX "fkh_user_follows_followed_idx" ON "fkh_user_follows" USING btree ("followed_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_feed_items_user_dedupe_idx" ON "fkh_feed_items" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "fkh_feed_items_user_created_idx" ON "fkh_feed_items" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fkh_feed_items_visibility_created_idx" ON "fkh_feed_items" USING btree ("visibility","created_at");--> statement-breakpoint
CREATE INDEX "fkh_feed_items_source_idx" ON "fkh_feed_items" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_feed_reactions_item_user_type_idx" ON "fkh_feed_reactions" USING btree ("feed_item_id","user_id","reaction_type");--> statement-breakpoint
CREATE INDEX "fkh_feed_reactions_user_idx" ON "fkh_feed_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fkh_feed_comments_item_created_idx" ON "fkh_feed_comments" USING btree ("feed_item_id","created_at");--> statement-breakpoint
CREATE INDEX "fkh_feed_comments_user_idx" ON "fkh_feed_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_challenge_templates_slug_idx" ON "fkh_challenge_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "fkh_challenge_templates_active_idx" ON "fkh_challenge_templates" USING btree ("active");--> statement-breakpoint
CREATE INDEX "fkh_challenges_creator_idx" ON "fkh_challenges" USING btree ("creator_user_id");--> statement-breakpoint
CREATE INDEX "fkh_challenges_visibility_status_idx" ON "fkh_challenges" USING btree ("visibility","status");--> statement-breakpoint
CREATE INDEX "fkh_challenges_template_idx" ON "fkh_challenges" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_challenge_entries_challenge_user_idx" ON "fkh_challenge_entries" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "fkh_challenge_entries_user_idx" ON "fkh_challenge_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fkh_challenge_attempts_challenge_user_idx" ON "fkh_challenge_attempts" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "fkh_challenge_attempts_entry_idx" ON "fkh_challenge_attempts" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_challenge_results_challenge_user_idx" ON "fkh_challenge_results" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "fkh_challenge_results_challenge_rank_idx" ON "fkh_challenge_results" USING btree ("challenge_id","rank");--> statement-breakpoint
CREATE INDEX "fkh_challenge_results_user_idx" ON "fkh_challenge_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fkh_challenge_comments_challenge_created_idx" ON "fkh_challenge_comments" USING btree ("challenge_id","created_at");--> statement-breakpoint
CREATE INDEX "fkh_challenge_comments_user_idx" ON "fkh_challenge_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fkh_challenge_invites_challenge_invitee_idx" ON "fkh_challenge_invites" USING btree ("challenge_id","invitee_user_id");--> statement-breakpoint
CREATE INDEX "fkh_challenge_invites_invitee_status_idx" ON "fkh_challenge_invites" USING btree ("invitee_user_id","status");--> statement-breakpoint
INSERT INTO "fkh_challenge_templates" ("slug", "name", "description", "challenge_type", "rules_json", "scoring_direction")
VALUES
	('longest-drive', 'Longest Drive', 'Post your best verified driver total distance.', 'longest_drive', '{"metric":"total_yards","clubTypes":["driver"],"minShots":1,"tieBreakers":["verified_source","earliest_submission"]}'::jsonb, 'desc'),
	('wedge-window', 'Wedge Window', 'Hit a controlled wedge set between 50 and 90 yards.', 'wedge_window', '{"metric":"carry_error","clubTypes":["pw","gw","aw","sw","lw","wedge"],"minShots":20,"targetRangeYards":[50,90],"tieBreakers":["offline_error","straight_rate","earliest_submission"]}'::jsonb, 'asc'),
	('7i-consistency', '7i Consistency', 'Measure carry consistency with a 7 iron sample.', 'consistency', '{"metric":"carry_stddev","clubTypes":["7i","7 iron"],"minShots":10,"tieBreakers":["offline_error","earliest_submission"]}'::jsonb, 'asc'),
	('closest-to-pin', 'Closest to Pin', 'Log your closest approach to a target distance.', 'closest_to_pin', '{"metric":"distance_to_pin","minShots":1,"tieBreakers":["offline_error","earliest_submission"]}'::jsonb, 'asc'),
	('monthly-practice-streak', 'Monthly Practice Streak', 'Keep practice sessions ticking through the month.', 'practice_streak', '{"metric":"practice_days","period":"monthly","tieBreakers":["shot_count","earliest_submission"]}'::jsonb, 'desc')
ON CONFLICT ("slug") DO UPDATE
SET "name" = excluded."name",
	"description" = excluded."description",
	"challenge_type" = excluded."challenge_type",
	"rules_json" = excluded."rules_json",
	"scoring_direction" = excluded."scoring_direction",
	"active" = true,
	"updated_at" = now();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_are_friends(viewer_id uuid, subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viewer_id = subject_id
    OR EXISTS (
      SELECT 1
      FROM public.fkh_friendships friendship
      WHERE (friendship.user_a_id = LEAST(viewer_id, subject_id) AND friendship.user_b_id = GREATEST(viewer_id, subject_id))
    );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_has_social_block(viewer_id uuid, subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fkh_user_blocks block
    WHERE (block.blocker_user_id = viewer_id AND block.blocked_user_id = subject_id)
       OR (block.blocker_user_id = subject_id AND block.blocked_user_id = viewer_id)
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_view_social_profile(profile_row public.fkh_user_profiles)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.fkh_has_social_block(auth.uid(), profile_row.user_id)
    AND (
      profile_row.user_id = auth.uid()
      OR profile_row.public_profile = true
      OR (profile_row.friend_profile = true AND public.fkh_are_friends(auth.uid(), profile_row.user_id))
    );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_view_feed_item(item_row public.fkh_feed_items)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.fkh_has_social_block(auth.uid(), item_row.user_id)
    AND (
      item_row.user_id = auth.uid()
      OR item_row.visibility = 'public'
      OR (item_row.visibility = 'friends' AND public.fkh_are_friends(auth.uid(), item_row.user_id))
    );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.fkh_can_view_challenge(challenge_row public.fkh_challenges)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.fkh_has_social_block(auth.uid(), challenge_row.creator_user_id)
    AND (
      challenge_row.creator_user_id = auth.uid()
      OR challenge_row.visibility = 'public'
      OR (challenge_row.visibility = 'friends' AND public.fkh_are_friends(auth.uid(), challenge_row.creator_user_id))
      OR EXISTS (
        SELECT 1 FROM public.fkh_challenge_entries entry
        WHERE entry.challenge_id = challenge_row.id AND entry.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.fkh_challenge_invites invite
        WHERE invite.challenge_id = challenge_row.id AND invite.invitee_user_id = auth.uid()
      )
    );
$$;
--> statement-breakpoint
ALTER TABLE "fkh_user_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_friend_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_friendships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_user_blocks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_user_follows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_feed_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_feed_reactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_feed_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenge_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenge_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenge_attempts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenge_results" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenge_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fkh_challenge_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "fkh_user_profiles_select_visible" ON "fkh_user_profiles" FOR SELECT USING (public.fkh_can_view_social_profile(fkh_user_profiles));
--> statement-breakpoint
CREATE POLICY "fkh_user_profiles_insert_self" ON "fkh_user_profiles" FOR INSERT WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_user_profiles_update_self" ON "fkh_user_profiles" FOR UPDATE USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_friend_requests_select_related" ON "fkh_friend_requests" FOR SELECT USING ("requester_user_id" = auth.uid() OR "recipient_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_friend_requests_insert_self" ON "fkh_friend_requests" FOR INSERT WITH CHECK ("requester_user_id" = auth.uid() AND "recipient_user_id" <> auth.uid() AND NOT public.fkh_has_social_block(auth.uid(), "recipient_user_id"));
--> statement-breakpoint
CREATE POLICY "fkh_friend_requests_update_related" ON "fkh_friend_requests" FOR UPDATE USING ("requester_user_id" = auth.uid() OR "recipient_user_id" = auth.uid()) WITH CHECK ("requester_user_id" = auth.uid() OR "recipient_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_friend_requests_delete_related" ON "fkh_friend_requests" FOR DELETE USING ("requester_user_id" = auth.uid() OR "recipient_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_friendships_select_participant" ON "fkh_friendships" FOR SELECT USING ("user_a_id" = auth.uid() OR "user_b_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_friendships_insert_participant" ON "fkh_friendships" FOR INSERT WITH CHECK (("user_a_id" = auth.uid() OR "user_b_id" = auth.uid()) AND "user_a_id" <> "user_b_id" AND NOT public.fkh_has_social_block("user_a_id", "user_b_id"));
--> statement-breakpoint
CREATE POLICY "fkh_friendships_delete_participant" ON "fkh_friendships" FOR DELETE USING ("user_a_id" = auth.uid() OR "user_b_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_user_blocks_owner_all" ON "fkh_user_blocks" FOR ALL USING ("blocker_user_id" = auth.uid()) WITH CHECK ("blocker_user_id" = auth.uid() AND "blocked_user_id" <> auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_user_follows_select_related" ON "fkh_user_follows" FOR SELECT USING ("follower_user_id" = auth.uid() OR "followed_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_user_follows_owner_all" ON "fkh_user_follows" FOR ALL USING ("follower_user_id" = auth.uid()) WITH CHECK ("follower_user_id" = auth.uid() AND "followed_user_id" <> auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_feed_items_select_visible" ON "fkh_feed_items" FOR SELECT USING (public.fkh_can_view_feed_item(fkh_feed_items));
--> statement-breakpoint
CREATE POLICY "fkh_feed_items_owner_write" ON "fkh_feed_items" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_feed_reactions_select_visible_item" ON "fkh_feed_reactions" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_feed_items item WHERE item.id = feed_item_id AND public.fkh_can_view_feed_item(item)));
--> statement-breakpoint
CREATE POLICY "fkh_feed_reactions_insert_self_visible_item" ON "fkh_feed_reactions" FOR INSERT WITH CHECK ("user_id" = auth.uid() AND EXISTS (SELECT 1 FROM public.fkh_feed_items item WHERE item.id = feed_item_id AND public.fkh_can_view_feed_item(item)));
--> statement-breakpoint
CREATE POLICY "fkh_feed_reactions_delete_self" ON "fkh_feed_reactions" FOR DELETE USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_feed_comments_select_visible_item" ON "fkh_feed_comments" FOR SELECT USING ("deleted_at" IS NULL AND EXISTS (SELECT 1 FROM public.fkh_feed_items item WHERE item.id = feed_item_id AND public.fkh_can_view_feed_item(item)));
--> statement-breakpoint
CREATE POLICY "fkh_feed_comments_insert_self_visible_item" ON "fkh_feed_comments" FOR INSERT WITH CHECK ("user_id" = auth.uid() AND EXISTS (SELECT 1 FROM public.fkh_feed_items item WHERE item.id = feed_item_id AND public.fkh_can_view_feed_item(item)));
--> statement-breakpoint
CREATE POLICY "fkh_feed_comments_update_self" ON "fkh_feed_comments" FOR UPDATE USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_feed_comments_delete_self" ON "fkh_feed_comments" FOR DELETE USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_templates_select_authenticated" ON "fkh_challenge_templates" FOR SELECT USING (auth.uid() IS NOT NULL);
--> statement-breakpoint
CREATE POLICY "fkh_challenges_select_visible" ON "fkh_challenges" FOR SELECT USING (public.fkh_can_view_challenge(fkh_challenges));
--> statement-breakpoint
CREATE POLICY "fkh_challenges_creator_write" ON "fkh_challenges" FOR ALL USING ("creator_user_id" = auth.uid()) WITH CHECK ("creator_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_entries_select_visible_challenge" ON "fkh_challenge_entries" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_entries_insert_self_visible_challenge" ON "fkh_challenge_entries" FOR INSERT WITH CHECK ("user_id" = auth.uid() AND EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_entries_update_self" ON "fkh_challenge_entries" FOR UPDATE USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_entries_delete_self" ON "fkh_challenge_entries" FOR DELETE USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_attempts_select_visible_challenge" ON "fkh_challenge_attempts" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_attempts_insert_self_visible_challenge" ON "fkh_challenge_attempts" FOR INSERT WITH CHECK ("user_id" = auth.uid() AND EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_attempts_delete_self" ON "fkh_challenge_attempts" FOR DELETE USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_results_select_visible_challenge" ON "fkh_challenge_results" FOR SELECT USING (EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_results_owner_write" ON "fkh_challenge_results" FOR ALL USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_comments_select_visible_challenge" ON "fkh_challenge_comments" FOR SELECT USING ("deleted_at" IS NULL AND EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_comments_insert_self_visible_challenge" ON "fkh_challenge_comments" FOR INSERT WITH CHECK ("user_id" = auth.uid() AND EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_comments_update_self" ON "fkh_challenge_comments" FOR UPDATE USING ("user_id" = auth.uid()) WITH CHECK ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_comments_delete_self" ON "fkh_challenge_comments" FOR DELETE USING ("user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_invites_select_related" ON "fkh_challenge_invites" FOR SELECT USING ("inviter_user_id" = auth.uid() OR "invitee_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "fkh_challenge_invites_insert_self_visible_challenge" ON "fkh_challenge_invites" FOR INSERT WITH CHECK ("inviter_user_id" = auth.uid() AND "invitee_user_id" <> auth.uid() AND EXISTS (SELECT 1 FROM public.fkh_challenges challenge WHERE challenge.id = challenge_id AND public.fkh_can_view_challenge(challenge)));
--> statement-breakpoint
CREATE POLICY "fkh_challenge_invites_update_related" ON "fkh_challenge_invites" FOR UPDATE USING ("inviter_user_id" = auth.uid() OR "invitee_user_id" = auth.uid()) WITH CHECK ("inviter_user_id" = auth.uid() OR "invitee_user_id" = auth.uid());
