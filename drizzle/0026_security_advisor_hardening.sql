ALTER FUNCTION public.fkh_can_view_course_record(public.fkh_course_records) SET search_path = public;
--> statement-breakpoint
ALTER FUNCTION public.fkh_can_view_tournament(public.fkh_tournaments) SET search_path = public;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS extensions;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension ext
    JOIN pg_namespace namespace ON namespace.oid = ext.extnamespace
    WHERE ext.extname = 'citext'
      AND namespace.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER EXTENSION citext SET SCHEMA extensions';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can select from avatars" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects';
  END IF;
END
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_are_friends(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_are_friends(uuid, uuid) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_access_user(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_access_user(uuid, text[]) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_manage_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_manage_group(uuid, uuid) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_read_course(public.fkh_courses) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_read_course(public.fkh_courses) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_view_ai_summary(public.fkh_ai_social_summaries) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_ai_summary(public.fkh_ai_social_summaries) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_view_challenge(public.fkh_challenges) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_challenge(public.fkh_challenges) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_view_feed_item(public.fkh_feed_items) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_feed_item(public.fkh_feed_items) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_view_group(public.fkh_groups) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_group(public.fkh_groups) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_view_social_profile(public.fkh_user_profiles) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_social_profile(public.fkh_user_profiles) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_can_write_course(public.fkh_courses) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_write_course(public.fkh_courses) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_has_social_block(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_has_social_block(uuid, uuid) TO anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.fkh_is_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_is_group_member(uuid, uuid) TO anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
