import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  createManualSpeedSessionWithStateAction,
  updateSpeedGoalsWithStateAction,
  updateSpeedSessionWithStateAction,
  saveSpeedTransferTestWithStateAction,
  deleteSpeedSessionWithStateAction,
} from "@/app/speed/actions";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({
  revalidatePath: () => {
    throw new Error("Synthetic refresh failure");
  },
}));
vi.mock("@/lib/achievements/service", () => ({
  syncAchievementsForUser: async () => {
    throw new Error("Synthetic award refresh failure");
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
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
describe.skipIf(!enabled)("speed state workflows", () => {
  afterAll(closeDb);
  it("returns durable session identity, preserves goals on invalid edits and rejects foreign clubs", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      for (const name of ["Speed owner", "Foreign speed owner"])
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      actor.id = owners[0];
      const clubIds: string[] = [];
      for (const owner of owners)
        clubIds.push(
          (
            await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'driver','speed-state-driver') returning id`
          )[0].id,
        );
      const valid = form({ driverGlobalTarget: "110", [`clubTarget:${clubIds[0]}`]: "105" });
      expect(await updateSpeedGoalsWithStateAction(valid)).toEqual({ ok: true });
      const original =
        await db`select goal_key,target_speed_mph from fkh_speed_training_goals where user_id=${actor.id} order by goal_key`;
      expect(original).toHaveLength(2);
      expect(
        await updateSpeedGoalsWithStateAction(
          form({ driverGlobalTarget: "115", driverGlobalDate: "2026-02-30" }),
        ),
      ).toMatchObject({ ok: false, error: "Choose a valid target date." });
      expect(
        await db`select goal_key,target_speed_mph from fkh_speed_training_goals where user_id=${actor.id} order by goal_key`,
      ).toEqual(original);

      const invalid = form({ driverGlobalTarget: "120", [`clubTarget:${clubIds[0]}`]: "999" });
      expect(await updateSpeedGoalsWithStateAction(invalid)).toMatchObject({ ok: false });
      expect(
        await db`select goal_key,target_speed_mph from fkh_speed_training_goals where user_id=${actor.id} order by goal_key`,
      ).toEqual(original);
      expect(invalid.get("driverGlobalTarget")).toBe("120");
      expect(
        await createManualSpeedSessionWithStateAction(
          form({ speedReadings: "100\n102", clubId: clubIds[1] }),
        ),
      ).toMatchObject({ ok: false });
      expect(
        await db`select id from fkh_speed_training_sessions where user_id=${actor.id}`,
      ).toHaveLength(0);
      const saved = await createManualSpeedSessionWithStateAction(
        form({ speedReadings: "100\n102", warmupReadings: "120", clubId: clubIds[0] }),
      );
      expect(saved.ok).toBe(true);
      if (!saved.ok || !saved.sessionId) throw new Error("Missing saved identity");
      expect(
        (
          await db`select user_id,max_speed_mph,swing_count from fkh_speed_training_sessions where id=${saved.sessionId}`
        )[0],
      ).toMatchObject({ user_id: actor.id, max_speed_mph: 102, swing_count: 3 });
      expect(
        await db`select id from fkh_speed_training_swings where speed_session_id=${saved.sessionId}`,
      ).toHaveLength(3);
      const edit = form({
        sessionId: saved.sessionId,
        clubId: clubIds[0],
        speedReadings: "104\n106",
        sessionDate: "2026-02-30",
      });
      expect(await updateSpeedSessionWithStateAction(edit)).toMatchObject({
        ok: false,
        error: "Choose a valid session date.",
      });
      expect(
        (
          await db`select max_speed_mph from fkh_speed_training_sessions where id=${saved.sessionId}`
        )[0].max_speed_mph,
      ).toBe(102);
      await db`update fkh_speed_training_sessions set source='rapsodo' where id=${saved.sessionId}`;
      await db`update fkh_speed_training_swings set source_raw_json='{"providerReading":"original"}' where speed_session_id=${saved.sessionId}`;
      const providerOriginal =
        await db`select swing_number,club_speed_mph,source_raw_json from fkh_speed_training_swings where speed_session_id=${saved.sessionId} order by swing_number`;
      edit.set("sessionDate", "2026-09-07");
      expect(await updateSpeedSessionWithStateAction(edit)).toEqual({
        ok: true,
        sessionId: saved.sessionId,
      });
      expect(
        (
          await db`select max_speed_mph from fkh_speed_training_sessions where id=${saved.sessionId}`
        )[0].max_speed_mph,
      ).toBe(106);
      expect(
        await db`select id from fkh_speed_training_swings where speed_session_id=${saved.sessionId}`,
      ).toHaveLength(2);
      const editedMetadata = (
        await db`select raw_metadata_json from fkh_speed_training_sessions where id=${saved.sessionId}`
      )[0].raw_metadata_json;
      expect(editedMetadata.originalImportedSwings).toEqual(
        providerOriginal.map((row) => ({
          swingNumber: row.swing_number,
          clubSpeedMph: row.club_speed_mph,
          sourceRawJson: row.source_raw_json,
        })),
      );

      edit.set("speedReadings", "108\n110");
      expect(await updateSpeedSessionWithStateAction(edit)).toEqual({
        ok: true,
        sessionId: saved.sessionId,
      });
      expect(
        (
          await db`select raw_metadata_json from fkh_speed_training_sessions where id=${saved.sessionId}`
        )[0].raw_metadata_json.originalImportedSwings,
      ).toEqual(editedMetadata.originalImportedSwings);
      expect(
        (
          await db`select max_speed_mph from fkh_speed_training_sessions where id=${saved.sessionId}`
        )[0].max_speed_mph,
      ).toBe(110);
      const practiceId = (
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'csv','range','2026-09-07T12:00:00Z','Synthetic transfer') returning id`
      )[0].id;
      const shotIds: string[] = [];
      for (let index = 0; index < 5; index++) {
        shotIds.push(
          (
            await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,side_carry_yd,source_raw_json) values(${actor.id},${practiceId},${clubIds[0]},'driver','2026-09-07T12:00:00Z',220,${index},'{"synthetic":true}') returning id`
          )[0].id,
        );
      }
      const transfer = form({ speedSessionId: saved.sessionId, shotSessionId: practiceId });
      for (const id of shotIds) transfer.append("shotId", id);
      expect(await saveSpeedTransferTestWithStateAction(transfer)).toEqual({
        ok: true,
        sessionId: saved.sessionId,
      });
      const linked = (
        await db`select raw_metadata_json from fkh_speed_training_sessions where id=${saved.sessionId}`
      )[0].raw_metadata_json;
      expect(linked.transferTest.shotIds).toEqual(shotIds);
      expect(linked.transferTest.corridor.basis).toBe("provisional_driver");
      await db`update fkh_sessions set data_confidence_json=${db.json({ alignment: "aligned", directionReviews: { [shotIds[0]]: { status: "questionable" } } })} where id=${practiceId}`;
      expect(await saveSpeedTransferTestWithStateAction(transfer)).toMatchObject({ ok: false });
      expect(
        (
          await db`select raw_metadata_json from fkh_speed_training_sessions where id=${saved.sessionId}`
        )[0].raw_metadata_json,
      ).toEqual(linked);
      await db`update fkh_sessions set data_confidence_json=${db.json({ alignment: "misaligned", directionReviews: { [shotIds[0]]: { status: "confirmed" } } })} where id=${practiceId}`;
      expect(await saveSpeedTransferTestWithStateAction(transfer)).toMatchObject({ ok: false });
      expect(
        (
          await db`select carry_yd,side_carry_yd,source_raw_json from fkh_shots where id=${shotIds[0]}`
        )[0],
      ).toMatchObject({ carry_yd: 220, side_carry_yd: 0, source_raw_json: { synthetic: true } });
      expect(
        await saveSpeedTransferTestWithStateAction(form({ speedSessionId: saved.sessionId })),
      ).toEqual({ ok: true, sessionId: saved.sessionId });
      actor.id = owners[1];
      expect(await updateSpeedSessionWithStateAction(edit)).toMatchObject({ ok: false });
      expect(
        await saveSpeedTransferTestWithStateAction(form({ speedSessionId: saved.sessionId })),
      ).toMatchObject({ ok: false });
      expect(
        await deleteSpeedSessionWithStateAction(form({ sessionId: saved.sessionId })),
      ).toMatchObject({ ok: false });
      expect(
        await db`select id from fkh_speed_training_sessions where id=${saved.sessionId}`,
      ).toHaveLength(1);
      actor.id = owners[0];
      expect(await deleteSpeedSessionWithStateAction(form({ sessionId: saved.sessionId }))).toEqual(
        { ok: true, sessionId: saved.sessionId },
      );
      expect(
        await db`select id from fkh_speed_training_swings where speed_session_id=${saved.sessionId}`,
      ).toHaveLength(0);
      expect(
        await deleteSpeedSessionWithStateAction(form({ sessionId: saved.sessionId })),
      ).toMatchObject({ ok: false });
      expect(
        await db`select id from fkh_speed_training_sessions where user_id=${owners[1]}`,
      ).toHaveLength(0);
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
