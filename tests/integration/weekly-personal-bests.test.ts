import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getWeeklyChangeEvidence } from "@/lib/weekly-change-review-data";
vi.mock("@/lib/admin", () => ({ requireAdminUser: async () => ({}) }));
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
let sql: ReturnType<typeof postgres>;
beforeAll(() => {
  if (enabled) sql = postgres(url!, { max: 1 });
});
afterAll(async () => {
  if (enabled) {
    await closeDb();
    await sql.end();
  }
});
it.skipIf(!enabled)(
  "ignores invalid carry records without poisoning later legitimate personal bests",
  async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic weekly PB') returning id`
    )[0].id;
    try {
      const session = (
        await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'csv','range','2026-09-01','synthetic') returning id`
      )[0].id;
      const club = (
        await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'7i','weekly-pb') returning id`
      )[0].id;
      const values = [100, Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 120];
      for (let i = 0; i < values.length; i++) {
        await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,review_status,source_raw_json) values(${actor.id},${session},${club},'7i',${new Date(Date.UTC(2026, 8, 1, i))},${values[i]},'included','{}')`;
        if (i === 4)
          expect(
            (await getWeeklyChangeEvidence(actor.id, new Date("2026-09-07T00:00:00Z")))
              .personalBestCount,
          ).toBe(1);
      }
      const result = await getWeeklyChangeEvidence(actor.id, new Date("2026-09-07T00:00:00Z"));
      expect(result.personalBestCount).toBe(2);
    } finally {
      await sql`delete from fkh_users where id=${actor.id}`;
    }
  },
);
