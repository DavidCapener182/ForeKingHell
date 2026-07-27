-- Survey-grade green grids used to unlock honest Grade A putting packages.

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_putting_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.fkh_courses(id) ON DELETE CASCADE,
  hole_number integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending',
  source_name varchar(180) NOT NULL,
  source_url text,
  captured_at timestamptz NOT NULL,
  coordinate_system varchar(80) NOT NULL DEFAULT 'EPSG:4326',
  grid_spacing_m double precision NOT NULL,
  vertical_accuracy_mm double precision NOT NULL,
  grid_json jsonb NOT NULL,
  reviewed_by_user_id uuid REFERENCES public.fkh_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_putting_surveys_hole_check CHECK (hole_number BETWEEN 1 AND 54),
  CONSTRAINT fkh_course_twin_putting_surveys_status_check
    CHECK (status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT fkh_course_twin_putting_surveys_spacing_check
    CHECK (grid_spacing_m BETWEEN 0.02 AND 1),
  CONSTRAINT fkh_course_twin_putting_surveys_accuracy_check
    CHECK (vertical_accuracy_mm > 0 AND vertical_accuracy_mm <= 100),
  CONSTRAINT fkh_course_twin_putting_surveys_grid_object_check
    CHECK (jsonb_typeof(grid_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_putting_surveys_course_hole_idx
  ON public.fkh_course_twin_putting_surveys(course_id, hole_number);
CREATE INDEX IF NOT EXISTS fkh_course_twin_putting_surveys_status_idx
  ON public.fkh_course_twin_putting_surveys(course_id, status, updated_at);

ALTER TABLE public.fkh_course_twin_putting_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_putting_surveys FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fkh_course_twin_putting_surveys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_putting_surveys FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.fkh_course_twin_putting_surveys TO service_role;

-- Survey source files and review state stay server-mediated; published manifests
-- expose only the validated grid and source attribution.
