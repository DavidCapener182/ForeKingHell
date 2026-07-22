-- Durable first-wave catalogue ingestion queue. Network enrichment is processed
-- outside the initiating web request and can resume safely after throttling.

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_catalog_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id uuid REFERENCES public.fkh_users(id) ON DELETE SET NULL,
  external_id varchar(180) NOT NULL,
  idempotency_key varchar(160) NOT NULL,
  candidate_json jsonb NOT NULL,
  force boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'queued',
  retry_count integer NOT NULL DEFAULT 0,
  course_id uuid REFERENCES public.fkh_courses(id) ON DELETE SET NULL,
  build_id uuid REFERENCES public.fkh_course_twin_builds(id) ON DELETE SET NULL,
  error_code varchar(80),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_catalog_jobs_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT fkh_course_twin_catalog_jobs_retry_check CHECK (retry_count >= 0),
  CONSTRAINT fkh_course_twin_catalog_jobs_candidate_object_check
    CHECK (jsonb_typeof(candidate_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_catalog_jobs_idempotency_idx
  ON public.fkh_course_twin_catalog_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS fkh_course_twin_catalog_jobs_status_attempt_idx
  ON public.fkh_course_twin_catalog_jobs(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_catalog_jobs_external_idx
  ON public.fkh_course_twin_catalog_jobs(external_id, created_at);

ALTER TABLE public.fkh_course_twin_catalog_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_catalog_jobs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fkh_course_twin_catalog_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_catalog_jobs FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.fkh_course_twin_catalog_jobs TO service_role;

-- Catalogue jobs are infrastructure state and remain server-mediated.
