import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { revalidatePath } from "next/cache";
import { closeDb } from "@/db/client";
import {
  saveSessionComparisonWithStateAction,
  deleteSessionComparisonWithStateAction,
} from "@/app/analyse/compare/actions";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || !["localhost", "127.0.0.1"].includes(t.hostname) || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable comparison database required.");
}
describe.skipIf(!enabled)("saved comparison state", () => {
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
    "retains owned comparison outcomes with refresh failure=%s",
    async (refreshFailure) => {
      if (refreshFailure)
        vi.mocked(revalidatePath).mockImplementation(() => {
          throw new Error("Synthetic refresh failure");
        });
      users = (
        await sql`insert into fkh_users(name) values('Synthetic comparer'),('Synthetic foreign comparer') returning id`
      ).map((r) => r.id);
      actor.id = users[0];
      const ids: string[] = [];
      for (const userId of [users[0], users[0], users[1]])
        ids.push(
          (
            await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${userId},'csv','range',now(),'Synthetic comparison') returning id`
          )[0].id,
        );
      const form = new FormData();
      form.set("sessionId", ids[0]);
      form.set("baselineSessionId", ids[0]);
      form.set("confidence", "low");
      form.set("experimentType", "equipment");
      expect(await saveSessionComparisonWithStateAction(form)).toMatchObject({
        ok: false,
        code: "comparison_validation",
      });
      form.set("baselineSessionId", ids[2]);
      expect(await saveSessionComparisonWithStateAction(form)).toMatchObject({
        ok: false,
        code: "comparison_validation",
      });
      form.set("baselineSessionId", ids[1]);
      expect(await saveSessionComparisonWithStateAction(form)).toEqual({ ok: true });
      const [snapshot] =
        await sql`select id,filters_json,chart_state_json from fkh_analysis_snapshots where user_id=${actor.id}`;
      expect(snapshot.filters_json).toMatchObject({
        sessionId: ids[0],
        baselineSessionId: ids[1],
        focus: "session",
        baseline: "previous-session",
      });
      expect(snapshot.chart_state_json).toMatchObject({
        confidence: "low",
        experimentType: "equipment",
      });
      const deletion = new FormData();
      deletion.set("snapshotId", snapshot.id);
      actor.id = users[1];
      expect(await deleteSessionComparisonWithStateAction(deletion)).toMatchObject({
        ok: false,
        code: "comparison_validation",
      });
      expect(await sql`select id from fkh_analysis_snapshots where id=${snapshot.id}`).toHaveLength(
        1,
      );
      actor.id = users[0];
      expect(await deleteSessionComparisonWithStateAction(deletion)).toEqual({ ok: true });
      expect(await sql`select id from fkh_analysis_snapshots where id=${snapshot.id}`).toHaveLength(
        0,
      );
      expect(await deleteSessionComparisonWithStateAction(deletion)).toMatchObject({
        ok: false,
        code: "comparison_validation",
      });
    },
  );
});
