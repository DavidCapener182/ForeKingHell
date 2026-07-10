import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, lt, or, sql } from "drizzle-orm";

import { billingCustomers, entitlements, stripeWebhookEvents, subscriptions } from "@/db/schema";
import { getDb } from "@/db/client";
import type { PlanKey } from "@/lib/billing";

export type StripeWebhookEvent = {
  id: string;
  created: number;
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
  claimEvent(input: {
    eventId: string;
    eventType: string;
    objectKey: string | null;
    eventCreatedAt: Date;
  }): Promise<"claimed" | "duplicate">;
  completeEvent(eventId: string, result: StripeWebhookResult): Promise<void>;
  failEvent(eventId: string, errorCode: string): Promise<void>;
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
  applySubscriptionState(input: SubscriptionStateInput): Promise<boolean>;
  replacePlanEntitlements(input: {
    userId: string;
    planKey: PlanKey;
    active: boolean;
    expiresAt: Date | null;
    source: string;
  }): Promise<void>;
};

type SubscriptionStateInput = {
  userId: string;
  billingCustomerId: string | null;
  stripeSubscriptionId: string;
  planKey: PlanKey;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  metadataJson: Record<string, unknown>;
  active: boolean;
  source: string;
  eventId: string;
  eventCreatedAt: Date;
};

type WebhookContext = {
  eventId: string;
  eventCreatedAt: Date;
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
    ["ai_monthly_credits", { value: 0 }],
    ["ai_daily_chat_messages", { value: 0 }],
    ["ai_scorecard_extracts_monthly", { value: 0 }],
  ],
  plus: [
    ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
    ["max_friend_groups", { value: 8 }],
    ["max_private_challenges", { value: 999999, label: "Unlimited" }],
    ["private_course_record_boards", { value: true }],
    ["private_friend_tournaments", { value: true }],
    ["advanced_reports", { value: true }],
    ["ai_monthly_credits", { value: 10 }],
    ["ai_daily_chat_messages", { value: 0 }],
    ["ai_scorecard_extracts_monthly", { value: 2 }],
  ],
  pro: [
    ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
    ["max_friend_groups", { value: 12 }],
    ["max_private_challenges", { value: 999999, label: "Unlimited" }],
    ["advanced_reports", { value: true }],
    ["can_use_ai_coach", { value: true }],
    ["friend_comparison_insights", { value: true }],
    ["challenge_analytics", { value: true }],
    ["ai_record_strategy", { value: true }],
    ["advanced_verification_analytics", { value: true }],
    ["device_import_square", { value: true }],
    ["device_import_trackman", { value: true }],
    ["ai_monthly_credits", { value: 100 }],
    ["ai_daily_chat_messages", { value: 30 }],
    ["ai_scorecard_extracts_monthly", { value: 10 }],
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
    ["host_major_tournaments", { value: true }],
    ["evidence_review_queue", { value: true }],
    ["max_player_seats", { value: 25 }],
    ["ai_monthly_credits", { value: 300 }],
    ["ai_daily_chat_messages", { value: 60 }],
    ["ai_scorecard_extracts_monthly", { value: 25 }],
  ],
  full: [
    ["lifetime_full", { value: true }],
    ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
    ["max_friend_groups", { value: 999999, label: "Unlimited" }],
    ["max_private_challenges", { value: 999999, label: "Unlimited" }],
    ["monthly_course_record_attempts", { value: 999999, label: "Unlimited" }],
    ["private_course_record_boards", { value: true }],
    ["private_friend_tournaments", { value: true }],
    ["host_major_tournaments", { value: true }],
    ["can_use_ai_coach", { value: true }],
    ["advanced_reports", { value: true }],
    ["friend_comparison_insights", { value: true }],
    ["challenge_analytics", { value: true }],
    ["ai_record_strategy", { value: true }],
    ["advanced_verification_analytics", { value: true }],
    ["coach_dashboard", { value: true }],
    ["evidence_review_queue", { value: true }],
    ["max_player_seats", { value: 999999, label: "Unlimited" }],
    ["device_import_square", { value: true }],
    ["device_import_trackman", { value: true }],
    ["admin_operations", { value: true }],
    ["ai_monthly_credits", { value: 1000, label: "Internal safety cap" }],
    ["ai_daily_chat_messages", { value: 100 }],
    ["ai_scorecard_extracts_monthly", { value: 50 }],
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
  if (!isHandledStripeEventType(event.type)) {
    return { handled: false, type: event.type, reason: "ignored_event_type" };
  }

  if (!event.id || !Number.isFinite(event.created) || event.created <= 0) {
    return { handled: false, type: event.type, reason: "invalid_event_identity" };
  }

  const context: WebhookContext = {
    eventId: event.id,
    eventCreatedAt: new Date(event.created * 1000),
  };
  const claimed = await store.claimEvent({
    eventId: context.eventId,
    eventType: event.type,
    objectKey: stripeId(event.data.object.subscription) ?? stripeId(event.data.object.id),
    eventCreatedAt: context.eventCreatedAt,
  });

  if (claimed === "duplicate") {
    return { handled: true, type: event.type, reason: "duplicate_event" };
  }

  try {
    let result: StripeWebhookResult;

    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(
          event.data.object,
          store,
          env,
          event.type,
          context,
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(
          event.data.object,
          store,
          env,
          event.type,
          context,
        );
        break;
      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(
          event.data.object,
          store,
          env,
          event.type,
          context,
        );
        break;
      case "invoice.paid":
        result = await handleInvoicePaid(event.data.object, store, env, event.type, context);
        break;
      case "invoice.payment_failed":
        result = await handleInvoicePaymentFailed(
          event.data.object,
          store,
          env,
          event.type,
          context,
        );
        break;
    }

    await store.completeEvent(context.eventId, result);
    return result;
  } catch (error) {
    await store.failEvent(context.eventId, errorCodeForWebhookFailure(error));
    throw error;
  }
}

