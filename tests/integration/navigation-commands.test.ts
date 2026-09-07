import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { GET } from "@/app/api/desktop-workbench/commands/route";
const actor = vi.hoisted(() => ({ id: "", fail: false }));
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => (actor.id ? { id: actor.id } : null),
}));
vi.mock("@/lib/social", () => ({
  getFriendIds: async () => {
    if (actor.fail) throw new Error("Synthetic lookup failure");
    return [];
  },
}));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = new URL(url!);
  if (t.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable local database required");
}
afterAll(async () => {
  if (enabled) await closeDb();
});
describe.skipIf(!enabled)("navigation command account and entity identity", () => {
  it("returns exact owned entity destinations and reports lookup failures as retryable", async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic command owner'),('Synthetic foreign command owner') returning id`
        ).map((row) => row.id),
      );
      actor.id = users[0];
      const ids: string[] = [];
      for (const owner of users) {
        ids.push(
          (
            await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name) values(${owner},'manual','range',now(),'Synthetic','Navigation fixture.csv') returning id`
          )[0].id,
        );
      }
      const club = (
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${users[0]},'7i','command-owned') returning id`
      )[0];
      const foreign = (
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${users[1]},'7i','command-foreign') returning id`
      )[0];
      const response = await GET();
      expect(response.status).toBe(200);
      const { items } = await response.json();
      expect(items.some((item: { href: string }) => item.href === `/sessions/${ids[0]}`)).toBe(
        true,
      );
      expect(
        items.some((item: { href: string }) => item.href === `/bag/${club.id}/analytics`),
      ).toBe(true);
      expect(JSON.stringify(items)).not.toContain(ids[1]);
      expect(JSON.stringify(items)).not.toContain(foreign.id);
      actor.fail = true;
      const failed = await GET();
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({ items: [] });
      actor.fail = false;
      expect((await GET()).status).toBe(200);
    } finally {
      actor.id = "";
      actor.fail = false;
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  });
});
