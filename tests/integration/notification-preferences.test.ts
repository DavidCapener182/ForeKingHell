import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { saveNotificationPreferencesAction } from "@/app/settings/notifications/actions";
import { getProductPreferences } from "@/lib/product-preferences";
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
describe.skipIf(!enabled)("notification preference ownership", () => {
  afterAll(closeDb);
  it("saves only the signed-in account and preserves unrelated preferences", async () => {
    const db = postgres(url!, { max: 1 });
    const owners: string[] = [];
    try {
      for (const name of ["Synthetic settings owner", "Synthetic foreign settings"])
        owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
      for (const id of owners)
        await db`insert into fkh_user_feature_preferences(user_id,highlight_settings_json) values(${id},'{"unrelatedFixture":{"keep":true}}')`;
      actor.id = owners[0];
      const form = new FormData();
      form.set("userId", owners[1]);
      form.set("settingsReturnTo", "section");
      form.set("providerSync", "off");
      form.set("legacy_weeklyReview", "on");
      const error = await saveNotificationPreferencesAction(form).catch((error) => error);
      expect(error.digest).toContain("/settings?section=notifications&saved=1");
      expect((await getProductPreferences(owners[0])).notifications.delivery.providerSync).toBe(
        "off",
      );
      const rows =
        await db`select user_id,highlight_settings_json from fkh_user_feature_preferences where user_id in ${db(owners)}`;
      expect(
        rows.find((row) => row.user_id === owners[0])!.highlight_settings_json.unrelatedFixture,
      ).toEqual({ keep: true });
      expect(rows.find((row) => row.user_id === owners[1])!.highlight_settings_json).toEqual({
        unrelatedFixture: { keep: true },
      });
    } finally {
      if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
      await db.end();
    }
  });
});
