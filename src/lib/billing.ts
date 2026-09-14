import { planEntitlements } from "@/lib/plan-entitlements";
import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import {
  billingCustomers,
  entitlements,
  planLimits,
  subscriptions,
  usageEvents,
  users,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { billingPlans, type BillingInterval, type PlanKey } from "@/lib/billing-plan-catalog";
import { requireCurrentUserId } from "@/lib/current-user";

export { billingIntervals, billingPlans } from "@/lib/billing-plan-catalog";
export type { BillingInterval, BillingPlan, PlanKey } from "@/lib/billing-plan-catalog";

export const lifetimeFullEntitlements = planEntitlements.full;

export async function getBillingPageData() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [billingCustomer] = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);
  const subscriptionHistory = await db
    .select({
      id: subscriptions.id,
      planKey: subscriptions.planKey,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(24);
  const latestSubscription = subscriptionHistory[0] ?? null;
  const entitlementRows = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId));
  const limitRows = await db
    .select()
    .from(planLimits)
    .where(
      inArray(
        planLimits.planKey,
        billingPlans.map((plan) => plan.key),
      ),
    );
  const activePlanKey = resolveActivePlanKey(latestSubscription, entitlementRows);

  return {
    user,
    billingCustomer,
    plans: billingPlans,
    activePlanKey,
    latestSubscription,
    subscriptionHistory,
    entitlements: entitlementRows,
    planLimits: withDefaultAiPlanLimits(limitRows),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    checkoutAvailability: getCheckoutAvailability(),
    portalAvailable: Boolean(process.env.STRIPE_SECRET_KEY && billingCustomer?.stripeCustomerId),
  };
}

export function getCheckoutAvailability(): Record<PlanKey, Record<BillingInterval, boolean>> {
  return Object.fromEntries(
    billingPlans.map((plan) => {
      const configured = (interval: BillingInterval) => {
        const priceName = plan.priceEnv[interval];
        return Boolean(
          plan.key !== "free" &&
          !plan.internal &&
          process.env.STRIPE_SECRET_KEY &&
          priceName &&
          process.env[priceName],
        );
      };
      return [plan.key, { monthly: configured("monthly"), yearly: configured("yearly") }];
    }),
  ) as Record<PlanKey, Record<BillingInterval, boolean>>;
}

function withDefaultAiPlanLimits(rows: Array<typeof planLimits.$inferSelect>) {
  const existing = new Set(rows.map((row) => `${row.planKey}:${row.limitKey}`));
  const now = new Date();
  const defaults = billingPlans.flatMap((plan) =>
    planEntitlements[plan.key]
      .filter(([limitKey]) => limitKey.startsWith("ai_"))
      .filter(([limitKey]) => !existing.has(`${plan.key}:${limitKey}`))
      .map(([limitKey, limitValueJson]) => ({
        id: `default-${plan.key}-${limitKey}`,
        planKey: plan.key,
        limitKey,
        limitValueJson,
        createdAt: now,
        updatedAt: now,
      })),
  );

  return [...rows, ...defaults];
}

export async function getActivePlanKeyForUser(userId: string): Promise<PlanKey> {
  const [latestSubscription] = await getDb()
    .select({
      planKey: subscriptions.planKey,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const entitlementRows = await getDb()
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId));

  return resolveActivePlanKey(latestSubscription, entitlementRows);
}

export function planAllowsPrivateChallenges(planKey: PlanKey) {
  return planKey !== "free";
}

export function planAllowsAiCoach(planKey: PlanKey) {
  return planKey === "pro" || planKey === "coach" || planKey === "full";
}

