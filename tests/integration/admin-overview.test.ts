import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getAdminOverviewData } from "@/lib/admin";
const actor = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.userId }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Admin tests require disposable local database.");
}
describe.skipIf(!enabled)("admin overview access and stored evidence", () => {
  let sql: ReturnType<typeof postgres>;
  let owner: string;
  let operator: string;
  let email: string;
  let trigger: string;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  beforeEach(async () => {
    trigger = `admin_fixture_${Date.now()}`;
    email = `admin-fixture-${crypto.randomUUID()}@example.invalid`;
    owner = (
      await sql`insert into fkh_users(name,email) values('Disposable owner',${email}) returning id`
    )[0].id;
    operator = (
      await sql`insert into fkh_users(name) values('Disposable operator') returning id`
    )[0].id;
    await sql`insert into fkh_admin_users(user_id,role) values(${owner},'owner'),(${operator},'operator')`;
    actor.userId = operator;
  });
  afterEach(async () => {
    await sql.unsafe(`drop function if exists ${trigger}() cascade`);
    await sql`delete from fkh_admin_audit_log where actor_user_id in ${sql([owner, operator])}`;
    await sql`delete from fkh_moderation_events where actor_user_id in ${sql([owner, operator])}`;
    await sql`delete from fkh_users where id in ${sql([owner, operator])}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it("gates overview reads and preserves stored counts and audit evidence without writes", async () => {
    await sql`update fkh_admin_users set status='inactive' where user_id=${operator}`;
    await expect(getAdminOverviewData()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    await sql`delete from fkh_admin_users where user_id=${operator}`;
    await expect(getAdminOverviewData()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    actor.userId = owner;
    const [audit] =
      await sql`insert into fkh_admin_audit_log(actor_user_id,action,target_type,target_id) values(${owner},'synthetic_overview','user',${operator}) returning id`;
    const totals = async () =>
      (
        await sql`select
      (select count(*)::int from fkh_users) as users,
      (select count(*)::int from fkh_admin_audit_log) as audits,
      (select count(*)::int from fkh_moderation_events where status='open') as moderation,
      (select count(*)::int from fkh_import_jobs where status='failed') as imports,
      (select count(*)::int from fkh_subscriptions where status in ('past_due','unpaid','incomplete_expired')) as billing`
      )[0];
    const before = await totals();
    const result = await getAdminOverviewData();
    expect(result.data.metrics.users).toBe(before.users);
    expect(result.operations.openModerationEvents).toBe(before.moderation);
    expect(result.operations.providerImportFailures).toBe(before.imports);
    expect(result.operations.billingFailures).toBe(before.billing);
    expect(result.data.recentAuditRows.find((row) => row.id === audit.id)).toMatchObject({
      action: "synthetic_overview",
      targetType: "user",
      targetId: operator,
      actorEmail: email,
    });
    expect(await totals()).toEqual(before);
  });
});
