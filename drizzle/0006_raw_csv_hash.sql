ALTER TABLE "fkh_sessions" ADD COLUMN "raw_csv_hash" varchar(64);
CREATE UNIQUE INDEX "fkh_sessions_user_source_raw_hash_idx" ON "fkh_sessions" USING btree ("user_id","source","raw_csv_hash");
