ALTER TABLE fkh_golf_training_sessions ADD COLUMN IF NOT EXISTS load_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
-- Only finished, contiguous nine/eighteen-hole cards count. Scores establish completion,
-- never workload: penalties, putts and scoring quality are not swing-volume proxies.
CREATE OR REPLACE FUNCTION fkh_real_round_hole_count(card jsonb) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  WITH items AS (
    SELECT CASE WHEN (h->>'holeNumber') ~ '^[0-9]+$' THEN (h->>'holeNumber')::numeric END AS n,
      CASE WHEN (h->>'score') ~ '^[0-9]+$' THEN (h->>'score')::numeric END AS score
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(card)='array' THEN card ELSE '[]'::jsonb END) h
  )
  SELECT CASE WHEN count(*) IN (9,18) AND count(DISTINCT n)=count(*)
    AND bool_and(score > 0) AND count(score)=count(*)
    AND ((min(n)=1 AND max(n)=count(*)) OR (count(*)=9 AND min(n)=10 AND max(n)=18))
    THEN count(*)::integer ELSE NULL END FROM items;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fkh_sync_real_round_training() RETURNS trigger
-- The source row has already passed session RLS (including delegated editors).
-- This trigger accepts no arguments and writes only that row's linked workload.
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE played integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM fkh_golf_training_sessions WHERE user_id=OLD.user_id AND source_type='round'
      AND source_id=OLD.id::text AND load_metadata_json->>'model'='round-duration-rpe-v1';
    RETURN OLD;
  END IF;
  played := CASE WHEN NEW.type='real_round' AND NEW.round_status='complete'
    THEN fkh_real_round_hole_count(NEW.scorecard_json) ELSE NULL END;
  IF played IS NULL THEN
    DELETE FROM fkh_golf_training_sessions WHERE user_id=NEW.user_id AND source_type='round'
      AND source_id=NEW.id::text AND load_metadata_json->>'model'='round-duration-rpe-v1';
    RETURN NEW;
  END IF;
  INSERT INTO fkh_golf_training_sessions AS existing
    (user_id,source_type,source_id,title,session_date,holes_played,rpe,session_load,notes,load_metadata_json)
  VALUES (NEW.user_id,'round',NEW.id::text,coalesce(nullif(NEW.course_name,''),'Golf round'),
    (NEW.date AT TIME ZONE 'Europe/London')::date,played,3,round(played * (240.0/18) * 3),
    'Automatically linked to the completed round. Add duration and overall effort to refine the estimate.',
    '{"model":"round-duration-rpe-v1","rpeEstimated":true,"movement":"unknown"}'::jsonb)
  ON CONFLICT (user_id,source_type,source_id) DO UPDATE SET
    title=excluded.title,session_date=excluded.session_date,holes_played=excluded.holes_played,
    session_load=round(coalesce(existing.duration_minutes,excluded.holes_played*(240.0/18))*existing.rpe),
    updated_at=now()
  WHERE existing.load_metadata_json->>'model'='round-duration-rpe-v1';
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS fkh_real_round_training_sync ON fkh_sessions;
CREATE TRIGGER fkh_real_round_training_sync AFTER INSERT OR UPDATE OF type,round_status,scorecard_json,date,course_name OR DELETE
ON fkh_sessions FOR EACH ROW EXECUTE FUNCTION fkh_sync_real_round_training();
--> statement-breakpoint
-- Preserve all previously logged loads, including user-entered effort. The unique source
-- key prevents a saved round or repeated migration from adding duplicate workload.
INSERT INTO fkh_golf_training_sessions
  (user_id,source_type,source_id,title,session_date,holes_played,rpe,session_load,notes,load_metadata_json)
SELECT s.user_id,'round',s.id::text,coalesce(nullif(s.course_name,''),'Golf round'),
  (s.date AT TIME ZONE 'Europe/London')::date,h.played,3,round(h.played*(240.0/18)*3),
  'Automatically linked to the completed round. Add duration and overall effort to refine the estimate.',
  '{"model":"round-duration-rpe-v1","rpeEstimated":true,"movement":"unknown"}'::jsonb
FROM fkh_sessions s CROSS JOIN LATERAL (SELECT fkh_real_round_hole_count(s.scorecard_json) AS played) h
WHERE s.type='real_round' AND s.round_status='complete' AND h.played IS NOT NULL
ON CONFLICT (user_id,source_type,source_id) DO NOTHING;
