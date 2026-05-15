UPDATE "fkh_challenge_templates"
SET "name" = 'Practice Streak',
	"description" = 'Keep verified practice sessions ticking through the month.',
	"updated_at" = now()
WHERE "slug" = 'monthly-practice-streak';
--> statement-breakpoint
INSERT INTO "fkh_plan_limits" ("plan_key", "limit_key", "limit_value_json")
VALUES
	('plus', 'max_private_challenges', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('plus', 'max_monthly_imports', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('pro', 'max_private_challenges', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('pro', 'max_friend_groups', '{"value":12}'::jsonb),
	('pro', 'device_import_square', '{"value":true}'::jsonb),
	('pro', 'device_import_trackman', '{"value":true}'::jsonb),
	('coach', 'max_private_challenges', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('coach', 'max_friend_groups', '{"value":999999,"label":"Unlimited"}'::jsonb),
	('coach', 'advanced_reports', '{"value":true}'::jsonb),
	('coach', 'friend_comparison_insights', '{"value":true}'::jsonb),
	('coach', 'challenge_analytics', '{"value":true}'::jsonb),
	('coach', 'device_import_square', '{"value":true}'::jsonb),
	('coach', 'device_import_trackman', '{"value":true}'::jsonb)
ON CONFLICT ("plan_key","limit_key") DO UPDATE
SET "limit_value_json" = excluded."limit_value_json",
	"updated_at" = now();
