import {
  saveWorkspaceComparisonWithStateAction,
  deleteWorkspaceComparisonWithStateAction,
} from "@/app/compare/actions";
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
  it("saves exact owned club selections and rejects fallback substitution or foreign deletion", async () => {
    users = (
      await sql`insert into fkh_users(name) values('Synthetic workspace owner'),('Synthetic other owner') returning id`
    ).map((row) => row.id);
    actor.id = users[0];
    const owned =
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'7i','seven'),(${actor.id},'8i','eight') returning id`;
    const [foreign] =
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${users[1]},'9i','nine') returning id`;
    const data = new FormData();
    data.set("view", "clubs");
    data.set("focusId", owned[0].id);
    data.set("baselineId", foreign.id);
    expect(await saveWorkspaceComparisonWithStateAction(data)).toMatchObject({ ok: false });
    expect(await sql`select id from fkh_analysis_snapshots where user_id=${actor.id}`).toHaveLength(
      0,
    );
    data.set("baselineId", owned[1].id);
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error("Synthetic workspace refresh");
    });
    expect(await saveWorkspaceComparisonWithStateAction(data)).toEqual({ ok: true });
    const [saved] =
      await sql`select id,filters_json,chart_state_json from fkh_analysis_snapshots where user_id=${actor.id}`;
    expect(saved.filters_json).toMatchObject({ clubAId: owned[0].id, clubBId: owned[1].id });
    expect(saved.chart_state_json).toMatchObject({ compareView: "clubs" });
    const deletion = new FormData();
    deletion.set("snapshotId", saved.id);
    actor.id = users[1];
    expect(await deleteWorkspaceComparisonWithStateAction(deletion)).toMatchObject({ ok: false });
    actor.id = users[0];
    expect(await deleteWorkspaceComparisonWithStateAction(deletion)).toEqual({ ok: true });
    expect(await deleteWorkspaceComparisonWithStateAction(deletion)).toMatchObject({ ok: false });
  });
  it("preserves progress periods and only saves explicitly visible player pairs", async () => {
    users = (
      await sql`insert into fkh_users(name) values('Synthetic player A'),('Synthetic player B') returning id`
    ).map((row) => row.id);
    actor.id = users[0];
    for (const id of users)
      await sql`insert into fkh_user_profiles(user_id,username,display_name) values(${id},${id},'Synthetic player')`;
    const data = new FormData();
    data.set("view", "players");
    data.set("focusId", users[0]);
    data.set("baselineId", users[1]);
    expect(await saveWorkspaceComparisonWithStateAction(data)).toMatchObject({ ok: false });
    await sql`update fkh_user_profiles set public_profile=true,visibility_settings_json=${sql.json({ allowCompare: true, exactShots: "public", rounds: "public", bag: "public", handicap: "public" })} where user_id=${users[1]}`;
    expect(await saveWorkspaceComparisonWithStateAction(data)).toEqual({ ok: true });
    const [pair] =
      await sql`select filters_json,chart_state_json from fkh_analysis_snapshots where user_id=${actor.id}`;
    expect(pair.filters_json).toMatchObject({ playerAId: users[0], playerBId: users[1] });
    expect(pair.chart_state_json).toMatchObject({ compareView: "players" });
    for (const [focus, baseline] of [
      ["last-7", "previous-7"],
      ["last-30", "previous-30"],
    ]) {
      data.set("view", "progress");
      data.set("focusId", focus);
      data.set("baselineId", baseline);
      expect(await saveWorkspaceComparisonWithStateAction(data)).toEqual({ ok: true });
      const rows =
        await sql`select filters_json from fkh_analysis_snapshots where user_id=${actor.id} and chart_state_json->>'compareView'='progress'`;
      expect(
        rows.some(
          (row) => row.filters_json.focusId === focus && row.filters_json.baselineId === baseline,
        ),
      ).toBe(true);
    }
  });
});
