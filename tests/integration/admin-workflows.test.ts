import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  grantAdminAccessByEmail,
  deactivateAdminAccess,
  resolveModerationEvent,
  bulkResolveModerationEvents,
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
describe.skipIf(!enabled)("admin role transitions", () => {
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
  it("records authorised role changes and rolls them back if the audit write fails", async () => {
    const targetEmail = `target-${crypto.randomUUID()}@example.invalid`;
    await sql`update fkh_users set email=${targetEmail} where id=${operator}`;
    actor.userId = owner;
    await grantAdminAccessByEmail(targetEmail, "owner");
    expect((await sql`select role from fkh_admin_users where user_id=${operator}`)[0].role).toBe(
      "owner",
    );
    expect(
      (
        await sql`select count(*) from fkh_admin_audit_log where actor_user_id=${owner} and target_user_id=${operator}`
      )[0].count,
    ).toBe("1");
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.actor_user_id='${owner}'::uuid then raise exception 'synthetic audit failure'; end if; return NEW; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_admin_audit_log for each row execute function ${trigger}()`,
    );
    await expect(grantAdminAccessByEmail(targetEmail, "operator")).rejects.toThrow();
    expect((await sql`select role from fkh_admin_users where user_id=${operator}`)[0].role).toBe(
      "owner",
    );
    await sql.unsafe(`drop function ${trigger}() cascade`);
    await deactivateAdminAccess(operator);
    expect(
      (await sql`select status from fkh_admin_users where user_id=${operator}`)[0].status,
    ).toBe("inactive");
    actor.userId = operator;
    await expect(grantAdminAccessByEmail(email, "owner")).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("audits each changed moderation event only once under retries and concurrent bulk resolution", async () => {
    const ids = [];
    for (let i = 0; i < 2; i++)
      ids.push(
        (
          await sql`insert into fkh_moderation_events(target_type,target_id,actor_user_id,event_type,status,reason) values('synthetic',${owner},${operator},'fixture','open','Synthetic moderation') returning id`
        )[0].id,
      );
    await resolveModerationEvent(ids[0]);
    await resolveModerationEvent(ids[0]);
    const results = await Promise.allSettled([
      bulkResolveModerationEvents(ids),
      bulkResolveModerationEvents(ids),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await sql`select count(*) from fkh_admin_audit_log where actor_user_id=${operator} and action='moderation_event_resolved'`
      )[0].count,
    ).toBe("2");
  });

  it("does not create a resolution audit for a nonexistent moderation event", async () => {
    await expect(resolveModerationEvent(crypto.randomUUID())).rejects.toThrow("not found");
    expect(
      (await sql`select count(*) from fkh_admin_audit_log where actor_user_id=${operator}`)[0]
        .count,
    ).toBe("0");
  });

  it("prevents an operator demoting an owner through the grant upsert", async () => {
    await expect(grantAdminAccessByEmail(email, "operator")).rejects.toThrow("Owner access");
    expect((await sql`select role from fkh_admin_users where user_id=${owner}`)[0].role).toBe(
      "owner",
    );
    expect(
      (await sql`select count(*) from fkh_admin_audit_log where actor_user_id=${operator}`)[0]
        .count,
    ).toBe("0");
  });
});
