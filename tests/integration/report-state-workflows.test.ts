import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { closeDb } from "@/db/client";
import {
  createCoachReportWithStateAction,
  revokeCoachReportWithStateAction,
} from "@/app/coach/reports/actions";
import { hashShareToken } from "@/lib/share-links";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || t.hostname !== "127.0.0.1" || t.port !== "55432" || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable report database required");
}
describe.skipIf(!enabled)("report state actions", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it.each([false, true])(
    "preserves report outcomes and ownership with refresh failure=%s",
    async (refreshFailure) => {
      const ids = (
        await sql`insert into fkh_users(name) values('Synthetic report owner'),('Synthetic report stranger') returning id`
      ).map((r) => r.id);
      actor.id = ids[0];
      try {
        expect(await createCoachReportWithStateAction(new FormData())).toMatchObject({ ok: false });
        const form = new FormData();
        form.set("requestId", randomUUID());
        form.append("sections", "recent_sessions");
        form.append("sections", "raw_evidence");
        form.set("hideExactShotData", "on");
        form.set("password", "Synthetic password");
        form.set("expiryDays", "7");
        form.set("title", "  My measured review  ");
        if (refreshFailure)
          vi.mocked(revalidatePath).mockImplementation(() => {
            throw new Error("Synthetic report refresh failure");
          });
        const result = await createCoachReportWithStateAction(form);
        expect(result.ok).toBe(true);
        if (!result.ok || !result.shareToken) throw new Error("Missing report token");
        const [link] =
          await sql`select * from fkh_share_links where token_hash=${hashShareToken(result.shareToken)} and user_id=${ids[0]}`;
        const [report] = await sql`select * from fkh_content_exports where id=${link.resource_id}`;
        expect(report.render_config_json.selectedSections).toEqual(["recent_sessions"]);
        expect(report.render_config_json.passwordHash).toBeTruthy();
        expect(report.render_config_json.passwordHash).not.toBe("Synthetic password");
        expect(link.title).toBe("My measured review");
        expect(report.snapshot_json.title).toBe(link.title);
        const retries = await Promise.all([
          createCoachReportWithStateAction(form),
          createCoachReportWithStateAction(form),
        ]);
        for (const retry of retries)
          expect(retry).toEqual({ ok: true, reportId: report.id, recovered: true });
        expect(await sql`select id from fkh_content_exports where user_id=${ids[0]}`).toHaveLength(
          1,
        );
        expect(await sql`select id from fkh_share_links where user_id=${ids[0]}`).toHaveLength(1);
        form.set("password", "Different secret password");
        expect(await createCoachReportWithStateAction(form)).toMatchObject({ ok: false });
        form.set("password", "Synthetic password");
        form.set("title", "Changed scope must not overwrite frozen report");
        expect(await createCoachReportWithStateAction(form)).toMatchObject({ ok: false });
        form.set("title", "  My measured review  ");
        actor.id = ids[1];
        const foreignAttempt = await createCoachReportWithStateAction(form);
        expect(foreignAttempt.ok).toBe(true);
        if (!foreignAttempt.ok) throw new Error("Foreign owner's independent attempt failed");
        expect(foreignAttempt.reportId).not.toBe(report.id);
        actor.id = ids[0];
        const revoke = new FormData();
        revoke.set("shareLinkId", link.id);
        actor.id = ids[1];
        expect(await revokeCoachReportWithStateAction(revoke)).toMatchObject({ ok: false });
        expect(
          (await sql`select revoked_at from fkh_share_links where id=${link.id}`)[0].revoked_at,
        ).toBeNull();
        actor.id = ids[0];
        expect(await revokeCoachReportWithStateAction(revoke)).toEqual({ ok: true });
        expect(
          (await sql`select revoked_at from fkh_share_links where id=${link.id}`)[0].revoked_at,
        ).not.toBeNull();
        expect(await createCoachReportWithStateAction(form)).toEqual({
          ok: true,
          reportId: report.id,
          recovered: true,
        });
        expect(
          (await sql`select revoked_at from fkh_share_links where id=${link.id}`)[0].revoked_at,
        ).not.toBeNull();
      } finally {
        vi.mocked(revalidatePath).mockReset();
        await sql`delete from fkh_users where id in ${sql(ids)}`;
      }
    },
  );
  it("serializes simultaneous first submissions into one frozen report", async () => {
    const [owner] =
      await sql`insert into fkh_users(name) values('Synthetic concurrent report owner') returning id`;
    actor.id = owner.id;
    try {
      const form = new FormData();
      form.set("requestId", randomUUID());
      form.append("sections", "recent_sessions");
      const results = await Promise.all([
        createCoachReportWithStateAction(form),
        createCoachReportWithStateAction(form),
      ]);
      expect(results.every((result) => result.ok)).toBe(true);
      expect(results.filter((result) => result.ok && result.shareToken)).toHaveLength(1);
      expect(results.filter((result) => result.ok && result.recovered)).toHaveLength(1);
      expect(await sql`select id from fkh_content_exports where user_id=${owner.id}`).toHaveLength(
        1,
      );
      expect(await sql`select id from fkh_share_links where user_id=${owner.id}`).toHaveLength(1);
      form.set("requestId", "invalid");
      expect(await createCoachReportWithStateAction(form)).toMatchObject({ ok: false });
    } finally {
      await sql`delete from fkh_users where id=${owner.id}`;
    }
  });
});
