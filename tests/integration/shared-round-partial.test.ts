import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import SharedRoundPage from "@/app/share/[token]/page";
import { hashShareToken } from "@/lib/share-links";
vi.mock("@/lib/app-surface-server", () => ({ getRequestAppSurface: async () => "workbench" }));
vi.mock("@/app/share/[token]/shared-round-workbench", () => ({ SharedRoundWorkbench: () => null }));
vi.mock("@/lib/admin", () => ({ requireAdminUser: async () => ({}) }));
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
it.skipIf(!enabled)(
  "does not calculate a handicap differential from an incomplete shared scorecard",
  async () => {
    actor.id = (
      await sql`insert into fkh_users(name) values('Synthetic shared partial round') returning id`
    )[0].id;
    try {
      const card = Array.from({ length: 18 }, (_, i) => ({
        holeNumber: i + 1,
        par: 4,
        score: i === 0 ? 5 : null,
        putts: null,
      }));
      const session = (
        await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,scorecard_json) values(${actor.id},'manual','real_round',now(),'synthetic',${sql.json(card)}) returning id`
      )[0].id;
      const token = crypto.randomUUID();
      await sql`insert into fkh_share_links(user_id,token_hash,resource_type,resource_id) values(${actor.id},${hashShareToken(token)},'round',${session})`;
      const page = await SharedRoundPage({ params: Promise.resolve({ token }) });
      expect(page.props.round.handicapDifferential).toBeNull();
      const complete = card.map((hole) => ({ ...hole, score: 4 }));
      await sql`update fkh_sessions set scorecard_json=${sql.json(complete)} where id=${session}`;
      expect(
        (await SharedRoundPage({ params: Promise.resolve({ token }) })).props.round
          .handicapDifferential,
      ).toBe(0);
      const duplicate = complete.map((hole, index) => ({
        ...hole,
        holeNumber: index === 17 ? 1 : hole.holeNumber,
      }));
      await sql`update fkh_sessions set scorecard_json=${sql.json(duplicate)} where id=${session}`;
      expect(
        (await SharedRoundPage({ params: Promise.resolve({ token }) })).props.round
          .handicapDifferential,
      ).toBeNull();
    } finally {
      await sql`delete from fkh_users where id=${actor.id}`;
    }
  },
);
it.skipIf(!enabled)("rejects expired, revoked and mismatched-owner shared rounds", async () => {
  const owners = (
    await sql`insert into fkh_users(name) values('Synthetic share owner'),('Synthetic share foreign') returning id`
  ).map((row) => row.id);
  try {
    const session = (
      await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${owners[0]},'manual','real_round',now(),'synthetic') returning id`
    )[0].id;
    const token = crypto.randomUUID();
    const link = (
      await sql`insert into fkh_share_links(user_id,token_hash,resource_type,resource_id) values(${owners[0]},${hashShareToken(token)},'round',${session}) returning id`
    )[0].id;
    const open = () => SharedRoundPage({ params: Promise.resolve({ token }) });
    expect((await open()).props.round.session.id).toBe(session);
    await sql`update fkh_share_links set revoked_at=now() where id=${link}`;
    await expect(open()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await sql`update fkh_share_links set revoked_at=null,expires_at=now()-interval '1 second' where id=${link}`;
    await expect(open()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await sql`update fkh_share_links set expires_at=null,user_id=${owners[1]} where id=${link}`;
    await expect(open()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  } finally {
    await sql`delete from fkh_users where id in ${sql(owners)}`;
  }
});
