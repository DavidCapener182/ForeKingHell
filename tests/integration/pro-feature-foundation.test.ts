import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.id,
  getOptionalCurrentUserId: async () => actor.id,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
import { createCheckoutSession, getActivePlanKeyForUser } from "@/lib/billing";
import { createDrizzleBillingWebhookStore, handleStripeWebhookEvent } from "@/lib/stripe-webhook";
vi.mock("next/server", () => ({ after: vi.fn() }));
import { saveRapsodoImport, type SaveRapsodoImportInput } from "@/lib/imports/save-rapsodo-import";
import { closeDb } from "@/db/client";
import {
  assertCanStartProTrial,
  getProTrialEligibility,
  markTrialConsumed,
  markTrialEligibleAfterFirstImport,
  reserveProTrialCheckout,
} from "@/lib/billing-pro-trial";
import { getMonthlyImportUsage } from "@/lib/imports/import-usage";

const enabled = process.env.RUN_PRO_FEATURE_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = new URL(url!);
  const local =
    target.hostname === "127.0.0.1" &&
    target.port === "55437" &&
    target.pathname === "/fkh_features";
  const ci =
    process.env.GITHUB_ACTIONS === "true" &&
    ["localhost", "127.0.0.1"].includes(target.hostname) &&
    target.port === "5432" &&
    target.pathname === "/forekinghell";
  if (!local && !ci) throw new Error("Disposable feature database required");
}
const db = enabled ? postgres(url!, { max: 3 }) : null;
let userId = "";
describe.skipIf(!enabled)("Pro feature database foundation", () => {
  beforeEach(async () => {
    userId = randomUUID();
    actor.id = userId;
    await db!`insert into fkh_users(id,email,name) values(${userId},'pro-features@example.invalid','Synthetic feature actor')`;
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await db!`delete from fkh_users where id=${userId}`;
  });
  afterAll(async () => {
    await closeDb();
    await db?.end();
  });
  async function firstImport() {
    const [session] =
      await db!`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${userId},'rapsodo','range',now(),'synthetic fixture') returning id`;
    await db!`insert into fkh_import_files(user_id,session_id,source,file_name,raw_csv_hash,status) values(${userId},${session.id},'rapsodo','synthetic.csv',${randomUUID().replaceAll("-", "").repeat(2)},'saved')`;
    return session.id as string;
  }
  it("requires an actual successful import before eligibility", async () => {
    expect((await getProTrialEligibility(userId)).eligible).toBe(false);
    await expect(assertCanStartProTrial(userId)).rejects.toThrow(/successful import/);
    await firstImport();
    expect(await markTrialEligibleAfterFirstImport(userId)).toBe(true);
    expect((await getProTrialEligibility(userId)).eligible).toBe(true);
  });
  it("does not create first-import eligibility after an older successful import", async () => {
    await firstImport();
    await firstImport();
    expect(await markTrialEligibleAfterFirstImport(userId)).toBe(false);
    expect((await getProTrialEligibility(userId)).eligible).toBe(false);
  });
  it("gives simultaneous devices one durable checkout request and preserves unconsumed eligibility", async () => {
    await firstImport();
    await markTrialEligibleAfterFirstImport(userId);
    const reservations = await Promise.all(
      Array.from({ length: 5 }, () => reserveProTrialCheckout(userId)),
    );
    expect(new Set(reservations.map((row) => row.requestId)).size).toBe(1);
    expect((await getProTrialEligibility(userId)).consumed).toBe(false);
  });
  it("consumes exactly once and never reoffers after a trial", async () => {
    await firstImport();
    await markTrialEligibleAfterFirstImport(userId);
    const input = {
      userId,
      subscriptionId: "sub_synthetic_trial",
      startedAt: new Date(),
      endsAt: new Date(Date.now() + 604800000),
    };
    expect(await markTrialConsumed(input)).toBe(true);
    expect(await markTrialConsumed(input)).toBe(false);
    expect(await getProTrialEligibility(userId)).toMatchObject({ eligible: false, consumed: true });
    await expect(reserveProTrialCheckout(userId)).rejects.toThrow(/no previous Pro trial/);
  });
  it("retains the legacy UTC monthly count and switches to the usage ledger once present", async () => {
    for (let i = 0; i < 5; i++) await firstImport();
    expect(await getMonthlyImportUsage(userId)).toMatchObject({
      used: 5,
      remaining: 0,
      allowed: false,
      legacyUsageToMigrate: 5,
    });
    await db!`insert into fkh_usage_events(user_id,event_type,quantity) values(${userId},'subscription_import',5)`;
    expect(await getMonthlyImportUsage(userId)).toMatchObject({ used: 5, legacyUsageToMigrate: 0 });
    await db!`insert into fkh_subscriptions(user_id,plan_key,status,current_period_end) values(${userId},'pro','trialing',now()+interval '7 days')`;
    expect(await getMonthlyImportUsage(userId)).toMatchObject({
      limit: null,
      remaining: null,
      allowed: true,
    });
  });
  it("prevents direct client reads/writes to server-managed trial and Pro plan tables", async () => {
    for (const role of ["anon", "authenticated"])
      for (const table of ["fkh_billing_trials", "fkh_course_twin_round_plans"]) {
        await expect(
          db!.begin(async (sql) => {
            await sql.unsafe(`set local role ${role}`);
            await sql.unsafe(`select * from ${table}`);
          }),
        ).rejects.toMatchObject({ code: "42501" });
      }
    await expect(
      db!.begin(async (sql) => {
        await sql.unsafe("set local role authenticated");
        await sql`insert into fkh_billing_trials(user_id) values(${userId})`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("builds only eligible monthly Pro trials, reuses the Stripe key across devices, and consumes only in the live webhook", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic");
    vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "price_synthetic");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        requests.push({ url, init });
        return Response.json(
          init?.method === "POST"
            ? { id: "cs_synthetic", url: "https://checkout.stripe.com/c/pay/synthetic" }
            : { status: "open" },
        );
      }),
    );
    const input = {
      planKey: "pro" as const,
      interval: "monthly" as const,
      origin: "https://example.invalid",
      trialDays: 7 as const,
    };
    expect((await createCheckoutSession(input)).error).toBeTruthy();
    expect(requests).toHaveLength(0);
    await firstImport();
    await markTrialEligibleAfterFirstImport(userId);
    expect((await createCheckoutSession({ ...input, interval: "yearly" })).error).toBeTruthy();
    expect(requests).toHaveLength(0);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createCheckoutSession(input)),
    );
    expect(results.every((r) => !r.error)).toBe(true);
    const posts = requests.filter((r) => r.init?.method === "POST");
    expect(
      new Set(posts.map((r) => (r.init!.headers as Record<string, string>)["Idempotency-Key"]))
        .size,
    ).toBe(1);
    const params = new URLSearchParams(String(posts[0].init!.body));
    expect(params.get("subscription_data[trial_period_days]")).toBe("7");
    expect(params.get("payment_method_collection")).toBe("always");
    expect(params.get("metadata[user_id]")).toBe(userId);
    expect(params.get("metadata[trial]")).toBe("pro_7d");
    expect((await getProTrialEligibility(userId)).consumed).toBe(false);
    const now = Math.floor(Date.now() / 1000);
    const event = {
      id: `evt_${randomUUID()}`,
      created: now,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_synthetic",
          subscription: `sub_${userId}`,
          client_reference_id: userId,
          payment_status: "no_payment_required",
          metadata: { plan_key: "pro", trial: "pro_7d" },
        },
      },
    };
    const store = createDrizzleBillingWebhookStore();
    await handleStripeWebhookEvent(event, store, {});
    expect(await getActivePlanKeyForUser(userId)).toBe("pro");
    expect((await getProTrialEligibility(userId)).consumed).toBe(true);
    expect(await handleStripeWebhookEvent(event, store, {})).toMatchObject({
      reason: "duplicate_event",
    });
    const [activated] =
      await db!`select count(*)::int total from fkh_usage_events where user_id=${userId} and event_type='pro_trial_activated'`;
    expect(activated.total).toBe(1);
    const converted = {
      id: `evt_${randomUUID()}`,
      created: now + 1,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: `sub_${userId}`,
          status: "active",
          current_period_start: now + 604800,
          current_period_end: now + 3196800,
          trial_start: now,
          trial_end: now + 604800,
          metadata: { user_id: userId, plan_key: "pro", trial: "pro_7d" },
        },
      },
    };
    await handleStripeWebhookEvent(converted, store, {});
    expect(await getActivePlanKeyForUser(userId)).toBe("pro");
    expect((await getProTrialEligibility(userId)).endsAt).toBe(
      new Date((now + 604800) * 1000).toISOString(),
    );
    // Conversion keeps the paid period active without extending the historical trial window.
    await db!`delete from fkh_stripe_webhook_events where event_id=${converted.id}`;
    const expired = {
      id: `evt_${randomUUID()}`,
      created: now + 2,
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: `sub_${userId}`,
          status: "canceled",
          metadata: { user_id: userId, plan_key: "pro", trial: "pro_7d" },
          trial_start: now,
          trial_end: now + 604800,
        },
      },
    };
    await handleStripeWebhookEvent(expired, store, {});
    expect(await getActivePlanKeyForUser(userId)).toBe("free");
    expect((await getProTrialEligibility(userId)).eligible).toBe(false);
    const [expiredCount] =
      await db!`select count(*)::int total from fkh_usage_events where user_id=${userId} and event_type='pro_trial_expired'`;
    expect(expiredCount.total).toBe(0);
    await db!`delete from fkh_stripe_webhook_events where event_id in (${event.id},${expired.id})`;
  });

  it("serialises the final Free allowance, skips duplicates before quota, and records first-import eligibility only after success", async () => {
    function input(carry: number): SaveRapsodoImportInput {
      const rawCsvText = `Shot Number,Club,Carry Distance,Total Distance,Ball Speed\n1,7 Iron,${carry},${carry + 10},110\n2,7 Iron,${carry + 2},${carry + 12},111`;
      return {
        rawCsvText,
        fileName: `synthetic-${carry}.csv`,
        fileSizeBytes: rawCsvText.length,
        source: "rapsodo",
        sessionType: "range",
        sessionDate: new Date().toISOString().slice(0, 10),
        distanceUnit: "yards",
      };
    }
    expect((await getProTrialEligibility(userId)).eligible).toBe(false);
    const first = await saveRapsodoImport(input(140));
    expect(first).toMatchObject({ ok: true, skipped: false });
    expect((await getProTrialEligibility(userId)).eligible).toBe(true);
    expect(await saveRapsodoImport(input(140))).toMatchObject({ ok: true, skipped: true });
    expect((await getMonthlyImportUsage(userId)).used).toBe(1);
    for (const carry of [150, 160, 170])
      expect((await saveRapsodoImport(input(carry))).ok).toBe(true);
    const racing = await Promise.all([
      saveRapsodoImport(input(180)),
      saveRapsodoImport(input(190)),
    ]);
    expect(racing.filter((r) => r.ok)).toHaveLength(1);
    expect(racing.find((r) => !r.ok)).toMatchObject({
      ok: false,
      code: "IMPORT_LIMIT_REACHED",
      limit: { used: 5, limit: 5 },
    });
    expect((await getMonthlyImportUsage(userId)).used).toBe(5);
    expect(await saveRapsodoImport(input(140))).toMatchObject({ ok: true, skipped: true });
    expect((await getMonthlyImportUsage(userId)).used).toBe(5);
  });
  it("keeps a failed checkout unconsumed and rotates only a provider-confirmed expired session", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_synthetic");
    vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "price_synthetic");
    await firstImport();
    await markTrialEligibleAfterFirstImport(userId);
    const keys: string[] = [];
    let stage = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method !== "POST") return Response.json({ status: "expired" });
        keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
        if (stage++ === 0)
          return Response.json(
            { error: { message: "Synthetic provider failure" } },
            { status: 503 },
          );
        return Response.json({
          id: `cs_synthetic_${stage}`,
          url: "https://checkout.stripe.com/c/pay/synthetic",
        });
      }),
    );
    const input = {
      planKey: "pro" as const,
      interval: "monthly" as const,
      origin: "https://example.invalid",
      trialDays: 7 as const,
    };
    expect((await createCheckoutSession(input)).error).toBeTruthy();
    expect((await getProTrialEligibility(userId)).consumed).toBe(false);
    expect((await createCheckoutSession(input)).error).toBeNull();
    expect(keys[0]).toBe(keys[1]);
    expect((await createCheckoutSession(input)).error).toBeNull();
    expect(keys[2]).not.toBe(keys[1]);
    expect((await getProTrialEligibility(userId)).consumed).toBe(false);
  });
  it("consumes once even when concurrent trusted events have no pre-existing trial row", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        markTrialConsumed({
          userId,
          subscriptionId: `sub_${userId}`,
          startedAt: new Date(),
          endsAt: new Date(Date.now() + 604800000),
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("rolls trial consumption and entitlements back together when entitlement insertion fails", async () => {
    await firstImport();
    await markTrialEligibleAfterFirstImport(userId);
    const trigger = `trial_atomic_${randomUUID().replaceAll("-", "")}`;
    const now = Math.floor(Date.now() / 1000);
    const event = {
      id: `evt_${randomUUID()}`,
      created: now,
      type: "customer.subscription.created",
      data: {
        object: {
          id: `sub_${userId}`,
          status: "trialing",
          trial_start: now,
          trial_end: now + 604800,
          metadata: { user_id: userId, plan_key: "pro", trial: "pro_7d" },
        },
      },
    };
    try {
      await db!.unsafe(
        `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.user_id='${userId}'::uuid then raise exception 'Synthetic entitlement failure'; end if; return NEW; end $$`,
      );
      await db!.unsafe(
        `create trigger ${trigger} before insert on fkh_entitlements for each row execute function ${trigger}()`,
      );
      await expect(
        handleStripeWebhookEvent(event, createDrizzleBillingWebhookStore(), {}),
      ).rejects.toThrow();
      expect((await getProTrialEligibility(userId)).consumed).toBe(false);
      expect(await getActivePlanKeyForUser(userId)).toBe("free");
      expect(await db!`select id from fkh_subscriptions where user_id=${userId}`).toHaveLength(0);
    } finally {
      await db!.unsafe(`drop trigger if exists ${trigger} on fkh_entitlements`);
      await db!.unsafe(`drop function if exists ${trigger}()`);
    }
    const store = createDrizzleBillingWebhookStore();
    await handleStripeWebhookEvent(event, store, {});
    expect(await getActivePlanKeyForUser(userId)).toBe("pro");
    expect((await getProTrialEligibility(userId)).consumed).toBe(true);
    const expired = {
      ...event,
      id: `evt_${randomUUID()}`,
      created: now + 1,
      type: "customer.subscription.deleted",
      data: { object: { ...event.data.object, status: "canceled" } },
    };
    await handleStripeWebhookEvent(expired, store, {});
    expect(await getActivePlanKeyForUser(userId)).toBe("free");
    expect((await getProTrialEligibility(userId)).eligible).toBe(false);
    const [expiry] =
      await db!`select count(*)::int total from fkh_usage_events where user_id=${userId} and event_type='pro_trial_expired'`;
    expect(expiry.total).toBe(1);
    await db!`delete from fkh_stripe_webhook_events where event_id in (${event.id},${expired.id})`;
  });
});
