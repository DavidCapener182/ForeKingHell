import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { dismissWelcomeAction } from "@/app/welcome/actions";
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
  "dismisses only the signed-in account without creating onboarding evidence",
  async () => {
    const owners = (
      await sql`insert into fkh_users(name) values('Synthetic welcome owner'),('Synthetic welcome foreign') returning id`
    ).map((row) => row.id);
    actor.id = owners[0];
    try {
      await expect(dismissWelcomeAction()).rejects.toMatchObject({
        digest: expect.stringContaining("/today"),
      });
      const rows =
        await sql`select id,onboarding_completed_at from fkh_users where id in ${sql(owners)}`;
      expect(rows.find((row) => row.id === owners[0])?.onboarding_completed_at).toBeInstanceOf(
        Date,
      );
      expect(rows.find((row) => row.id === owners[1])?.onboarding_completed_at).toBeNull();
      expect(await sql`select id from fkh_sessions where user_id in ${sql(owners)}`).toHaveLength(
        0,
      );
      expect(
        await sql`select id from fkh_practice_plans where user_id in ${sql(owners)}`,
      ).toHaveLength(0);
    } finally {
      await sql`delete from fkh_users where id in ${sql(owners)}`;
    }
  },
);
