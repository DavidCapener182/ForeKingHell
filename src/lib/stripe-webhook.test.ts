import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  entitlementRowsForPlan,
  handleStripeWebhookEvent,
  verifyStripeSignature,
  type BillingWebhookStore,
  type StripeWebhookEvent,
} from "@/lib/stripe-webhook";
import type { PlanKey } from "@/lib/billing";

describe("Stripe webhook handling", () => {
  it("verifies Stripe signatures and rejects tampered payloads", () => {
    const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
    const secret = "whsec_test";
    const timestamp = 1_700_000_000;
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`, "utf8")
      .digest("hex");
    const header = `t=${timestamp},v1=${signature}`;

    expect(
      verifyStripeSignature({
        payload,
        signatureHeader: header,
        webhookSecret: secret,
        nowSeconds: timestamp,
      }),
    ).toBe(true);
    expect(
      verifyStripeSignature({
        payload: `${payload} `,
        signatureHeader: header,
        webhookSecret: secret,
        nowSeconds: timestamp,
      }),
    ).toBe(false);
    expect(
      verifyStripeSignature({
        payload,
        signatureHeader: header,
        webhookSecret: secret,
        nowSeconds: timestamp + 301,
      }),
    ).toBe(false);
  });

  it("maps subscription updates to customers, subscriptions, and active entitlements", async () => {
    const store = new FakeBillingWebhookStore();
    const userId = randomUUID();
    const event: StripeWebhookEvent = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_pro",
          customer: "cus_pro",
          status: "active",
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
          cancel_at_period_end: false,
          metadata: {
            user_id: userId,
          },
          items: {
            data: [
              {
                price: { id: "price_pro_monthly" },
              },
            ],
          },
        },
      },
    };

    const result = await handleStripeWebhookEvent(event, store, {
      STRIPE_PRO_MONTHLY_PRICE_ID: "price_pro_monthly",
    });

    expect(result).toMatchObject({ handled: true, userId, planKey: "pro" });
    expect(store.customers.get("cus_pro")?.userId).toBe(userId);
    expect(store.subscriptions.get("sub_pro")).toMatchObject({
      userId,
      planKey: "pro",
      status: "active",
      cancelAtPeriodEnd: false,
    });
    expect(store.entitlements.get(userId)?.map((row) => row.entitlementKey)).toEqual(
      expect.arrayContaining([
        "can_use_ai_coach",
        "friend_comparison_insights",
        "device_import_trackman",
      ]),
    );
  });

  it("revokes plan entitlements when subscriptions are deleted", async () => {
    const store = new FakeBillingWebhookStore();
    const userId = randomUUID();
    await store.upsertBillingCustomer({
      userId,
      stripeCustomerId: "cus_deleted",
      email: "player@example.test",
    });
    await store.replacePlanEntitlements({
      userId,
      planKey: "plus",
      active: true,
      expiresAt: null,
      source: "plan",
    });

    const event: StripeWebhookEvent = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_deleted",
          customer: "cus_deleted",
          status: "canceled",
          metadata: {},
          items: {
            data: [{ price: { id: "price_plus_monthly" } }],
          },
        },
      },
    };

    const result = await handleStripeWebhookEvent(event, store, {
      STRIPE_PLUS_MONTHLY_PRICE_ID: "price_plus_monthly",
    });

    expect(result).toMatchObject({ handled: true, userId, planKey: "plus" });
    expect(store.subscriptions.get("sub_deleted")?.status).toBe("canceled");
    expect(store.entitlements.get(userId)).toEqual([]);
  });

  it("marks failed invoice subscriptions past_due and removes access", async () => {
    const store = new FakeBillingWebhookStore();
    const userId = randomUUID();
    await store.upsertBillingCustomer({
      userId,
      stripeCustomerId: "cus_failed",
      email: "player@example.test",
    });
    await store.upsertSubscription({
      userId,
      billingCustomerId: "customer-row",
      stripeSubscriptionId: "sub_failed",
      planKey: "coach",
      status: "active",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      metadataJson: {},
    });
    await store.replacePlanEntitlements({
      userId,
      planKey: "coach",
      active: true,
      expiresAt: null,
      source: "plan",
    });

    const result = await handleStripeWebhookEvent(
      {
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_failed",
            customer: "cus_failed",
            subscription: "sub_failed",
            lines: {
              data: [{ price: { id: "price_coach_monthly" } }],
            },
          },
        },
      },
      store,
      { STRIPE_COACH_MONTHLY_PRICE_ID: "price_coach_monthly" },
    );

    expect(result).toMatchObject({ handled: true, userId, planKey: "coach" });
    expect(store.subscriptions.get("sub_failed")?.status).toBe("past_due");
    expect(store.entitlements.get(userId)).toEqual([]);
  });
});

type StoredEntitlement = ReturnType<typeof entitlementRowsForPlan>[number];

class FakeBillingWebhookStore implements BillingWebhookStore {
  customers = new Map<string, { id: string; userId: string; email: string | null }>();
  subscriptions = new Map<
    string,
    {
      userId: string;
      billingCustomerId: string | null;
      stripeSubscriptionId: string;
      planKey: PlanKey;
      status: string;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      metadataJson: Record<string, unknown>;
    }
  >();
  entitlements = new Map<string, StoredEntitlement[]>();

  async upsertBillingCustomer(input: {
    userId: string;
    stripeCustomerId: string | null;
    email: string | null;
  }) {
    const id = input.stripeCustomerId ?? `cus_${input.userId}`;
    this.customers.set(id, {
      id,
      userId: input.userId,
      email: input.email,
    });
    return { id, userId: input.userId };
  }

  async findUserIdByStripeCustomerId(stripeCustomerId: string) {
    return this.customers.get(stripeCustomerId)?.userId ?? null;
  }

  async upsertSubscription(input: {
    userId: string;
    billingCustomerId: string | null;
    stripeSubscriptionId: string;
    planKey: PlanKey;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    metadataJson: Record<string, unknown>;
  }) {
    this.subscriptions.set(input.stripeSubscriptionId, input);
  }

  async markSubscriptionStatus(input: {
    stripeSubscriptionId: string;
    status: string;
    metadataJson: Record<string, unknown>;
  }) {
    const subscription = this.subscriptions.get(input.stripeSubscriptionId);

    if (subscription) {
      this.subscriptions.set(input.stripeSubscriptionId, {
        ...subscription,
        status: input.status,
        metadataJson: input.metadataJson,
      });
    }
  }

  async replacePlanEntitlements(input: {
    userId: string;
    planKey: PlanKey;
    active: boolean;
    expiresAt: Date | null;
    source: string;
  }) {
    this.entitlements.set(
      input.userId,
      input.active
        ? entitlementRowsForPlan(input.userId, input.planKey, {
            expiresAt: input.expiresAt,
            source: input.source,
            now: new Date("2026-05-15T00:00:00.000Z"),
          })
        : [],
    );
  }
}
