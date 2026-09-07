import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { hashShareToken } from "@/lib/share-links";
import { hashReportPassword } from "@/lib/coach-report-access";
import { unlockCoachReportStateAction } from "@/app/share/report/[token]/actions";
const cookie = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookie }));
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
it.skipIf(!enabled)("only grants ready, correctly owned, active report links", async () => {
  const owners = (
    await sql`insert into fkh_users(name) values('Synthetic report owner'),('Synthetic report foreign') returning id`
  ).map((row) => row.id);
  try {
    const config = { passwordHash: hashReportPassword("test-password") };
    const report = (
      await sql`insert into fkh_content_exports(user_id,source_type,source_id,status,render_config_json) values(${owners[0]},'coach_report','synthetic','ready',${sql.json(config)}) returning id`
    )[0].id;
    const token = crypto.randomUUID();
    const link = (
      await sql`insert into fkh_share_links(user_id,resource_type,resource_id,token_hash) values(${owners[0]},'coach_report',${report},${hashShareToken(token)}) returning id`
    )[0].id;
    const form = new FormData();
    form.set("password", "test-password");
    const unlock = () => unlockCoachReportStateAction(token, {}, form);
    await expect(unlock()).rejects.toMatchObject({
      digest: expect.stringContaining(`/share/report/${token};`),
    });
    expect(cookie.set).toHaveBeenCalledOnce();
    for (const state of [
      "revoked",
      "expired",
      "foreign",
      "wrong-type",
      "not-ready",
      "wrong-source",
    ]) {
      await sql`update fkh_share_links set revoked_at=null,expires_at=null,user_id=${owners[0]},resource_type='coach_report' where id=${link}`;
      await sql`update fkh_content_exports set status='ready',source_type='coach_report' where id=${report}`;
      if (state === "revoked")
        await sql`update fkh_share_links set revoked_at=now() where id=${link}`;
      if (state === "expired")
        await sql`update fkh_share_links set expires_at=now()-interval '1 second' where id=${link}`;
      if (state === "foreign")
        await sql`update fkh_share_links set user_id=${owners[1]} where id=${link}`;
      if (state === "wrong-type")
        await sql`update fkh_share_links set resource_type='round' where id=${link}`;
      if (state === "not-ready")
        await sql`update fkh_content_exports set status='pending' where id=${report}`;
      if (state === "wrong-source")
        await sql`update fkh_content_exports set source_type='session' where id=${report}`;
      cookie.set.mockClear();
      await expect(unlock()).rejects.toMatchObject({
        digest: expect.stringContaining("/privacy;"),
      });
      expect(cookie.set).not.toHaveBeenCalled();
    }
  } finally {
    await sql`delete from fkh_users where id in ${sql(owners)}`;
  }
});
