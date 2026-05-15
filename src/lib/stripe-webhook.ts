import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { billingCustomers, entitlements, subscriptions } from "@/db/schema";
import { getDb } from "@/db/client";
import type { PlanKey } from "@/lib/billing";

export type StripeWebhookEvent = {
  id?: string;
  type: StripeWebhookEventType;
  data: {
    object: StripeObject;
  };
};

export type StripeWebhookEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed"
  | string;

type StripeObject = Record<string, unknown>;
type StripeWebhookEnv = Record<string, string | undefined>;

export type BillingWebhookStore = {
  upsertBillingCustomer(input: {
    userId: string;
    stripeCustomerId: string | null;
    email: string | null;
  }): Promise<{ id: string; userId: string }>;
  findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null>;
  upsertSubscription(input: {
    userId: string;
    billingCustomerId: string | null;
    stripeSubscriptionId: string;
    planKey: PlanKey;
    status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    metadataJson: Record<string, unknown>;
  }): Promise<void>;
  markSubscriptionStatus(input: {
    stripeSubscriptionId: string;
    status: string;
    metadataJson: Record<string, unknown>;
  }): Promise<void>;
  replacePlanEntitlements(input: {
    userId: string;
    planKey: PlanKey;
    active: boolean;
    expiresAt: Date | null;
    source: string;
  }): Promise<void>;
};

export type StripeWebhookResult = {
  handled: boolean;
  type: string;
  userId?: string;
  planKey?: PlanKey;
  reason?: string;
};

const activeSubscriptionStatuses = new Set(["active", "trialing"]);
const allowedClockSkewSeconds = 300;

const priceEnvByPlan = {
  plus: ["STRIPE_PLUS_MONTHLY_PRICE_ID", "STRIPE_PLUS_YEARLY_PRICE_ID"],
  pro: ["STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_PRO_YEARLY_PRICE_ID"],
  coach: ["STRIPE_COACH_MONTHLY_PRICE_ID", "STRIPE_COACH_YEARLY_PRICE_ID"],
} as const satisfies Partial<Record<PlanKey, readonly string[]>>;

const planEntitlements = {
  free: [
    ["max_monthly_imports", { value: 5 }],
    ["max_friend_groups", { value: 1 }],
    ["max_private_challenges", { value: 0 }],
    ["can_use_ai_coach", { value: false }],
  ],
  plus: [
    ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
    ["max_friend_groups", { value: 8 }],
    ["max_private_challenges", { value: 999999, label: "Unlimited" }],
    ["advanced_reports", { value: true }],
  ],
  pro: [
    ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
    ["max_friend_groups", { value: 12 }],
    ["max_private_challenges", { value: 999999, label: "Unlimited" }],
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
    ["device_import_square", { value: true }],
    ["device_import_trackman", { value: true }],
    ["coach_dashboard", { value: true }],
    ["max_player_seats", { value: 25 }],
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
} as const satisfies Record<PlanKey, ReadonlyArray<readonly [string, Record<string, unknown>]>>;

export function verifyStripeSignature(input: {
  payload: string;
  signatureHeader: string | null;
  webhookSecret: string;
  nowSeconds?: number;
}) {
  const parts = parseSignatureHeader(input.signatureHeader);
  const timestamp = parts.timestamp;

  if (!timestamp || parts.signatures.length === 0) {
    return false;
  }

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - timestamp) > allowedClockSkewSeconds) {
    return false;
  }

  const expected = createHmac("sha256", input.webhookSecret)
    .update(`${timestamp}.${input.payload}`, "utf8")
    .digest("hex");

  return parts.signatures.some((signature) => safeEqualHex(signature, expected));
}

export async function handleStripeWebhookEvent(
  event: StripeWebhookEvent,
  store: BillingWebhookStore = createDrizzleBillingWebhookStore(),
  env: StripeWebhookEnv = process.env,
): Promise<StripeWebhookResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event.data.object, store, env, event.type);
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return handleSubscriptionUpdated(event.data.object, store, env, event.type);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object, store, env, event.type);
    case "invoice.paid":
      return handleInvoicePaid(event.data.object, store, env, event.type);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object, store, env, event.type);
    default:
      return { handled: false, type: event.type, reason: "ignored_event_type" };
  }
}

