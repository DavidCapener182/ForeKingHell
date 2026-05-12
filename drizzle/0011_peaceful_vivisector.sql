CREATE INDEX "fkh_sessions_type_date_idx" ON "fkh_sessions" USING btree ("type","date");--> statement-breakpoint
CREATE INDEX "fkh_shots_session_idx" ON "fkh_shots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "fkh_shots_club_type_idx" ON "fkh_shots" USING btree ("club_type");--> statement-breakpoint
CREATE INDEX "fkh_shots_shot_at_idx" ON "fkh_shots" USING btree ("shot_at");