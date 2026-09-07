import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { ensureUserProfile } from "@/lib/current-user";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}
describe.skipIf(!enabled)("concurrent identity bootstrap", () => {
  afterAll(closeDb);
  it("keeps separate owners when generated username candidates collide", async () => {
    const sql = postgres(url!, { max: 1 });
    const first = crypto.randomUUID();
    const second = `${first.slice(0, 8)}${crypto.randomUUID().slice(8)}`;
    const ids = [first, second];
    try {
      const outcomes = await Promise.allSettled(
        ids.flatMap((id) =>
          Array.from({ length: 4 }, () =>
            ensureUserProfile({
              id,
              email: `${id}@example.invalid`,
              name: "Synthetic matching name",
            }),
          ),
        ),
      );
      expect(outcomes.filter((result) => result.status === "rejected")).toEqual([]);
      const profiles =
        await sql`select user_id,username,display_name from fkh_user_profiles where user_id in ${sql(ids)}`;
      expect(profiles).toHaveLength(2);
      expect(new Set(profiles.map((profile) => profile.username)).size).toBe(2);
      expect(profiles.map((profile) => profile.user_id).sort()).toEqual([...ids].sort());
      expect(profiles.every((profile) => profile.display_name === "Synthetic matching name")).toBe(
        true,
      );
    } finally {
      await sql`delete from fkh_users where id in ${sql(ids)}`;
      await sql.end();
    }
  });
  it.each([false, true])(
    "creates one profile without overwriting existing identity (user exists: %s)",
    async (existing) => {
      const sql = postgres(url!, { max: 1 });
      const id = crypto.randomUUID();
      const email = `${id}@example.invalid`;
      try {
        if (existing)
          await sql`insert into fkh_users(id,email,name) values(${id},${email},'Kept name')`;
        const outcomes = await Promise.allSettled(
          Array.from({ length: 8 }, () =>
            ensureUserProfile({ id, email, name: "Synthetic identity" }),
          ),
        );
        expect(outcomes.filter((result) => result.status === "rejected")).toEqual([]);
        const users = await sql`select name from fkh_users where id=${id}`;
        const profiles = await sql`select display_name from fkh_user_profiles where user_id=${id}`;
        expect(users).toHaveLength(1);
        expect(profiles).toHaveLength(1);
        expect(profiles[0].display_name).toBe(existing ? "Kept name" : "Synthetic identity");
      } finally {
        await sql`delete from fkh_users where id=${id}`;
        await sql.end();
      }
    },
  );
});
