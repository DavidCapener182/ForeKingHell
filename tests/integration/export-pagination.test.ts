import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { GET } from "@/app/api/settings/export/route";
vi.mock("@/lib/admin", () => ({ requireAdminUser: async () => ({}) }));
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getOptionalCurrentUserId: async () => actor.id,
}));
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
  "exports both shot pages without foreign rows or duplicate continuation",
  async () => {
    const owners = (
      await sql`insert into fkh_users(name) values('Synthetic export owner'),('Synthetic export foreign') returning id`
    ).map((row) => row.id);
    actor.id = owners[0];
    try {
      for (const owner of owners) {
        const session = (
          await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${owner},'csv','range',now(),'synthetic') returning id`
        )[0].id;
        const club = (
          await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'7i','export-test') returning id`
        )[0].id;
        await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,review_status,source_raw_json) select ${owner}::uuid,${session}::uuid,${club}::uuid,'7i',now(),100,'included','{}'::jsonb from generate_series(1,${owner === actor.id ? 5001 : 1})`;
      }
      const first = await (await GET(new Request("http://localhost/api/settings/export"))).json();
      expect(first.data.shots).toHaveLength(5000);
      expect(first.pagination.shots.hasMore).toBe(true);
      const second = await (
        await GET(new Request(new URL(first.pagination.shots.nextPath, "http://localhost")))
      ).json();
      expect(second.data.shots).toHaveLength(1);
      expect(second.pagination.shots.hasMore).toBe(false);
      const all: Array<{ id: string; userId: string }> = [
        ...first.data.shots,
        ...second.data.shots,
      ];
      expect(new Set(all.map((row) => row.id)).size).toBe(5001);
      expect(all.every((row) => row.userId === actor.id)).toBe(true);
    } finally {
      await sql`delete from fkh_users where id in ${sql(owners)}`;
    }
  },
);
