import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: "", email: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getCurrentUser: async () => actor,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { updateUserSettingsFormAction, settingsAccessFormAction } from "@/app/settings/actions";
import { hashInvitationToken } from "@/lib/collaboration";
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
const form = (values: Record<string, string>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};
it.skipIf(!enabled)(
  "settings saves only the selected section and fails for an absent account",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      const [owner] =
        await db`insert into fkh_users(name,email,preferred_units,theme,table_density,dashboard_pins,privacy_settings_json) values('Original','settings@example.invalid','metres','dark','compact','["shots"]','{"allowCoachAccess":true}') returning id`;
      users.push(owner.id);
      actor.id = owner.id;
      expect(
        await updateUserSettingsFormAction(
          { ok: false },
          form({ settingsSection: "appearance", theme: "light", tableDensity: "comfortable" }),
        ),
      ).toEqual({ ok: true });
      let [row] =
        await db`select name,preferred_units,theme,table_density,dashboard_pins,privacy_settings_json from fkh_users where id=${owner.id}`;
      expect(row).toMatchObject({
        name: "Original",
        preferred_units: "metres",
        theme: "light",
        table_density: "comfortable",
        dashboard_pins: ["shots"],
        privacy_settings_json: { allowCoachAccess: true },
      });
      expect(
        await updateUserSettingsFormAction(
          { ok: false },
          form({ settingsSection: "privacy", allowLeaderboard: "on" }),
        ),
      ).toEqual({ ok: true });
      [row] =
        await db`select name,preferred_units,theme,dashboard_pins,privacy_settings_json from fkh_users where id=${owner.id}`;
      expect(row).toMatchObject({
        name: "Original",
        preferred_units: "metres",
        theme: "light",
        dashboard_pins: ["shots"],
        privacy_settings_json: {
          allowCoachAccess: false,
          allowLeaderboard: true,
          publicProfile: false,
        },
      });
      expect(
        await updateUserSettingsFormAction(
          { ok: false },
          form({
            settingsSection: "general",
            name: "Changed",
            preferredUnits: "yards",
            dashboardPins: "bag",
          }),
        ),
      ).toEqual({ ok: true });
      [row] =
        await db`select name,preferred_units,theme,table_density,dashboard_pins,privacy_settings_json from fkh_users where id=${owner.id}`;
      expect(row).toMatchObject({
        name: "Changed",
        preferred_units: "yards",
        theme: "light",
        table_density: "comfortable",
        dashboard_pins: ["bag"],
        privacy_settings_json: { allowLeaderboard: true },
      });
      actor.id = crypto.randomUUID();
      expect(
        (await updateUserSettingsFormAction({ ok: true }, form({ settingsSection: "appearance" })))
          .ok,
      ).toBe(false);
    } finally {
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
it.skipIf(!enabled)(
  "access state confirms only an owned changed record and returns the persisted invitation token",
  async () => {
    const db = postgres(url!, { max: 1 });
    const users: string[] = [];
    try {
      users.push(
        ...(
          await db`insert into fkh_users(name,email) values('Owner','owner-state@example.invalid'),('Other','other-state@example.invalid') returning id`
        ).map((row) => row.id),
      );
      actor.id = users[0];
      actor.email = "owner-state@example.invalid";
      expect(
        (
          await settingsAccessFormAction(
            { ok: true, inviteToken: "old" },
            form({ operation: "invite", invitedEmail: actor.email }),
          )
        ).ok,
      ).toBe(false);
      const result = await settingsAccessFormAction(
        { ok: false },
        form({ operation: "invite", invitedEmail: " Recipient@example.invalid ", role: "coach" }),
      );
      expect(result.ok).toBe(true);
      expect(result.inviteToken).toBeTruthy();
      const [invite] =
        await db`select id,role,status,invited_email,token_hash from fkh_account_invitations where owner_user_id=${users[0]}`;
      expect(invite).toMatchObject({
        role: "coach",
        status: "pending",
        invited_email: "recipient@example.invalid",
        token_hash: hashInvitationToken(result.inviteToken!),
      });
      expect(
        await db`select id from fkh_account_memberships where owner_user_id=${users[0]}`,
      ).toHaveLength(0);
      actor.id = users[1];
      const denied = await settingsAccessFormAction(
        { ok: true, inviteToken: "old" },
        form({ operation: "cancel", invitationId: invite.id }),
      );
      expect(denied.ok).toBe(false);
      expect(denied.inviteToken).toBeUndefined();
      actor.id = users[0];
      expect(
        await settingsAccessFormAction(
          { ok: false },
          form({ operation: "cancel", invitationId: invite.id }),
        ),
      ).toEqual({ ok: true });
      expect(
        (
          await settingsAccessFormAction(
            { ok: true },
            form({ operation: "cancel", invitationId: invite.id }),
          )
        ).ok,
      ).toBe(false);
      const [membership] =
        await db`insert into fkh_account_memberships(owner_user_id,member_user_id,role) values(${users[0]},${users[1]},'viewer') returning id`;
      actor.id = users[1];
      expect(
        (
          await settingsAccessFormAction(
            { ok: true },
            form({ operation: "remove", membershipId: membership.id }),
          )
        ).ok,
      ).toBe(false);
      expect(
        await db`select id from fkh_account_memberships where id=${membership.id}`,
      ).toHaveLength(1);
      actor.id = users[0];
      expect(
        await settingsAccessFormAction(
          { ok: false },
          form({ operation: "remove", membershipId: membership.id }),
        ),
      ).toEqual({ ok: true });
      expect(
        await db`select id from fkh_account_memberships where id=${membership.id}`,
      ).toHaveLength(0);
    } finally {
      if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
      await db.end();
    }
  },
);
