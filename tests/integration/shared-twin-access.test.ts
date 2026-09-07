import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import SharedTwinPage from "@/app/share/course-twin/[token]/page";
import { hashShareToken } from "@/lib/share-links";
import { manifest, replay } from "../fixtures/ui-upgrade/shared-twin-data";
const loaders = vi.hoisted(() => ({ manifest: vi.fn(), replay: vi.fn() }));
vi.mock("@/lib/course-twin-data", () => ({
  getCourseTwinManifest: loaders.manifest,
  getCourseTwinReplay: loaders.replay,
}));
vi.mock("@/app/share/course-twin/[token]/shared-twin-view", () => ({ SharedTwinView: () => null }));
vi.mock("@/lib/admin", () => ({ requireAdminUser: async () => ({}) }));
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = new URL(url!);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}
let sql: ReturnType<typeof postgres>;
beforeAll(() => {
  if (enabled) sql = postgres(url!, { max: 1 });
});
afterAll(async () => {
  if (enabled) {
    await closeDb();
    await sql.end();
  }
});
it.skipIf(!enabled)(
  "gates shared replay tokens before loading owner-scoped course data",
  async () => {
    const owners = (
      await sql`insert into fkh_users(name) values('Synthetic twin owner'),('Synthetic twin foreign') returning id`
    ).map((row) => row.id);
    let course: string | undefined;
    try {
      course = (
        await sql`insert into fkh_courses(name) values('Synthetic shared twin') returning id`
      )[0].id;
      const session = (
        await sql`insert into fkh_sessions(user_id,course_id,source,type,date,raw_csv_text) values(${owners[0]},${course!},'csv','sim_round',now(),'synthetic') returning id`
      )[0].id;
      const token = crypto.randomUUID();
      const link = (
        await sql`insert into fkh_share_links(user_id,token_hash,resource_type,resource_id) values(${owners[0]},${hashShareToken(token)},'course_twin_replay',${session}) returning id`
      )[0].id;
      loaders.manifest.mockResolvedValue(manifest);
      loaders.replay.mockResolvedValue(replay);
      const open = () =>
        SharedTwinPage({
          params: Promise.resolve({ token }),
          searchParams: Promise.resolve({ hole: "1" }),
        });
      expect((await open()).props.initialHoleNumber).toBe(1);
      expect(loaders.manifest).toHaveBeenCalledWith({ userId: owners[0], courseId: course });
      expect(loaders.replay).toHaveBeenCalledWith({
        userId: owners[0],
        courseId: course,
        sessionId: session,
        manifest,
      });
      for (const state of ["revoked", "expired", "foreign", "wrong-type"]) {
        await sql`update fkh_share_links set revoked_at=null,expires_at=null,user_id=${owners[0]},resource_type='course_twin_replay' where id=${link}`;
        if (state === "revoked")
          await sql`update fkh_share_links set revoked_at=now() where id=${link}`;
        if (state === "expired")
          await sql`update fkh_share_links set expires_at=now()-interval '1 second' where id=${link}`;
        if (state === "foreign")
          await sql`update fkh_share_links set user_id=${owners[1]} where id=${link}`;
        if (state === "wrong-type")
          await sql`update fkh_share_links set resource_type='round' where id=${link}`;
        loaders.manifest.mockClear();
        loaders.replay.mockClear();
        await expect(open()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
        expect(loaders.manifest).not.toHaveBeenCalled();
        expect(loaders.replay).not.toHaveBeenCalled();
      }
    } finally {
      await sql`delete from fkh_users where id in ${sql(owners)}`;
      if (course) await sql`delete from fkh_courses where id=${course}`;
    }
  },
);