export function createDrizzleBillingWebhookStore(): BillingWebhookStore {
  return {
    async claimEvent(input) {
      const now = new Date();
      const [inserted] = await getDb()
        .insert(stripeWebhookEvents)
        .values({
          eventId: input.eventId,
          eventType: input.eventType,
          objectKey: input.objectKey,
          eventCreatedAt: input.eventCreatedAt,
          status: "processing",
          receivedAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning({ eventId: stripeWebhookEvents.eventId });

      if (inserted) {
        return "claimed";
      }

      const staleBefore = new Date(now.getTime() - 10 * 60 * 1000);
      const [reclaimed] = await getDb()
        .update(stripeWebhookEvents)
        .set({
          status: "processing",
          attempts: sql`${stripeWebhookEvents.attempts} + 1`,
          errorCode: null,
          processedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(stripeWebhookEvents.eventId, input.eventId),
            or(
              eq(stripeWebhookEvents.status, "failed"),
              and(
                eq(stripeWebhookEvents.status, "processing"),
                lt(stripeWebhookEvents.updatedAt, staleBefore),
              ),
            ),
          ),
        )
        .returning({ eventId: stripeWebhookEvents.eventId });

      return reclaimed ? "claimed" : "duplicate";
    },
    async completeEvent(eventId, result) {
      await getDb()
        .update(stripeWebhookEvents)
        .set({
          status: "processed",
          resultJson: { ...result },
          errorCode: null,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stripeWebhookEvents.eventId, eventId));
    },
    async failEvent(eventId, errorCode) {
      await getDb()
        .update(stripeWebhookEvents)
        .set({
          status: "failed",
          errorCode,
          updatedAt: new Date(),
        })
        .where(eq(stripeWebhookEvents.eventId, eventId));
    },
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
    async applySubscriptionState(input) {
      return getDb().transaction(async (tx) => {
        const now = new Date();
        const [applied] = await tx
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
            lastStripeEventId: input.eventId,
            lastStripeEventCreatedAt: input.eventCreatedAt,
            metadataJson: input.metadataJson,
            updatedAt: now,
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
              lastStripeEventId: input.eventId,
              lastStripeEventCreatedAt: input.eventCreatedAt,
              metadataJson: input.metadataJson,
              updatedAt: now,
            },
            setWhere: sql`
              ${subscriptions.lastStripeEventCreatedAt} IS NULL
              OR ${subscriptions.lastStripeEventCreatedAt} < ${input.eventCreatedAt}
              OR (
                ${subscriptions.lastStripeEventCreatedAt} = ${input.eventCreatedAt}
                AND COALESCE(${subscriptions.lastStripeEventId}, '') < ${input.eventId}
              )
            `,
          })
          .returning({ id: subscriptions.id });

        if (!applied) {
          return false;
        }

        await tx
          .delete(entitlements)
          .where(and(eq(entitlements.userId, input.userId), eq(entitlements.source, input.source)));

        if (input.active) {
          await tx.insert(entitlements).values(
            entitlementRowsForPlan(input.userId, input.planKey, {
              source: input.source,
              expiresAt: input.currentPeriodEnd,
              now,
            }),
          );
        }

        return true;
      });
    },
    async replacePlanEntitlements(input) {
      const now = new Date();

      await getDb().transaction(async (tx) => {
        await tx
          .delete(entitlements)
          .where(and(eq(entitlements.userId, input.userId), eq(entitlements.source, input.source)));

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
  context: WebhookContext,
): Promise<StripeWebhookResult> {
  const metadata = objectMetadata(object);
  const userId = stringFrom(metadata.user_id) ?? stringFrom(object.client_reference_id);
  const customerId = stripeId(object.customer);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);
  const subscriptionId = stripeId(object.subscription);
  const paid = object.payment_status === "paid";

  if (!userId) {
    return Promise.resolve({ handled: false, type, planKey, reason: "missing_user_id" });
  }

  if (!subscriptionId) {
    return Promise.resolve({
      handled: false,
      type,
      userId,
      planKey,
      reason: "missing_subscription_id",
    });
  }

  return upsertCustomerSubscriptionAndEntitlements({
    store,
    type,
    userId,
    customerId,
    email: stringFrom(object.customer_email),
    subscriptionId,
    planKey,
    status: paid ? "active" : "checkout_completed",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    active: paid,
    metadataJson: {
      stripeEvent: type,
      checkoutSessionId: stringFrom(object.id),
      checkoutStatus: stringFrom(object.status),
      paymentStatus: stringFrom(object.payment_status),
      metadata,
    },
    ...context,
  });
}

async function handleSubscriptionUpdated(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
  context: WebhookContext,
): Promise<StripeWebhookResult> {
  const metadata = objectMetadata(object);
  const customerId = stripeId(object.customer);
  const userId =
    stringFrom(metadata.user_id) ??
    (customerId ? await store.findUserIdByStripeCustomerId(customerId) : null);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);
  const status = stringFrom(object.status) ?? "unknown";
  const subscriptionId = stripeId(object.id);

  if (!userId || !subscriptionId) {
    return {
      handled: false,
      type,
      planKey,
      reason: !userId ? "missing_user_id" : "missing_subscription_id",
    };
  }

  return upsertCustomerSubscriptionAndEntitlements({
    store,
    type,
    userId,
    customerId,
    email: null,
    subscriptionId,
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
    ...context,
  });
}

async function handleSubscriptionDeleted(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
  context: WebhookContext,
): Promise<StripeWebhookResult> {
  const result = await handleSubscriptionUpdated(
    {
      ...object,
      status: stringFrom(object.status) ?? "canceled",
    },
    store,
    env,
    type,
    context,
  );

  return result.handled && result.reason !== "stale_event_ignored"
    ? { ...result, reason: "revoked_plan_entitlements" }
    : result;
}

async function handleInvoicePaid(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
  context: WebhookContext,
): Promise<StripeWebhookResult> {
  const customerId = stripeId(object.customer);
  const userId = customerId ? await store.findUserIdByStripeCustomerId(customerId) : null;
  const subscriptionId = stripeId(object.subscription);
  const metadata = objectMetadata(object);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);

  if (!userId || !subscriptionId) {
    return {
      handled: false,
      type,
      planKey,
      reason: !userId ? "missing_user_id" : "missing_subscription_id",
    };
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
    ...context,
  });
}

