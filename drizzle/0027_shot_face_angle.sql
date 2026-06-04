ALTER TABLE "fkh_shots" ADD COLUMN IF NOT EXISTS "face_angle_deg" double precision;

UPDATE "fkh_shots"
SET "face_angle_deg" = (("launch_direction_deg" - ("club_path_deg" * 0.2)) / 0.8)
WHERE "face_angle_deg" IS NULL
  AND "launch_direction_deg" IS NOT NULL
  AND "club_path_deg" IS NOT NULL;
