import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  createGroup,
  getGroupDetailData,
  joinGroup,
  leaveGroup,
  deleteGroup,
  createGroupPost,
  respondToGroupInvite,
} from "@/lib/groups";
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
describe.skipIf(!enabled)("group membership workflows", () => {
  afterAll(closeDb);
  it("enforces private membership, invitation recipient and owner deletion", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      for (const name of [
        "Synthetic group owner",
        "Synthetic invited member",
        "Synthetic stranger",
      ])
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      actor.id = owners[0];
      const group = await createGroup({
        name: `Isolated ${crypto.randomUUID()}`,
        groupType: "friends",
        visibility: "private",
      });
      await expect(leaveGroup(group.id)).rejects.toThrow("group owner");
      const invite = (
        await db`insert into fkh_group_invites(group_id,inviter_user_id,invitee_user_id) values(${group.id},${owners[0]},${owners[1]}) returning id`
      )[0].id;
      actor.id = owners[2];
      await expect(joinGroup(group.id)).rejects.toThrow("invite link");
      await expect(respondToGroupInvite(invite, "accepted")).rejects.toThrow("not found");
      await expect(
        createGroupPost(group.id, null, "Synthetic unauthorized post"),
      ).rejects.toThrow();
      await expect(deleteGroup(group.id)).rejects.toThrow("owner");
      actor.id = owners[1];
      expect(await respondToGroupInvite(invite, "accepted")).toBe(group.slug);
      await expect(respondToGroupInvite(invite, "accepted")).rejects.toThrow("not found");
      await createGroupPost(group.id, "Synthetic note", "Disposable member post");
      expect(await db`select id from fkh_group_posts where group_id=${group.id}`).toHaveLength(1);
      await leaveGroup(group.id);
      await expect(createGroupPost(group.id, null, "After leaving")).rejects.toThrow();
      expect(await db`select id from fkh_group_posts where group_id=${group.id}`).toHaveLength(1);
      actor.id = owners[0];
      await deleteGroup(group.id);
      expect(
        await db`select id from fkh_group_memberships where group_id=${group.id}`,
      ).toHaveLength(0);
      expect(await db`select id from fkh_group_posts where group_id=${group.id}`).toHaveLength(0);
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
  it("rolls invitation acceptance back when its status cannot be saved", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    const marker = `group_failure_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      for (const name of ["Synthetic rollback owner", "Synthetic rollback member"])
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      actor.id = owners[0];
      const group = await createGroup({
        name: `Rollback ${crypto.randomUUID()}`,
        groupType: "friends",
        visibility: "private",
      });
      const invite = (
        await db`insert into fkh_group_invites(group_id,inviter_user_id,invitee_user_id) values(${group.id},${owners[0]},${owners[1]}) returning id`
      )[0].id;
      await db.unsafe(
        `create function ${marker}() returns trigger language plpgsql as $$ begin if NEW.id = '${invite}'::uuid then raise exception 'Synthetic invitation save failure'; end if; return NEW; end $$`,
      );
      await db.unsafe(
        `create trigger ${marker} before update on fkh_group_invites for each row execute function ${marker}()`,
      );
      actor.id = owners[1];
      await expect(respondToGroupInvite(invite, "accepted")).rejects.toThrow();
      expect(
        await db`select id from fkh_group_memberships where group_id=${group.id} and user_id=${actor.id}`,
      ).toHaveLength(0);
      expect((await db`select status from fkh_group_invites where id=${invite}`)[0].status).toBe(
        "pending",
      );
      await db.unsafe(`drop trigger ${marker} on fkh_group_invites`);
      const results = await Promise.allSettled([
        respondToGroupInvite(invite, "accepted"),
        respondToGroupInvite(invite, "declined"),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const status = (await db`select status from fkh_group_invites where id=${invite}`)[0].status;
      expect(
        await db`select id from fkh_group_memberships where group_id=${group.id} and user_id=${actor.id}`,
      ).toHaveLength(status === "accepted" ? 1 : 0);
    } finally {
      await db.unsafe(`drop trigger if exists ${marker} on fkh_group_invites`);
      await db.unsafe(`drop function if exists ${marker}()`);
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
  it("rolls group creation back on feed failure and retries without duplicates", async () => {
    const db = postgres(url!, { max: 1 });
    const marker = `group_feed_${crypto.randomUUID().replaceAll("-", "")}`;
    let owner: string | undefined;
    try {
      owner = (
        await db`insert into fkh_users(name) values('Synthetic group feed rollback') returning id`
      )[0].id;
      actor.id = owner!;
      await db.unsafe(
        `create function ${marker}() returns trigger language plpgsql as $$ begin if NEW.user_id = '${owner}'::uuid and NEW.item_type = 'group_created' then raise exception 'Synthetic group feed failure'; end if; return NEW; end $$`,
      );
      await db.unsafe(
        `create trigger ${marker} before insert on fkh_feed_items for each row execute function ${marker}()`,
      );
      const input = {
        name: `Feed rollback ${crypto.randomUUID()}`,
        groupType: "friends" as const,
        visibility: "private" as const,
      };
      await expect(createGroup(input)).rejects.toThrow();
      expect(await db`select id from fkh_groups where owner_user_id=${owner!}`).toHaveLength(0);
      expect(await db`select id from fkh_group_memberships where user_id=${owner!}`).toHaveLength(
        0,
      );
      await db.unsafe(`drop trigger ${marker} on fkh_feed_items`);
      const saved = await createGroup(input);
      expect(await db`select id from fkh_groups where owner_user_id=${owner!}`).toHaveLength(1);
      expect(
        await db`select id from fkh_group_memberships where group_id=${saved.id} and user_id=${owner!}`,
      ).toHaveLength(1);
      expect(
        await db`select id from fkh_feed_items where user_id=${owner!} and item_type='group_created'`,
      ).toHaveLength(1);
    } finally {
      await db.unsafe(`drop trigger if exists ${marker} on fkh_feed_items`);
      await db.unsafe(`drop function if exists ${marker}()`);
      if (owner) await db`delete from fkh_users where id=${owner}`;
      await db.end();
    }
  });
  it("reports the viewer role independently from other group members", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      for (const name of [
        "Synthetic role owner",
        "Synthetic role member",
        "Synthetic role visitor",
      ])
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      actor.id = owners[0];
      const group = await createGroup({
        name: `Role ${crypto.randomUUID()}`,
        groupType: "friends",
        visibility: "public",
      });
      actor.id = owners[1];
      await joinGroup(group.id);
      for (const [id, role, canPost, canAdmin] of [
        [owners[2], null, false, false],
        [owners[0], "admin", true, true],
        [owners[1], "member", true, false],
      ] as const) {
        actor.id = id;
        const view = await getGroupDetailData(group.slug);
        expect(view?.group.viewerRole).toBe(role);
        expect(Number(view?.group.memberCount)).toBe(2);
        expect(view?.members).toHaveLength(2);
        expect(view?.canPost).toBe(canPost);
        expect(view?.canAdmin).toBe(canAdmin);
      }
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
