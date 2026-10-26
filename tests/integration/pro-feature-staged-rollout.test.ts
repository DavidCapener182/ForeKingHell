import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getOptionalCurrentUserId: async () => actor.id,
  getCurrentUser: async () => ({ id: actor.id }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/course-twin-data", () => ({
  getCourseTwinManifest: async () => ({ course: { id: "synthetic-course" } }),
}));
vi.mock("@/lib/mobile-quick-bag-data", () => ({
  getMobileCourseTwinBagProfiles: async () => [{}],
}));
import { closeDb } from "@/db/client";
import { proFeatureStorageReady } from "@/lib/pro-feature-readiness";
import { getProTrialEligibility } from "@/lib/billing-pro-trial";
import { getBillingPageData, createCheckoutSession } from "@/lib/billing";
import { saveRapsodoImport } from "@/lib/imports/save-rapsodo-import";
import { GET, POST } from "@/app/api/course-twins/[courseId]/round-plan/route";
import { GET as exportSettings } from "@/app/api/settings/export/route";
const enabled = process.env.RUN_STAGED_FEATURE_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = new URL(url!);
  if (t.hostname !== "127.0.0.1" || t.port !== "55437" || t.pathname !== "/forekinghell")
    throw new Error("Designated disposable pre-0062 database required");
}
afterAll(async () => {
  if (enabled) await closeDb();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe.skipIf(!enabled)("Code rollout before optional migration0062", () => {
  it("preserves billing and imports while trial checkout and plan persistence remain unavailable", async () => {
    const db = postgres(url!, { max: 1 });
    actor.id = randomUUID();
    try {
      expect(await proFeatureStorageReady()).toBe(false);
      await db`insert into fkh_users(id,name,email) values(${actor.id},'Staged rollout fixture','staged@example.invalid')`;
      expect((await getBillingPageData()).proTrial).toMatchObject({
        eligible: false,
        configured: false,
        storageReady: false,
      });
      const rawCsvText =
        "Shot Number,Club,Carry Distance,Total Distance,Ball Speed\n1,7 Iron,151,161,110\n2,7 Iron,152,162,111";
      expect(
        await saveRapsodoImport({
          rawCsvText,
          fileName: "staged.csv",
          fileSizeBytes: rawCsvText.length,
          source: "rapsodo",
          sessionType: "range",
          sessionDate: new Date().toISOString().slice(0, 10),
          distanceUnit: "yards",
        }),
      ).toMatchObject({ ok: true });
      expect((await getProTrialEligibility(actor.id)).eligible).toBe(false);
      const [eligibility] = await db`select count(*)::int as total from fkh_usage_events
        where user_id=${actor.id} and event_type='pro_trial_import_eligible'`;
      expect(eligibility.total).toBe(1);
      const exported = await exportSettings(
        new Request("https://example.invalid/api/settings/export"),
      );
      expect(exported.status).toBe(200);
      const document = await exported.json();
      expect(document.data.billingTrials).toEqual([]);
      expect(document.data.courseTwinRoundPlans).toEqual([]);
      expect(document.data.sessions).toHaveLength(1);
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic");
      vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "price_synthetic");
      const provider = vi.fn();
      vi.stubGlobal("fetch", provider);
      expect(
        (
          await createCheckoutSession({
            planKey: "pro",
            interval: "monthly",
            origin: "https://example.invalid",
            trialDays: 7,
          })
        ).error,
      ).toBeTruthy();
      expect(provider).not.toHaveBeenCalled();
      await db`insert into fkh_subscriptions(user_id,plan_key,status) values(${actor.id},'pro','active')`;
      const context = { params: Promise.resolve({ courseId: "synthetic-course" }) };
      expect((await GET(new Request("https://example.invalid/round-plan"), context)).status).toBe(
        503,
      );
      expect(
        (
          await POST(
            new Request("https://example.invalid/round-plan", {
              method: "POST",
              body: JSON.stringify({ intent: "normal" }),
            }),
            context,
          )
        ).status,
      ).toBe(503);
    } finally {
      await db`delete from fkh_users where id=${actor.id}`;
      await db.end();
    }
  });
});
