import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  createBallModelWithStateAction,
  saveEquipmentHistoryWithStateAction,
  captureEquipmentSnapshotWithStateAction,
  saveBagOrderWithStateAction,
  retireClubWithStateAction,
  createBallModelAction,
} from "@/app/equipment/actions";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || !["localhost", "127.0.0.1"].includes(t.hostname) || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable equipment database required.");
}
describe.skipIf(!enabled)("equipment state actions", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterEach(async () => {
    await sql`delete from fkh_users where id=${actor.id}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  function form(values: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(values)) f.set(k, v);
    return f;
  }
  it("saves each equipment workflow while returning validation errors and preserving legacy redirects", async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic equipment owner') returning id`
    )[0].id;
    const clubId = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'7i','fixture') returning id`
    )[0].id;
    expect(await createBallModelWithStateAction(form({ model: "" }))).toMatchObject({
      ok: false,
      code: "equipment_validation",
    });
    expect(await createBallModelWithStateAction(form({ brand: "Fixture", model: "Ball" }))).toEqual(
      { ok: true },
    );
    const ballId = (await sql`select id from fkh_ball_models where user_id=${actor.id}`)[0].id;
    expect(
      await saveEquipmentHistoryWithStateAction(
        form({ clubId, ballModelId: ballId, loftDeg: "999" }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      await saveEquipmentHistoryWithStateAction(
        form({ clubId, ballModelId: ballId, loftDeg: "32", effectiveFrom: "2026-01-01" }),
      ),
    ).toEqual({ ok: true });
    expect(
      await saveBagOrderWithStateAction(
        form({ clubId, [`bagPosition:${clubId}`]: "3", [`bagSection:${clubId}`]: "irons" }),
      ),
    ).toEqual({ ok: true });
    expect(
      await captureEquipmentSnapshotWithStateAction(form({ label: "Fixture snapshot" })),
    ).toEqual({ ok: true });
    expect(
      (await sql`select count(*) from fkh_equipment_snapshots where user_id=${actor.id}`)[0].count,
    ).toBe("1");
    expect(await retireClubWithStateAction(form({ clubId: crypto.randomUUID() }))).toMatchObject({
      ok: false,
      code: "equipment_validation",
    });
    expect(await retireClubWithStateAction(form({ clubId }))).toEqual({ ok: true });
    expect(
      (await sql`select active,bag_position from fkh_clubs where id=${clubId}`)[0],
    ).toMatchObject({ active: false, bag_position: 3 });
    expect(
      (await sql`select effective_to from fkh_club_equipment_history where user_id=${actor.id}`)[0]
        .effective_to,
    ).not.toBeNull();
    await expect(
      createBallModelAction(form({ brand: "Fixture", model: "Ball" })),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });
});
