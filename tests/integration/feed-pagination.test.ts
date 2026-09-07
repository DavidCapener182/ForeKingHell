import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { ensureSocialProfileForUser, getVisibleFeedPageForViewer } from "@/lib/social";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = new URL(url!);
  if (t.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable local DB required");
}
afterAll(closeDb);
it.skipIf(!enabled)(
  "pages past hidden candidates, keeps stable identity ties and searches the full permitted history",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic paged owner'),('Synthetic blocked owner'),('Synthetic private owner') returning id`
        ).map((row) => row.id),
      );
      for (const id of users) await ensureSocialProfileForUser(id);
      const [owner, blocked, foreign] = users;
      await db`insert into fkh_user_blocks(blocker_user_id,blocked_user_id) values(${owner},${blocked})`;
      await db`insert into fkh_feed_items(user_id,item_type,headline,visibility,created_at) select ${blocked},'status_update','Blocked latest','public','2026-01-03' from generate_series(1,130)`;
      await db`insert into fkh_feed_items(user_id,item_type,headline,visibility,created_at) values(${foreign},'status_update','Private hidden','private','2026-01-03')`;
      await db`insert into fkh_feed_items(user_id,item_type,headline,visibility,created_at) select ${owner},'status_update','Visible '||n,'private','2026-01-02 01:01:01.123456+00' from generate_series(1,45) n`;
      const oldest = (
        await db`insert into fkh_feed_items(user_id,item_type,headline,visibility,created_at) values(${owner},'status_update','Needle older activity','private','2026-01-01') returning id`
      )[0];
      const first = await getVisibleFeedPageForViewer(owner, { filter: "me" });
      expect(first.items).toHaveLength(40);
      expect(first.olderCursor).toBeTruthy();
      expect(first.newerCursor).toBeNull();
      const second = await getVisibleFeedPageForViewer(owner, {
        filter: "me",
        after: first.olderCursor!,
      });
      expect(second.items).toHaveLength(6);
      expect(second.olderCursor).toBeNull();
      expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(46);
      expect([...first.items, ...second.items].every((item) => item.userId === owner)).toBe(true);
      const back = await getVisibleFeedPageForViewer(owner, {
        filter: "me",
        before: second.newerCursor!,
      });
      expect(back.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
      expect(
        (
          await getVisibleFeedPageForViewer(owner, {
            query: "Needle",
            from: "2026-01-01",
            to: "2026-01-01",
          })
        ).items.map((item) => item.id),
      ).toEqual([oldest.id]);
      expect((await getVisibleFeedPageForViewer(owner, { query: "Blocked latest" })).items).toEqual(
        [],
      );
      expect((await getVisibleFeedPageForViewer(owner, { query: "Private hidden" })).items).toEqual(
        [],
      );
      expect((await getVisibleFeedPageForViewer(owner, { filter: "friends" })).items).toEqual([]);
    } finally {
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
