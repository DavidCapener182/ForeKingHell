WITH newly_classified AS (
  UPDATE public.fkh_shots AS shot
  SET
    review_status = 'warm_up',
    review_reason = 'Legacy quality flag classified during review lifecycle migration.',
    review_confidence = 1,
    review_source = 'migration',
    reviewed_at = now()
  WHERE lower(coalesce(shot.quality_tag, '')) = 'warm_up'
    AND shot.review_status = 'included'
    AND shot.review_reason IS NULL
    AND shot.review_confidence IS NULL
    AND shot.review_source IS NULL
    AND shot.review_previous_quality_tag IS NULL
    AND shot.reviewed_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.fkh_shot_review_events AS existing_event
      WHERE existing_event.shot_id = shot.id
        AND existing_event.source = 'migration'
        AND existing_event.status = 'warm_up'
    )
  RETURNING
    shot.user_id,
    shot.id AS shot_id,
    shot.quality_tag,
    shot.reviewed_at
)
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
  shot_id,
  'included',
  'warm_up',
  'Legacy quality flag classified during review lifecycle migration.',
  1,
  'migration',
  NULL,
  quality_tag,
  reviewed_at
FROM newly_classified;

DROP POLICY IF EXISTS fkh_shot_review_events_owner_insert
  ON public.fkh_shot_review_events;

REVOKE INSERT ON TABLE public.fkh_shot_review_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fkh_shot_review_events TO authenticated;
