import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { recordCoachReportView } from "@/lib/coach-report-view-history";
import { unlockCoachReportAction } from "@/app/share/report/[token]/actions";
import { hashReportPassword } from "@/lib/coach-report-access";
import { hashShareToken } from "@/lib/share-links";
const cookie = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookie }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || !["localhost", "127.0.0.1"].includes(t.hostname) || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable report database required.");
}
describe.skipIf(!enabled)("shared report view history", () => {
  let sql: ReturnType<typeof postgres>;
  let userId: string;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterEach(async () => {
    await sql`delete from fkh_users where id=${userId}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it("unlocks only an active owned report with the correct password", async () => {
    cookie.set.mockClear();
    userId = (
      await sql`insert into fkh_users(name) values('Synthetic unlock owner') returning id`
    )[0].id;
    const config = { passwordHash: hashReportPassword("synthetic-password") };
    const id = (
      await sql`insert into fkh_content_exports(user_id,source_type,source_id,render_config_json) values(${userId},'coach_report','synthetic',${sql.json(config)}) returning id`
    )[0].id;
    const token = crypto.randomUUID() + crypto.randomUUID();
    const link = (
      await sql`insert into fkh_share_links(user_id,resource_type,resource_id,token_hash) values(${userId},'coach_report',${id},${hashShareToken(token)}) returning id`
    )[0].id;
    async function unlock(password: string) {
      const f = new FormData();
      f.set("password", password);
      return unlockCoachReportAction(token, f).catch((e: { digest: string }) => e.digest);
    }
    expect(await unlock("incorrect")).toContain("error=password");
    expect(cookie.set).not.toHaveBeenCalled();
    expect(await unlock("synthetic-password")).toContain(`/share/report/${token}`);
    expect(cookie.set).toHaveBeenCalledTimes(1);
    expect(cookie.set.mock.calls[0][2]).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: `/share/report/${token}`,
    });
    await sql`update fkh_share_links set expires_at=now()-interval '1 minute' where id=${link}`;
    expect(await unlock("synthetic-password")).toContain("/privacy");
    expect(cookie.set).toHaveBeenCalledTimes(1);
    await sql`update fkh_share_links set expires_at=null,revoked_at=now() where id=${link}`;
    expect(await unlock("synthetic-password")).toContain("/privacy");
    expect(cookie.set).toHaveBeenCalledTimes(1);
    await sql`update fkh_share_links set revoked_at=null where id=${link}`;
    const foreign = (
      await sql`insert into fkh_users(name) values('Synthetic foreign report owner') returning id`
    )[0].id;
    try {
      await sql`update fkh_content_exports set user_id=${foreign} where id=${id}`;
      expect(await unlock("synthetic-password")).toContain("/privacy");
      expect(cookie.set).toHaveBeenCalledTimes(1);
      await sql`update fkh_content_exports set user_id=${userId} where id=${id}`;
    } finally {
      await sql`delete from fkh_users where id=${foreign}`;
    }
    await sql`update fkh_content_exports set status='pending' where id=${id}`;
    expect(await unlock("synthetic-password")).toContain("/privacy");
    expect(cookie.set).toHaveBeenCalledTimes(1);
  });

  it("retains current privacy settings and simultaneous views, bounded to fifty entries", async () => {
    userId = (
      await sql`insert into fkh_users(name) values('Synthetic report owner') returning id`
    )[0].id;
    const id = (
      await sql`insert into fkh_content_exports(user_id,source_type,source_id,render_config_json) values(${userId},'coach_report','synthetic','{"passwordHash":"new:hash","disableDownload":true,"customSetting":"retain"}'::jsonb) returning id`
    )[0].id;
    await Promise.all([recordCoachReportView(id), recordCoachReportView(id)]);
    let config = (await sql`select render_config_json from fkh_content_exports where id=${id}`)[0]
      .render_config_json;
    expect(config).toMatchObject({
      passwordHash: "new:hash",
      disableDownload: true,
      customSetting: "retain",
    });
    expect(config.accessHistory).toHaveLength(2);
    const history = Array.from({ length: 50 }, () => new Date(0).toISOString());
    await sql`update fkh_content_exports set render_config_json=render_config_json || ${sql.json({ accessHistory: history, passwordHash: "rotated:hash" })}::jsonb where id=${id}`;
    await recordCoachReportView(id);
    config = (await sql`select render_config_json from fkh_content_exports where id=${id}`)[0]
      .render_config_json;
    expect(config.passwordHash).toBe("rotated:hash");
    expect(config.accessHistory).toHaveLength(50);
    expect(config.accessHistory[49]).not.toBe(new Date(0).toISOString());
  });
});