export function createDrizzleBillingWebhookStore(): BillingWebhookStore {
  return {
    async upsertBillingCustomer(input) {
      const [customer] = await getDb()
        .insert(billingCustomers)
        .values({
          userId: input.userId,
          stripeCustomerId: input.stripeCustomerId,
          email: input.email,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: billingCustomers.userId,
          set: {
            stripeCustomerId: input.stripeCustomerId,
            email: input.email,
            updatedAt: new Date(),
          },
        })
        .returning({ id: billingCustomers.id, userId: billingCustomers.userId });

      return customer;
    },
    async findUserIdByStripeCustomerId(stripeCustomerId) {
      const [customer] = await getDb()
        .select({ userId: billingCustomers.userId })
        .from(billingCustomers)
        .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
        .limit(1);

      return customer?.userId ?? null;
    },
    async upsertSubscription(input) {
      await getDb()
        .insert(subscriptions)
        .values({
          userId: input.userId,
          billingCustomerId: input.billingCustomerId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          planKey: input.planKey,
          status: input.status,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          metadataJson: input.metadataJson,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: subscriptions.stripeSubscriptionId,
          set: {
            userId: input.userId,
            billingCustomerId: input.billingCustomerId,
            planKey: input.planKey,
            status: input.status,
            currentPeriodStart: input.currentPeriodStart,
            currentPeriodEnd: input.currentPeriodEnd,
            cancelAtPeriodEnd: input.cancelAtPeriodEnd,
            metadataJson: input.metadataJson,
            updatedAt: new Date(),
          },
        });
    },
    async markSubscriptionStatus(input) {
      await getDb()
        .update(subscriptions)
        .set({
          status: input.status,
          metadataJson: input.metadataJson,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, input.stripeSubscriptionId));
    },
    async replacePlanEntitlements(input) {
      const now = new Date();

      await getDb().transaction(async (tx) => {
        await tx.delete(entitlements).where(and(eq(entitlements.userId, input.userId), eq(entitlements.source, input.source)));

        if (!input.active) {
          return;
        }

        await tx.insert(entitlements).values(
          entitlementRowsForPlan(input.userId, input.planKey, {
            source: input.source,
            expiresAt: input.expiresAt,
            now,
          }),
        );
      });
    },
  };
}

export function entitlementRowsForPlan(
  userId: string,
  planKey: PlanKey,
  options: { source?: string; expiresAt?: Date | null; now?: Date } = {},
) {
  const now = options.now ?? new Date();

  return planEntitlements[planKey].map(([entitlementKey, valueJson]) => ({
    userId,
    entitlementKey,
    valueJson,
    source: options.source ?? "plan",
    expiresAt: options.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  }));
}

function handleCheckoutSessionCompleted(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
): Promise<StripeWebhookResult> {
  const metadata = objectMetadata(object);
  const userId = stringFrom(metadata.user_id) ?? stringFrom(object.client_reference_id);
  const customerId = stripeId(object.customer);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);
  const subscriptionId = stripeId(object.subscription);

  if (!userId) {
    return Promise.resolve({ handled: false, type, planKey, reason: "missing_user_id" });
  }

  return upsertCustomerSubscriptionAndEntitlements({
    store,
    type,
    userId,
    customerId,
    email: stringFrom(object.customer_email),
    subscriptionId,
    planKey,
    status: object.payment_status === "paid" || object.status === "complete" ? "active" : "checkout_completed",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    active: object.payment_status === "paid" || object.status === "complete",
    metadataJson: {
      stripeEvent: type,
      checkoutSessionId: stringFrom(object.id),
      checkoutStatus: stringFrom(object.status),
      paymentStatus: stringFrom(object.payment_status),
      metadata,
    },
  });
}

async function handleSubscriptionUpdated(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
): Promise<StripeWebhookResult> {
  const metadata = objectMetadata(object);
  const customerId = stripeId(object.customer);
  const userId = stringFrom(metadata.user_id) ?? (customerId ? await store.findUserIdByStripeCustomerId(customerId) : null);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);
  const status = stringFrom(object.status) ?? "unknown";

  if (!userId) {
    return { handled: false, type, planKey, reason: "missing_user_id" };
  }

  return upsertCustomerSubscriptionAndEntitlements({
    store,
    type,
    userId,
    customerId,
    email: null,
    subscriptionId: stripeId(object.id),
    planKey,
    status,
    currentPeriodStart: dateFromUnixSeconds(numberFrom(object.current_period_start)),
    currentPeriodEnd: dateFromUnixSeconds(numberFrom(object.current_period_end)),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
    active: activeSubscriptionStatuses.has(status),
    metadataJson: {
      stripeEvent: type,
      metadata,
      priceId: firstPriceId(object),
    },
  });
}

async function handleSubscriptionDeleted(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
): Promise<StripeWebhookResult> {
  const result = await handleSubscriptionUpdated(
    {
      ...object,
      status: stringFrom(object.status) ?? "canceled",
    },
    store,
    env,
    type,
  );

  return result.handled ? { ...result, reason: "revoked_plan_entitlements" } : result;
}

async function handleInvoicePaid(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
): Promise<StripeWebhookResult> {
  const customerId = stripeId(object.customer);
  const userId = customerId ? await store.findUserIdByStripeCustomerId(customerId) : null;
  const subscriptionId = stripeId(object.subscription);
  const metadata = objectMetadata(object);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);

  if (!userId || !subscriptionId) {
    return { handled: false, type, planKey, reason: !userId ? "missing_user_id" : "missing_subscription_id" };
  }

  return upsertCustomerSubscriptionAndEntitlements({
    store,
    type,
    userId,
    customerId,
    email: stringFrom(object.customer_email),
    subscriptionId,
    planKey,
    status: "active",
    currentPeriodStart: dateFromUnixSeconds(invoicePeriodUnix(object, "start")),
    currentPeriodEnd: dateFromUnixSeconds(invoicePeriodUnix(object, "end")),
    cancelAtPeriodEnd: false,
    active: true,
    metadataJson: {
      stripeEvent: type,
      invoiceId: stringFrom(object.id),
      paymentIntent: stringFrom(object.payment_intent),
      priceId: firstPriceId(object),
      metadata,
    },
  });
}

