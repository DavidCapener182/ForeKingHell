-- RLS policies invoke these helpers as the caller. Keep PUBLIC revoked while
-- allowing the real Supabase API roles to evaluate policy predicates.
REVOKE EXECUTE ON FUNCTION public.fkh_can_access_user(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_access_user(uuid, text[]) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_read_course(public.fkh_courses) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_read_course(public.fkh_courses) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_view_ai_summary(public.fkh_ai_social_summaries) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_ai_summary(public.fkh_ai_social_summaries) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_view_challenge(public.fkh_challenges) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_challenge(public.fkh_challenges) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_view_feed_item(public.fkh_feed_items) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_feed_item(public.fkh_feed_items) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_view_group(public.fkh_groups) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_group(public.fkh_groups) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_view_social_profile(public.fkh_user_profiles) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_social_profile(public.fkh_user_profiles) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_write_course(public.fkh_courses) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_write_course(public.fkh_courses) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_view_course_record(public.fkh_course_records) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_course_record(public.fkh_course_records) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fkh_can_view_tournament(public.fkh_tournaments) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_can_view_tournament(public.fkh_tournaments) TO anon, authenticated;
