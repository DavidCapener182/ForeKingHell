CREATE OR REPLACE FUNCTION fkh_sync_real_round_training() RETURNS trigger
-- The source row has already passed session RLS (including delegated editors).
-- This trigger accepts no arguments and writes only that row's linked workload.
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE played integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM fkh_golf_training_sessions WHERE user_id=OLD.user_id AND source_type='round'
      AND source_id=OLD.id::text AND load_metadata_json->>'model' IN ('round-duration-rpe-v1','round-duration-rpe-v2');
    RETURN OLD;
  END IF;
  played := CASE WHEN NEW.type='real_round' AND NEW.round_status='complete'
    THEN fkh_real_round_hole_count(NEW.scorecard_json) ELSE NULL END;
  IF played IS NULL THEN
    DELETE FROM fkh_golf_training_sessions WHERE user_id=NEW.user_id AND source_type='round'
      AND source_id=NEW.id::text AND load_metadata_json->>'model' IN ('round-duration-rpe-v1','round-duration-rpe-v2');
    RETURN NEW;
  END IF;
  INSERT INTO fkh_golf_training_sessions AS existing
    (user_id,source_type,source_id,title,session_date,holes_played,rpe,session_load,notes,load_metadata_json)
  VALUES (NEW.user_id,'round',NEW.id::text,coalesce(nullif(NEW.course_name,''),'Golf round'),
    (NEW.date AT TIME ZONE 'Europe/London')::date,played,3,round(played * (240.0/18) * 3 * 0.5),
    'Automatically linked to the completed round. Add duration and overall effort to refine the estimate.',
    '{"model":"round-duration-rpe-v2","rpeEstimated":true,"movement":"unknown"}'::jsonb)
  ON CONFLICT (user_id,source_type,source_id) DO UPDATE SET
    title=excluded.title,session_date=excluded.session_date,holes_played=excluded.holes_played,
    session_load=round(coalesce(existing.duration_minutes,excluded.holes_played*(240.0/18))*existing.rpe*0.5),
    load_metadata_json=existing.load_metadata_json||'{"model":"round-duration-rpe-v2"}'::jsonb, updated_at=now()
  WHERE existing.load_metadata_json->>'model' IN ('round-duration-rpe-v1','round-duration-rpe-v2');
  RETURN NEW;
END;
$$;

--> statement-breakpoint
-- Recalculate from original inputs, never multiply an already weighted load.
-- Preserve recorded duration, effort, walking context and legacy manual entries.
UPDATE fkh_golf_training_sessions
SET session_load=round(coalesce(duration_minutes,holes_played*(240.0/18))*rpe*0.5),
 load_metadata_json=load_metadata_json||'{"model":"round-duration-rpe-v2"}'::jsonb,updated_at=now()
WHERE source_type='round' AND load_metadata_json->>'model' IN ('round-duration-rpe-v1','round-duration-rpe-v2');
