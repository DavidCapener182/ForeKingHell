import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tournament-calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tournament-calendar")>()),
  getScheduledTournamentSet: () => [],
}));
import { getTournamentsPageData } from "@/lib/tournaments";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (t?.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable database required");
}
afterAll(closeDb);
it.skipIf(!enabled)(
  "hides a friend's private event while retaining friends, own and participant visibility",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic tournament viewer'),('Synthetic tournament friend') returning id`
        ).map((r) => r.id),
      );
      actor.id = users[0];
      const [a, b] = [...users].sort();
      await db`insert into fkh_friendships(user_a_id,user_b_id) values(${a},${b})`;
      const ids: string[] = [];
      for (const visibility of ["private", "friends", "public"])
        ids.push(
          (
            await db`insert into fkh_tournaments(title,visibility,created_by_user_id) values('Synthetic visibility',${visibility},${users[1]}) returning id`
          )[0].id,
        );
      const own = (
        await db`insert into fkh_tournaments(title,visibility,created_by_user_id) values('Synthetic own','private',${actor.id}) returning id`
      )[0].id;
      let visible = (await getTournamentsPageData()).tournaments.map((t) => t.id);
      expect(visible).not.toContain(ids[0]);
      expect(visible).toEqual(expect.arrayContaining([ids[1], ids[2], own]));
      await db`insert into fkh_tournament_entries(tournament_id,user_id) values(${ids[0]},${actor.id})`;
      visible = (await getTournamentsPageData()).tournaments.map((t) => t.id);
      expect(visible).toContain(ids[0]);
    } finally {
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
