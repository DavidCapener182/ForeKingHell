import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getCourseRecordCourseData } from "@/lib/course-records";
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
describe.skipIf(!enabled)("course-specific record proof", () => {
  afterAll(closeDb);
  it("keeps pending attempts separate from verified active leaders", async () => {
    const db = postgres(url!, { max: 1 });
    let owner: string | undefined;
    let courseId: string | undefined;
    try {
      owner = (
        await db`insert into fkh_users(name) values('Synthetic course proof') returning id`
      )[0].id;
      actor.id = owner!;
      await db`insert into fkh_user_profiles(user_id,username,display_name) values(${owner!},${"rec-" + owner!.replaceAll("-", "")},'Synthetic leader')`;
      courseId = (
        await db`insert into fkh_courses(name,created_by_user_id,visibility) values('Synthetic proof course',${owner!},'private') returning id`
      )[0].id;
      const initial = await getCourseRecordCourseData(courseId!);
      const board = initial!.recordCards[0].record;
      const [attempt] =
        await db`insert into fkh_course_record_attempts(record_id,category_id,course_id,user_id,metric_value,metric_label,verification_status) values(${board.id},${board.categoryId},${courseId!},${owner!},72,'72','pending_evidence') returning id`;
      await db`insert into fkh_course_record_results(record_id,user_id,best_attempt_id,rank,metric_value,score_label,verification_status) values(${board.id},${owner!},${attempt.id},1,72,'72','pending_evidence')`;
      const pending = await getCourseRecordCourseData(courseId!);
      expect(pending!.championCard).toBeNull();
      expect(pending!.viewerBest?.id).toBe(attempt.id);
      expect(pending!.recordCards.find((c) => c.record.id === board.id)?.viewerBest).toBeNull();
      await db`update fkh_course_record_results set verification_status='verified' where record_id=${board.id}`;
      expect((await getCourseRecordCourseData(courseId!))!.championCard?.record.id).toBe(board.id);
      await db`update fkh_course_record_results set status='verified' where record_id=${board.id}`;
      expect((await getCourseRecordCourseData(courseId!))!.championCard?.record.id).toBe(board.id);
      await db`update fkh_course_record_results set rank=2 where record_id=${board.id}`;
      expect((await getCourseRecordCourseData(courseId!))!.championCard).toBeNull();
      await db`update fkh_course_record_results set rank=1,status='inactive' where record_id=${board.id}`;
      expect((await getCourseRecordCourseData(courseId!))!.championCard).toBeNull();
      await db`update fkh_course_record_results set status='active' where record_id=${board.id}`;
      await db`update fkh_course_records set status='inactive' where id=${board.id}`;
      const hidden = await getCourseRecordCourseData(courseId!);
      expect(hidden!.recordCards.some((c) => c.record.id === board.id)).toBe(false);
      expect(hidden!.viewerBest?.id).toBe(attempt.id);
    } finally {
      if (courseId) await db`delete from fkh_courses where id=${courseId}`;
      if (owner) await db`delete from fkh_users where id=${owner}`;
      await db.end();
    }
  });
});
