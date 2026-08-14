CREATE TABLE IF NOT EXISTS public.fkh_course_favourites (
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.fkh_courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_favourites_user_course_idx
  ON public.fkh_course_favourites (user_id, course_id);
CREATE INDEX IF NOT EXISTS fkh_course_favourites_user_idx
  ON public.fkh_course_favourites (user_id);
CREATE INDEX IF NOT EXISTS fkh_course_favourites_course_idx
  ON public.fkh_course_favourites (course_id);

ALTER TABLE public.fkh_course_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_favourites FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fkh_course_favourites_owner_select
  ON public.fkh_course_favourites;
CREATE POLICY fkh_course_favourites_owner_select
  ON public.fkh_course_favourites
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS fkh_course_favourites_owner_insert
  ON public.fkh_course_favourites;
CREATE POLICY fkh_course_favourites_owner_insert
  ON public.fkh_course_favourites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS fkh_course_favourites_owner_delete
  ON public.fkh_course_favourites;
CREATE POLICY fkh_course_favourites_owner_delete
  ON public.fkh_course_favourites
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.fkh_course_favourites FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.fkh_course_favourites TO authenticated;

COMMENT ON TABLE public.fkh_course_favourites IS
  'Account-scoped course favourites shared across the golfer desktop and companion surfaces.';
