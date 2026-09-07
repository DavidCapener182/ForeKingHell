import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getProviderIntegrationsPageData } from "@/lib/provider-integrations";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    target?.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable provider DB required");
}
describe.skipIf(!enabled)("provider history pagination", () => {
  let db: ReturnType<typeof postgres>;
  beforeAll(() => {
    db = postgres(url!, { max: 1 });
  });
  afterAll(async () => {
    await closeDb();
    await db.end();
  });
  it("reaches older records with stable ties, owner isolation and independent latest health", async () => {
    const users =
      await db`insert into fkh_users(name) values('Synthetic paged provider'),('Synthetic foreign provider') returning id`;
    actor.id = users[0].id;
    try {
      for (const user of users) {
        await db`insert into fkh_provider_sessions(user_id,provider_kind,provider_session_id,title,last_seen_at) select ${user.id},'rapsodo','fixture-'||n,'Synthetic record '||n,'2026-09-01'::timestamptz from generate_series(1,31) n`;
        await db`insert into fkh_import_jobs(user_id,provider_kind,status,created_at) select ${user.id},'rapsodo','completed','2026-09-01'::timestamptz from generate_series(1,31)`;
        await db`insert into fkh_import_source_files(user_id,provider_kind,file_name,raw_hash,created_at) select ${user.id},'rapsodo','Synthetic file '||n,lpad(n::text,64,'0'),'2026-09-01'::timestamptz from generate_series(1,31) n`;
      }
      await db`insert into fkh_import_jobs(user_id,provider_kind,status,error_message) values(${actor.id},'rapsodo','failed','Synthetic latest failure')`;
      const first = await getProviderIntegrationsPageData();
      const second = await getProviderIntegrationsPageData({
        sessionsPage: 2,
        jobsPage: 2,
        filesPage: 2,
      });
      for (const kind of ["sessions", "jobs", "files"] as const) {
        expect(first[kind]).toHaveLength(20);
        expect(second[kind]).toHaveLength(kind === "jobs" ? 12 : 11);
        const ids = [...first[kind], ...second[kind]].map((row) => row.id);
        expect(new Set(ids).size).toBe(kind === "jobs" ? 32 : 31);
        expect([...first[kind], ...second[kind]].every((row) => row.userId === actor.id)).toBe(
          true,
        );
        expect(second.pagination[kind].page).toBe(2);
      }
      expect(second.providers).toEqual(first.providers);
      expect(second.latestJobs[0].status).toBe("failed");
      const beyond = await getProviderIntegrationsPageData({
        sessionsPage: Number.MAX_SAFE_INTEGER,
        jobsPage: -2,
        filesPage: NaN,
      });
      expect(beyond.sessions.map((row) => row.id)).toEqual(second.sessions.map((row) => row.id));
      expect(beyond.pagination.jobs.page).toBe(1);
      expect(beyond.pagination.files.page).toBe(1);
    } finally {
      await db`delete from fkh_users where id in ${db(users.map((user) => user.id))}`;
    }
  });
});
