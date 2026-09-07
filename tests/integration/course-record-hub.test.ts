import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getCourseRecordsHubData } from "@/lib/course-records";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    target?.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}
describe.skipIf(!enabled)("course record hub facts", () => {
  afterAll(closeDb);
  it("counts submissions rather than boards and exposes only verified featured leaders", async () => {
    const db = postgres(url!, { max: 1 });
    let owner: string | undefined;
    let courseId: string | undefined;
    try {
      owner = (
        await db`insert into fkh_users(name) values('Synthetic record owner') returning id`
      )[0].id;
      actor.id = owner!;
      await db`insert into fkh_user_profiles(user_id,username,display_name) values(${owner!},${"rec-" + owner!.replaceAll("-", "")},'Synthetic leader')`;
      courseId = (
        await db`insert into fkh_courses(name,created_by_user_id,visibility) values(${"000 Synthetic records " + owner},${owner!},'private') returning id`
      )[0].id;
      const initial = (await getCourseRecordsHubData()).courses.find((c) => c.id === courseId)!;
      expect(initial.recordCount).toBeGreaterThan(0);
      expect(initial.liveAttemptCount).toBe(0);
      const [board] =
        await db`select * from fkh_course_records where course_id=${courseId!} and period='all_time' order by record_type limit 1`;
      const attempts =
        await db`insert into fkh_course_record_attempts(record_id,category_id,course_id,user_id,metric_value,metric_label,verification_status,proof_status) values(${board.id},${board.category_id},${courseId!},${owner!},72,'72','verified','verified'),(${board.id},${board.category_id},${courseId!},${owner!},70,'70','pending_evidence','pending_evidence') returning id`;
      await db`insert into fkh_course_record_results(record_id,user_id,best_attempt_id,rank,metric_value,score_label,verification_status) values(${board.id},${owner!},${attempts[0].id},1,72,'72','pending_evidence')`;
      const pending = (await getCourseRecordsHubData()).courses.find((c) => c.id === courseId)!;
      expect(pending.liveAttemptCount).toBe(2);
      expect(pending.champion).toBeNull();
      await db`update fkh_course_record_results set verification_status='verified' where record_id=${board.id}`;
      const verified = (await getCourseRecordsHubData()).courses.find((c) => c.id === courseId)!;
      expect(verified.champion).toMatchObject({
        recordId: board.id,
        recordType: board.record_type,
        categoryId: board.category_id,
        period: "all_time",
        verificationStatus: "verified",
        proofStatus: "verified",
      });
      await db`update fkh_course_records set period='month', period_start='2026-09-01T00:00:00Z', period_end='2026-10-01T00:00:00Z', best_result_id=(select id from fkh_course_record_results where record_id=${board.id} limit 1) where id=${board.id}`;
      expect(
        (await getCourseRecordsHubData()).courses.find((c) => c.id === courseId)?.champion,
      ).toMatchObject({
        recordId: board.id,
        period: "month",
        periodStart: new Date("2026-09-01T00:00:00Z"),
        periodEnd: new Date("2026-10-01T00:00:00Z"),
      });
      await db`update fkh_course_record_results set status='inactive' where record_id=${board.id}`;
      expect(
        (await getCourseRecordsHubData()).courses.find((c) => c.id === courseId)?.champion,
      ).toBeNull();
    } finally {
      if (courseId) await db`delete from fkh_courses where id=${courseId}`;
      if (owner) await db`delete from fkh_users where id=${owner}`;
      await db.end();
    }
  });
});
