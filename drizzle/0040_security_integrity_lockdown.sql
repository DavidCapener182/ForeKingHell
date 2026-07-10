-- Lock server-maintained identity, provenance, reward, quota, competition and
-- practice state behind the application server. Add relational integrity
-- checks for privileged writes that bypass Supabase RLS.

ALTER TABLE public.fkh_user_identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.fkh_user_identity_links
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fkh_validate_identity_link_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  canonical_email text;
  linked_email text;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT lower(email) INTO canonical_email
    FROM public.fkh_users WHERE id = NEW.canonical_user_id;
    SELECT lower(email) INTO linked_email
    FROM public.fkh_users WHERE id = NEW.linked_user_id;

    IF canonical_email IS NULL OR linked_email IS NULL OR canonical_email <> linked_email THEN
      RAISE EXCEPTION 'Linked identities must have the same verified email address'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_validate_identity_link_emails()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fkh_identity_links_validate_emails
  ON public.fkh_user_identity_links;
CREATE TRIGGER fkh_identity_links_validate_emails
  BEFORE INSERT OR UPDATE ON public.fkh_user_identity_links
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_identity_link_emails();

UPDATE public.fkh_user_identity_links identity_link
SET status = 'invalid_email', updated_at = now()
WHERE identity_link.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.fkh_users canonical_user
    JOIN public.fkh_users linked_user
      ON linked_user.id = identity_link.linked_user_id
    WHERE canonical_user.id = identity_link.canonical_user_id
      AND canonical_user.email IS NOT NULL
      AND linked_user.email IS NOT NULL
      AND lower(canonical_user.email) = lower(linked_user.email)
  );

DROP POLICY IF EXISTS "fkh_usage_events_owner_all" ON public.fkh_usage_events;
DROP POLICY IF EXISTS "fkh_ai_usage_events_owner_all" ON public.fkh_ai_usage_events;
DROP POLICY IF EXISTS "fkh_ai_generation_cache_owner_all" ON public.fkh_ai_generation_cache;
REVOKE ALL PRIVILEGES ON TABLE
  public.fkh_usage_events,
  public.fkh_ai_usage_events,
  public.fkh_ai_generation_cache
  FROM anon, authenticated;

ALTER TABLE public.fkh_ai_usage_events
  DROP CONSTRAINT IF EXISTS fkh_ai_usage_events_credits_nonnegative;
ALTER TABLE public.fkh_ai_usage_events
  ADD CONSTRAINT fkh_ai_usage_events_credits_nonnegative CHECK (ai_credits >= 0);

DROP POLICY IF EXISTS "fkh_user_achievements_insert_owner" ON public.fkh_user_achievements;
DROP POLICY IF EXISTS "fkh_user_achievements_update_owner_or_editor" ON public.fkh_user_achievements;
DROP POLICY IF EXISTS "fkh_user_achievements_delete_owner" ON public.fkh_user_achievements;
DROP POLICY IF EXISTS "fkh_xp_ledger_insert_owner" ON public.fkh_xp_ledger;
DROP POLICY IF EXISTS "fkh_xp_ledger_update_owner_or_editor" ON public.fkh_xp_ledger;
DROP POLICY IF EXISTS "fkh_xp_ledger_delete_owner" ON public.fkh_xp_ledger;
DROP POLICY IF EXISTS "fkh_achievement_progress_insert_owner" ON public.fkh_achievement_progress;
DROP POLICY IF EXISTS "fkh_achievement_progress_update_owner_or_editor" ON public.fkh_achievement_progress;
DROP POLICY IF EXISTS "fkh_achievement_progress_delete_owner" ON public.fkh_achievement_progress;
DROP POLICY IF EXISTS "fkh_achievement_sync_insert_owner" ON public.fkh_achievement_sync_state;
DROP POLICY IF EXISTS "fkh_achievement_sync_update_owner_or_editor" ON public.fkh_achievement_sync_state;
DROP POLICY IF EXISTS "fkh_achievement_sync_delete_owner" ON public.fkh_achievement_sync_state;
DROP POLICY IF EXISTS "fkh_rapsodo_sync_insert_owner" ON public.fkh_rapsodo_sync_sessions;
DROP POLICY IF EXISTS "fkh_rapsodo_sync_update_owner_or_editor" ON public.fkh_rapsodo_sync_sessions;
DROP POLICY IF EXISTS "fkh_rapsodo_sync_delete_owner" ON public.fkh_rapsodo_sync_sessions;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.fkh_user_achievements,
  public.fkh_xp_ledger,
  public.fkh_achievement_progress,
  public.fkh_achievement_sync_state,
  public.fkh_rapsodo_sync_sessions
  FROM anon, authenticated;

