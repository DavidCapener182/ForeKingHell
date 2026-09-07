import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { revalidatePath } from "next/cache";
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
    vi.mocked(revalidatePath).mockReset();
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
  it("rejects malformed numeric specifications without closing the existing setup", async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic equipment validation') returning id`
    )[0].id;
    const clubId = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'7i','validation') returning id`
    )[0].id;
    expect(
      await saveEquipmentHistoryWithStateAction(
        form({ clubId, loftDeg: "32", lieDeg: "61", effectiveFrom: "2026-01-01" }),
      ),
    ).toEqual({ ok: true });
    for (const field of ["loftDeg", "lieDeg"]) {
      for (const value of ["abc", "NaN", "Infinity", "0x10", "1e999"]) {
        expect(
          await saveEquipmentHistoryWithStateAction(form({ clubId, [field]: value })),
        ).toMatchObject({ ok: false, code: "equipment_validation" });
      }
    }
    expect(
      await sql`select loft_deg,lie_deg,effective_to from fkh_club_equipment_history where user_id=${actor.id}`,
    ).toEqual([{ loft_deg: 32, lie_deg: 61, effective_to: null }]);
    expect(
      await saveEquipmentHistoryWithStateAction(
        form({ clubId, loftDeg: "", lieDeg: "61.24", effectiveFrom: "2026-02-01" }),
      ),
    ).toEqual({ ok: true });
    expect(
      (
        await sql`select loft_deg,lie_deg from fkh_club_equipment_history where user_id=${actor.id} and effective_to is null`
      )[0],
    ).toEqual({ loft_deg: null, lie_deg: 61.2 });
  });

  it("reuses the same null-brand ball identity across concurrent retries and reactivation", async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic equipment ball retries') returning id`
    )[0].id;
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        createBallModelWithStateAction(form({ brand: " ", model: "Unbranded fixture" })),
      ),
    );
    expect(results).toEqual(Array.from({ length: 6 }, () => ({ ok: true })));
    const rows = await sql`select id,brand,active from fkh_ball_models where user_id=${actor.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ brand: null, active: true });
    await sql`update fkh_ball_models set active=false where id=${rows[0].id}`;
    expect(await createBallModelWithStateAction(form({ model: "Unbranded fixture" }))).toEqual({
      ok: true,
    });
    expect(
      await sql`select id,brand,active from fkh_ball_models where user_id=${actor.id}`,
    ).toEqual(rows);
  });

  it("replays snapshots by request identity without recapturing changed clubs or crossing accounts", async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic equipment snapshot retries') returning id`
    )[0].id;
    const owner = actor.id;
    const clubId = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key,model) values(${owner},'7i','snapshot','Original club') returning id`
    )[0].id;
    const creationId = crypto.randomUUID();
    const request = { creationId, label: "Original setup" };
    expect(await captureEquipmentSnapshotWithStateAction(form(request))).toEqual({ ok: true });
    const original = (
      await sql`select id,label,snapshot_json,captured_at from fkh_equipment_snapshots where user_id=${owner}`
    )[0];
    await sql`update fkh_clubs set model='Changed after capture' where id=${clubId}`;
    expect(
      await Promise.all(
        Array.from({ length: 4 }, () => captureEquipmentSnapshotWithStateAction(form(request))),
      ),
    ).toEqual(Array.from({ length: 4 }, () => ({ ok: true })));
    expect(
      await sql`select id,label,snapshot_json,captured_at from fkh_equipment_snapshots where user_id=${owner}`,
    ).toEqual([original]);
    expect(
      await captureEquipmentSnapshotWithStateAction(
        form({ ...request, label: "Different request" }),
      ),
    ).toMatchObject({ ok: false, code: "equipment_validation" });
    expect(
      await captureEquipmentSnapshotWithStateAction(form({ creationId: "invalid" })),
    ).toMatchObject({ ok: false, code: "equipment_validation" });
    const other = (
      await sql`insert into fkh_users(name) values('Synthetic foreign equipment') returning id`
    )[0].id;
    try {
      actor.id = other;
      expect(await captureEquipmentSnapshotWithStateAction(form(request))).toMatchObject({
        ok: false,
        code: "equipment_validation",
      });
      expect(await sql`select id from fkh_equipment_snapshots where user_id=${other}`).toHaveLength(
        0,
      );
    } finally {
      actor.id = owner;
      await sql`delete from fkh_users where id=${other}`;
    }
    expect(
      await captureEquipmentSnapshotWithStateAction(
        form({ ...request, creationId: crypto.randomUUID() }),
      ),
    ).toEqual({ ok: true });
    expect(await sql`select id from fkh_equipment_snapshots where user_id=${owner}`).toHaveLength(
      2,
    );
  });

  it.each([false, true])(
    "saves equipment workflows with postcommit refresh failure=%s",
    async (refreshFailure) => {
      if (refreshFailure)
        vi.mocked(revalidatePath).mockImplementation(() => {
          throw new Error("Synthetic equipment refresh failure");
        });
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
      expect(
        await createBallModelWithStateAction(form({ brand: "Fixture", model: "Ball" })),
      ).toEqual({ ok: true });
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
        (await sql`select count(*) from fkh_equipment_snapshots where user_id=${actor.id}`)[0]
          .count,
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
        (
          await sql`select effective_to from fkh_club_equipment_history where user_id=${actor.id}`
        )[0].effective_to,
      ).not.toBeNull();
      await expect(
        createBallModelAction(form({ brand: "Fixture", model: "Ball" })),
      ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    },
  );
});
