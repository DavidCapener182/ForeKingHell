import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { createGolfTrainingSessionWithStateAction } from "@/app/stats/training-over-time/actions";
import { calculateSessionLoad } from "@/lib/training/trainingLoad";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({
  revalidatePath: () => {
    throw new Error("Synthetic refresh failure");
  },
}));
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
describe.skipIf(!enabled)("training state save", () => {
  afterAll(closeDb);
  it("retains invalid entries and saves exact load despite refresh failure", async () => {
    const db = postgres(url!, { max: 1 });
    try {
      actor.id = (
        await db`insert into fkh_users(name) values('Synthetic training state') returning id`
      )[0].id;
      const form = new FormData();
      for (const [key, value] of Object.entries({
        sessionDate: "2026-02-30",
        activityType: "range",
        durationMinutes: "45",
        fullSwings: "50",
        shortGameSwings: "10",
        rpe: "4",
      }))
        form.set(key, value);
      expect(await createGolfTrainingSessionWithStateAction(form)).toEqual({
        ok: false,
        error: "Choose a valid session date.",
      });
      expect(form.get("durationMinutes")).toBe("45");
      expect(
        await db`select id from fkh_golf_training_sessions where user_id=${actor.id}`,
      ).toHaveLength(0);
      form.set("sessionDate", "2024-02-29");
      expect(await createGolfTrainingSessionWithStateAction(form)).toEqual({ ok: true });
      const rows =
        await db`select source_type,total_swings,session_load,session_date from fkh_golf_training_sessions where user_id=${actor.id}`;
      expect(rows).toHaveLength(1);
      expect({ ...rows[0], session_load: Number(rows[0].session_load) }).toMatchObject({
        source_type: "practice",
        total_swings: 60,
        session_load: calculateSessionLoad({
          durationMinutes: 45,
          holesPlayed: null,
          totalSwings: 60,
          fullSwings: 50,
          shortGameSwings: 10,
          puttingSwings: null,
          walked: null,
          competition: false,
          rpe: 4,
          mentalPressure: null,
        }),
      });
    } finally {
      if (actor.id) await db`delete from fkh_users where id=${actor.id}`;
      await db.end();
    }
  });
  it("rejects a foreign source and gives a clear outcome for an already linked source", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      for (const name of ["Synthetic training owner", "Synthetic training foreign"])
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      const ids: string[] = [];
      for (const owner of owners)
        ids.push(
          (
            await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${owner},'csv','range',now(),'synthetic') returning id`
          )[0].id,
        );
      actor.id = owners[0];
      const form = new FormData();
      for (const [key, value] of Object.entries({
        sourceType: "imported",
        sourceId: ids[1],
        sessionDate: "2026-09-07",
        rpe: "4",
        totalSwings: "50",
      }))
        form.set(key, value);
      expect(await createGolfTrainingSessionWithStateAction(form)).toEqual({
        ok: false,
        error: "That source session is not available in your account.",
      });
      expect(
        await db`select id from fkh_golf_training_sessions where user_id=${actor.id}`,
      ).toHaveLength(0);
      form.set("sourceId", ids[0]);
      expect(await createGolfTrainingSessionWithStateAction(form)).toEqual({ ok: true });
      expect(await createGolfTrainingSessionWithStateAction(form)).toEqual({
        ok: false,
        error:
          "This source session already has a training load. Open the existing entry to review it.",
      });
      expect(
        await db`select id from fkh_golf_training_sessions where user_id=${actor.id}`,
      ).toHaveLength(1);
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
