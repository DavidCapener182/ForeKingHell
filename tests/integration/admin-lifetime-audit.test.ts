import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  grantLifetimeFullAccessByEmail,
  getAdminBillingData,
  resolveAdminGrantTarget,
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
describe.skipIf(!enabled)("admin lifetime grant audit", () => {
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
  it("rolls back a failed grant audit and exposes only recorded lifetime grants", async () => {
    const targetEmail=`lifetime-${crypto.randomUUID()}@example.invalid`;
    await sql`update fkh_users set email=${targetEmail} where id=${operator}`;
    await expect(grantLifetimeFullAccessByEmail(targetEmail,operator)).rejects.toThrow("Owner access");
    await expect(resolveAdminGrantTarget(targetEmail)).rejects.toThrow("Owner access");
    actor.userId=owner;
    const resolved = await resolveAdminGrantTarget(`  ${targetEmail.toUpperCase()}  `);
    expect(resolved).toEqual({id:operator,displayName:'Disposable operator',email:targetEmail});
    expect(await sql`select id from fkh_entitlements where user_id=${operator}`).toHaveLength(0);
    expect(await sql`select id from fkh_billing_customers where user_id=${operator}`).toHaveLength(0);

    await sql.unsafe(`create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.actor_user_id='${owner}'::uuid then raise exception 'synthetic audit failure'; end if; return NEW; end $$`);
    await sql.unsafe(`create trigger ${trigger} before insert on fkh_admin_audit_log for each row execute function ${trigger}()`);
    await expect(grantLifetimeFullAccessByEmail(targetEmail,operator)).rejects.toThrow();
    expect(await sql`select id from fkh_entitlements where user_id=${operator}`).toHaveLength(0);
    expect(await sql`select id from fkh_subscriptions where user_id=${operator}`).toHaveLength(0);
    expect(await sql`select id from fkh_billing_customers where user_id=${operator}`).toHaveLength(0);
    await sql.unsafe(`drop function ${trigger}() cascade`);
    await grantLifetimeFullAccessByEmail(targetEmail,operator);
    const [unrelated]=await sql`insert into fkh_admin_audit_log(actor_user_id,action,target_type,target_id) values(${owner},'moderation_event_resolved','moderation_event',${operator}) returning id`;
    const data=await getAdminBillingData();
    const own=data.auditRows.filter(row=>row.actorUserId===owner);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({action:'lifetime_full_granted',targetUserId:operator,targetId:operator,actorEmail:email});
    expect(data.auditRows.some(row=>row.id===unrelated.id)).toBe(false);
    const entitlements=await sql`select id from fkh_entitlements where user_id=${operator}`;
    expect(own[0].metadataJson.entitlementCount).toBe(entitlements.length);
    expect(data.entitlements.some(row=>row.userId===operator && row.entitlementKey==='lifetime_full' && row.valueJson.value===true)).toBe(true);
  });
});
