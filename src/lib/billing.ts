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
import { requireCurrentUserId } from "@/lib/current-user";

export const billingIntervals = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof billingIntervals)[number];

export type PlanKey = "free" | "plus" | "pro" | "coach" | "full";

export type BillingPlan = {
  key: PlanKey;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  audience: string;
  description: string;
  features: string[];
  priceEnv: Partial<Record<BillingInterval, string>>;
  internal?: boolean;
};

const defaultAiPlanLimitValues = {
  free: [
    ["ai_monthly_credits", { value: 0 }],
    ["ai_daily_chat_messages", { value: 0 }],
    ["ai_scorecard_extracts_monthly", { value: 0 }],
  ],
  plus: [
    ["ai_monthly_credits", { value: 10 }],
    ["ai_daily_chat_messages", { value: 0 }],
    ["ai_scorecard_extracts_monthly", { value: 2 }],
  ],
  pro: [
    ["ai_monthly_credits", { value: 100 }],
    ["ai_daily_chat_messages", { value: 30 }],
    ["ai_scorecard_extracts_monthly", { value: 10 }],
  ],
  coach: [
    ["ai_monthly_credits", { value: 300 }],
    ["ai_daily_chat_messages", { value: 60 }],
    ["ai_scorecard_extracts_monthly", { value: 25 }],
  ],
  full: [
    ["ai_monthly_credits", { value: 1000, label: "Internal safety cap" }],
    ["ai_daily_chat_messages", { value: 100 }],
    ["ai_scorecard_extracts_monthly", { value: 50 }],
  ],
} as const satisfies Record<PlanKey, ReadonlyArray<readonly [string, Record<string, unknown>]>>;

export const lifetimeFullEntitlements = [
  ["lifetime_full", { value: true }],
  ["max_monthly_imports", { value: 999999, label: "Unlimited" }],
  ["max_friend_groups", { value: 999999, label: "Unlimited" }],
  ["max_private_challenges", { value: 999999, label: "Unlimited" }],
  ["monthly_course_record_attempts", { value: 999999, label: "Unlimited" }],
  ["private_course_record_boards", { value: true }],
  ["private_friend_tournaments", { value: true }],
  ["host_major_tournaments", { value: true }],
  ["can_use_ai_coach", { value: true }],
  ["ai_monthly_credits", { value: 1000, label: "Internal safety cap" }],
  ["ai_daily_chat_messages", { value: 100 }],
  ["ai_scorecard_extracts_monthly", { value: 50 }],
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
] as const satisfies ReadonlyArray<readonly [string, Record<string, unknown>]>;

export const billingPlans: BillingPlan[] = [
  {
    key: "free",
    name: "Free",
    monthlyPrice: "£0",
    yearlyPrice: "£0",
    audience: "Rapsodo CSV starters",
    description: "Starter importing, trust checks, public records and basic social play.",
    features: [
      "5 monthly imports",
      "Import Quality and Data Health",
      "Basic bag and stock yardage views",
      "Public course records",
      "Monthly public boards",
      "Basic friend and profile features",
    ],
    priceEnv: {},
  },
  {
    key: "plus",
    name: "Plus",
    monthlyPrice: "£6.99",
    yearlyPrice: "£69",
    audience: "Players tracking long-term improvement",
    description: "Unlimited history, private competition, share cards and light AI review.",
    features: [
      "Unlimited imports and history",
      "Advanced bag and progress views",
      "Private course boards, tournaments and challenges",
      "Share-card customisation",
      "10 AI credits per month",
      "Weekly recaps, practice recaps, captions and session roast",
      "2 scorecard extracts per month",
    ],
    priceEnv: {
      monthly: "STRIPE_PLUS_MONTHLY_PRICE_ID",
      yearly: "STRIPE_PLUS_YEARLY_PRICE_ID",
    },
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: "£12.99",
    yearlyPrice: "£119",
    audience: "Launch-monitor power users",
    description: "AI coaching, Data Chat, course strategy and deeper launch-monitor analytics.",
    features: [
      "AI coach and Ask Coach chat",
      "Data Chat from your golf history",
      "100 AI credits per month",
      "30 AI chat messages per day",
      "AI course strategy and practice reviews",
      "10 scorecard extracts per month",
      "Friend comparison and challenge analytics",
      "Square and TrackMan beta adapters when enabled",
    ],
    priceEnv: {
      monthly: "STRIPE_PRO_MONTHLY_PRICE_ID",
      yearly: "STRIPE_PRO_YEARLY_PRICE_ID",
    },
  },
  {
    key: "coach",
    name: "Coach / Club",
    monthlyPrice: "£49",
    yearlyPrice: "£499",
    audience: "Coaches, societies and simulator venues",
    description: "Player seats, coach dashboards, hosted events and evidence review.",
    features: [
      "Up to 25 player seats",
      "Coach dashboard and player summaries",
      "Private leagues and player groups",
      "Major-style tournaments",
      "Evidence review queue",
      "300 pooled AI credits",
      "60 AI chat messages per day",
      "25 scorecard extracts per month",
      "Export standings",
      "Custom pricing above 25 players",
    ],
    priceEnv: {
      monthly: "STRIPE_COACH_MONTHLY_PRICE_ID",
      yearly: "STRIPE_COACH_YEARLY_PRICE_ID",
    },
  },
  {
    key: "full",
    name: "Lifetime Full",
    monthlyPrice: "Lifetime",
    yearlyPrice: "No renewal",
    audience: "Internal owner grant",
    description: "Permanent full access for owner and operator accounts that run the site.",
    features: [
      "Unlimited imports",
      "AI coach",
      "Data Chat",
      "Internal AI safety cap",
      "Major-style tournaments",
      "All provider adapters",
      "Admin operations",
    ],
    priceEnv: {},
    internal: true,
  },
];

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
  };
}

function withDefaultAiPlanLimits(rows: Array<typeof planLimits.$inferSelect>) {
  const existing = new Set(rows.map((row) => `${row.planKey}:${row.limitKey}`));
  const now = new Date();
  const defaults = billingPlans.flatMap((plan) =>
    defaultAiPlanLimitValues[plan.key]
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
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok || !isRecord(payload) || typeof payload.url !== "string") {
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
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok || !isRecord(payload) || typeof payload.url !== "string") {
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

function resolveActivePlanKey(
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
