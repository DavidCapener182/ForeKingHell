-- Spectator capacity and a tamper-evident shared-round ledger for private rooms.

ALTER TABLE public.fkh_course_twin_rooms
  ADD COLUMN IF NOT EXISTS competition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spectator_limit integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS shared_round_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS final_event_hash varchar(64),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE public.fkh_course_twin_rooms
  DROP CONSTRAINT IF EXISTS fkh_course_twin_rooms_spectator_limit_check,
  ADD CONSTRAINT fkh_course_twin_rooms_spectator_limit_check
    CHECK (spectator_limit BETWEEN 0 AND 20),
  DROP CONSTRAINT IF EXISTS fkh_course_twin_rooms_shared_version_check,
  ADD CONSTRAINT fkh_course_twin_rooms_shared_version_check CHECK (shared_round_version > 0),
  DROP CONSTRAINT IF EXISTS fkh_course_twin_rooms_final_hash_check,
  ADD CONSTRAINT fkh_course_twin_rooms_final_hash_check
    CHECK (final_event_hash IS NULL OR final_event_hash ~ '^[0-9a-f]{64}$');

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_shared_round_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.fkh_course_twin_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  client_event_id uuid NOT NULL,
  sequence integer NOT NULL,
  event_type varchar(40) NOT NULL,
  payload_json jsonb NOT NULL,
  previous_hash varchar(64),
  event_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_shared_events_sequence_check CHECK (sequence > 0),
  CONSTRAINT fkh_course_twin_shared_events_type_check
    CHECK (event_type IN ('shot.accepted', 'shot.mulligan', 'hole.completed', 'round.completed', 'round.abandoned')),
  CONSTRAINT fkh_course_twin_shared_events_payload_check
    CHECK (jsonb_typeof(payload_json) = 'object'),
  CONSTRAINT fkh_course_twin_shared_events_previous_hash_check
    CHECK (previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fkh_course_twin_shared_events_hash_check CHECK (event_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_shared_events_room_client_idx
  ON public.fkh_course_twin_shared_round_events(room_id, client_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_shared_events_room_sequence_idx
  ON public.fkh_course_twin_shared_round_events(room_id, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_shared_events_room_hash_idx
  ON public.fkh_course_twin_shared_round_events(room_id, event_hash);
CREATE INDEX IF NOT EXISTS fkh_course_twin_shared_events_user_created_idx
  ON public.fkh_course_twin_shared_round_events(user_id, created_at);

ALTER TABLE public.fkh_course_twin_shared_round_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_shared_round_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fkh_course_twin_shared_round_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_shared_round_events FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.fkh_course_twin_shared_round_events TO service_role;

-- Room and event access remains server-mediated. The server verifies membership,
-- spectator read-only status, host-only finalisation and optimistic event ordering.
