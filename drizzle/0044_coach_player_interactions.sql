-- Coach Workspace interactions with explicit player visibility and relationship-scoped RLS.

CREATE TABLE IF NOT EXISTS public.fkh_coach_player_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  interaction_type varchar(40) NOT NULL,
  visibility varchar(24) NOT NULL DEFAULT 'player_visible',
  title varchar(180) NOT NULL,
  body text NOT NULL,
  session_id uuid REFERENCES public.fkh_sessions(id) ON DELETE SET NULL,
  practice_plan_id uuid REFERENCES public.fkh_practice_plans(id) ON DELETE SET NULL,
  goal_reference varchar(220),
  evidence_type varchar(60),
  evidence_id varchar(220),
  status varchar(24) NOT NULL DEFAULT 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_coach_player_interactions_distinct_users_check
    CHECK (player_user_id <> coach_user_id),
  CONSTRAINT fkh_coach_player_interactions_type_check
    CHECK (interaction_type IN (
      'practice_assignment',
      'private_note',
      'player_note',
      'session_comment',
      'goal_review',
      'evidence_request'
    )),
  CONSTRAINT fkh_coach_player_interactions_visibility_check
    CHECK (visibility IN ('coach_only', 'player_visible')),
  CONSTRAINT fkh_coach_player_interactions_private_note_check
    CHECK (
      (interaction_type = 'private_note' AND visibility = 'coach_only')
      OR (interaction_type <> 'private_note' AND visibility = 'player_visible')
    ),
  CONSTRAINT fkh_coach_player_interactions_status_check
    CHECK (status IN ('open', 'acknowledged', 'completed', 'cancelled')),
  CONSTRAINT fkh_coach_player_interactions_body_length_check
    CHECK (char_length(body) BETWEEN 1 AND 8000)
);

CREATE INDEX IF NOT EXISTS fkh_coach_player_interactions_player_status_idx
  ON public.fkh_coach_player_interactions (player_user_id, status, created_at);
CREATE INDEX IF NOT EXISTS fkh_coach_player_interactions_coach_status_idx
  ON public.fkh_coach_player_interactions (coach_user_id, status, created_at);
CREATE INDEX IF NOT EXISTS fkh_coach_player_interactions_session_idx
  ON public.fkh_coach_player_interactions (session_id);
CREATE INDEX IF NOT EXISTS fkh_coach_player_interactions_plan_idx
  ON public.fkh_coach_player_interactions (practice_plan_id);
CREATE INDEX IF NOT EXISTS fkh_coach_player_interactions_due_idx
  ON public.fkh_coach_player_interactions (due_at);

ALTER TABLE public.fkh_coach_player_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_coach_player_interactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fkh_coach_player_interactions_select_related
  ON public.fkh_coach_player_interactions;
CREATE POLICY fkh_coach_player_interactions_select_related
  ON public.fkh_coach_player_interactions
  FOR SELECT TO authenticated
  USING (
    (
      player_user_id = (SELECT auth.uid())
      AND visibility = 'player_visible'
    )
    OR (
      coach_user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.fkh_account_memberships membership
        WHERE membership.owner_user_id = player_user_id
          AND membership.member_user_id = (SELECT auth.uid())
          AND membership.role = 'coach'
      )
    )
  );

DROP POLICY IF EXISTS fkh_coach_player_interactions_coach_insert
  ON public.fkh_coach_player_interactions;
CREATE POLICY fkh_coach_player_interactions_coach_insert
  ON public.fkh_coach_player_interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    coach_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fkh_account_memberships membership
      WHERE membership.owner_user_id = player_user_id
        AND membership.member_user_id = (SELECT auth.uid())
        AND membership.role = 'coach'
    )
  );

DROP POLICY IF EXISTS fkh_coach_player_interactions_coach_update
  ON public.fkh_coach_player_interactions;
CREATE POLICY fkh_coach_player_interactions_coach_update
  ON public.fkh_coach_player_interactions
  FOR UPDATE TO authenticated
  USING (
    coach_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fkh_account_memberships membership
      WHERE membership.owner_user_id = player_user_id
        AND membership.member_user_id = (SELECT auth.uid())
        AND membership.role = 'coach'
    )
  )
  WITH CHECK (
    coach_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fkh_account_memberships membership
      WHERE membership.owner_user_id = player_user_id
        AND membership.member_user_id = (SELECT auth.uid())
        AND membership.role = 'coach'
    )
  );

DROP POLICY IF EXISTS fkh_coach_player_interactions_coach_delete
  ON public.fkh_coach_player_interactions;
CREATE POLICY fkh_coach_player_interactions_coach_delete
  ON public.fkh_coach_player_interactions
  FOR DELETE TO authenticated
  USING (
    coach_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.fkh_account_memberships membership
      WHERE membership.owner_user_id = player_user_id
        AND membership.member_user_id = (SELECT auth.uid())
        AND membership.role = 'coach'
    )
  );

REVOKE ALL ON TABLE public.fkh_coach_player_interactions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.fkh_coach_player_interactions TO authenticated;

DROP TRIGGER IF EXISTS fkh_coach_player_interactions_scope_immutable
  ON public.fkh_coach_player_interactions;
CREATE TRIGGER fkh_coach_player_interactions_scope_immutable
  BEFORE UPDATE OF player_user_id, coach_user_id
  ON public.fkh_coach_player_interactions
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment(
    'player_user_id', 'coach_user_id'
  );

CREATE OR REPLACE FUNCTION public.fkh_validate_coach_player_interaction_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.fkh_account_memberships membership
    WHERE membership.owner_user_id = NEW.player_user_id
      AND membership.member_user_id = NEW.coach_user_id
      AND membership.role = 'coach'
  ) THEN
    RAISE EXCEPTION 'Coach interaction requires an active coach membership'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.fkh_sessions session_row
    WHERE session_row.id = NEW.session_id
      AND session_row.user_id = NEW.player_user_id
  ) THEN
    RAISE EXCEPTION 'Coach interaction session must belong to the player'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.practice_plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.fkh_practice_plans practice_plan
    WHERE practice_plan.id = NEW.practice_plan_id
      AND practice_plan.user_id = NEW.player_user_id
  ) THEN
    RAISE EXCEPTION 'Coach interaction practice plan must belong to the player'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_validate_coach_player_interaction_scope()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS fkh_coach_player_interactions_validate_scope
  ON public.fkh_coach_player_interactions;
CREATE TRIGGER fkh_coach_player_interactions_validate_scope
  BEFORE INSERT OR UPDATE OF player_user_id, coach_user_id, session_id, practice_plan_id
  ON public.fkh_coach_player_interactions
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_coach_player_interaction_scope();

COMMENT ON TABLE public.fkh_coach_player_interactions IS
  'Relationship-scoped Coach Workspace assignments, notes, reviews, comments and evidence requests.';
