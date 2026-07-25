UPDATE "fkh_sponsors"
SET "name" = 'LM World Tour Partners',
    "updated_at" = now()
WHERE "slug" = 'forekinghell-partners'
  AND "name" = 'ForeKingHell Partners';
--> statement-breakpoint
UPDATE "fkh_courses"
SET "name" = 'LM World Tour Links',
    "updated_at" = now()
WHERE "name" = 'ForeKingHell Tour Links';
--> statement-breakpoint
UPDATE "fkh_sessions"
SET "location" = CASE
      WHEN "location" = 'ForeKingHell Tour Links' THEN 'LM World Tour Links'
      ELSE "location"
    END,
    "course_name" = CASE
      WHEN "course_name" = 'ForeKingHell Tour Links' THEN 'LM World Tour Links'
      ELSE "course_name"
    END
WHERE "location" = 'ForeKingHell Tour Links'
   OR "course_name" = 'ForeKingHell Tour Links';
--> statement-breakpoint
UPDATE "fkh_groups"
SET "name" = CASE
      WHEN "name" = 'ForeKingHell Tour Players' THEN 'LM World Tour Players'
      ELSE replace("name", 'ForeKingHell', 'LM World Tour')
    END,
    "description" = CASE
      WHEN "description" IS NULL THEN NULL
      ELSE replace("description", 'ForeKingHell', 'LM World Tour')
    END,
    "invite_code" = CASE
      WHEN "invite_code" = 'FKH-TOUR'
        AND NOT EXISTS (
          SELECT 1
          FROM "fkh_groups" existing
          WHERE existing."invite_code" = 'LMWT-TOUR'
        )
        THEN 'LMWT-TOUR'
      ELSE "invite_code"
    END,
    "updated_at" = now()
WHERE "name" LIKE '%ForeKingHell%'
   OR "description" LIKE '%ForeKingHell%'
   OR "invite_code" = 'FKH-TOUR';
--> statement-breakpoint
UPDATE "fkh_feed_items"
SET "headline" = replace("headline", 'ForeKingHell', 'LM World Tour'),
    "metric_label" = CASE
      WHEN "metric_label" IS NULL THEN NULL
      ELSE replace("metric_label", 'ForeKingHell', 'LM World Tour')
    END,
    "context" = CASE
      WHEN "context" IS NULL THEN NULL
      ELSE replace("context", 'ForeKingHell', 'LM World Tour')
    END,
    "updated_at" = now()
WHERE "headline" LIKE '%ForeKingHell%'
   OR "metric_label" LIKE '%ForeKingHell%'
   OR "context" LIKE '%ForeKingHell%';
