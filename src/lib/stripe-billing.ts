import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, ne } from "drizzle-orm";

import { billingCustomers, entitlements, subscriptions, users } from "@/db/schema";
import { getDb } from "@/db/client";
import type { PlanKey } from "@/lib/billing";

export type StripeWebhookEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed";

export type StripeWebhookEvent = {
  id?: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

export type BillingWebhookStore = {
  findUserIdByCustomerId(customerId: string): Promise<string | null>;
  upsertBillingCustomer(input: {
    userId: string;
    stripeCustomerId: string | null;
    email: string | null;
  }): Promise<string | null>;
  upsertSubscription(input: {
    userId: string;
    billingCustomerId: string | null;
    stripeSubscriptionId: string | null;
    planKey: PlanKey;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    metadataJson: Record<string, unknown>;
  }): Promise<void>;
  applyPlanEntitlements(input: {
    userId: string;
    planKey: PlanKey;
    expiresAt: Date | null;
    sourceEvent: string;
  }): Promise<void>;
  expirePlanEntitlements(input: {
    userId: string;
    sourceEvent: string;
    expiresAt: Date;
  }): Promise<void>;
};

export type ProcessStripeWebhookResult = {
  handled: boolean;
  eventType: string;
  userId: string | null;
  planKey: PlanKey | null;
  subscriptionStatus: string | null;
};

export function verifyStripeWebhookSignature(input: {
  payload: string;
  signatureHeader: string | null;
  webhookSecret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}) {
  const parts = parseStripeSignatureHeader(input.signatureHeader);
  if (!parts.timestamp || parts.signatures.length === 0) {
    return false;
  }

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - parts.timestamp) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${parts.timestamp}.${input.payload}`;
  const expected = createHmac("sha256", input.webhookSecret).update(signedPayload).digest("hex");
  return parts.signatures.some((signature) => safeEqualHex(signature, expected));
}

export function parseStripeWebhookEvent(payload: string): StripeWebhookEvent {
  const parsed = JSON.parse(payload) as unknown;
  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    throw new Error("Invalid Stripe webhook event payload.");
  }

  return parsed as StripeWebhookEvent;
}

export async function processStripeWebhookEvent(
  event: StripeWebhookEvent,
  store: BillingWebhookStore,
): Promise<ProcessStripeWebhookResult> {
  if (!isHandledStripeEventType(event.type)) {
    return {
      handled: false,
      eventType: event.type,
      userId: null,
      planKey: null,
      subscriptionStatus: null,
    };
  }

  const object = event.data?.object;
  if (!isRecord(object)) {
    throw new Error("Stripe webhook event is missing its data object.");
  }

  if (event.type === "checkout.session.completed") {
    return processCheckoutCompleted(event.type, object, store);
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    return processInvoiceEvent(event.type, object, store);
  }

  return processSubscriptionEvent(event.type, object, store);
}

export function entitlementValuesForPlan(planKey: PlanKey) {
  const planEntitlements: Record<
    Exclude<PlanKey, "free">,
    Array<readonly [string, Record<string, unknown>]>
  > = {
    plus: [
      ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
      ["max_friend_groups", { value: 8 }],
      ["max_private_challenges", { value: 12 }],
      ["advanced_reports", { value: true }],
    ],
    pro: [
      ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
      ["max_friend_groups", { value: 8 }],
      ["max_private_challenges", { value: 12 }],
      ["advanced_reports", { value: true }],
      ["can_use_ai_coach", { value: true }],
      ["friend_comparison_insights", { value: true }],
      ["challenge_analytics", { value: true }],
      ["device_import_square", { value: true }],
      ["device_import_trackman", { value: true }],
    ],
    coach: [
      ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
      ["max_friend_groups", { value: 999999, label: "Unlimited" }],
      ["max_private_challenges", { value: 999999, label: "Unlimited" }],
      ["advanced_reports", { value: true }],
      ["can_use_ai_coach", { value: true }],
      ["friend_comparison_insights", { value: true }],
      ["challenge_analytics", { value: true }],
      ["coach_dashboard", { value: true }],
      ["max_player_seats", { value: 25 }],
      ["device_import_square", { value: true }],
      ["device_import_trackman", { value: true }],
    ],
    full: [
      ["lifetime_full", { value: true }],
      ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
      ["max_friend_groups", { value: 999999, label: "Unlimited" }],
      ["max_private_challenges", { value: 999999, label: "Unlimited" }],
      ["can_use_ai_coach", { value: true }],
      ["advanced_reports", { value: true }],
      ["friend_comparison_insights", { value: true }],
      ["challenge_analytics", { value: true }],
      ["coach_dashboard", { value: true }],
      ["max_player_seats", { value: 999999, label: "Unlimited" }],
      ["device_import_square", { value: true }],
      ["device_import_trackman", { value: true }],
      ["admin_operations", { value: true }],
    ],
  };

  return planKey === "free" ? [] : planEntitlements[planKey];
}

export function planKeyFromStripePriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) {
    return null;
  }

  const entries: Array<readonly [PlanKey, string | undefined]> = [
    ["plus", process.env.STRIPE_PLUS_MONTHLY_PRICE_ID],
    ["plus", process.env.STRIPE_PLUS_YEARLY_PRICE_ID],
    ["pro", process.env.STRIPE_PRO_MONTHLY_PRICE_ID],
    ["pro", process.env.STRIPE_PRO_YEARLY_PRICE_ID],
    ["coach", process.env.STRIPE_COACH_MONTHLY_PRICE_ID],
    ["coach", process.env.STRIPE_COACH_YEARLY_PRICE_ID],
  ];

  return entries.find(([, configuredPriceId]) => configuredPriceId === priceId)?.[0] ?? null;
}

export function createDrizzleBillingWebhookStore(): BillingWebhookStore {
  const db = getDb();

  return {
    async findUserIdByCustomerId(customerId) {
      const [customer] = await db
        .select({ userId: billingCustomers.userId })
        .from(billingCustomers)
        .where(eq(billingCustomers.stripeCustomerId, customerId))
        .limit(1);
      return customer?.userId ?? null;
    },
    async upsertBillingCustomer(input) {
      if (!input.userId) {
        return null;
      }

      const now = new Date();
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      const [customer] = await db
        .insert(billingCustomers)
        .values({
          userId: input.userId,
          stripeCustomerId: input.stripeCustomerId,
          email: input.email ?? user?.email ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: billingCustomers.userId,
          set: {
            stripeCustomerId: input.stripeCustomerId,
            email: input.email ?? user?.email ?? null,
            updatedAt: now,
          },
        })
        .returning({ id: billingCustomers.id });
      return customer?.id ?? null;
    },
    async upsertSubscription(input) {
      const now = new Date();
      const values = {
        userId: input.userId,
        billingCustomerId: input.billingCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        planKey: input.planKey,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        metadataJson: input.metadataJson,
        updatedAt: now,
      };

      if (input.stripeSubscriptionId) {
        await db
          .insert(subscriptions)
          .values(values)
          .onConflictDoUpdate({
            target: subscriptions.stripeSubscriptionId,
            set: {
              billingCustomerId: input.billingCustomerId,
              planKey: input.planKey,
              status: input.status,
              currentPeriodStart: input.currentPeriodStart,
              currentPeriodEnd: input.currentPeriodEnd,
              cancelAtPeriodEnd: input.cancelAtPeriodEnd,
              metadataJson: input.metadataJson,
              updatedAt: now,
            },
          });
        return;
      }

      await db.insert(subscriptions).values(values);
    },
    async applyPlanEntitlements(input) {
      const now = new Date();
      for (const [entitlementKey, valueJson] of entitlementValuesForPlan(input.planKey)) {
        await db
          .insert(entitlements)
          .values({
            userId: input.userId,
            entitlementKey,
            valueJson,
            source: "plan",
            expiresAt: input.expiresAt,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [entitlements.userId, entitlements.entitlementKey],
            set: {
              valueJson,
              source: "plan",
              expiresAt: input.expiresAt,
              updatedAt: now,
            },
          });
      }
    },
    async expirePlanEntitlements(input) {
      await db
        .update(entitlements)
        .set({
          expiresAt: input.expiresAt,
          updatedAt: input.expiresAt,
          valueJson: { value: false, sourceEvent: input.sourceEvent },
        })
        .where(
          and(
            eq(entitlements.userId, input.userId),
            eq(entitlements.source, "plan"),
            ne(entitlements.entitlementKey, "lifetime_full"),
          ),
        );
    },
  };
}

async function processCheckoutCompleted(
  eventType: StripeWebhookEventType,
  object: Record<string, unknown>,
  store: BillingWebhookStore,
) {
  const customerId = readId(object.customer);
  const subscriptionId = readId(object.subscription);
  const userId =
    readStringPath(object, ["metadata", "user_id"]) ??
    readString(object.client_reference_id) ??
    (customerId ? await store.findUserIdByCustomerId(customerId) : null);
  const planKey = parsePlanKey(
    readStringPath(object, ["metadata", "plan_key"]) ??
      planKeyFromStripePriceId(readSessionPriceId(object)) ??
      undefined,
  );

  if (!userId) {
    throw new Error("Stripe checkout session did not include a LM World Tour user id.");
  }

  const billingCustomerId = customerId
    ? await store.upsertBillingCustomer({
        userId,
        stripeCustomerId: customerId,
        email: readStringPath(object, ["customer_details", "email"]),
      })
    : null;

  await store.upsertSubscription({
    userId,
    billingCustomerId,
    stripeSubscriptionId: subscriptionId,
    planKey,
    status: subscriptionId ? "active" : (readString(object.payment_status) ?? "checkout_completed"),
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    metadataJson: { stripeEvent: eventType, checkoutSessionId: readString(object.id) },
  });
  await store.applyPlanEntitlements({ userId, planKey, expiresAt: null, sourceEvent: eventType });

  return { handled: true, eventType, userId, planKey, subscriptionStatus: "active" };
}

async function processSubscriptionEvent(
  eventType: StripeWebhookEventType,
  object: Record<string, unknown>,
  store: BillingWebhookStore,
) {
  const customerId = readId(object.customer);
  const userId =
    readStringPath(object, ["metadata", "user_id"]) ??
    (customerId ? await store.findUserIdByCustomerId(customerId) : null);
  if (!userId) {
    throw new Error("Stripe subscription event could not be matched to a LM World Tour user.");
  }

  const planKey = parsePlanKey(
    readStringPath(object, ["metadata", "plan_key"]) ??
      planKeyFromStripePriceId(readSubscriptionPriceId(object)) ??
      undefined,
  );
  const currentPeriodEnd = dateFromStripeSeconds(readNumber(object.current_period_end));
  const billingCustomerId = customerId
    ? await store.upsertBillingCustomer({ userId, stripeCustomerId: customerId, email: null })
    : null;
  const status =
    eventType === "customer.subscription.deleted"
      ? "canceled"
      : (readString(object.status) ?? "active");

  await store.upsertSubscription({
    userId,
    billingCustomerId,
    stripeSubscriptionId: readString(object.id),
    planKey,
    status,
    currentPeriodStart: dateFromStripeSeconds(readNumber(object.current_period_start)),
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
    metadataJson: { stripeEvent: eventType, priceId: readSubscriptionPriceId(object) },
  });

  if (isEntitledSubscriptionStatus(status)) {
    await store.applyPlanEntitlements({
      userId,
      planKey,
      expiresAt: currentPeriodEnd,
      sourceEvent: eventType,
    });
  } else {
    await store.expirePlanEntitlements({ userId, sourceEvent: eventType, expiresAt: new Date() });
  }

  return { handled: true, eventType, userId, planKey, subscriptionStatus: status };
}

async function processInvoiceEvent(
  eventType: StripeWebhookEventType,
  object: Record<string, unknown>,
  store: BillingWebhookStore,
) {
  const customerId = readId(object.customer);
  const subscriptionId =
    readId(object.subscription) ??
    readStringPath(object, ["parent", "subscription_details", "subscription"]);
  const userId =
    readStringPath(object, ["metadata", "user_id"]) ??
    readStringPath(object, ["subscription_details", "metadata", "user_id"]) ??
    (customerId ? await store.findUserIdByCustomerId(customerId) : null);
  if (!userId) {
    throw new Error("Stripe invoice event could not be matched to a LM World Tour user.");
  }

  const planKey = parsePlanKey(
    readStringPath(object, ["metadata", "plan_key"]) ??
      readStringPath(object, ["subscription_details", "metadata", "plan_key"]) ??
      planKeyFromStripePriceId(readInvoicePriceId(object)) ??
      undefined,
  );
  const billingCustomerId = customerId
    ? await store.upsertBillingCustomer({
        userId,
        stripeCustomerId: customerId,
        email: readString(object.customer_email),
      })
    : null;
  const status = eventType === "invoice.paid" ? "active" : "past_due";
  const periodEnd = dateFromStripeSeconds(readInvoicePeriodEnd(object));

  await store.upsertSubscription({
    userId,
    billingCustomerId,
    stripeSubscriptionId: subscriptionId,
    planKey,
    status,
    currentPeriodStart: dateFromStripeSeconds(readInvoicePeriodStart(object)),
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    metadataJson: {
      stripeEvent: eventType,
      invoiceId: readString(object.id),
      priceId: readInvoicePriceId(object),
    },
  });

  if (eventType === "invoice.paid") {
    await store.applyPlanEntitlements({
      userId,
      planKey,
      expiresAt: periodEnd,
      sourceEvent: eventType,
    });
  } else {
    await store.expirePlanEntitlements({ userId, sourceEvent: eventType, expiresAt: new Date() });
  }

  return { handled: true, eventType, userId, planKey, subscriptionStatus: status };
}

function parseStripeSignatureHeader(signatureHeader: string | null) {
  const result = { timestamp: 0, signatures: [] as string[] };
  if (!signatureHeader) {
    return result;
  }

  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") {
      result.timestamp = Number(value);
    }
    if (key === "v1" && value) {
      result.signatures.push(value);
    }
  }

  return result;
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isHandledStripeEventType(type: string): type is StripeWebhookEventType {
  return (
    type === "checkout.session.completed" ||
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted" ||
    type === "invoice.paid" ||
    type === "invoice.payment_failed"
  );
}

function isEntitledSubscriptionStatus(status: string) {
  return status === "active" || status === "trialing";
}

function parsePlanKey(value: string | null | undefined): PlanKey {
  return value === "plus" || value === "pro" || value === "coach" || value === "full"
    ? value
    : "free";
}

function readSessionPriceId(object: Record<string, unknown>) {
  return readStringPath(object, ["line_items", "data", "0", "price", "id"]);
}

function readSubscriptionPriceId(object: Record<string, unknown>) {
  return readStringPath(object, ["items", "data", "0", "price", "id"]);
}

function readInvoicePriceId(object: Record<string, unknown>) {
  return readStringPath(object, ["lines", "data", "0", "price", "id"]);
}

function readInvoicePeriodStart(object: Record<string, unknown>) {
  return readNumberPath(object, ["lines", "data", "0", "period", "start"]);
}

function readInvoicePeriodEnd(object: Record<string, unknown>) {
  return readNumberPath(object, ["lines", "data", "0", "period", "end"]);
}

function dateFromStripeSeconds(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

function readId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return isRecord(value) && typeof value.id === "string" ? value.id : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringPath(object: Record<string, unknown>, path: string[]) {
  let current: unknown = object;
  for (const segment of path) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return null;
    }
  }

  return readString(current);
}

function readNumberPath(object: Record<string, unknown>, path: string[]) {
  let current: unknown = object;
  for (const segment of path) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return null;
    }
  }

  return readNumber(current);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
