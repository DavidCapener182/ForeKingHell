import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getCurrentUser: async () => (actor.id ? { id: actor.id } : null),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { GET, POST } from "@/app/api/course-twins/[courseId]/round-plan/route";
import { closeDb } from "@/db/client";
const enabled = process.env.RUN_PRO_FEATURE_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = new URL(url!);
  const local =
    target.hostname === "127.0.0.1" &&
    target.port === "55437" &&
    target.pathname === "/fkh_features";
  const ci =
    process.env.GITHUB_ACTIONS === "true" &&
    ["localhost", "127.0.0.1"].includes(target.hostname) &&
    target.port === "5432" &&
    target.pathname === "/forekinghell";
  if (!local && !ci) throw new Error("Disposable feature database required");
}
afterAll(async () => {
  if (enabled) await closeDb();
});
describe.skipIf(!enabled)("Owned round plan API against actual database", () => {
  it("saves append history, reloads the latest owner snapshot, rejects another owner and rechecks access after expiry", async () => {
    const db = postgres(url!, { max: 1 });
    const owner = randomUUID(),
      other = randomUUID(),
      club = randomUUID(),
      session = randomUUID();
    const courseId = "486ddef6-5963-41d7-b2e6-82cec6732170";
    const context = { params: Promise.resolve({ courseId }) };
    const request = (intent = "normal") =>
      new Request("https://example.invalid/round-plan", {
        method: "POST",
        body: JSON.stringify({ intent }),
      });
    let courseCreated = false;
    try {
      for (const id of [owner, other]) {
        await db`insert into fkh_users(id,name) values(${id},'Synthetic round plan actor')`;
        await db`insert into fkh_subscriptions(user_id,plan_key,status,current_period_end) values(${id},'pro','trialing',now()+interval '7 days')`;
      }
      const inserted =
        await db`insert into fkh_courses(id,name,visibility,created_by_user_id) values(${courseId},'Synthetic private mapped course','private',${owner}) on conflict do nothing returning id`;
      courseCreated = inserted.length > 0;
      if (!courseCreated) throw new Error("Designated fixture course must be unused");
      await db`insert into fkh_clubs(id,user_id,type,normalized_club_key) values(${club},${owner},'7i',${randomUUID()})`;
      await db`insert into fkh_sessions(id,user_id,source,type,date,raw_csv_text) values(${session},${owner},'rapsodo','range',now(),'synthetic')`;
      for (let i = 0; i < 10; i++)
        await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,carry_yd,total_yd,side_carry_yd,ball_speed_mph,quality_tag,review_status,source_raw_json) values(${owner},${session},${club},'7i',now(),${i + 1},${150 + (i % 3)},${160 + (i % 3)},${i % 2 ? -3 : 4},110,'stock_quality','included','{}')`;
      actor.id = owner;
      expect((await GET(request(), context)).status).toBe(200);
      expect(await (await GET(request(), context)).json()).toEqual({ plan: null });
      const first = await POST(request(), context);
      expect(first.status).toBe(200);
      const firstPlan = (await first.json()).plan;
      const second = await POST(request("safe"), context);
      expect(second.status).toBe(200);
      const secondPlan = (await second.json()).plan;
      expect(firstPlan.holesJson).toHaveLength(18);
      expect(firstPlan.holesJson[0].clubId).toBe(club);
      expect(secondPlan.id).not.toBe(firstPlan.id);
      expect((await (await GET(request(), context)).json()).plan.id).toBe(secondPlan.id);
      actor.id = other;
      expect((await GET(request(), context)).status).toBe(404);
      expect((await POST(request(), context)).status).toBe(404);
      await db`update fkh_courses set visibility='shared' where id=${courseId}`;
      expect(await (await GET(request(), context)).json()).toEqual({ plan: null });
      expect((await POST(request(), context)).status).toBe(422);
      actor.id = owner;
      await db`update fkh_subscriptions set current_period_end=now()-interval '1 minute' where user_id=${owner}`;
      expect((await GET(request(), context)).status).toBe(403);
      expect((await POST(request(), context)).status).toBe(403);
      const [history] =
        await db`select count(*)::int total from fkh_course_twin_round_plans where user_id=${owner} and course_id=${courseId}`;
      expect(history.total).toBe(2);
    } finally {
      if (courseCreated) await db`delete from fkh_courses where id=${courseId}`;
      await db`delete from fkh_users where id in (${owner},${other})`;
      await db.end();
    }
  });
});