async function handleInvoicePaymentFailed(
  object: StripeObject,
  store: BillingWebhookStore,
  env: StripeWebhookEnv,
  type: string,
  context: WebhookContext,
): Promise<StripeWebhookResult> {
  const customerId = stripeId(object.customer);
  const userId = customerId ? await store.findUserIdByStripeCustomerId(customerId) : null;
  const subscriptionId = stripeId(object.subscription);
  const metadata = objectMetadata(object);
  const planKey = resolvePlanKey(metadata, firstPriceId(object), env);

  if (!userId || !subscriptionId) {
    return {
      handled: false,
      type,
      planKey,
      reason: !userId ? "missing_user_id" : "missing_subscription_id",
    };
  }

  return upsertCustomerSubscriptionAndEntitlements({
    store,
    type,
    userId,
    customerId,
    email: stringFrom(object.customer_email),
    subscriptionId,
    planKey,
    status: "past_due",
    currentPeriodStart: dateFromUnixSeconds(invoicePeriodUnix(object, "start")),
    currentPeriodEnd: dateFromUnixSeconds(invoicePeriodUnix(object, "end")),
    cancelAtPeriodEnd: false,
    active: false,
    metadataJson: {
      stripeEvent: type,
      invoiceId: stringFrom(object.id),
      hostedInvoiceUrl: stringFrom(object.hosted_invoice_url),
      metadata,
    },
    successReason: "payment_failed_revoked_entitlements",
    ...context,
  });
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
  eventId: string;
  eventCreatedAt: Date;
  successReason?: string;
}): Promise<StripeWebhookResult> {
  const customer = input.customerId
    ? await input.store.upsertBillingCustomer({
        userId: input.userId,
        stripeCustomerId: input.customerId,
        email: input.email,
      })
    : null;

  if (!input.subscriptionId) {
    return {
      handled: false,
      type: input.type,
      userId: input.userId,
      planKey: input.planKey,
      reason: "missing_subscription_id",
    };
  }

  const applied = await input.store.applySubscriptionState({
    userId: input.userId,
    billingCustomerId: customer?.id ?? null,
    stripeSubscriptionId: input.subscriptionId,
    planKey: input.planKey,
    status: input.status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    metadataJson: input.metadataJson,
    active: input.active,
    source: "plan",
    eventId: input.eventId,
    eventCreatedAt: input.eventCreatedAt,
  });

  return {
    handled: true,
    type: input.type,
    userId: input.userId,
    planKey: input.planKey,
    reason: applied ? input.successReason : "stale_event_ignored",
  };
}

