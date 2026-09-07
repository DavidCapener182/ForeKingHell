import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  grantLifetimeFullAccessByEmail,
  grantAdminAccessByEmail,
} from "@/lib/admin";
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
describe.skipIf(!enabled)("admin bound account identity", () => {
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
  it("rejects stale account identity before role, entitlement or audit changes", async () => {
    actor.userId = owner;
    const before = (await sql`select count(*)::int as count from fkh_admin_audit_log where actor_user_id=${owner}`)[0].count;
    await expect(grantAdminAccessByEmail(email, "operator", operator)).rejects.toThrow("This account has changed");
    await expect(grantLifetimeFullAccessByEmail(email, operator)).rejects.toThrow("This account has changed");
    expect((await sql`select role from fkh_admin_users where user_id=${owner}`)[0].role).toBe("owner");
    expect(await sql`select id from fkh_entitlements where user_id=${owner}`).toHaveLength(0);
    expect((await sql`select count(*)::int as count from fkh_admin_audit_log where actor_user_id=${owner}`)[0].count).toBe(before);
    const targetEmail = `bound-${crypto.randomUUID()}@example.invalid`;
    await sql`update fkh_users set email=${targetEmail} where id=${operator}`;
    await grantAdminAccessByEmail(targetEmail, "operator", operator);
    expect((await sql`select role from fkh_admin_users where user_id=${operator}`)[0].role).toBe("operator");
    expect((await sql`select count(*)::int as count from fkh_admin_audit_log where actor_user_id=${owner} and target_user_id=${operator}`)[0].count).toBe(1);
  });

});
