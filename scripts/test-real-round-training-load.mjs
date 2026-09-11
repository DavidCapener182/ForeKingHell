import postgres from "postgres";
// Run after db:migrate. Every fixture is rolled back, including on failure.
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`DO $$
DECLARE uid uuid := gen_random_uuid(); sid uuid:=gen_random_uuid(); sim uuid:=gen_random_uuid(); legacy uuid:=gen_random_uuid(); card jsonb; n integer; amount numeric;
BEGIN
 INSERT INTO fkh_users(id) VALUES(uid);
 SELECT jsonb_agg(jsonb_build_object('holeNumber',i,'par',4,'score',5)) INTO card FROM generate_series(1,18)i;
 IF fkh_real_round_hole_count(card)<>18 OR fkh_real_round_hole_count('[{"holeNumber":1,"score":5}]') IS NOT NULL OR fkh_real_round_hole_count('{}') IS NOT NULL THEN RAISE EXCEPTION 'validation'; END IF;
 INSERT INTO fkh_sessions(id,user_id,source,type,date,round_status,scorecard_json,raw_csv_text,course_name) VALUES(sid,uid,'manual','real_round','2026-09-10T23:30:00Z','complete',card,'','Rollback test');
 SELECT count(*),max(session_load) INTO n,amount FROM fkh_golf_training_sessions WHERE source_id=sid::text AND user_id=uid;
 IF n<>1 OR amount<>360 THEN RAISE EXCEPTION 'insert'; END IF;
 IF (SELECT session_date FROM fkh_golf_training_sessions WHERE source_id=sid::text)<>'2026-09-11'::date THEN RAISE EXCEPTION 'London date'; END IF;
 UPDATE fkh_golf_training_sessions SET duration_minutes=213,rpe=7,walked=true,used_cart=false,session_load=746,load_metadata_json=load_metadata_json||'{"rpeEstimated":false,"movement":"trolley"}' WHERE source_id=sid::text;
 UPDATE fkh_sessions SET scorecard_json=jsonb_set(card,'{0,score}','12') WHERE id=sid;
 IF (SELECT session_load FROM fkh_golf_training_sessions WHERE source_id=sid::text)<>746 THEN RAISE EXCEPTION 'score changed physical load'; END IF;
 UPDATE fkh_sessions SET course_name='Renamed' WHERE id=sid;
 IF (SELECT count(*) FROM fkh_golf_training_sessions WHERE source_id=sid::text)<>1 THEN RAISE EXCEPTION 'duplicate'; END IF;
 IF (SELECT load_metadata_json->>'movement' FROM fkh_golf_training_sessions WHERE source_id=sid::text)<>'trolley' THEN RAISE EXCEPTION 'lost effort'; END IF;
 INSERT INTO fkh_sessions(id,user_id,source,type,date,round_status,scorecard_json,raw_csv_text) VALUES(sim,uid,'manual','sim_round',now(),'complete',card,'');
 IF EXISTS(SELECT 1 FROM fkh_golf_training_sessions WHERE source_id=sim::text) THEN RAISE EXCEPTION 'sim counted'; END IF;
 INSERT INTO fkh_golf_training_sessions(user_id,source_type,source_id,title,session_date,rpe,session_load) VALUES(uid,'round',legacy::text,'User log',current_date,8,888);
 INSERT INTO fkh_sessions(id,user_id,source,type,date,round_status,scorecard_json,raw_csv_text) VALUES(legacy,uid,'manual','real_round',now(),'complete',card,'');
 IF (SELECT session_load FROM fkh_golf_training_sessions WHERE source_id=legacy::text)<>888 THEN RAISE EXCEPTION 'legacy overwritten'; END IF;
 UPDATE fkh_sessions SET round_status='in_progress' WHERE id=sid;
 IF EXISTS(SELECT 1 FROM fkh_golf_training_sessions WHERE source_id=sid::text) THEN RAISE EXCEPTION 'incomplete load retained'; END IF;
 UPDATE fkh_sessions SET round_status='complete' WHERE id=sid;
 DELETE FROM fkh_sessions WHERE id=sid;
 IF EXISTS(SELECT 1 FROM fkh_golf_training_sessions WHERE source_id=sid::text) THEN RAISE EXCEPTION 'orphaned load'; END IF;
END $$;`);
      const [fixture] = await tx`select gen_random_uuid() as uid, gen_random_uuid() as sid`;
      await tx`insert into fkh_users(id) values(${fixture.uid})`;
      await tx`insert into fkh_sessions(id,user_id,source,type,date,round_status,scorecard_json,raw_csv_text) values(${fixture.sid},${fixture.uid},'manual','real_round',now(),'complete',(select jsonb_agg(jsonb_build_object('holeNumber',i,'par',4,'score',5)) from generate_series(1,18)i),'')`;
      // Grant a non-owner editor access to this disposable source row only. The
      // training table retains its real owner-only RLS. All grants roll back.
      await tx.unsafe(`GRANT USAGE ON SCHEMA public TO authenticated;
        GRANT SELECT, UPDATE ON fkh_sessions TO authenticated;
        CREATE POLICY fkh_round_sync_editor_test ON fkh_sessions FOR ALL TO authenticated USING (id='${fixture.sid}'::uuid) WITH CHECK (id='${fixture.sid}'::uuid);
        SET LOCAL ROLE authenticated;`);
      const changed =
        await tx`update fkh_sessions set course_name='Editor update' where id=${fixture.sid} returning id`;
      if (changed.length !== 1) throw new Error("Editor source update failed");
      await tx.unsafe("RESET ROLE");
      const [linked] =
        await tx`select title from fkh_golf_training_sessions where source_id=${fixture.sid}`;
      if (linked?.title !== "Editor update") throw new Error("Editor load sync failed");
      throw new Error("ROLLBACK_PASSED");
    });
  } catch (error) {
    if (error.message !== "ROLLBACK_PASSED") throw error;
    console.log("Real-round training integration checks passed; fixtures rolled back.");
  }
} finally {
  await sql.end();
}
