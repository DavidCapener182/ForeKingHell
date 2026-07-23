-- Extend the private and shared tamper-evident ledgers with explicit putting events.
-- Access remains server-mediated behind forced RLS.

ALTER TABLE public.fkh_course_twin_round_events
  DROP CONSTRAINT IF EXISTS fkh_course_twin_round_events_type_check;
ALTER TABLE public.fkh_course_twin_round_events
  ADD CONSTRAINT fkh_course_twin_round_events_type_check
  CHECK (
    event_type IN (
      'shot.accepted',
      'putt.accepted',
      'shot.mulligan',
      'hole.completed',
      'round.completed',
      'round.abandoned'
    )
  );

ALTER TABLE public.fkh_course_twin_shared_round_events
  DROP CONSTRAINT IF EXISTS fkh_course_twin_shared_events_type_check;
ALTER TABLE public.fkh_course_twin_shared_round_events
  ADD CONSTRAINT fkh_course_twin_shared_events_type_check
  CHECK (
    event_type IN (
      'shot.accepted',
      'putt.accepted',
      'shot.mulligan',
      'hole.completed',
      'round.completed',
      'round.abandoned'
    )
  );

ALTER TABLE public.fkh_course_twin_round_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_round_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_shared_round_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_shared_round_events FORCE ROW LEVEL SECURITY;
