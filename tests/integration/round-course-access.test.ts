import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { createManualRoundAction, updateRoundCourseLinkAction } from "@/app/rounds/actions";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
describe.skipIf(!enabled)("manual round private course access", () => {
  afterAll(closeDb);
  it("rejects a foreign private tee even when the submitted course claims ownership", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    const courseIds: string[] = [];
    try {
      for (const name of ["Synthetic course owner", "Synthetic round creator"]) {
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      }
      for (const owner of owners) {
        courseIds.push(
          (
            await db`insert into fkh_courses(name, visibility, created_by_user_id) values('Synthetic private course', 'private', ${owner}) returning id`
          )[0].id,
        );
      }
      const tee = (
        await db`insert into fkh_tee_sets(course_id,name,par) values(${courseIds[0]},'Synthetic tee',72) returning id`
      )[0].id;
      actor.id = owners[1];
      const form = new FormData();
      const creationId = crypto.randomUUID();
      form.set("creationId", creationId);
      form.set("teeSetId", tee);
      form.set("courseId", courseIds[1]);
      form.set("date", "2026-09-07");
      form.set("roundStatus", "in_progress");
      form.set("holeCount", "18");
      form.set("date", "2026-02-30");
      await expect(createManualRoundAction(form)).rejects.toThrow("date is not a valid date.");
      form.set("date", "2026-09-07");
      await expect(createManualRoundAction(form)).rejects.toThrow("Tee set not found.");
      expect(await db`select id from fkh_sessions where id=${creationId}`).toHaveLength(0);
      expect(await db`select id from fkh_sessions where user_id=${actor.id}`).toHaveLength(0);
      const round = (
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,scorecard_json) values(${actor.id},'manual','real_round',now(),'','[]'::jsonb) returning id,updated_at`
      )[0];
      form.set("sessionId", round.id);
      await expect(updateRoundCourseLinkAction(form)).rejects.toThrow("Tee set not found.");
      const retained = (
        await db`select course_id,tee_set_id,scorecard_json,updated_at from fkh_sessions where id=${round.id}`
      )[0];
      expect(retained.course_id).toBeNull();
      expect(retained.tee_set_id).toBeNull();
      expect(retained.scorecard_json).toEqual([]);
      expect(retained.updated_at).toEqual(round.updated_at);
      actor.id = owners[0];
      await expect(updateRoundCourseLinkAction(form)).rejects.toThrow("Round not found.");
    } finally {
      if (courseIds.length) await db`delete from fkh_courses where id in ${db(courseIds)}`;
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
