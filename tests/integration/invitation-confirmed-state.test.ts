import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: "", email: "", signedIn: true }));
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: async () => (actor.signedIn ? actor : null),
  requireCurrentUserId: async () => actor.id,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { acceptInvitationFormAction } from "@/app/settings/actions";
import { createInvitationToken, hashInvitationToken } from "@/lib/collaboration";
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
  "confirmed acceptance enforces recipient, expiry and one-time exact membership",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name,email) values('Synthetic invitation owner','state-owner@example.invalid'),('Synthetic invitation member','state-member@example.invalid') returning id`
        ).map((row) => row.id),
      );
      actor.id = users[1];
      actor.email = "wrong@example.invalid";
      actor.signedIn = true;
      const token = createInvitationToken();
      const [invite] =
        await db`insert into fkh_account_invitations(owner_user_id,invited_email,role,token_hash,status,expires_at) values(${users[0]},'state-member@example.invalid','viewer',${hashInvitationToken(token)},'pending',now()+interval '1 day') returning id`;
      const data = new FormData();
      data.set("token", token);
      data.set("role", "editor");
      data.set("ownerUserId", users[1]);
      expect((await acceptInvitationFormAction({ ok: true }, data)).ok).toBe(false);
      actor.email = "state-member@example.invalid";
      actor.signedIn = false;
      expect((await acceptInvitationFormAction({ ok: true }, data)).ok).toBe(false);
      actor.signedIn = true;
      expect((await acceptInvitationFormAction({ ok: true }, new FormData())).ok).toBe(false);
      await db`update fkh_account_invitations set expires_at=now()-interval '1 day' where id=${invite.id}`;
      expect((await acceptInvitationFormAction({ ok: true }, data)).ok).toBe(false);
      await db`update fkh_account_invitations set expires_at=now()+interval '1 day',status='cancelled' where id=${invite.id}`;
      expect((await acceptInvitationFormAction({ ok: true }, data)).ok).toBe(false);
      expect(
        await db`select id from fkh_account_memberships where owner_user_id=${users[0]}`,
      ).toHaveLength(0);
      await db`update fkh_account_invitations set status='pending' where id=${invite.id}`;
      const results = await Promise.all([
        acceptInvitationFormAction({ ok: false }, data),
        acceptInvitationFormAction({ ok: false }, data),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        await db`select owner_user_id,member_user_id,role from fkh_account_memberships where owner_user_id=${users[0]}`,
      ).toEqual([{ owner_user_id: users[0], member_user_id: users[1], role: "viewer" }]);
      await db`delete from fkh_account_memberships where owner_user_id=${users[0]}`;
      expect((await acceptInvitationFormAction({ ok: true }, data)).ok).toBe(false);
      expect(
        await db`select id from fkh_account_memberships where owner_user_id=${users[0]}`,
      ).toHaveLength(0);
    } finally {
      actor.signedIn = true;
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
