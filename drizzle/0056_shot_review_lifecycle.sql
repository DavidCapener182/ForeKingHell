ALTER TABLE public.fkh_shots
  ADD COLUMN IF NOT EXISTS review_status varchar(32) NOT NULL DEFAULT 'included',
  ADD COLUMN IF NOT EXISTS review_reason varchar(500),
  ADD COLUMN IF NOT EXISTS review_confidence double precision,
  ADD COLUMN IF NOT EXISTS review_source varchar(24),
  ADD COLUMN IF NOT EXISTS review_previous_quality_tag varchar(40),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.fkh_shots'::regclass
      AND conname = 'fkh_shots_review_status_check'
  ) THEN
    ALTER TABLE public.fkh_shots
      ADD CONSTRAINT fkh_shots_review_status_check
      CHECK (review_status IN (
        'included',
        'suggested_exclusion',
        'user_excluded',
        'restored',
        'calibration',
        'warm_up',
        'launch_monitor_error'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.fkh_shots'::regclass
      AND conname = 'fkh_shots_review_confidence_check'
  ) THEN
    ALTER TABLE public.fkh_shots
      ADD CONSTRAINT fkh_shots_review_confidence_check
      CHECK (review_confidence IS NULL OR review_confidence BETWEEN 0 AND 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.fkh_shots'::regclass
      AND conname = 'fkh_shots_review_source_check'
  ) THEN
    ALTER TABLE public.fkh_shots
      ADD CONSTRAINT fkh_shots_review_source_check
      CHECK (review_source IS NULL OR review_source IN ('user', 'system', 'import', 'migration'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS fkh_shots_user_review_status_idx
  ON public.fkh_shots (user_id, review_status, shot_at);

CREATE TABLE IF NOT EXISTS public.fkh_shot_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  shot_id uuid NOT NULL REFERENCES public.fkh_shots(id) ON DELETE CASCADE,
  previous_status varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  reason varchar(500) NOT NULL,
  confidence double precision NOT NULL,
  source varchar(24) NOT NULL DEFAULT 'user',
  previous_quality_tag varchar(40),
  resulting_quality_tag varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_shot_review_events_previous_status_check
    CHECK (previous_status IN (
      'included',
      'suggested_exclusion',
      'user_excluded',
      'restored',
      'calibration',
      'warm_up',
      'launch_monitor_error'
    )),
  CONSTRAINT fkh_shot_review_events_status_check
    CHECK (status IN (
      'included',
      'suggested_exclusion',
      'user_excluded',
      'restored',
      'calibration',
      'warm_up',
      'launch_monitor_error'
    )),
  CONSTRAINT fkh_shot_review_events_confidence_check
    CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT fkh_shot_review_events_source_check
    CHECK (source IN ('user', 'system', 'import', 'migration'))
);

CREATE INDEX IF NOT EXISTS fkh_shot_review_events_user_created_idx
  ON public.fkh_shot_review_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS fkh_shot_review_events_shot_created_idx
  ON public.fkh_shot_review_events (shot_id, created_at);

UPDATE public.fkh_shots
SET
  review_status = CASE
    WHEN lower(coalesce(quality_tag, '')) LIKE 'exclude%'
      OR lower(coalesce(quality_tag, '')) IN ('delete', 'deleted')
      THEN 'user_excluded'
    WHEN lower(coalesce(quality_tag, '')) = 'calibration'
      THEN 'calibration'
    WHEN lower(coalesce(quality_tag, '')) IN ('warm-up', 'warmup', 'warm_up')
      THEN 'warm_up'
    WHEN lower(coalesce(quality_tag, '')) IN (
      'bad-data',
      'bad_data',
      'invalid',
      'launch-monitor-error',
      'misread'
    )
      THEN 'launch_monitor_error'
    WHEN lower(coalesce(quality_tag, '')) IN ('fat', 'mishit', 'thin', 'top')
      THEN 'suggested_exclusion'
    ELSE review_status
  END,
  review_reason = 'Legacy quality flag classified during review lifecycle migration.',
  review_confidence = 1,
  review_source = 'migration',
  reviewed_at = now()
WHERE review_status = 'included'
  AND review_reason IS NULL
  AND review_confidence IS NULL
  AND review_source IS NULL
  AND review_previous_quality_tag IS NULL
  AND reviewed_at IS NULL
  AND (
    lower(coalesce(quality_tag, '')) LIKE 'exclude%'
    OR lower(coalesce(quality_tag, '')) IN (
      'delete',
      'deleted',
      'calibration',
      'warm-up',
      'warmup',
      'warm_up',
      'bad-data',
      'bad_data',
      'invalid',
      'launch-monitor-error',
      'misread',
      'fat',
      'mishit',
      'thin',
      'top'
    )
  );

INSERT INTO public.fkh_shot_review_events (
  user_id,
  shot_id,
  previous_status,
  status,
  reason,
  confidence,
  source,
  previous_quality_tag,
  resulting_quality_tag,
  created_at
)
SELECT
  user_id,
  id,
  'included',
  review_status,
  review_reason,
  review_confidence,
  review_source,
  NULL,
  quality_tag,
  reviewed_at
FROM public.fkh_shots AS shot
WHERE shot.review_source = 'migration'
  AND NOT EXISTS (
    SELECT 1
    FROM public.fkh_shot_review_events AS existing_event
    WHERE existing_event.shot_id = shot.id
      AND existing_event.source = 'migration'
      AND existing_event.status = shot.review_status
  );

ALTER TABLE public.fkh_shot_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_shot_review_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fkh_shot_review_events_owner_select
  ON public.fkh_shot_review_events;
CREATE POLICY fkh_shot_review_events_owner_select
  ON public.fkh_shot_review_events
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS fkh_shot_review_events_owner_insert
  ON public.fkh_shot_review_events;

REVOKE ALL ON TABLE public.fkh_shot_review_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fkh_shot_review_events TO authenticated;

COMMENT ON TABLE public.fkh_shot_review_events IS
  'Append-only, owner-scoped audit history for reversible shot review decisions.';
COMMENT ON COLUMN public.fkh_shots.review_previous_quality_tag IS
  'Quality tag retained before an exclusion-class review so restore can recover it exactly.';

-- Shot lifecycle and source provenance are server-maintained. Browser/Data API
-- clients retain owner/editor-scoped reads, while all shot writes run through
-- authenticated server actions using the trusted DATABASE_URL connection.
DROP POLICY IF EXISTS fkh_shots_select_accessible ON public.fkh_shots;
CREATE POLICY fkh_shots_select_accessible
  ON public.fkh_shots
  FOR SELECT TO authenticated
  USING (public.fkh_can_access_user(user_id, ARRAY['coach', 'viewer', 'editor']));

DROP POLICY IF EXISTS fkh_shots_insert_owner ON public.fkh_shots;
DROP POLICY IF EXISTS fkh_shots_update_owner_or_editor ON public.fkh_shots;
DROP POLICY IF EXISTS fkh_shots_delete_owner ON public.fkh_shots;

REVOKE ALL PRIVILEGES ON TABLE public.fkh_shots
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fkh_shots TO authenticated;

-- A direct session delete would otherwise cascade through shots and erase the
-- corresponding append-only review events. Intended account deletion and golf
-- data reset continue through the trusted server database connection.
DROP POLICY IF EXISTS fkh_sessions_delete_owner ON public.fkh_sessions;
REVOKE DELETE, TRUNCATE ON TABLE public.fkh_sessions
  FROM PUBLIC, anon, authenticated;