async function handleInvoicePaymentFailed(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
): Promise<StripeWebhookResult> {
  const customerId = stripeId(object.customer);
  const userId = customerId ? await store.findUserIdByStripeCustomerId(customerId) : null;
  const subscriptionId = stripeId(object.subscription);
  const metadata = objectMetadata(object);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);

  if (!userId || !subscriptionId) {
    return { handled: false, type, planKey, reason: !userId ? "missing_user_id" : "missing_subscription_id" };
  }

  await store.markSubscriptionStatus({
    stripeSubscriptionId: subscriptionId,
    status: "past_due",
    metadataJson: {
      stripeEvent: type,
      invoiceId: stringFrom(object.id),
      hostedInvoiceUrl: stringFrom(object.hosted_invoice_url),
      metadata,
    },
  });
  await store.replacePlanEntitlements({
    userId,
    planKey,
    active: false,
    expiresAt: null,
    source: "plan",
  });

  return { handled: true, type, userId, planKey, reason: "payment_failed_revoked_entitlements" };
}

async function upsertCustomerSubscriptionAndEntitlements(input: {
  store: BillingWebhookStore;
  type: string;
  userId: string;
  customerId: string | null;
  email: string | null;
  subscriptionId: string | null;
  planKey: PlanKey;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  active: boolean;
  metadataJson: Record<string, unknown>;
}): Promise<StripeWebhookResult> {
  const customer = input.customerId
    ? await input.store.upsertBillingCustomer({
        userId: input.userId,
        stripeCustomerId: input.customerId,
        email: input.email,
      })
    : null;

  if (input.subscriptionId) {
    await input.store.upsertSubscription({
      userId: input.userId,
      billingCustomerId: customer?.id ?? null,
      stripeSubscriptionId: input.subscriptionId,
      planKey: input.planKey,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      metadataJson: input.metadataJson,
    });
  }

  await input.store.replacePlanEntitlements({
    userId: input.userId,
    planKey: input.planKey,
    active: input.active,
    expiresAt: input.currentPeriodEnd,
    source: "plan",
  });

  return {
    handled: true,
    type: input.type,
    userId: input.userId,
    planKey: input.planKey,
  };
}

function resolvePlanKey(metadata: Record<string, unknown>, priceId: string | null, env: StripeWebhookEnv): PlanKey {
  const metadataPlan = stringFrom(metadata.plan_key);

  if (metadataPlan === "plus" || metadataPlan === "pro" || metadataPlan === "coach" || metadataPlan === "full") {
    return metadataPlan;
  }

  if (priceId) {
    for (const [planKey, envKeys] of Object.entries(priceEnvByPlan) as Array<[PlanKey, readonly string[]]>) {
      if (envKeys.some((envKey) => env[envKey] === priceId)) {
        return planKey;
      }
    }
  }

  return "free";
}

function parseSignatureHeader(signatureHeader: string | null) {
  const parts = (signatureHeader ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice("v1=".length))
    .filter(Boolean);
  const timestamp = timestampPart ? Number(timestampPart.slice("t=".length)) : null;

  return {
    timestamp: Number.isFinite(timestamp) ? timestamp : null,
    signatures,
  };
}

function safeEqualHex(left: string, right: string) {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function objectMetadata(object: StripeObject) {
  return isRecord(object.metadata) ? object.metadata : {};
}

function stripeId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value) && typeof value.id === "string") {
    return value.id;
  }

  return null;
}

function firstPriceId(object: StripeObject): string | null {
  const directPrice = isRecord(object.price) ? stripeId(object.price) : null;

  if (directPrice) {
    return directPrice;
  }

  const items = isRecord(object.items) && Array.isArray(object.items.data) ? object.items.data : null;
  const itemPrice = items?.map((item) => (isRecord(item) && isRecord(item.price) ? stripeId(item.price) : null)).find(Boolean);

  if (itemPrice) {
    return itemPrice;
  }

  const lines = isRecord(object.lines) && Array.isArray(object.lines.data) ? object.lines.data : null;

  return lines?.map((line) => (isRecord(line) && isRecord(line.price) ? stripeId(line.price) : null)).find(Boolean) ?? null;
}

function invoicePeriodUnix(object: StripeObject, key: "start" | "end") {
  const lines = isRecord(object.lines) && Array.isArray(object.lines.data) ? object.lines.data : [];
  const firstLine = lines.find(isRecord);
  const period = firstLine && isRecord(firstLine.period) ? firstLine.period : null;

  return period ? numberFrom(period[key]) : null;
}

function dateFromUnixSeconds(value: number | null) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function numberFrom(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
