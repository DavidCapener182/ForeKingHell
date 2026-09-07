import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  ensureSocialProfileForUser,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  followUser,
  blockUser,
  unblockUser,
} from "@/lib/social";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}
describe.skipIf(!enabled)("friendship and blocking workflows", () => {
  afterAll(closeDb);
  it.each(["accept", "block"])(
    "does not retain a friendship when %s starts first",
    async (first) => {
      const db = postgres(url!, { max: 1 });
      const gate = postgres(url!, { max: 1 });
      const owners: string[] = [];
      const pending: Promise<unknown>[] = [];
      let gateOpen = false;
      const waitForBlockedQuery = async (prefix: string) => {
        await vi.waitFor(
          async () => {
            const rows =
              await db`select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like ${prefix + "%"}`;
            expect(rows.length).toBeGreaterThan(0);
          },
          { timeout: 5000, interval: 20 },
        );
      };
      try {
        for (const name of ["Synthetic concurrent requester", "Synthetic concurrent recipient"]) {
          const id = (await db`insert into fkh_users(name) values(${name}) returning id`)[0].id;
          owners.push(id);
          await ensureSocialProfileForUser(id);
        }
        actor.id = owners[0];
        await sendFriendRequest(owners[1], null);
        const request = (
          await db`select id from fkh_friend_requests where requester_user_id=${owners[0]} and recipient_user_id=${owners[1]}`
        )[0].id;
        await gate`begin`;
        gateOpen = true;
        await gate`select id from fkh_friend_requests where id=${request} for update`;
        actor.id = owners[1];
        const accept = () => acceptFriendRequest(request).catch((error) => error);
        const block = () => blockUser(owners[0]).catch((error) => error);
        pending.push(first === "accept" ? accept() : block());
        await waitForBlockedQuery(
          first === "accept" ? 'update "fkh_friend_requests"' : 'delete from "fkh_friend_requests"',
        );
        pending.push(first === "accept" ? block() : accept());
        await waitForBlockedQuery(
          first === "accept" ? 'delete from "fkh_friend_requests"' : 'update "fkh_friend_requests"',
        );
        await gate`commit`;
        gateOpen = false;
        const outcomes = await Promise.all(pending);
        if (first === "accept") expect(outcomes).toEqual([undefined, undefined]);
        else {
          expect(outcomes[0]).toBeUndefined();
          expect(outcomes[1]).toBeInstanceOf(Error);
          expect((outcomes[1] as Error).message).toBe("Friend request not found.");
        }
        const [a, b] = [...owners].sort();
        expect(
          await db`select id from fkh_user_blocks where blocker_user_id=${owners[1]} and blocked_user_id=${owners[0]}`,
        ).toHaveLength(1);
        expect(
          await db`select id from fkh_friendships where user_a_id=${a} and user_b_id=${b}`,
        ).toHaveLength(0);
      } finally {
        if (gateOpen) await gate`rollback`;
        await Promise.all(pending);
        if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
        await Promise.all([db.end(), gate.end()]);
      }
    },
  );
  it("limits acceptance to its recipient and blocking removes relationships in both directions", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      for (const name of ["Synthetic friend A", "Synthetic friend B", "Synthetic stranger"]) {
        const id = (await db`insert into fkh_users(name) values(${name}) returning id`)[0].id;
        owners.push(id);
        await ensureSocialProfileForUser(id);
        await db`update fkh_user_profiles set public_profile=true where user_id=${id}`;
      }
      actor.id = owners[0];
      await sendFriendRequest(owners[1], null);
      await sendFriendRequest(owners[1], null);
      const requests =
        await db`select id from fkh_friend_requests where requester_user_id=${owners[0]} and recipient_user_id=${owners[1]}`;
      expect(requests).toHaveLength(1);
      actor.id = owners[2];
      await expect(acceptFriendRequest(requests[0].id)).rejects.toThrow("not found");
      actor.id = owners[1];
      await acceptFriendRequest(requests[0].id);
      const [a, b] = [owners[0], owners[1]].sort();
      expect(
        await db`select id from fkh_friendships where user_a_id=${a} and user_b_id=${b}`,
      ).toHaveLength(1);
      await declineFriendRequest(requests[0].id).catch(() => undefined);
      actor.id = owners[0];
      await cancelFriendRequest(requests[0].id).catch(() => undefined);
      expect(
        (await db`select status from fkh_friend_requests where id=${requests[0].id}`)[0].status,
      ).toBe("accepted");
      actor.id = owners[1];
      await followUser(owners[0]);
      actor.id = owners[0];
      await followUser(owners[1]);
      const triggerName = `social_block_${owners[0].replaceAll("-", "")}`;
      try {
        await db.unsafe(
          `create function ${triggerName}() returns trigger language plpgsql as $$ begin if old.requester_user_id = '${owners[0]}'::uuid then raise exception 'Synthetic block failure'; end if; return old; end $$`,
        );
        await db.unsafe(
          `create trigger ${triggerName} before delete on fkh_friend_requests for each row execute function ${triggerName}()`,
        );
        await expect(blockUser(owners[1])).rejects.toThrow();
        expect(
          await db`select id from fkh_friendships where user_a_id=${a} and user_b_id=${b}`,
        ).toHaveLength(1);
        expect(
          await db`select id from fkh_user_blocks where blocker_user_id=${owners[0]} and blocked_user_id=${owners[1]}`,
        ).toHaveLength(0);
        expect(
          await db`select id from fkh_user_follows where follower_user_id in ${db([a, b])} and followed_user_id in ${db([a, b])}`,
        ).toHaveLength(2);
      } finally {
        await db.unsafe(`drop trigger if exists ${triggerName} on fkh_friend_requests`);
        await db.unsafe(`drop function if exists ${triggerName}()`);
      }
      await blockUser(owners[1]);
      expect(
        await db`select id from fkh_friendships where user_a_id=${a} and user_b_id=${b}`,
      ).toHaveLength(0);
      expect(
        await db`select id from fkh_user_follows where follower_user_id in ${db([a, b])} and followed_user_id in ${db([a, b])}`,
      ).toHaveLength(0);
      await expect(sendFriendRequest(owners[1], null)).rejects.toThrow();
      actor.id = owners[1];
      await expect(sendFriendRequest(owners[0], null)).rejects.toThrow();
      await expect(followUser(owners[0])).rejects.toThrow();
      actor.id = owners[0];
      await unblockUser(owners[1]);
      expect(
        await db`select id from fkh_friendships where user_a_id=${a} and user_b_id=${b}`,
      ).toHaveLength(0);
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
