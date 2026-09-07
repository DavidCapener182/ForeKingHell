import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { getActivationJourney } from "@/lib/activation-journey";
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
it.skipIf(!enabled)("does not call measurement-empty shot rows a usable club signal", async () => {
  actor.id = (
    await sql`insert into fkh_users(name) values('Synthetic activation evidence') returning id`
  )[0].id;
  try {
    const session = (
      await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'csv','range',now(),'synthetic') returning id`
    )[0].id;
    const club = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key,active) values(${actor.id},'7i','activation-empty',true) returning id`
    )[0].id;
    await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,review_status,source_raw_json) select ${actor.id}::uuid,${session}::uuid,${club}::uuid,'7i',now(),'included','{}'::jsonb from generate_series(1,12)`;
    const result = await getActivationJourney(actor.id);
    expect(result.steps.find((step) => step.id === "trust")?.complete).toBe(false);
    expect(result.firstTrustedResult).toBeNull();
    await sql`update fkh_shots set ball_speed_mph=100 where user_id=${actor.id}`;
    const measured = await getActivationJourney(actor.id);
    expect(measured.steps.find((step) => step.id === "trust")?.complete).toBe(true);
    expect(measured.firstTrustedResult).toContain("12 usable measured shots");
    await sql`update fkh_clubs set active=false where id=${club}`;
    const inactive = await getActivationJourney(actor.id);
    expect(inactive.steps.find((step) => step.id === "trust")?.complete).toBe(false);
    // An unrelated active club must not make the inactive club's evidence usable.
    await sql`insert into fkh_clubs(user_id,type,normalized_club_key,active) values(${actor.id},'Driver','activation-unrelated',true)`;
    const unrelated = await getActivationJourney(actor.id);
    expect(unrelated.steps.find((step) => step.id === "trust")?.complete).toBe(false);
    expect(unrelated.firstTrustedResult).toBeNull();
  } finally {
    await sql`delete from fkh_users where id=${actor.id}`;
  }
});
