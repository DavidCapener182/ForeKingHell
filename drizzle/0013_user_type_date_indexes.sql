CREATE INDEX IF NOT EXISTS "fkh_sessions_user_type_date_idx" ON "fkh_sessions" USING btree ("user_id","type","date");
