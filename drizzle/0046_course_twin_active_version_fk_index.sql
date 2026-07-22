-- Cover the composite Course Twin active-version foreign key for deletes and validation.

DROP INDEX IF EXISTS public.fkh_course_twins_active_version_idx;
CREATE INDEX fkh_course_twins_active_version_idx
  ON public.fkh_course_twins(active_version_id, id);
