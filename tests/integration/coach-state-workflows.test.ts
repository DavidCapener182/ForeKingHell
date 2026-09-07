import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  createCoachInteractionWithStateAction as create,
  updateCoachInteractionStatusWithStateAction as update,
  completePlayerInteractionWithStateAction as complete,
} from "@/app/coach/workspace/actions";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || t.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable coach database required");
}
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
describe.skipIf(!enabled)("coach workspace state actions", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it("enforces coach membership, private scope, and existing interaction ownership", async () => {
    const ids = (
      await sql`insert into fkh_users(name) values('Synthetic coach'),('Synthetic player'),('Synthetic stranger') returning id`
    ).map((r) => r.id);
    const [coach, player, stranger] = ids;
    actor.id = coach;
    const draft = {
      playerUserId: player,
      interactionType: "private_note",
      title: "Private fixture",
      body: "Synthetic note",
    };
    try {
      expect(await create(form(draft))).toMatchObject({ ok: false });
      await sql`insert into fkh_account_memberships(owner_user_id,member_user_id,role) values(${player},${coach},'coach')`;
      expect(await create(form({ ...draft, sessionId: crypto.randomUUID() }))).toMatchObject({
        ok: false,
      });
      expect(await create(form(draft))).toEqual({ ok: true });
      const [privateRow] =
        await sql`select id,visibility from fkh_coach_player_interactions where coach_user_id=${coach}`;
      expect(privateRow.visibility).toBe("coach_only");
      actor.id = player;
      expect(await complete(form({ interactionId: privateRow.id }))).toMatchObject({ ok: false });
      actor.id = coach;
      expect(await create(form({ ...draft, interactionType: "practice_assignment" }))).toEqual({
        ok: true,
      });
      const [visible] =
        await sql`select id from fkh_coach_player_interactions where coach_user_id=${coach} and visibility='player_visible'`;
      actor.id = stranger;
      expect(await complete(form({ interactionId: visible.id }))).toMatchObject({ ok: false });
      actor.id = player;
      expect(await complete(form({ interactionId: visible.id }))).toEqual({ ok: true });
      actor.id = coach;
      expect(
        await update(
          form({ playerUserId: player, interactionId: crypto.randomUUID(), status: "completed" }),
        ),
      ).toMatchObject({ ok: false });
      expect(
        await update(
          form({ playerUserId: player, interactionId: privateRow.id, status: "cancelled" }),
        ),
      ).toEqual({ ok: true });
    } finally {
      await sql`delete from fkh_users where id in ${sql(ids)}`;
    }
  });
});
