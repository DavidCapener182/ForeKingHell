import { afterAll, expect, it } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getStrokesGainedHistory, type StrokesGainedFilters } from "@/lib/strokes-gained-history";
import { summarizeStrokesGained } from "@/lib/strokes-gained";
import { getOwnedStrokesGainedPracticeEvents } from "@/lib/strokes-gained-practice-data";
import { sgPracticeFingerprint } from "@/lib/strokes-gained-practice-handoff";
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
const filters: StrokesGainedFilters = {
  q: "",
  sessionId: "",
  category: "",
  hole: "",
  startLie: "",
  endLie: "",
  from: "",
  to: "",
  sg: "",
  sort: "recent",
};
it.skipIf(!enabled)(
  "reaches all owned SG events with consistent bounded totals and unchanged draft evidence",
  async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      owners.push(
        ...(
          await db`insert into fkh_users(name) values('SG history owner'),('SG foreign owner') returning id`
        ).map((r) => r.id),
      );
      const [owner, foreign] = owners;
      const rounds =
        await db`insert into fkh_sessions(user_id,source,type,date,course_name,raw_csv_text) select ${owner},'manual','round','2026-09-01'::timestamptz,'Recent course ' || n,'fixture' from generate_series(1,8) n returning id`;
      for (const round of rounds)
        await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,strokes_gained,created_at) select ${owner},${round.id},'approach','fairway','green',-0.1,'2026-09-01'::timestamptz from generate_series(1,25)`;
      const [old] =
        await db`insert into fkh_sessions(user_id,source,type,date,course_name,raw_csv_text) values(${owner},'manual','round','2020-01-01','Old %_ course','fixture') returning id`;
      await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,strokes_gained,created_at) select ${owner},${old.id},'tee','tee','fairway',case when n=1 then null else -1 end,'2020-01-01'::timestamptz from generate_series(1,5) n`;
      const [foreignRound] =
        await db`insert into fkh_sessions(user_id,source,type,date,course_name,raw_csv_text) values(${foreign},'manual','round','2020-01-01','Foreign course','fixture') returning id`;
      await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,strokes_gained) values(${foreign},${foreignRound.id},'tee','tee','fairway',999)`;
      const first = await getStrokesGainedHistory(owner, filters);
      const second = await getStrokesGainedHistory(owner, filters, 2);
      expect([first.events.length, second.events.length, first.total, first.pages]).toEqual([
        200, 5, 205, 2,
      ]);
      expect(new Set([...first.events, ...second.events].map((e) => e.id)).size).toBe(205);
      expect(summarizeStrokesGained(first.events.map((e) => e.strokesGained))).toMatchObject({
        total: -20,
        sampleSize: 200,
      });
      expect(summarizeStrokesGained(second.events.map((e) => e.strokesGained))).toMatchObject({
        total: -4,
        sampleSize: 4,
      });
      expect(first.catalog.rounds).toHaveLength(9);
      expect(first.catalog.rounds.some((r) => r.id === old.id)).toBe(true);
      expect(first.catalog.categories).toContain("tee");
      const oldScope = await getStrokesGainedHistory(owner, {
        ...filters,
        q: "%_",
        category: "tee",
      });
      expect(oldScope.total).toBe(5);
      expect(oldScope.events.every((e) => e.sessionId === old.id)).toBe(true);
      const pending = await getStrokesGainedHistory(owner, {
        ...filters,
        sessionId: old.id,
        sg: "pending",
      });
      expect(pending.events).toHaveLength(1);
      expect(pending.events[0].strokesGained).toBeNull();
      expect(
        (await getStrokesGainedHistory(owner, { ...filters, sessionId: foreignRound.id })).total,
      ).toBe(0);
      expect((await getStrokesGainedHistory(owner, filters, 999999)).page).toBe(2);
      const source = await getOwnedStrokesGainedPracticeEvents(
        owner,
        first.events.map((e) => e.id),
      );
      expect(source).toHaveLength(200);
      expect(sgPracticeFingerprint("approach", source)).toBe(
        sgPracticeFingerprint("approach", first.events),
      );
      const sortedFirst = await getStrokesGainedHistory(owner, { ...filters, sort: "losses" });
      const sortedSecond = await getStrokesGainedHistory(owner, { ...filters, sort: "losses" }, 2);
      expect(new Set([...sortedFirst.events, ...sortedSecond.events].map((e) => e.id)).size).toBe(
        205,
      );
      expect(sortedSecond.events.at(-1)?.strokesGained).toBeNull();
      expect(
        (
          await getStrokesGainedHistory(owner, {
            ...filters,
            sessionId: "invalid",
            hole: "999999999999999999999",
            from: "2026-99-99",
            to: "2026-02-30",
          })
        ).total,
      ).toBe(205);
      const [edge] =
        await db`insert into fkh_sessions(user_id,source,type,date,course_name,raw_csv_text) values(${owner},'manual','round','2026-09-01T23:59:59.999999Z','UTC edge course','fixture') returning id`;
      await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,strokes_gained) values(${owner},${edge.id},'tee','tee','fairway',0)`;
      expect(
        (
          await getStrokesGainedHistory(owner, {
            ...filters,
            q: "UTC edge",
            from: "2026-09-01",
            to: "2026-09-01",
          })
        ).total,
      ).toBe(1);
    } finally {
      for (const owner of owners) await db`delete from fkh_users where id=${owner}`;
      await db.end();
    }
  },
  30000,
);
