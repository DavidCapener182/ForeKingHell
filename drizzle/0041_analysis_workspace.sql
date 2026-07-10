-- Durable user-authored analysis notes and point-in-time analytical snapshots.

CREATE TABLE IF NOT EXISTS public.fkh_analysis_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.fkh_sessions(id) ON DELETE SET NULL,
  annotation_type varchar(40) NOT NULL,
  title varchar(180) NOT NULL,
  body text NOT NULL,
  range_from timestamptz,
  range_to timestamptz,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_analysis_annotations_range_check
    CHECK (range_to IS NULL OR range_from IS NULL OR range_to >= range_from)
);

CREATE INDEX IF NOT EXISTS fkh_analysis_annotations_user_created_idx
  ON public.fkh_analysis_annotations (user_id, created_at);
CREATE INDEX IF NOT EXISTS fkh_analysis_annotations_user_range_idx
  ON public.fkh_analysis_annotations (user_id, range_from, range_to);
CREATE INDEX IF NOT EXISTS fkh_analysis_annotations_session_idx
  ON public.fkh_analysis_annotations (session_id);

CREATE TABLE IF NOT EXISTS public.fkh_analysis_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  chart_state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_metrics_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_data_through timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fkh_analysis_snapshots_user_captured_idx
  ON public.fkh_analysis_snapshots (user_id, captured_at);
CREATE INDEX IF NOT EXISTS fkh_analysis_snapshots_user_source_idx
  ON public.fkh_analysis_snapshots (user_id, source_data_through);

ALTER TABLE public.fkh_analysis_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_analysis_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fkh_analysis_annotations_owner_all
  ON public.fkh_analysis_annotations;
CREATE POLICY fkh_analysis_annotations_owner_all
  ON public.fkh_analysis_annotations
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS fkh_analysis_snapshots_owner_all
  ON public.fkh_analysis_snapshots;
CREATE POLICY fkh_analysis_snapshots_owner_all
  ON public.fkh_analysis_snapshots
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.fkh_analysis_annotations FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.fkh_analysis_snapshots FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_analysis_annotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_analysis_snapshots TO authenticated;

DROP TRIGGER IF EXISTS fkh_analysis_annotations_owner_immutable
  ON public.fkh_analysis_annotations;
CREATE TRIGGER fkh_analysis_annotations_owner_immutable
  BEFORE UPDATE OF user_id ON public.fkh_analysis_annotations
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');

DROP TRIGGER IF EXISTS fkh_analysis_snapshots_owner_immutable
  ON public.fkh_analysis_snapshots;
CREATE TRIGGER fkh_analysis_snapshots_owner_immutable
  BEFORE UPDATE OF user_id ON public.fkh_analysis_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.fkh_reject_scope_reassignment('user_id');

CREATE OR REPLACE FUNCTION public.fkh_validate_analysis_annotation_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.fkh_sessions session_row
    WHERE session_row.id = NEW.session_id
      AND session_row.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Analysis annotation session must belong to the same user'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fkh_validate_analysis_annotation_scope()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS fkh_analysis_annotations_validate_scope
  ON public.fkh_analysis_annotations;
CREATE TRIGGER fkh_analysis_annotations_validate_scope
  BEFORE INSERT OR UPDATE OF user_id, session_id ON public.fkh_analysis_annotations
  FOR EACH ROW EXECUTE FUNCTION public.fkh_validate_analysis_annotation_scope();
