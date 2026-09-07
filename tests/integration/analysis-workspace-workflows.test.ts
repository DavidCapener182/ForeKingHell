import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { revalidatePath } from "next/cache";
import { closeDb } from "@/db/client";
import {
  saveAnalysisAnnotationWithStateAction,
  deleteAnalysisAnnotationWithStateAction,
  saveAnalysisSnapshotWithStateAction,
  deleteAnalysisSnapshotWithStateAction,
} from "@/app/analyse/workspace/actions";
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
    throw new Error("Disposable workspace database required");
}
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
describe.skipIf(!enabled)("analysis workspace persisted evidence", () => {
  let sql: ReturnType<typeof postgres>;
  let users: string[] = [];
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterEach(async () => {
    vi.mocked(revalidatePath).mockReset();
    await sql`delete from fkh_users where id in ${sql(users)}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it.each([false, true])(
    "preserves snapshot evidence and owner deletion with refresh failure=%s",
    async (failRefresh) => {
      users = (
        await sql`insert into fkh_users(name) values('Synthetic analyst'),('Synthetic foreign analyst') returning id`
      ).map((row) => row.id);
      actor.id = users[0];
      const [session] =
        await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'csv','range',now(),'raw') returning id`;
      const [club] =
        await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'7i','workspace-7i') returning id`;
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,carry_yd,review_status,source_raw_json) values(${actor.id},${session.id},${club.id},'7i',now(),1,150,'included','{}'),(${actor.id},${session.id},${club.id},'7i',now(),2,999,'user_excluded','{}')`;
      if (failRefresh)
        vi.mocked(revalidatePath).mockImplementation(() => {
          throw new Error("Synthetic refresh failure");
        });
      expect(
        await saveAnalysisSnapshotWithStateAction(form({ name: "Snapshot", from: "2026-02-30" })),
      ).toMatchObject({ ok: false });
      expect(await saveAnalysisSnapshotWithStateAction(form({ name: "Snapshot" }))).toEqual({
        ok: true,
      });
      const [snapshot] =
        await sql`select id,summary_json,source_data_through from fkh_analysis_snapshots where user_id=${actor.id}`;
      expect(snapshot.summary_json).toMatchObject({
        shotCount: 1,
        sessionCount: 1,
        carryMedianYd: 150,
      });
      expect(snapshot.source_data_through).toBeTruthy();
      await sql`update fkh_shots set carry_yd=170 where user_id=${actor.id} and review_status='included'`;
      expect(
        (await sql`select summary_json from fkh_analysis_snapshots where id=${snapshot.id}`)[0]
          .summary_json,
      ).toEqual(snapshot.summary_json);
      const deletion = form({ snapshotId: snapshot.id });
      actor.id = users[1];
      expect(await deleteAnalysisSnapshotWithStateAction(deletion)).toMatchObject({ ok: false });
      actor.id = users[0];
      expect(await deleteAnalysisSnapshotWithStateAction(deletion)).toEqual({ ok: true });
      expect(await deleteAnalysisSnapshotWithStateAction(deletion)).toMatchObject({ ok: false });
    },
  );
  it("keeps annotations owned and rejects malformed IDs and dates without unscoped saves", async () => {
    users = (
      await sql`insert into fkh_users(name) values('Synthetic annotation owner'),('Synthetic other owner') returning id`
    ).map((row) => row.id);
    actor.id = users[0];
    const [session] =
      await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${users[1]},'csv','range',now(),'raw') returning id`;
    const values = {
      title: "Swing note",
      body: "Measured observation",
      annotationType: "swing_thought",
    };
    const invalidInputs: Record<string, string>[] = [
      { sessionId: "bad-id" },
      { sessionId: session.id },
      { rangeFrom: "2026-02-30" },
      { rangeFrom: "2026-09-10", rangeTo: "2026-09-01" },
    ];
    for (const extra of invalidInputs) {
      expect(
        await saveAnalysisAnnotationWithStateAction(form({ ...values, ...extra })),
      ).toMatchObject({ ok: false });
    }
    expect(
      await sql`select id from fkh_analysis_annotations where user_id=${actor.id}`,
    ).toHaveLength(0);
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error("Synthetic annotation refresh failure");
    });
    expect(await saveAnalysisAnnotationWithStateAction(form(values))).toEqual({ ok: true });
    const [annotation] =
      await sql`select id,title,body from fkh_analysis_annotations where user_id=${actor.id}`;
    expect(annotation).toMatchObject({ title: values.title, body: values.body });
    const deletion = form({ annotationId: annotation.id });
    actor.id = users[1];
    expect(await deleteAnalysisAnnotationWithStateAction(deletion)).toMatchObject({ ok: false });
    expect(
      await sql`select id from fkh_analysis_annotations where id=${annotation.id}`,
    ).toHaveLength(1);
    actor.id = users[0];
    expect(await deleteAnalysisAnnotationWithStateAction(deletion)).toEqual({ ok: true });
    expect(await deleteAnalysisAnnotationWithStateAction(deletion)).toMatchObject({ ok: false });
  });
});
