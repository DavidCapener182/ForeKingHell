import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getOptionalCurrentUserId: async () => actor.id,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { ensureSocialProfileForUser, getProfilePageData } from "@/lib/social";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    target?.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable database required");
}
afterAll(closeDb);
it.skipIf(!enabled)(
  "applies private, friends and public round scopes independently of profile access",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name) values('Synthetic scope owner'),('Synthetic scope friend') returning id`
        ).map((row) => row.id),
      );
      const owner = await ensureSocialProfileForUser(users[0]);
      await ensureSocialProfileForUser(users[1]);
      const [club] =
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${users[0]},'7 Iron','synthetic-7i') returning id`;
      await db`insert into fkh_stock_yardages(user_id,club_id,sample_size,carry_median_yd,total_median_yd,confidence_score) values(${users[0]},${club.id},10,150,160,80)`;
      const scorecard = Array.from({ length: 18 }, (_, index) => ({
        holeNumber: index + 1,
        par: 4,
        score: 5,
        yards: 350,
        name: null,
      }));
      for (let index = 0; index < 3; index++)
        await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,scorecard_json) values(${users[0]},'manual','real_round',now(),'synthetic',${db.json(scorecard)})`;
      const [a, b] = [...users].sort();
      await db`insert into fkh_friendships(user_a_id,user_b_id) values(${a},${b})`;
      await db`update fkh_user_profiles set public_profile=true, friend_profile=true, handicap_band='Synthetic private band', visibility_settings_json=${db.json({ rounds: "private", bag: "private", handicap: "private" })} where user_id=${users[0]}`;
      actor.id = users[1];
      expect((await getProfilePageData(owner.username))?.stats.rounds).toBeNull();
      expect((await getProfilePageData(owner.username))?.profile.handicapBand).toBeNull();
      expect((await getProfilePageData(owner.username))?.stats.gapLadder).toEqual([]);
      expect((await getProfilePageData(owner.username))?.stats.handicapEstimate).toBeNull();
      actor.id = users[0];
      expect((await getProfilePageData(owner.username))?.stats.rounds).toBe(3);
      expect((await getProfilePageData(owner.username))?.stats.gapLadder).toEqual([
        expect.objectContaining({ clubId: club.id, carryMedianYd: 150 }),
      ]);
      expect((await getProfilePageData(owner.username))?.stats.handicapEstimate).toBe(18);
      await db`update fkh_user_profiles set visibility_settings_json=${db.json({ rounds: "friends", bag: "friends", handicap: "friends" })} where user_id=${users[0]}`;
      actor.id = users[1];
      expect((await getProfilePageData(owner.username))?.stats.rounds).toBe(3);
      expect((await getProfilePageData(owner.username))?.stats.gapLadder).toHaveLength(1);
      expect((await getProfilePageData(owner.username))?.stats.handicapEstimate).toBe(18);
      actor.id = null;
      expect((await getProfilePageData(owner.username))?.profile.handicapBand).toBeNull();
      expect((await getProfilePageData(owner.username))?.stats.rounds).toBeNull();
      expect((await getProfilePageData(owner.username))?.stats.gapLadder).toEqual([]);
      expect((await getProfilePageData(owner.username))?.stats.handicapEstimate).toBeNull();
      await db`update fkh_user_profiles set visibility_settings_json=${db.json({ rounds: "public", bag: "public", handicap: "public" })} where user_id=${users[0]}`;
      expect((await getProfilePageData(owner.username))?.stats.rounds).toBe(3);
      expect((await getProfilePageData(owner.username))?.stats.gapLadder).toHaveLength(1);
      expect((await getProfilePageData(owner.username))?.stats.handicapEstimate).toBe(18);
    } finally {
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