DROP POLICY IF EXISTS "fkh_challenge_attempts_insert_self_visible_challenge"
  ON public.fkh_challenge_attempts;
DROP POLICY IF EXISTS "fkh_challenge_attempts_delete_self"
  ON public.fkh_challenge_attempts;
DROP POLICY IF EXISTS "fkh_challenge_results_owner_write"
  ON public.fkh_challenge_results;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.fkh_challenge_attempts,
  public.fkh_challenge_results
  FROM anon, authenticated;

DROP POLICY IF EXISTS "fkh_practice_templates_owner_all" ON public.fkh_practice_templates;
DROP POLICY IF EXISTS "fkh_practice_plans_owner_all" ON public.fkh_practice_plans;
DROP POLICY IF EXISTS "fkh_practice_blocks_owner_all" ON public.fkh_practice_blocks;
DROP POLICY IF EXISTS "fkh_practice_results_owner_all" ON public.fkh_practice_results;
DROP POLICY IF EXISTS "fkh_practice_plan_matches_owner_all" ON public.fkh_practice_plan_matches;
DROP POLICY IF EXISTS "fkh_practice_block_results_owner_all" ON public.fkh_practice_block_results;
REVOKE ALL PRIVILEGES ON TABLE
  public.fkh_practice_templates,
  public.fkh_practice_plans,
  public.fkh_practice_blocks,
  public.fkh_practice_results,
  public.fkh_practice_plan_matches,
  public.fkh_practice_block_results
  FROM anon, authenticated;

DROP POLICY IF EXISTS "fkh_course_features_select_course_access" ON public.fkh_course_features;
DROP POLICY IF EXISTS "fkh_course_features_write_course_owner" ON public.fkh_course_features;
ALTER TABLE public.fkh_course_features ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.fkh_course_features FROM anon, authenticated;

DROP POLICY IF EXISTS "fkh_club_equipment_insert_owner" ON public.fkh_club_equipment_history;
DROP POLICY IF EXISTS "fkh_club_equipment_update_owner_or_editor"
  ON public.fkh_club_equipment_history;
DROP POLICY IF EXISTS "fkh_club_equipment_delete_owner" ON public.fkh_club_equipment_history;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.fkh_club_equipment_history FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.fkh_validate_hole_tee_course()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.fkh_tee_sets tee_set
    WHERE tee_set.id = NEW.tee_set_id
      AND tee_set.course_id = NEW.course_id
  ) THEN
    RAISE EXCEPTION 'Hole tee set does not belong to the selected course'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_validate_hole_tee_course()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fkh_holes_validate_tee_course ON public.fkh_holes;
CREATE TRIGGER fkh_holes_validate_tee_course
  BEFORE INSERT OR UPDATE ON public.fkh_holes
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_hole_tee_course();

CREATE OR REPLACE FUNCTION public.fkh_validate_equipment_history_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.fkh_clubs club
    WHERE club.id = NEW.club_id AND club.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Equipment club does not belong to the selected user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.ball_model_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.fkh_ball_models ball
    WHERE ball.id = NEW.ball_model_id AND ball.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Equipment ball does not belong to the selected user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_validate_equipment_history_ownership()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fkh_equipment_history_validate_ownership
  ON public.fkh_club_equipment_history;
CREATE TRIGGER fkh_equipment_history_validate_ownership
  BEFORE INSERT OR UPDATE ON public.fkh_club_equipment_history
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_equipment_history_ownership();

