import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  entitlementValuesForPlan,
  planKeyFromStripePriceId,
  processStripeWebhookEvent,
  type BillingWebhookStore,
} from "@/lib/stripe-billing";
import { verifyStripeWebhookSignature } from "@/lib/stripe-billing";

function signedHeader(payload: string, secret: string, timestamp = 1_700_000_000) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function fakeStore(): BillingWebhookStore & {
  subscriptions: unknown[];
  entitlements: unknown[];
  expired: unknown[];
} {
  const subscriptions: unknown[] = [];
  const entitlements: unknown[] = [];
  const expired: unknown[] = [];

  return {
    subscriptions,
    entitlements,
    expired,
    findUserIdByCustomerId: vi.fn(async (customerId: string) => (customerId === "cus_known" ? "user_known" : null)),
    upsertBillingCustomer: vi.fn(async () => "billing_customer_1"),
    upsertSubscription: vi.fn(async (input) => {
      subscriptions.push(input);
    }),
    applyPlanEntitlements: vi.fn(async (input) => {
      entitlements.push(input);
    }),
    expirePlanEntitlements: vi.fn(async (input) => {
      expired.push(input);
    }),
  };
}

describe("Stripe billing webhook helpers", () => {
  it("verifies Stripe HMAC signatures and rejects stale payloads", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const secret = "whsec_test";

    expect(
      verifyStripeWebhookSignature({
        payload,
        signatureHeader: signedHeader(payload, secret),
        webhookSecret: secret,
        nowSeconds: 1_700_000_100,
      }),
    ).toBe(true);
    expect(
      verifyStripeWebhookSignature({
        payload,
        signatureHeader: signedHeader(payload, "wrong"),
        webhookSecret: secret,
        nowSeconds: 1_700_000_100,
      }),
    ).toBe(false);
    expect(
      verifyStripeWebhookSignature({
        payload,
        signatureHeader: signedHeader(payload, secret, 1_699_000_000),
        webhookSecret: secret,
        nowSeconds: 1_700_000_100,
      }),
    ).toBe(false);
  });

  it("maps configured Stripe price ids to plan entitlements", () => {
    vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "price_pro_monthly");

    expect(planKeyFromStripePriceId("price_pro_monthly")).toBe("pro");
    expect(entitlementValuesForPlan("pro").map(([key]) => key)).toEqual(
      expect.arrayContaining(["can_use_ai_coach", "friend_comparison_insights", "device_import_square"]),
    );
  });

  it("records checkout completion subscriptions and applies entitlements", async () => {
    const store = fakeStore();

    const result = await processStripeWebhookEvent(
      {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test",
            customer: "cus_123",
            subscription: "sub_123",
            client_reference_id: "user_123",
            customer_details: { email: "player@example.com" },
            metadata: { user_id: "user_123", plan_key: "plus" },
          },
        },
      },
      store,
    );

    expect(result).toMatchObject({ handled: true, userId: "user_123", planKey: "plus", subscriptionStatus: "active" });
    expect(store.upsertBillingCustomer).toHaveBeenCalledWith({ userId: "user_123", stripeCustomerId: "cus_123", email: "player@example.com" });
    expect(store.subscriptions).toEqual([
      expect.objectContaining({ userId: "user_123", stripeSubscriptionId: "sub_123", planKey: "plus", status: "active" }),
    ]);
    expect(store.entitlements).toEqual([expect.objectContaining({ userId: "user_123", planKey: "plus", expiresAt: null })]);
  });

  it("expires plan entitlements when invoice payment fails", async () => {
    const store = fakeStore();

    const result = await processStripeWebhookEvent(
      {
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_failed",
            customer: "cus_known",
            subscription: "sub_known",
            subscription_details: { metadata: { plan_key: "pro" } },
          },
        },
      },
      store,
    );

    expect(result).toMatchObject({ handled: true, userId: "user_known", planKey: "pro", subscriptionStatus: "past_due" });
    expect(store.subscriptions).toEqual([expect.objectContaining({ status: "past_due", stripeSubscriptionId: "sub_known" })]);
    expect(store.expired).toEqual([expect.objectContaining({ userId: "user_known", sourceEvent: "invoice.payment_failed" })]);
  });
});
