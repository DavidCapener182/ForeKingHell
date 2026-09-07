import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ generateAiJson: vi.fn(() => { throw new Error("No AI in evidence test"); }) }));
import { getSocialIntelligencePageData } from "@/lib/social-intelligence";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (target?.hostname !== "127.0.0.1" || target.port !== "55432" || target.pathname !== "/fkh_redesign") throw new Error("Disposable database required");
}
afterAll(closeDb);
it.skipIf(!enabled)("resolves historical own evidence while excluding foreign, deleted and malformed references", async () => {
  const db = postgres(url!, { max: 1 }); const users: string[] = [];
  try {
    users.push(...(await db`insert into fkh_users(name) values('Synthetic recap owner'),('Synthetic recap other') returning id`).map(row => row.id));
    actor.id = users[0];
    const [own] = await db`insert into fkh_feed_items(user_id,item_type,headline,proof_url,created_at) values(${users[0]},'session','Original source','/sessions/source',now()-interval '1 year') returning id`;
    const [foreign] = await db`insert into fkh_feed_items(user_id,item_type,headline) values(${users[1]},'session','Foreign source') returning id`;
    for (let i=0;i<13;i++) await db`insert into fkh_feed_items(user_id,item_type,headline) values(${users[0]},'status_update','Newer source')`;
    await db`insert into fkh_ai_social_summaries(user_id,summary_type,headline,body,evidence_json) values(${users[0]},'import_recap','Saved recap','Synthetic',${db.json({feedItemIds:[own.id, own.id, foreign.id,'00000000-0000-0000-0000-000000000000','bad-id',null,7]})})`;
    const page = await getSocialIntelligencePageData();
    expect(page.recentFeed.map(item => item.id)).not.toContain(own.id);
    expect(Object.keys(page.evidenceFeedById)).toEqual([own.id]);
    expect(page.evidenceFeedById[own.id]).toMatchObject({headline:'Original source',proofUrl:'/sessions/source'});
    await db`delete from fkh_feed_items where id=${own.id}`;
    expect((await getSocialIntelligencePageData()).evidenceFeedById).toEqual({});
  } finally {
    if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
    await db.end();
  }
});
