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
      id: "evt_subscription_updated",
      created: 1_700_000_100,
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
      id: "evt_subscription_deleted",
      created: 1_700_000_200,
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
        id: "evt_invoice_failed",
        created: 1_700_000_300,
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

  it("does not grant access for a completed checkout until payment is paid", async () => {
    const store = new FakeBillingWebhookStore();
    const userId = randomUUID();

    const result = await handleStripeWebhookEvent(
      {
        id: "evt_checkout_unpaid",
        created: 1_700_000_400,
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_unpaid",
            customer: "cus_unpaid",
            subscription: "sub_unpaid",
            status: "complete",
            payment_status: "unpaid",
            metadata: { user_id: userId, plan_key: "coach" },
          },
        },
      },
      store,
      {},
    );

    expect(result).toMatchObject({ handled: true, userId, planKey: "coach" });
    expect(store.subscriptions.get("sub_unpaid")?.status).toBe("checkout_completed");
    expect(store.entitlements.get(userId)).toEqual([]);
  });

  it("uses the current Stripe price before stale subscription metadata", async () => {
    const store = new FakeBillingWebhookStore();
    const userId = randomUUID();

    const result = await handleStripeWebhookEvent(
      {
        id: "evt_subscription_downgraded",
        created: 1_700_000_500,
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_downgraded",
            customer: "cus_downgraded",
            status: "active",
            metadata: { user_id: userId, plan_key: "coach" },
            items: { data: [{ price: { id: "price_plus_monthly" } }] },
          },
        },
      },
      store,
      {
        STRIPE_PLUS_MONTHLY_PRICE_ID: "price_plus_monthly",
        STRIPE_COACH_MONTHLY_PRICE_ID: "price_coach_monthly",
      },
    );

    expect(result).toMatchObject({ handled: true, userId, planKey: "plus" });
    expect(store.subscriptions.get("sub_downgraded")?.planKey).toBe("plus");
    expect(
      store.entitlements.get(userId)?.some((row) => row.entitlementKey === "coach_dashboard"),
    ).toBe(false);
  });

  it("deduplicates repeated deliveries before applying billing state twice", async () => {
    const store = new FakeBillingWebhookStore();
    const userId = randomUUID();
    const event: StripeWebhookEvent = {
      id: "evt_duplicate",
      created: 1_700_001_000,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_duplicate",
          customer: "cus_duplicate",
          status: "active",
          metadata: { user_id: userId },
          items: { data: [{ price: { id: "price_plus_monthly" } }] },
        },
      },
    };

    const first = await handleStripeWebhookEvent(event, store, {
      STRIPE_PLUS_MONTHLY_PRICE_ID: "price_plus_monthly",
    });
    const duplicate = await handleStripeWebhookEvent(event, store, {
      STRIPE_PLUS_MONTHLY_PRICE_ID: "price_plus_monthly",
    });

    expect(first).toMatchObject({ handled: true, planKey: "plus" });
    expect(duplicate).toMatchObject({ handled: true, reason: "duplicate_event" });
    expect(store.events.get(event.id)).toBe("processed");
  });

  it("ignores an older subscription event delivered after newer active state", async () => {
    const store = new FakeBillingWebhookStore();
    const userId = randomUUID();
    const env = { STRIPE_PRO_MONTHLY_PRICE_ID: "price_pro_monthly" };

    await handleStripeWebhookEvent(
      {
        id: "evt_newer_active",
        created: 1_700_002_000,
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_ordered",
            customer: "cus_ordered",
            status: "active",
            metadata: { user_id: userId },
            items: { data: [{ price: { id: "price_pro_monthly" } }] },
          },
        },
      },
      store,
      env,
    );
    const stale = await handleStripeWebhookEvent(
      {
        id: "evt_older_deleted",
        created: 1_700_001_900,
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_ordered",
            customer: "cus_ordered",
            status: "canceled",
            metadata: { user_id: userId },
            items: { data: [{ price: { id: "price_pro_monthly" } }] },
          },
        },
      },
      store,
      env,
    );

    expect(stale).toMatchObject({ handled: true, reason: "stale_event_ignored" });
    expect(store.subscriptions.get("sub_ordered")?.status).toBe("active");
    expect(store.entitlements.get(userId)?.length).toBeGreaterThan(0);
  });
});

type StoredEntitlement = ReturnType<typeof entitlementRowsForPlan>[number];

class FakeBillingWebhookStore implements BillingWebhookStore {
  events = new Map<string, "processing" | "processed" | "failed">();
  subscriptionEvents = new Map<string, { eventId: string; eventCreatedAt: Date }>();
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

  async claimEvent(input: Parameters<BillingWebhookStore["claimEvent"]>[0]) {
    if (this.events.has(input.eventId)) {
      return "duplicate" as const;
    }

    this.events.set(input.eventId, "processing");
    return "claimed" as const;
  }

  async completeEvent(eventId: string) {
    this.events.set(eventId, "processed");
  }

  async failEvent(eventId: string) {
    this.events.set(eventId, "failed");
  }

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

  async applySubscriptionState(
    input: Parameters<BillingWebhookStore["applySubscriptionState"]>[0],
  ) {
    const previous = this.subscriptionEvents.get(input.stripeSubscriptionId);
    const isNewer =
      !previous ||
      previous.eventCreatedAt < input.eventCreatedAt ||
      (previous.eventCreatedAt.getTime() === input.eventCreatedAt.getTime() &&
        previous.eventId < input.eventId);

    if (!isNewer) {
      return false;
    }

    this.subscriptionEvents.set(input.stripeSubscriptionId, {
      eventId: input.eventId,
      eventCreatedAt: input.eventCreatedAt,
    });
    this.subscriptions.set(input.stripeSubscriptionId, {
      userId: input.userId,
      billingCustomerId: input.billingCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      planKey: input.planKey,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      metadataJson: input.metadataJson,
    });
    await this.replacePlanEntitlements({
      userId: input.userId,
      planKey: input.planKey,
      active: input.active,
      expiresAt: input.currentPeriodEnd,
      source: input.source,
    });
    return true;
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
