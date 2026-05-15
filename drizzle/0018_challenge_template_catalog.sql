INSERT INTO "fkh_challenge_templates" ("slug", "name", "description", "challenge_type", "rules_json", "scoring_direction")
VALUES
  ('straightest-drive', 'Straightest Drive', 'Post the lowest offline error with a verified tee shot.', 'straightest_drive', '{"metric":"offline_error","clubTypes":["driver","wood"],"minShots":1,"tieBreakers":["carry_yards","verified_source","earliest_submission"]}'::jsonb, 'asc'),
  ('7i-consistency', '7i Consistency', 'Hit a 7 iron set and rank by the tightest carry spread.', 'iron_consistency', '{"metric":"carry_spread","clubTypes":["7i","iron"],"minShots":10,"tieBreakers":["offline_error","verified_source","earliest_submission"]}'::jsonb, 'asc'),
  ('pw-launch-window', 'PW Launch Window', 'Control pitching wedge launch and carry in a scoring window.', 'launch_window', '{"metric":"launch_window_error","clubTypes":["pw"],"minShots":12,"targetRangeYards":[90,130],"tieBreakers":["carry_error","verified_source","earliest_submission"]}'::jsonb, 'asc'),
  ('wedge-ladder', 'Wedge Ladder 50–100 yd', 'Build a verified wedge ladder through 50, 60, 70, 80, 90 and 100 yard windows.', 'wedge_ladder', '{"metric":"ladder_error","clubTypes":["pw","gw","aw","sw","lw","wedge"],"minShots":18,"targetWindows":[50,60,70,80,90,100],"tieBreakers":["window_count","verified_source","earliest_submission"]}'::jsonb, 'asc'),
  ('closest-to-pin', 'Closest to Pin', 'Rank by the lowest carry/target error for a selected approach distance.', 'closest_to_pin', '{"metric":"target_error","clubTypes":["iron","pw","gw","aw","sw","lw","wedge"],"minShots":5,"tieBreakers":["offline_error","verified_source","earliest_submission"]}'::jsonb, 'asc'),
  ('best-gapping-improvement', 'Best Gapping Improvement', 'Win by improving stock yardage confidence and reducing overlap.', 'gapping_improvement', '{"metric":"gap_confidence_delta","minSessions":2,"tieBreakers":["shot_count","verified_source","earliest_submission"]}'::jsonb, 'desc'),
  ('club-trust-improvement', 'Most Improved Club Trust', 'Track confidence gains for the club you trust least.', 'club_trust', '{"metric":"club_trust_delta","minSessions":2,"tieBreakers":["dispersion_delta","verified_source","earliest_submission"]}'::jsonb, 'desc'),
  ('best-9-hole-sim-score', 'Best 9-hole Sim Score', 'Submit your best verified nine-hole simulator score.', 'sim_score_9', '{"metric":"strokes","holes":9,"tieBreakers":["net_score","verified_scorecard","earliest_submission"]}'::jsonb, 'asc'),
  ('best-18-hole-sim-score', 'Best 18-hole Sim Score', 'Submit your best verified eighteen-hole simulator score.', 'sim_score_18', '{"metric":"strokes","holes":18,"tieBreakers":["net_score","verified_scorecard","earliest_submission"]}'::jsonb, 'asc')
ON CONFLICT ("slug") DO UPDATE
SET "name" = excluded."name",
    "description" = excluded."description",
    "challenge_type" = excluded."challenge_type",
    "rules_json" = excluded."rules_json",
    "scoring_direction" = excluded."scoring_direction",
    "active" = true,
    "updated_at" = now();
