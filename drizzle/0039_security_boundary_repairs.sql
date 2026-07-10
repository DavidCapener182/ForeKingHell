-- Repair client-reachable RLS trust-establishment and ownership boundaries.

DROP POLICY IF EXISTS "fkh_subscriptions_owner_insert" ON public.fkh_subscriptions;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.fkh_subscriptions FROM anon, authenticated;

DROP POLICY IF EXISTS "fkh_billing_customers_owner_all" ON public.fkh_billing_customers;
DROP POLICY IF EXISTS "fkh_billing_customers_owner_select" ON public.fkh_billing_customers;
CREATE POLICY "fkh_billing_customers_owner_select"
  ON public.fkh_billing_customers
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND "user_id" = (SELECT auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON TABLE public.fkh_billing_customers FROM anon, authenticated;

DROP POLICY IF EXISTS "fkh_group_memberships_insert_self_or_manager"
  ON public.fkh_group_memberships;
DROP POLICY IF EXISTS "fkh_group_memberships_insert_manager"
  ON public.fkh_group_memberships;
CREATE POLICY "fkh_group_memberships_insert_manager"
  ON public.fkh_group_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND public.fkh_can_manage_group("group_id", (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "fkh_friendships_insert_participant" ON public.fkh_friendships;

-- Public-schema helpers remain usable by RLS, but no longer answer relationship
-- questions about arbitrary third parties supplied by an API caller.
CREATE OR REPLACE FUNCTION public.fkh_are_friends(viewer_id uuid, subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND (viewer_id = (SELECT auth.uid()) OR subject_id = (SELECT auth.uid()))
    AND (
      viewer_id = subject_id
      OR EXISTS (
        SELECT 1
        FROM public.fkh_friendships friendship
        WHERE friendship.user_a_id = LEAST(viewer_id, subject_id)
          AND friendship.user_b_id = GREATEST(viewer_id, subject_id)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.fkh_has_social_block(viewer_id uuid, subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND (viewer_id = (SELECT auth.uid()) OR subject_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.fkh_user_blocks block
      WHERE (block.blocker_user_id = viewer_id AND block.blocked_user_id = subject_id)
         OR (block.blocker_user_id = subject_id AND block.blocked_user_id = viewer_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.fkh_is_group_member(
  target_group_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND target_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fkh_group_memberships membership
      WHERE membership.group_id = target_group_id
        AND membership.user_id = target_user_id
        AND membership.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.fkh_can_manage_group(
  target_group_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND target_user_id = (SELECT auth.uid())
    AND (
      EXISTS (
        SELECT 1
        FROM public.fkh_groups target_group
        WHERE target_group.id = target_group_id
          AND target_group.owner_user_id = target_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.fkh_group_memberships membership
        WHERE membership.group_id = target_group_id
          AND membership.user_id = target_user_id
          AND membership.status = 'active'
          AND membership.role IN ('admin', 'moderator')
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_are_friends(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fkh_has_social_block(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fkh_is_group_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fkh_can_manage_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fkh_are_friends(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fkh_has_social_block(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fkh_is_group_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fkh_can_manage_group(uuid, uuid) TO anon, authenticated;

-- Editors may update content, but must never change its owner. Related-user and
-- competition rows similarly keep their participants and parent scope immutable.
CREATE OR REPLACE FUNCTION public.fkh_reject_scope_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  protected_column text;
BEGIN
  FOREACH protected_column IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(OLD) -> protected_column) IS DISTINCT FROM
       (to_jsonb(NEW) -> protected_column) THEN
      RAISE EXCEPTION 'Protected ownership or scope column % cannot be changed', protected_column
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_reject_scope_reassignment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS fkh_clubs_owner_immutable ON public.fkh_clubs;
CREATE TRIGGER fkh_clubs_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_clubs
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_sessions_owner_immutable ON public.fkh_sessions;
CREATE TRIGGER fkh_sessions_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_import_rows_owner_immutable ON public.fkh_import_rows;
CREATE TRIGGER fkh_import_rows_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_import_rows
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_import_files_owner_immutable ON public.fkh_import_files;
CREATE TRIGGER fkh_import_files_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_import_files
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_shots_owner_immutable ON public.fkh_shots;
CREATE TRIGGER fkh_shots_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_shots
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_stock_yardages_owner_immutable ON public.fkh_stock_yardages;
CREATE TRIGGER fkh_stock_yardages_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_stock_yardages
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_ball_models_owner_immutable ON public.fkh_ball_models;
CREATE TRIGGER fkh_ball_models_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_ball_models
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_club_equipment_owner_immutable ON public.fkh_club_equipment_history;
CREATE TRIGGER fkh_club_equipment_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_club_equipment_history
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_user_achievements_owner_immutable ON public.fkh_user_achievements;
CREATE TRIGGER fkh_user_achievements_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_xp_ledger_owner_immutable ON public.fkh_xp_ledger;
CREATE TRIGGER fkh_xp_ledger_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_xp_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_achievement_progress_owner_immutable ON public.fkh_achievement_progress;
CREATE TRIGGER fkh_achievement_progress_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_achievement_progress
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_achievement_sync_owner_immutable ON public.fkh_achievement_sync_state;
CREATE TRIGGER fkh_achievement_sync_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_achievement_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_rapsodo_sync_owner_immutable ON public.fkh_rapsodo_sync_sessions;
CREATE TRIGGER fkh_rapsodo_sync_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_rapsodo_sync_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');
DROP TRIGGER IF EXISTS fkh_sg_events_owner_immutable ON public.fkh_strokes_gained_shot_events;
CREATE TRIGGER fkh_sg_events_owner_immutable BEFORE UPDATE OF user_id ON public.fkh_strokes_gained_shot_events
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');

DROP TRIGGER IF EXISTS fkh_friend_requests_scope_immutable ON public.fkh_friend_requests;
CREATE TRIGGER fkh_friend_requests_scope_immutable
  BEFORE UPDATE OF requester_user_id, recipient_user_id ON public.fkh_friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment(
    'requester_user_id', 'recipient_user_id'
  );
DROP TRIGGER IF EXISTS fkh_challenge_entries_scope_immutable ON public.fkh_challenge_entries;
CREATE TRIGGER fkh_challenge_entries_scope_immutable
  BEFORE UPDATE OF user_id, challenge_id ON public.fkh_challenge_entries
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id', 'challenge_id');
DROP TRIGGER IF EXISTS fkh_challenge_invites_scope_immutable ON public.fkh_challenge_invites;
CREATE TRIGGER fkh_challenge_invites_scope_immutable
  BEFORE UPDATE OF inviter_user_id, invitee_user_id, challenge_id ON public.fkh_challenge_invites
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment(
    'inviter_user_id', 'invitee_user_id', 'challenge_id'
  );
DROP TRIGGER IF EXISTS fkh_groups_scope_immutable ON public.fkh_groups;
CREATE TRIGGER fkh_groups_scope_immutable
  BEFORE UPDATE OF id, owner_user_id ON public.fkh_groups
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('id', 'owner_user_id');
DROP TRIGGER IF EXISTS fkh_group_memberships_scope_immutable ON public.fkh_group_memberships;
CREATE TRIGGER fkh_group_memberships_scope_immutable
  BEFORE UPDATE OF group_id, user_id ON public.fkh_group_memberships
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('group_id', 'user_id');
DROP TRIGGER IF EXISTS fkh_group_invites_scope_immutable ON public.fkh_group_invites;
CREATE TRIGGER fkh_group_invites_scope_immutable
  BEFORE UPDATE OF group_id, inviter_user_id, invitee_user_id ON public.fkh_group_invites
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment(
    'group_id', 'inviter_user_id', 'invitee_user_id'
  );
DROP TRIGGER IF EXISTS fkh_group_posts_scope_immutable ON public.fkh_group_posts;
CREATE TRIGGER fkh_group_posts_scope_immutable
  BEFORE UPDATE OF group_id, user_id ON public.fkh_group_posts
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('group_id', 'user_id');
DROP TRIGGER IF EXISTS fkh_group_challenge_links_scope_immutable ON public.fkh_group_challenge_links;
CREATE TRIGGER fkh_group_challenge_links_scope_immutable
  BEFORE UPDATE OF group_id, challenge_id, created_by_user_id ON public.fkh_group_challenge_links
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment(
    'group_id', 'challenge_id', 'created_by_user_id'
  );
