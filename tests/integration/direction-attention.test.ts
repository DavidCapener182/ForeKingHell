import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getDirectionAttention } from "@/lib/direction-attention";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
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
describe.skipIf(!enabled)("direction attention", () => {
  afterAll(closeDb);
  it("returns an honest empty state and exact total beyond the visible limit", async () => {
    const db = postgres(url!, { max: 1 });
    const id = crypto.randomUUID();
    try {
      await db`insert into fkh_users(id,name) values(${id},'Synthetic attention limit')`;
      actor.id = id;
      expect(await getDirectionAttention()).toEqual({ totalSessions: 0, sessions: [] });
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,data_confidence_json)
        select ${id}::uuid,'csv','range',now() - i * interval '1 day','synthetic','{"alignment":"possibly_misaligned"}'::jsonb
        from generate_series(1,101) i`;
      const result = await getDirectionAttention();
      expect(result.totalSessions).toBe(101);
      expect(result.sessions).toHaveLength(100);
      expect(
        result.sessions.every(
          (session) => session.alignmentNeedsReview && session.questionableShots === 0,
        ),
      ).toBe(true);
      const dates = result.sessions.map((session) => Date.parse(session.date));
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    } finally {
      await db`delete from fkh_users where id=${id}`;
      await db.end();
    }
  });

  it("separates alignment and shot reviews, ignores missing shot references, and preserves raw evidence", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      for (const name of ["Owner", "Foreign"])
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      actor.id = owners[0];
      const sessionIds: string[] = [];
      for (const owner of [owners[0], owners[0], owners[1]])
        sessionIds.push(
          (
            await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${owner},'csv','range',now(),'synthetic') returning id`
          )[0].id,
        );
      const [club] =
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'7i','attention') returning id`;
      const [shot] =
        await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,ball_speed_mph,source_raw_json) values(${actor.id},${sessionIds[0]},${club.id},'7i',now(),150,110,'{"raw":true}') returning id`;
      const confidence = {
        alignment: "misaligned",
        directionReviews: {
          [shot.id]: { status: "questionable" },
          [crypto.randomUUID()]: { status: "questionable" },
        },
      };
      await db`update fkh_sessions set data_confidence_json=${db.json(confidence)} where id=${sessionIds[0]}`;
      await db`update fkh_sessions set data_confidence_json=${db.json({ alignment: "aligned", directionReviews: { [crypto.randomUUID()]: { status: "questionable" } } })} where id=${sessionIds[1]}`;
      await db`update fkh_sessions set data_confidence_json='{"alignment":"misaligned"}' where id=${sessionIds[2]}`;
      const result = await getDirectionAttention();
      expect(result.totalSessions).toBe(1);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).toMatchObject({
        id: sessionIds[0],
        alignmentNeedsReview: true,
        questionableShots: 1,
        href: `/sessions/${sessionIds[0]}`,
      });
      await db`update fkh_sessions set data_confidence_json=${db.json({ alignment: "aligned", directionReviews: { [shot.id]: { status: "questionable" } } })} where id=${sessionIds[0]}`;
      expect((await getDirectionAttention()).sessions[0]).toMatchObject({
        id: sessionIds[0],
        alignmentNeedsReview: false,
        questionableShots: 1,
      });
      await db`update fkh_sessions set data_confidence_json=${db.json({ alignment: "aligned", directionReviews: { [shot.id]: { status: "confirmed" } } })} where id=${sessionIds[0]}`;
      expect(await getDirectionAttention()).toEqual({ totalSessions: 0, sessions: [] });
      await db`update fkh_sessions set data_confidence_json=${db.json({ alignment: "misaligned", directionReviews: { [shot.id]: { status: "confirmed" } } })} where id=${sessionIds[0]}`;
      expect((await getDirectionAttention()).sessions[0]).toMatchObject({
        alignmentNeedsReview: true,
        questionableShots: 0,
      });
      expect(
        (
          await db`select carry_yd,ball_speed_mph,source_raw_json from fkh_shots where id=${shot.id}`
        )[0],
      ).toMatchObject({ carry_yd: 150, ball_speed_mph: 110, source_raw_json: { raw: true } });
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