export async function createCheckoutSession(input: {
  planKey: PlanKey;
  interval: BillingInterval;
  origin: string;
}) {
  const userId = await requireCurrentUserId();
  const plan = billingPlans.find((candidate) => candidate.key === input.planKey);

  if (!plan || plan.key === "free") {
    return { url: "/billing?plan=free", error: null };
  }

  if (plan.internal)
    return { url: "/billing", error: "This plan is available only by an internal grant." };
  if ((await getActivePlanKeyForUser(userId)) !== "free") {
    return { url: "/billing", error: "Use Manage billing to change your existing plan." };
  }

  const priceEnvKey = plan.priceEnv[input.interval];
  const priceId = priceEnvKey ? process.env[priceEnvKey] : null;
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey || !priceId) {
    return {
      url: `/billing?checkout=not-configured&plan=${plan.key}`,
      error: "Stripe Checkout is not configured for this plan yet.",
    };
  }

  const customer = await ensureBillingCustomer(userId);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set(
    "success_url",
    `${input.origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${input.origin}/billing?checkout=cancelled`);
  params.set("client_reference_id", userId);
  params.set("metadata[user_id]", userId);
  params.set("metadata[plan_key]", plan.key);
  params.set("subscription_data[metadata][user_id]", userId);
  params.set("subscription_data[metadata][plan_key]", plan.key);

  if (customer?.stripeCustomerId) {
    params.set("customer", customer.stripeCustomerId);
  } else if (customer?.email) {
    params.set("customer_email", customer.email);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  }).catch(() => null);
  const payload = (await response?.json().catch(() => null)) as unknown;

  if (!response?.ok || !isRecord(payload) || typeof payload.url !== "string") {
    return {
      url: `/billing?checkout=error&plan=${plan.key}`,
      error: readStripeError(payload) ?? "Stripe Checkout could not be started.",
    };
  }

  return { url: payload.url, error: null };
}

export async function createCustomerPortalSession(origin: string) {
  const userId = await requireCurrentUserId();
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    return {
      url: "/billing?portal=not-configured",
      error: "Stripe Billing Portal is not configured yet.",
    };
  }

  const [customer] = await getDb()
    .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1);

  if (!customer?.stripeCustomerId) {
    return {
      url: "/billing?portal=missing-customer",
      error: "No Stripe customer is linked to this account yet.",
    };
  }

  const params = new URLSearchParams();
  params.set("customer", customer.stripeCustomerId);
  params.set("return_url", `${origin}/billing`);

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  }).catch(() => null);
  const payload = (await response?.json().catch(() => null)) as unknown;

  if (!response?.ok || !isRecord(payload) || typeof payload.url !== "string") {
    return {
      url: "/billing?portal=error",
      error: readStripeError(payload) ?? "Stripe Billing Portal could not be opened.",
    };
  }

  return { url: payload.url, error: null };
}

export async function recordUsageEvent(input: {
  eventType: string;
  quantity?: number;
  sourceId?: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  const userId = await requireCurrentUserId();
  await getDb()
    .insert(usageEvents)
    .values({
      userId,
      eventType: input.eventType.slice(0, 80),
      quantity: Math.max(1, input.quantity ?? 1),
      sourceId: input.sourceId?.slice(0, 220) ?? null,
      metadataJson: input.metadataJson ?? {},
    });
}

async function ensureBillingCustomer(userId: string) {
  const [user] = await getDb()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const now = new Date();
  const [customer] = await getDb()
    .insert(billingCustomers)
    .values({
      userId,
      email: user?.email ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: billingCustomers.userId,
      set: {
        email: user?.email ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return customer;
}

function parsePlanKey(value: string | null | undefined): PlanKey {
  return value === "plus" || value === "pro" || value === "coach" || value === "full"
    ? value
    : "free";
}

export function resolveActivePlanKey(
  latestSubscription: Pick<typeof subscriptions.$inferSelect, "planKey" | "status"> | null,
  entitlementRows: Array<
    Pick<typeof entitlements.$inferSelect, "entitlementKey" | "valueJson" | "expiresAt">
  >,
): PlanKey {
  const now = Date.now();
  const hasLifetimeFull = entitlementRows.some((entitlement) => {
    const active = !entitlement.expiresAt || entitlement.expiresAt.getTime() > now;
    return (
      entitlement.entitlementKey === "lifetime_full" &&
      active &&
      entitlement.valueJson?.value === true
    );
  });

  if (hasLifetimeFull) {
    return "full";
  }

  return parsePlanKey(
    latestSubscription?.status === "active" || latestSubscription?.status === "trialing"
      ? latestSubscription.planKey
      : "free",
  );
}

function readStripeError(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  return typeof payload.error.message === "string" ? payload.error.message : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
