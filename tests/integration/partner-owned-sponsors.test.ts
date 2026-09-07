import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getPartnersPageData } from "@/lib/partners";
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
  "keeps older owned sponsors available beyond the newest forty display records",
  async () => {
    const ids: string[] = [];
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic sponsor owner') returning id`
    )[0].id;
    try {
      const old = (
        await sql`insert into fkh_sponsors(name,slug,owner_user_id,created_at) values('Old owned sponsor',${crypto.randomUUID()},${actor.id},'2000-01-01') returning id`
      )[0].id;
      ids.push(old);
      for (let i = 0; i < 41; i++) {
        ids.push(
          (
            await sql`insert into fkh_sponsors(name,slug,created_at) values('New unrelated sponsor',${crypto.randomUUID()},now()) returning id`
          )[0].id,
        );
      }
      const data = await getPartnersPageData();
      expect(data.sponsors).toHaveLength(40);
      expect(data.sponsors.some((row) => row.id === old)).toBe(false);
      expect(data.ownedSponsors.map((row) => row.id)).toEqual([old]);
      expect(data.ownedSponsors.every((row) => row.ownerUserId === actor.id)).toBe(true);
    } finally {
      if (ids.length) await sql`delete from fkh_sponsors where id in ${sql(ids)}`;
      await sql`delete from fkh_users where id=${actor.id}`;
    }
  },
);