CREATE OR REPLACE FUNCTION public.fkh_validate_practice_relationships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'fkh_practice_plans' THEN
    IF NEW.source_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.fkh_sessions session
      WHERE session.id = NEW.source_session_id AND session.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Practice source session does not belong to the selected user'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.template_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.fkh_practice_templates template
      WHERE template.id = NEW.template_id
        AND (template.user_id IS NULL OR template.user_id = NEW.user_id)
    ) THEN
      RAISE EXCEPTION 'Practice template is not available to the selected user'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'fkh_practice_blocks' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.fkh_practice_plans plan
      WHERE plan.id = NEW.practice_plan_id AND plan.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Practice block owner does not match its plan'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'fkh_practice_results' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.fkh_practice_plans plan
      WHERE plan.id = NEW.practice_plan_id AND plan.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Practice result owner does not match its plan'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.source_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.fkh_sessions session
      WHERE session.id = NEW.source_session_id AND session.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Practice result session does not belong to the selected user'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'fkh_practice_plan_matches' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.fkh_practice_plans plan
      JOIN public.fkh_sessions session ON session.id = NEW.session_id
      WHERE plan.id = NEW.practice_plan_id
        AND plan.user_id = NEW.user_id
        AND session.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Practice match owner does not match its plan and session'
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'fkh_practice_block_results' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.fkh_practice_results result
      JOIN public.fkh_practice_blocks block
        ON block.id = NEW.practice_block_id
       AND block.practice_plan_id = result.practice_plan_id
      WHERE result.id = NEW.practice_result_id
        AND result.user_id = NEW.user_id
        AND block.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Practice block result does not match one owned plan'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_validate_practice_relationships()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fkh_practice_plans_validate_relations ON public.fkh_practice_plans;
CREATE TRIGGER fkh_practice_plans_validate_relations
  BEFORE INSERT OR UPDATE ON public.fkh_practice_plans
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_practice_relationships();
DROP TRIGGER IF EXISTS fkh_practice_blocks_validate_relations ON public.fkh_practice_blocks;
CREATE TRIGGER fkh_practice_blocks_validate_relations
  BEFORE INSERT OR UPDATE ON public.fkh_practice_blocks
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_practice_relationships();
DROP TRIGGER IF EXISTS fkh_practice_results_validate_relations ON public.fkh_practice_results;
CREATE TRIGGER fkh_practice_results_validate_relations
  BEFORE INSERT OR UPDATE ON public.fkh_practice_results
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_practice_relationships();
DROP TRIGGER IF EXISTS fkh_practice_matches_validate_relations ON public.fkh_practice_plan_matches;
CREATE TRIGGER fkh_practice_matches_validate_relations
  BEFORE INSERT OR UPDATE ON public.fkh_practice_plan_matches
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_practice_relationships();
DROP TRIGGER IF EXISTS fkh_practice_block_results_validate_relations
  ON public.fkh_practice_block_results;
CREATE TRIGGER fkh_practice_block_results_validate_relations
  BEFORE INSERT OR UPDATE ON public.fkh_practice_block_results
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_practice_relationships();

CREATE TABLE IF NOT EXISTS public.fkh_scorecard_proof_consumptions (
  proof_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  scope_type varchar(32) NOT NULL,
  scope_id varchar(220) NOT NULL,
  round_number integer,
  image_hash varchar(64) NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fkh_scorecard_proof_consumptions_user_idx
  ON public.fkh_scorecard_proof_consumptions (user_id, consumed_at DESC);
ALTER TABLE public.fkh_scorecard_proof_consumptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.fkh_scorecard_proof_consumptions
  FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.fkh_stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type varchar(120) NOT NULL,
  object_key varchar(220),
  event_created_at timestamptz NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'processing',
  attempts integer NOT NULL DEFAULT 1,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code varchar(120),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fkh_stripe_webhook_events_object_created_idx
  ON public.fkh_stripe_webhook_events (object_key, event_created_at DESC);
ALTER TABLE public.fkh_stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.fkh_stripe_webhook_events
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.fkh_subscriptions
  ADD COLUMN IF NOT EXISTS last_stripe_event_id text,
  ADD COLUMN IF NOT EXISTS last_stripe_event_created_at timestamptz;
