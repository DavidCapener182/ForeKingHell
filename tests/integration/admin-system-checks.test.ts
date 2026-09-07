import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getAdminOperationsSnapshot } from "@/lib/admin";
import { recordAdminSystemSnapshot, getAdminSystemCheckHistory } from "@/lib/admin-system-checks";
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
  it("records exact stored counts with actor and scope, excluding unrelated audit events", async () => {
    const before = await getAdminOperationsSnapshot();
    const result = await recordAdminSystemSnapshot();
    expect(result.operations).toEqual(before);
    const [unrelated] =
      await sql`insert into fkh_admin_audit_log(actor_user_id,action,target_type,target_id) values(${operator},'synthetic_other','user',${owner}) returning id`;
    const history = await getAdminSystemCheckHistory();
    expect(history.some((row) => row.id === unrelated.id)).toBe(false);
    expect(history.find((row) => row.id === result.id)).toMatchObject({
      actorUserId: operator,
      metadataJson: {
        scope: "stored operational records",
        checkedAt: result.checkedAt,
        operations: before,
        liveProvidersChecked: false,
      },
    });
    await sql`update fkh_admin_users set status='inactive' where user_id=${operator}`;
    await expect(recordAdminSystemSnapshot()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    await expect(getAdminSystemCheckHistory()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(
      await sql`select id from fkh_admin_audit_log where actor_user_id=${operator} and action='system_snapshot_checked'`,
    ).toHaveLength(1);
  });
});
