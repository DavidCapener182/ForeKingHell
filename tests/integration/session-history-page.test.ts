import { afterAll, expect, it } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getSessionHistoryPage } from "@/lib/session-history-page";
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
  "searches all owned history before bounded paging, preserves filters and finds saved focus",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Page history owner'),('Other history owner') returning id`
        ).map((r) => r.id),
      );
      const [owner, foreign] = users;
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) select ${owner},'rapsodo','range','2026-09-01'::timestamptz,'Recent tied session ' || n,'fixture' from generate_series(1,55) n`;
      const [older] =
        await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner},'manual','range','2025-01-01','Needle old %_ literal','fixture') returning id`;
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${foreign},'manual','range','2025-01-01','Needle foreign %_ literal','fixture')`;
      const [club] =
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'7i','page-owned-7i') returning id`;
      await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,review_status,quality_tag,source_raw_json,shot_at) values(${owner},${older.id},${club.id},'7i',1,150,'included','good','{}'::jsonb,'2025-01-01'),(${owner},${older.id},${club.id},'driver',2,280,'user_excluded','good','{}'::jsonb,'2025-01-01')`;
      const first = await getSessionHistoryPage(owner, {}, false);
      const second = await getSessionHistoryPage(owner, { historyPage: "2" }, false);
      const third = await getSessionHistoryPage(owner, { historyPage: "3" }, false);
      expect([first.rows.length, second.rows.length, third.rows.length]).toEqual([24, 24, 8]);
      expect(new Set([...first.rows, ...second.rows, ...third.rows].map((r) => r.id)).size).toBe(
        56,
      );
      expect(first.total).toBe(56);
      expect(first.filterOptions.sources).toContain("Manual");
      expect(first.filterOptions.clubs).toEqual(["7i"]);
      const search = await getSessionHistoryPage(
        owner,
        { q: "Needle old %_", source: "Manual", club: "7i" },
        true,
      );
      expect(search.rows.map((r) => r.id)).toEqual([older.id]);
      expect(search.total).toBe(1);
      expect(search.rows[0].shotCount).toBe(2);
      expect(search.rows[0].clubs).toEqual(["7i"]);
      const none = await getSessionHistoryPage(
        owner,
        { q: "missing needle", source: "Manual" },
        false,
      );
      expect(none.rows).toEqual([]);
      expect(none.query).toContain("source=Manual");
      const focused = await getSessionHistoryPage(owner, { session: older.id }, false);
      expect(focused.page).toBe(3);
      expect(focused.query).toContain(older.id);
      expect(
        (
          await getSessionHistoryPage(
            owner,
            { historyPage: "999999", historyLimit: "999999" },
            false,
          )
        ).rows.length,
      ).toBe(8);
      expect(
        (await getSessionHistoryPage(foreign, { session: older.id }, false)).query,
      ).not.toContain(older.id);
    } finally {
      for (const id of users) await db`delete from fkh_users where id=${id}`;
      await db.end();
    }
  },
);
