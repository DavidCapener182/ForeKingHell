import { afterAll, expect, it } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getRecentSessionHistory } from "@/lib/session-history";

const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = new URL(url!);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}
afterAll(async () => {
  if (enabled) await closeDb();
});
it.skipIf(!enabled)(
  "history limits distinct owner sessions and uses the latest linked practice result",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic history owner'),('Synthetic private owner') returning id`
        ).map((r) => r.id),
      );
      const ids: string[] = [];
      for (const [index, owner] of [users[0], users[0], users[1]].entries()) {
        const [session] =
          await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name) values(${owner},'manual','range',${new Date(Date.UTC(2026, 8, 7 - index))},'Synthetic',${"history-" + index + ".csv"}) returning id`;
        ids.push(session.id);
      }
      const [club] =
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${users[0]},'7i','history-iron') returning id`;
      for (let n = 0; n < 3; n++)
        await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,source_raw_json) values(${users[0]},${ids[0]},${club.id},'7i',now(),140,'{}')`;
      for (const [score, day] of [
        [25, 1],
        [80, 2],
      ])
        await db`insert into fkh_practice_plans(user_id,source_session_id,session_type,time_minutes,energy_level,intent,title,generated_summary,practice_score,updated_at) values(${users[0]},${ids[0]},'range',10,'normal','confidence','Synthetic linked practice','Synthetic',${score},${new Date(Date.UTC(2026, 8, day))})`;
      const rows = await getRecentSessionHistory(users[0], 2, { includeShotPatterns: false });
      expect(rows.map((r) => r.id)).toEqual(ids.slice(0, 2));
      expect(rows[0]).toMatchObject({
        shotCount: 3,
        planLinked: true,
        verdict: "Practice usefulness 80/100",
        points: [],
      });
      expect(rows[1]).toMatchObject({ shotCount: 0, planLinked: false });
      expect((await getRecentSessionHistory(users[0], 1))[0].id).toBe(ids[0]);
      expect((await getRecentSessionHistory(users[1], 2)).map((r) => r.id)).toEqual([ids[2]]);
    } finally {
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
