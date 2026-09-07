import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  bulkResolveSocialReports,
  getAdminModerationData,
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
describe.skipIf(!enabled)("moderation partial bulk results", () => {
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
  it("reports only changed records under overlapping bulk requests and preserves exact audit history", async () => {
    const ids: string[] = [];
    for (let i=0;i<4;i++) ids.push((await sql`insert into fkh_moderation_events(target_type,target_id,actor_user_id,event_type,status,reason) values('synthetic',${owner},${operator},'fixture','open','Synthetic partial bulk') returning id`)[0].id);
    await resolveModerationEvent(ids[3]);
    const results = await Promise.all([
      bulkResolveModerationEvents([ids[0],ids[1],ids[3],crypto.randomUUID()]),
      bulkResolveModerationEvents([ids[1],ids[2],ids[3]]),
    ]);
    expect(results.reduce((sum,count)=>sum+count,0)).toBe(3);
    expect(results.every(count=>count>=1 && count<=2)).toBe(true);
    const audits = await sql`select target_id,metadata_json from fkh_admin_audit_log where actor_user_id=${operator} and action='moderation_event_resolved'`;
    expect(audits).toHaveLength(4);
    const [unrelated] = await sql`insert into fkh_admin_audit_log(actor_user_id,action,target_type,target_id) values(${operator},'admin_access_granted','user',${owner}) returning id`;
    const page = await getAdminModerationData();
    expect(page.auditRows.some(row=>row.id===unrelated.id)).toBe(false);
    const ownAudit = page.auditRows.filter(row=>row.actorUserId===operator);
    expect(ownAudit).toHaveLength(4);
    expect(ownAudit.every(row=>row.action==='moderation_event_resolved' && row.targetType==='moderation_event')).toBe(true);
    expect(new Set(ownAudit.map(row=>row.targetId))).toEqual(new Set(ids));
    expect(ownAudit.every(row=>row.createdAt instanceof Date)).toBe(true);
    expect(ownAudit.every(row=>row.metadataJson.outcome===undefined)).toBe(true);

    expect(new Set(audits.map(row=>row.target_id))).toEqual(new Set(ids));
    expect((await sql`select count(*)::int as count from fkh_moderation_events where id in ${sql(ids)} and status='resolved'`)[0].count).toBe(4);
    await expect(bulkResolveModerationEvents(ids)).rejects.toThrow("No selected open");
    expect(await sql`select id from fkh_admin_audit_log where actor_user_id=${operator} and action='moderation_event_resolved'`).toHaveLength(4);
  });
  it("keeps report resolution separate from detected events and reports a partial count", async () => {
    const reports = await sql`insert into fkh_social_reports(reporter_user_id,target_type,target_id,reason,status) values(${operator},'synthetic',${owner},'Synthetic open','open'),(${operator},'synthetic',${owner},'Synthetic resolved','resolved') returning id,status`;
    const count = await bulkResolveSocialReports([...reports.map(row=>row.id),crypto.randomUUID()]);
    expect(count).toBe(1);
    const page = await getAdminModerationData();
    const audits = page.auditRows.filter(row=>row.actorUserId===operator);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({action:'social_report_resolved',targetType:'social_report',targetId:reports.find(row=>row.status==='open')!.id,metadataJson:{bulkCount:1}});
  });
});
