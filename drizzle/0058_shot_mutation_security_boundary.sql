-- Make shot provenance and review history server-mediated on databases where
-- the lifecycle migrations are already present. This is intentionally
-- idempotent so policy/grant drift can be repaired safely.

ALTER TABLE public.fkh_shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fkh_shots_select_accessible ON public.fkh_shots;
CREATE POLICY fkh_shots_select_accessible
  ON public.fkh_shots
  FOR SELECT TO authenticated
  USING (public.fkh_can_access_user(user_id, ARRAY['coach', 'viewer', 'editor']));

DROP POLICY IF EXISTS fkh_shots_insert_owner ON public.fkh_shots;
DROP POLICY IF EXISTS fkh_shots_update_owner_or_editor ON public.fkh_shots;
DROP POLICY IF EXISTS fkh_shots_delete_owner ON public.fkh_shots;

-- Revoking the table-level privileges also protects quality_tag,
-- shot_category, source_raw_json, review_status, review_reason,
-- review_confidence, review_source, review_previous_quality_tag and reviewed_at
-- on both INSERT and UPDATE. TRUNCATE is revoked because it bypasses RLS.
REVOKE ALL PRIVILEGES ON TABLE public.fkh_shots
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fkh_shots TO authenticated;

-- fkh_shots.session_id cascades on session deletion, and review events cascade
-- from their shot. Prevent Data API users from deleting or truncating sessions
-- while retaining the existing server-side account deletion and reset paths.
DROP POLICY IF EXISTS fkh_sessions_delete_owner ON public.fkh_sessions;
REVOKE DELETE, TRUNCATE ON TABLE public.fkh_sessions
  FROM PUBLIC, anon, authenticated;
