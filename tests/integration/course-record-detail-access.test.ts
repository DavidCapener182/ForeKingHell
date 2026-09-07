import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getCourseRecordDetailData, submitCourseRecordAttempt } from "@/lib/course-records";
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
describe.skipIf(!enabled)("record detail access", () => {
  afterAll(closeDb);
  it("rejects a foreign private course submission", async () => {
    const db = postgres(url!, { max: 1 });
    let owner: string | undefined;
    let foreign: string | undefined;
    let courseId: string | undefined;
    try {
      owner = (
        await db`insert into fkh_users(name) values('Synthetic private record owner') returning id`
      )[0].id;
      foreign = (
        await db`insert into fkh_users(name) values('Synthetic private record visitor') returning id`
      )[0].id;
      courseId = (
        await db`insert into fkh_courses(name,created_by_user_id,visibility) values('Synthetic private record',${owner!},'private') returning id`
      )[0].id;
      const { ensureCourseRecordBoards } = await import("@/lib/course-records");
      await ensureCourseRecordBoards(courseId!, owner!);
      const [board] =
        await db`select id from fkh_course_records where course_id=${courseId!} and scope='public' limit 1`;
      actor.id = foreign!;
      expect(await getCourseRecordDetailData(board.id)).toBeNull();
      await expect(
        submitCourseRecordAttempt({ recordId: board.id, metricValue: 72 }),
      ).rejects.toThrow("Course record not found");
      expect(
        await db`select id from fkh_course_record_attempts where record_id=${board.id}`,
      ).toHaveLength(0);
    } finally {
      if (courseId) await db`delete from fkh_courses where id=${courseId}`;
      if (owner) await db`delete from fkh_users where id=${owner}`;
      if (foreign) await db`delete from fkh_users where id=${foreign}`;
      await db.end();
    }
  });
});