function resolvePlanKey(
  metadata: Record<string, unknown>,
  priceId: string | null,
  env: StripeWebhookEnv,
): PlanKey {
  if (priceId) {
    for (const [planKey, envKeys] of Object.entries(priceEnvByPlan) as Array<
      [PlanKey, readonly string[]]
    >) {
      if (envKeys.some((envKey) => env[envKey] === priceId)) {
        return planKey;
      }
    }
  }

  const metadataPlan = stringFrom(metadata.plan_key);

  if (
    metadataPlan === "plus" ||
    metadataPlan === "pro" ||
    metadataPlan === "coach" ||
    metadataPlan === "full"
  ) {
    return metadataPlan;
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

  const items =
    isRecord(object.items) && Array.isArray(object.items.data) ? object.items.data : null;
  const itemPrice = items
    ?.map((item) => (isRecord(item) && isRecord(item.price) ? stripeId(item.price) : null))
    .find(Boolean);

  if (itemPrice) {
    return itemPrice;
  }

  const lines =
    isRecord(object.lines) && Array.isArray(object.lines.data) ? object.lines.data : null;

  return (
    lines
      ?.map((line) => (isRecord(line) && isRecord(line.price) ? stripeId(line.price) : null))
      .find(Boolean) ?? null
  );
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

function isHandledStripeEventType(
  type: string,
): type is
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed" {
  return (
    type === "checkout.session.completed" ||
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted" ||
    type === "invoice.paid" ||
    type === "invoice.payment_failed"
  );
}

function errorCodeForWebhookFailure(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name.slice(0, 120);
  }

  return "webhook_processing_failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
