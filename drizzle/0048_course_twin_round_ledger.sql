-- Canonical Course Twin round state and tamper-evident event ledger.

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.fkh_courses(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.fkh_sessions(id) ON DELETE SET NULL,
  mode varchar(12) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'in_progress',
  hole_count integer NOT NULL,
  starting_hole integer NOT NULL DEFAULT 1,
  current_hole integer NOT NULL DEFAULT 1,
  version integer NOT NULL DEFAULT 1,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  scorecard_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_event_hash varchar(64),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_rounds_mode_check CHECK (mode IN ('play', 'live')),
  CONSTRAINT fkh_course_twin_rounds_status_check
    CHECK (status IN ('in_progress', 'complete', 'abandoned')),
  CONSTRAINT fkh_course_twin_rounds_hole_count_check CHECK (hole_count IN (9, 18)),
  CONSTRAINT fkh_course_twin_rounds_starting_hole_check CHECK (starting_hole BETWEEN 1 AND 18),
  CONSTRAINT fkh_course_twin_rounds_current_hole_check CHECK (current_hole BETWEEN 1 AND 18),
  CONSTRAINT fkh_course_twin_rounds_hole_window_check
    CHECK (starting_hole + hole_count - 1 <= 18),
  CONSTRAINT fkh_course_twin_rounds_version_check CHECK (version > 0),
  CONSTRAINT fkh_course_twin_rounds_rules_object_check CHECK (jsonb_typeof(rules_json) = 'object'),
  CONSTRAINT fkh_course_twin_rounds_scorecard_array_check
    CHECK (jsonb_typeof(scorecard_json) = 'array'),
  CONSTRAINT fkh_course_twin_rounds_final_hash_check
    CHECK (final_event_hash IS NULL OR final_event_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS fkh_course_twin_rounds_user_updated_idx
  ON public.fkh_course_twin_rounds(user_id, updated_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_rounds_course_status_idx
  ON public.fkh_course_twin_rounds(course_id, status, updated_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_rounds_session_idx
  ON public.fkh_course_twin_rounds(session_id);

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_round_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.fkh_course_twin_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  client_event_id uuid NOT NULL,
  sequence integer NOT NULL,
  event_type varchar(40) NOT NULL,
  payload_json jsonb NOT NULL,
  previous_hash varchar(64),
  event_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_round_events_sequence_check CHECK (sequence > 0),
  CONSTRAINT fkh_course_twin_round_events_type_check
    CHECK (event_type IN ('shot.accepted', 'shot.mulligan', 'hole.completed', 'round.completed', 'round.abandoned')),
  CONSTRAINT fkh_course_twin_round_events_payload_check CHECK (jsonb_typeof(payload_json) = 'object'),
  CONSTRAINT fkh_course_twin_round_events_previous_hash_check
    CHECK (previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fkh_course_twin_round_events_hash_check CHECK (event_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_round_events_round_client_idx
  ON public.fkh_course_twin_round_events(round_id, client_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_round_events_round_sequence_idx
  ON public.fkh_course_twin_round_events(round_id, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_round_events_round_hash_idx
  ON public.fkh_course_twin_round_events(round_id, event_hash);
CREATE INDEX IF NOT EXISTS fkh_course_twin_round_events_user_created_idx
  ON public.fkh_course_twin_round_events(user_id, created_at);

ALTER TABLE public.fkh_course_twin_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_rounds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_round_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_round_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fkh_course_twin_rounds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_round_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_rounds FROM service_role;
REVOKE ALL ON TABLE public.fkh_course_twin_round_events FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_rounds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_round_events TO service_role;

-- Browser access is intentionally server-mediated so user ownership, event
-- ordering and the hash chain are enforced in one trusted boundary.
