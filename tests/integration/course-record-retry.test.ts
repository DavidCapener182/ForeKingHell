import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { submitCourseRecordAttempt } from "@/lib/course-records";
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
  it("replays one request as one attempt and rejects changed payload reuse", async () => {
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
      actor.id = owner!;
      await db`insert into fkh_user_profiles(user_id,username,display_name) values(${owner!},${owner!.replaceAll("-", "")},'Synthetic retry')`;
      const input = { recordId: board.id, metricValue: 72, requestId: crypto.randomUUID() };
      const settled = await Promise.allSettled([
        submitCourseRecordAttempt(input),
        submitCourseRecordAttempt(input),
      ]);
      const ids = settled.map((result) => {
        if (result.status === "rejected") throw result.reason;
        return result.value;
      });
      expect(ids[0]).toBe(ids[1]);
      expect(
        await db`select id from fkh_course_record_attempts where record_id=${board.id}`,
      ).toHaveLength(1);
      await expect(submitCourseRecordAttempt({ ...input, metricValue: 73 })).rejects.toThrow(
        "different submission",
      );
      const marker = `record_retry_${crypto.randomUUID().replaceAll("-", "")}`;
      const retryInput = { ...input, requestId: crypto.randomUUID() };
      try {
        await db.unsafe(
          `create function ${marker}() returns trigger language plpgsql as $$ begin if new.id='${board.id}'::uuid then raise exception 'Synthetic ranking save failure'; end if; return new; end $$`,
        );
        await db.unsafe(
          `create trigger ${marker} before update on fkh_course_records for each row execute function ${marker}()`,
        );
        await expect(submitCourseRecordAttempt(retryInput)).rejects.toMatchObject({
          cause: { message: "Synthetic ranking save failure" },
        });
        expect(
          await db`select id from fkh_course_record_attempts where record_id=${board.id}`,
        ).toHaveLength(1);
      } finally {
        await db.unsafe(`drop trigger if exists ${marker} on fkh_course_records`);
        await db.unsafe(`drop function if exists ${marker}()`);
      }
      const retryId = await submitCourseRecordAttempt(retryInput);
      expect(retryId).not.toBe(ids[0]);
      expect(
        await db`select id from fkh_course_record_attempts where record_id=${board.id}`,
      ).toHaveLength(2);
    } finally {
      if (courseId) await db`delete from fkh_courses where id=${courseId}`;
      if (owner) await db`delete from fkh_users where id=${owner}`;
      if (foreign) await db`delete from fkh_users where id=${foreign}`;
      await db.end();
    }
  });
});
