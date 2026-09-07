import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  createInvitationAction,
  acceptInvitationAction,
  cancelInvitationAction,
  removeMembershipAction,
} from "@/app/settings/actions";
import { requireReadableAccountUserId } from "@/lib/account-access";
const actor = vi.hoisted(() => ({ id: "", email: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getCurrentUser: async () => actor,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || !["localhost", "127.0.0.1"].includes(t.hostname) || t.pathname !== "/fkh_redesign")
    throw new Error("Sharing tests require disposable local database.");
}
describe.skipIf(!enabled)("account sharing actions", () => {
  let sql: ReturnType<typeof postgres>;
  let owner: { id: string; email: string };
  let member: { id: string; email: string };
  let stranger: { id: string; email: string };
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  beforeEach(async () => {
    const rows = [];
    for (const name of ["Owner", "Member", "Stranger"])
      rows.push(
        (
          await sql`insert into fkh_users(name,email) values(${name},${`${crypto.randomUUID()}@example.invalid`}) returning id,email`
        )[0],
      );
    [owner, member, stranger] = rows as (typeof owner)[];
    Object.assign(actor, owner);
  });
  afterEach(async () => {
    await sql`delete from fkh_users where id in ${sql([owner.id, member.id, stranger.id])}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  function form(values: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(values)) f.set(k, v);
    return f;
  }
  async function redirected(p: Promise<unknown>) {
    const e = (await p.catch((e: unknown) => e)) as { digest: string };
    expect(e.digest).toContain("NEXT_REDIRECT");
    return e.digest as string;
  }
  async function invite() {
    Object.assign(actor, owner);
    const digest = await redirected(
      createInvitationAction(form({ invitedEmail: member.email, role: "viewer" })),
    );
    const token = new URL(digest.split(";")[2], "http://localhost").searchParams.get("invite")!;
    const [row] =
      await sql`select id,status from fkh_account_invitations where owner_user_id=${owner.id}`;
    return { token, id: row.id };
  }
  it("limits acceptance to the recipient, grants viewer access once, and revokes it without replay restoring access", async () => {
    const invitation = await invite();
    Object.assign(actor, stranger);
    expect(await redirected(acceptInvitationAction(form({ token: invitation.token })))).toContain(
      "inviteError=email",
    );
    Object.assign(actor, member);
    expect(await redirected(acceptInvitationAction(form({ token: invitation.token })))).toContain(
      "inviteAccepted=1",
    );
    expect(await requireReadableAccountUserId(owner.id)).toMatchObject({ role: "viewer" });
    const [membership] =
      await sql`select id from fkh_account_memberships where owner_user_id=${owner.id}`;
    Object.assign(actor, stranger);
    await redirected(removeMembershipAction(form({ membershipId: membership.id })));
    expect(
      (await sql`select count(*) from fkh_account_memberships where id=${membership.id}`)[0].count,
    ).toBe("1");
    Object.assign(actor, owner);
    await redirected(removeMembershipAction(form({ membershipId: membership.id })));
    Object.assign(actor, member);
    await expect(requireReadableAccountUserId(owner.id)).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
    expect(await redirected(acceptInvitationAction(form({ token: invitation.token })))).toContain(
      "inviteError=invalid",
    );
    expect(
      (await sql`select count(*) from fkh_account_memberships where owner_user_id=${owner.id}`)[0]
        .count,
    ).toBe("0");
  });
  it("rejects expired invitations and grants only one membership on simultaneous acceptance", async () => {
    const invitation = await invite();
    await sql`update fkh_account_invitations set expires_at=now()-interval '1 second' where id=${invitation.id}`;
    Object.assign(actor, member);
    expect(await redirected(acceptInvitationAction(form({ token: invitation.token })))).toContain(
      "inviteError=invalid",
    );
    expect(
      (await sql`select count(*) from fkh_account_memberships where owner_user_id=${owner.id}`)[0]
        .count,
    ).toBe("0");
    await sql`update fkh_account_invitations set expires_at=now()+interval '1 day' where id=${invitation.id}`;
    const results = await Promise.all([
      redirected(acceptInvitationAction(form({ token: invitation.token }))),
      redirected(acceptInvitationAction(form({ token: invitation.token }))),
    ]);
    expect(results.filter((r) => r.includes("inviteAccepted=1"))).toHaveLength(1);
    expect(
      (await sql`select count(*) from fkh_account_memberships where owner_user_id=${owner.id}`)[0]
        .count,
    ).toBe("1");
  });

  it("prevents acceptance after owner cancellation", async () => {
    const invitation = await invite();
    Object.assign(actor, stranger);
    await redirected(cancelInvitationAction(form({ invitationId: invitation.id })));
    expect(
      (await sql`select status from fkh_account_invitations where id=${invitation.id}`)[0].status,
    ).toBe("pending");
    Object.assign(actor, owner);
    await redirected(cancelInvitationAction(form({ invitationId: invitation.id })));
    Object.assign(actor, member);
    expect(await redirected(acceptInvitationAction(form({ token: invitation.token })))).toContain(
      "inviteError=invalid",
    );
  });
});
