-- Opt-in public matchmaking. Invite-only remains the default.

ALTER TABLE public.fkh_course_twin_rooms
  ADD COLUMN IF NOT EXISTS visibility varchar(16) NOT NULL DEFAULT 'private';

ALTER TABLE public.fkh_course_twin_rooms
  DROP CONSTRAINT IF EXISTS fkh_course_twin_rooms_visibility_check,
  ADD CONSTRAINT fkh_course_twin_rooms_visibility_check
    CHECK (visibility IN ('private', 'public'));

CREATE INDEX IF NOT EXISTS fkh_course_twin_rooms_matchmaking_idx
  ON public.fkh_course_twin_rooms(course_id, visibility, status, updated_at);

-- Existing forced RLS and server-only grants continue to protect discovery and joins.
