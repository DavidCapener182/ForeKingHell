-- Private Course Twin rooms, presence and append-only session events.

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.fkh_courses(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  invite_code varchar(12) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'lobby',
  mode varchar(20) NOT NULL DEFAULT 'explore',
  max_players integer NOT NULL DEFAULT 4,
  hole_number integer NOT NULL DEFAULT 1,
  state_version integer NOT NULL DEFAULT 1,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_rooms_status_check
    CHECK (status IN ('lobby', 'playing', 'finished', 'closed')),
  CONSTRAINT fkh_course_twin_rooms_mode_check
    CHECK (mode IN ('explore', 'play', 'live', 'replay')),
  CONSTRAINT fkh_course_twin_rooms_players_check CHECK (max_players BETWEEN 2 AND 4),
  CONSTRAINT fkh_course_twin_rooms_hole_check CHECK (hole_number BETWEEN 1 AND 18),
  CONSTRAINT fkh_course_twin_rooms_version_check CHECK (state_version > 0),
  CONSTRAINT fkh_course_twin_rooms_state_object_check CHECK (jsonb_typeof(state_json) = 'object'),
  CONSTRAINT fkh_course_twin_rooms_invite_check CHECK (invite_code ~ '^[A-Z2-9]{6,12}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_rooms_invite_idx
  ON public.fkh_course_twin_rooms(invite_code);
CREATE INDEX IF NOT EXISTS fkh_course_twin_rooms_course_status_idx
  ON public.fkh_course_twin_rooms(course_id, status, updated_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_rooms_host_idx
  ON public.fkh_course_twin_rooms(host_user_id, updated_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_rooms_expiry_idx
  ON public.fkh_course_twin_rooms(expires_at);

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.fkh_course_twin_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.fkh_users(id) ON DELETE CASCADE,
  display_name varchar(160) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'player',
  transport varchar(12) NOT NULL DEFAULT 'walk',
  position_json jsonb,
  hole_number integer NOT NULL DEFAULT 1,
  is_ready boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  CONSTRAINT fkh_course_twin_room_members_role_check
    CHECK (role IN ('host', 'player', 'spectator')),
  CONSTRAINT fkh_course_twin_room_members_transport_check CHECK (transport IN ('walk', 'cart')),
  CONSTRAINT fkh_course_twin_room_members_hole_check CHECK (hole_number BETWEEN 1 AND 18),
  CONSTRAINT fkh_course_twin_room_members_position_check
    CHECK (
      position_json IS NULL
      OR (jsonb_typeof(position_json) = 'array' AND jsonb_array_length(position_json) = 3)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS fkh_course_twin_room_members_room_user_idx
  ON public.fkh_course_twin_room_members(room_id, user_id);
CREATE INDEX IF NOT EXISTS fkh_course_twin_room_members_room_presence_idx
  ON public.fkh_course_twin_room_members(room_id, left_at, last_seen_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_room_members_user_idx
  ON public.fkh_course_twin_room_members(user_id, last_seen_at);

CREATE TABLE IF NOT EXISTS public.fkh_course_twin_room_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.fkh_course_twin_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.fkh_users(id) ON DELETE SET NULL,
  event_type varchar(40) NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fkh_course_twin_room_events_type_check
    CHECK (event_type ~ '^[a-z][a-z0-9_.-]{1,39}$'),
  CONSTRAINT fkh_course_twin_room_events_payload_check CHECK (jsonb_typeof(payload_json) = 'object')
);

CREATE INDEX IF NOT EXISTS fkh_course_twin_room_events_room_created_idx
  ON public.fkh_course_twin_room_events(room_id, created_at);
CREATE INDEX IF NOT EXISTS fkh_course_twin_room_events_user_created_idx
  ON public.fkh_course_twin_room_events(user_id, created_at);

ALTER TABLE public.fkh_course_twin_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_rooms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_room_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fkh_course_twin_room_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fkh_course_twin_rooms FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_room_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fkh_course_twin_room_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_rooms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_room_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fkh_course_twin_room_events TO service_role;

-- Browser clients never receive table grants. Authenticated room access is
-- checked by the server routes before the service-role database connection runs.
