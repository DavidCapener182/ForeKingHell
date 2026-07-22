-- Course Twin package metadata, build ledger and manual QA corrections.

CREATE TABLE IF NOT EXISTS public.fkh_course_twins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.fkh_courses(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL DEFAULT 'draft',
  active_version_id uuid,
  quality_grade varchar(4) NOT NULL DEFAULT 'D',
  supported_modes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twins_status_check
    CHECK (status IN ('draft', 'building', 'ready', 'published', 'failed', 'retired')),
  CONSTRAINT fkh_course_twins_grade_check CHECK (quality_grade IN ('A', 'B', 'C', 'D')),
  CONSTRAINT fkh_course_twins_modes_array_check CHECK (jsonb_typeof(supported_modes_json) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twins_course_idx
  ON public.fkh_course_twins(course_id);
CREATE INDEX IF NOT EXISTS fkh_course_twins_status_idx
  ON public.fkh_course_twins(status, updated_at);
CREATE INDEX IF NOT EXISTS fkh_course_twins_active_version_idx
  ON public.fkh_course_twins(active_version_id);

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_twin_id uuid NOT NULL REFERENCES public.fkh_course_twins(id) ON DELETE CASCADE,
  requested_by_user_id uuid REFERENCES public.fkh_users(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'queued',
  idempotency_key varchar(160) NOT NULL,
  input_fingerprint varchar(64) NOT NULL,
  execution_reference varchar(260),
  retry_count integer NOT NULL DEFAULT 0,
  progress_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code varchar(80),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_builds_status_check
    CHECK (status IN ('queued', 'dispatching', 'running', 'validating', 'ready', 'failed', 'cancelled')),
  CONSTRAINT fkh_course_twin_builds_retry_check CHECK (retry_count >= 0),
  CONSTRAINT fkh_course_twin_builds_progress_object_check CHECK (jsonb_typeof(progress_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_builds_idempotency_idx
  ON public.fkh_course_twin_builds(idempotency_key);
CREATE INDEX IF NOT EXISTS fkh_course_twin_builds_twin_status_idx
  ON public.fkh_course_twin_builds(course_twin_id, status, created_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_builds_requester_idx
  ON public.fkh_course_twin_builds(requested_by_user_id, created_at);

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_twin_id uuid NOT NULL REFERENCES public.fkh_course_twins(id) ON DELETE CASCADE,
  build_id uuid REFERENCES public.fkh_course_twin_builds(id) ON DELETE SET NULL,
  package_version integer NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  minimum_runtime_version varchar(32) NOT NULL DEFAULT '1.0.0',
  status varchar(24) NOT NULL DEFAULT 'staged',
  manifest_path text NOT NULL,
  manifest_sha256 varchar(64) NOT NULL,
  input_fingerprint varchar(64) NOT NULL,
  quality_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  attribution_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_versions_number_check CHECK (package_version > 0),
  CONSTRAINT fkh_course_twin_versions_schema_check CHECK (schema_version > 0),
  CONSTRAINT fkh_course_twin_versions_status_check
    CHECK (status IN ('staged', 'validated', 'published', 'superseded', 'rejected')),
  CONSTRAINT fkh_course_twin_versions_quality_object_check CHECK (jsonb_typeof(quality_json) = 'object'),
  CONSTRAINT fkh_course_twin_versions_attribution_array_check CHECK (jsonb_typeof(attribution_json) = 'array'),
  CONSTRAINT fkh_course_twin_versions_metrics_object_check CHECK (jsonb_typeof(metrics_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_versions_number_idx
  ON public.fkh_course_twin_versions(course_twin_id, package_version);
CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_versions_id_twin_idx
  ON public.fkh_course_twin_versions(id, course_twin_id);
CREATE INDEX IF NOT EXISTS fkh_course_twin_versions_status_idx
  ON public.fkh_course_twin_versions(course_twin_id, status);
CREATE INDEX IF NOT EXISTS fkh_course_twin_versions_build_idx
  ON public.fkh_course_twin_versions(build_id);

DO $$ BEGIN
  ALTER TABLE public.fkh_course_twins
    ADD CONSTRAINT fkh_course_twins_active_version_fk
    FOREIGN KEY (active_version_id, id)
    REFERENCES public.fkh_course_twin_versions(id, course_twin_id)
    ON DELETE SET NULL (active_version_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_twin_id uuid NOT NULL REFERENCES public.fkh_course_twins(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE RESTRICT,
  correction_type varchar(40) NOT NULL,
  target_reference varchar(160) NOT NULL,
  reason text NOT NULL,
  correction_json jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_corrections_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  CONSTRAINT fkh_course_twin_corrections_payload_object_check CHECK (jsonb_typeof(correction_json) = 'object'),
  CONSTRAINT fkh_course_twin_corrections_reason_check CHECK (char_length(reason) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS fkh_course_twin_corrections_twin_status_idx
  ON public.fkh_course_twin_corrections(course_twin_id, status, created_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_corrections_creator_idx
  ON public.fkh_course_twin_corrections(created_by_user_id, created_at);

ALTER TABLE public.fkh_course_twins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_builds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_corrections FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fkh_course_twins_select_course_access
  ON public.fkh_course_twins;
CREATE POLICY fkh_course_twins_select_course_access
  ON public.fkh_course_twins FOR SELECT TO authenticated
  USING (
    (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM public.fkh_courses course
        WHERE course.id = course_id AND public.fkh_can_read_course(course)
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.fkh_admin_users admin_user
      WHERE admin_user.user_id = (SELECT auth.uid()) AND admin_user.status = 'active'
    )
  );

DROP POLICY IF EXISTS fkh_course_twin_versions_select_published
  ON public.fkh_course_twin_versions;
CREATE POLICY fkh_course_twin_versions_select_published
  ON public.fkh_course_twin_versions FOR SELECT TO authenticated
  USING (
    (
      status = 'published'
      AND EXISTS (
        SELECT 1
        FROM public.fkh_course_twins twin
        JOIN public.fkh_courses course ON course.id = twin.course_id
        WHERE twin.id = course_twin_id
          AND twin.status = 'published'
          AND twin.active_version_id = fkh_course_twin_versions.id
          AND public.fkh_can_read_course(course)
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.fkh_admin_users admin_user
      WHERE admin_user.user_id = (SELECT auth.uid()) AND admin_user.status = 'active'
    )
  );

DROP POLICY IF EXISTS fkh_course_twin_builds_select_admin
  ON public.fkh_course_twin_builds;
CREATE POLICY fkh_course_twin_builds_select_admin
  ON public.fkh_course_twin_builds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fkh_admin_users admin_user
      WHERE admin_user.user_id = (SELECT auth.uid()) AND admin_user.status = 'active'
    )
  );

DROP POLICY IF EXISTS fkh_course_twin_corrections_select_admin
  ON public.fkh_course_twin_corrections;
CREATE POLICY fkh_course_twin_corrections_select_admin
  ON public.fkh_course_twin_corrections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fkh_admin_users admin_user
      WHERE admin_user.user_id = (SELECT auth.uid()) AND admin_user.status = 'active'
    )
  );

REVOKE ALL ON TABLE public.fkh_course_twins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_builds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fkh_course_twins TO authenticated;
GRANT SELECT ON TABLE public.fkh_course_twin_versions TO authenticated;
GRANT SELECT ON TABLE public.fkh_course_twin_builds TO authenticated;
GRANT SELECT ON TABLE public.fkh_course_twin_corrections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_builds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_corrections TO service_role;

-- Course-package builders and administrative mutation endpoints use the server-side
-- service role. Authenticated browser sessions intentionally receive SELECT only.
