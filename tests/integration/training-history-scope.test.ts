import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getTrainingOverTimeData } from "@/lib/training/trainingData";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const value = process.env.DATABASE_URL;
if (enabled) {
  const url = new URL(value!);
  if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/fkh_redesign")
    throw new Error("Disposable local database required");
}
describe.skipIf(!enabled)("custom Training Load history", () => {
  afterAll(closeDb);
  it("loads older owned history without changing current readiness", async () => {
    const db = postgres(value!, { max: 1 });
    let owner: string | undefined;
    try {
      owner = (
        await db`insert into fkh_users(name) values('Synthetic custom history') returning id`
      )[0].id;
      await db`insert into fkh_golf_training_sessions(user_id,source_type,title,session_date,rpe,session_load,duration_minutes) values(${owner!},'manual','Historic load','2024-01-01',5,90,25),(${owner!},'manual','Recent load',current_date,5,100,30)`;
      const oldScorecard = Array.from({ length: 18 }, (_, index) => ({
        hole: index + 1,
        par: 4,
        score: 6,
      }));
      const newScorecard = Array.from({ length: 18 }, (_, index) => ({
        hole: index + 1,
        par: 4,
        score: 4,
      }));
      const [oldRound] =
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,scorecard_json) values(${owner!},'manual','round','2024-01-02','synthetic',${db.json(oldScorecard)}) returning id`;
      const [newRound] =
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,scorecard_json) values(${owner!},'manual','round',current_date,'synthetic',${db.json(newScorecard)}) returning id`;
      await db`insert into fkh_golf_training_sessions(user_id,source_type,source_id,title,session_date,rpe,session_load,holes_played) values(${owner!},'round',${oldRound.id},'Historic scored round','2024-01-02',5,90,18),(${owner!},'round',${newRound.id},'Current scored round',current_date,5,100,18)`;
      const baseline = await getTrainingOverTimeData(owner!, "1y");
      const expanded = await getTrainingOverTimeData(owner!, "1y", "2024-01-01");
      expect(baseline.sessions.some((session) => session.title === "Historic load")).toBe(false);
      expect(expanded.sessions.some((session) => session.title === "Historic load")).toBe(true);
      expect(expanded.summary).toEqual(baseline.summary);
      expect(expanded.status).toEqual(baseline.status);
      expect(expanded.sessionFormSignal).toEqual(baseline.sessionFormSignal);
      expect(expanded.confidence).toEqual(baseline.confidence);
      expect(expanded.efficiencyCards).toEqual(baseline.efficiencyCards);
      expect(expanded.suggestions).toEqual(baseline.suggestions);
      expect(expanded.trend).toEqual(baseline.trend);
    } finally {
      if (owner) await db`delete from fkh_users where id=${owner}`;
      await db.end();
    }
  });
});
