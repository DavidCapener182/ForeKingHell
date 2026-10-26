import "server-only";
import { proFeatureStorageReady } from "./pro-feature-readiness";
import { randomUUID } from "node:crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { billingTrials, entitlements, importFiles, subscriptions, usageEvents } from "@/db/schema";
import type { PlanKey } from "./billing-plan-catalog";
import { isProTrialSubscription, proTrialEligibility } from "./billing-pro-trial-policy";

export type BillingTrialExecutor = Pick<
  ReturnType<typeof getDb>,
  "select" | "insert" | "update" | "execute"
>;

export async function getProTrialEligibility(
  userId: string,
  activePlanKey?: PlanKey,
  executor: BillingTrialExecutor = getDb(),
) {
  if (!(await proFeatureStorageReady(executor)))
    return {
      eligible: false,
      consumed: false,
      reason: "unavailable" as const,
      endsAt: null,
      startedAt: null,
      configured: false,
      storageReady: false,
    };
  const plan = activePlanKey ?? (await readActivePlan(userId, executor));
  // The existing usage ledger survives a code-first rollout before migration 0062.
  await executor.execute(sql`
    insert into fkh_billing_trials (user_id, pro_trial_eligible_after_import_at)
    select ${userId}::uuid, min(created_at) from fkh_usage_events
    where user_id = ${userId}::uuid and event_type = 'pro_trial_import_eligible'
    having count(*) > 0
    on conflict (user_id) do update set pro_trial_eligible_after_import_at =
      coalesce(fkh_billing_trials.pro_trial_eligible_after_import_at,
        excluded.pro_trial_eligible_after_import_at)
  `);
  const [trial] = await executor
    .select()
    .from(billingTrials)
    .where(eq(billingTrials.userId, userId))
    .limit(1);
  const history = await executor
    .select({
      planKey: subscriptions.planKey,
      status: subscriptions.status,
      metadataJson: subscriptions.metadataJson,
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.planKey, "pro")));
  const state = proTrialEligibility({
    activePlanKey: plan,
    eligibleAfterImportAt: trial?.proTrialEligibleAfterImportAt ?? null,
    consumedAt: trial?.proTrialConsumedAt ?? null,
    priorTrial: history.some((row) =>
      isProTrialSubscription(row.planKey, row.status, row.metadataJson),
    ),
  });
  return {
    ...state,
    storageReady: true,
    endsAt: trial?.proTrialEndsAt?.toISOString() ?? null,
    startedAt: trial?.proTrialStartedAt?.toISOString() ?? null,
    configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_MONTHLY_PRICE_ID),
  };
}

async function readActivePlan(userId: string, executor: BillingTrialExecutor) {
  const [latest] = await executor
    .select({
      planKey: subscriptions.planKey,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  const grants = await executor.select().from(entitlements).where(eq(entitlements.userId, userId));
  return (await import("./billing")).resolveActivePlanKey(latest ?? null, grants);
}

export async function assertCanStartProTrial(
  userId: string,
  executor: BillingTrialExecutor = getDb(),
) {
  const state = await getProTrialEligibility(userId, undefined, executor);
  if (!state.eligible)
    throw new Error(
      "A Pro trial requires a successful import, a Free plan and no previous Pro trial.",
    );
  return state;
}

export async function markTrialEligibleAfterFirstImport(
  userId: string,
  executor: BillingTrialExecutor = getDb(),
) {
  const [imports] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(importFiles)
    .where(and(eq(importFiles.userId, userId), ne(importFiles.status, "duplicate")));
  if (imports?.total !== 1) return false;
  await executor.execute(sql`
    insert into fkh_usage_events (user_id, event_type, quantity)
    select ${userId}::uuid, 'pro_trial_import_eligible', 1
    where not exists (select 1 from fkh_usage_events
      where user_id = ${userId}::uuid and event_type = 'pro_trial_import_eligible')
  `);
  if (!(await proFeatureStorageReady(executor))) return false;
  await executor
    .insert(billingTrials)
    .values({ userId, proTrialEligibleAfterImportAt: new Date() })
    .onConflictDoNothing();
  return true;
}

export async function markTrialConsumed(
  input: { userId: string; subscriptionId: string; startedAt: Date | null; endsAt: Date | null },
  executor?: BillingTrialExecutor,
): Promise<boolean> {
  if (!(await proFeatureStorageReady(executor ?? getDb()))) return false;
  if (!executor) return getDb().transaction((tx) => markTrialConsumed(input, tx));
  await executor.insert(billingTrials).values({ userId: input.userId }).onConflictDoNothing();
  const [previous] = await executor
    .select()
    .from(billingTrials)
    .where(eq(billingTrials.userId, input.userId))
    .for("update");
  const now = new Date();
  await executor
    .insert(billingTrials)
    .values({
      userId: input.userId,
      proTrialStartedAt: input.startedAt,
      proTrialEndsAt: input.endsAt,
      proTrialConsumedAt: now,
      stripeSubscriptionId: input.subscriptionId,
    })
    .onConflictDoUpdate({
      target: billingTrials.userId,
      set: {
        proTrialStartedAt: sql`coalesce(${billingTrials.proTrialStartedAt}, ${input.startedAt?.toISOString() ?? null}::timestamptz)`,
        proTrialEndsAt: input.endsAt ?? previous?.proTrialEndsAt ?? null,
        proTrialConsumedAt: sql`coalesce(${billingTrials.proTrialConsumedAt}, ${now.toISOString()}::timestamptz)`,
        stripeSubscriptionId: sql`coalesce(${billingTrials.stripeSubscriptionId}, ${input.subscriptionId})`,
        updatedAt: now,
      },
    });
  return !previous?.proTrialConsumedAt;
}

/** A row lock shares one request ID across devices. Stale attempts require provider reconciliation. */
export async function reserveProTrialCheckout(userId: string) {
  if (!(await proFeatureStorageReady()))
    throw new Error("Trial checkout is temporarily unavailable.");
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(billingTrials)
      .where(eq(billingTrials.userId, userId))
      .for("update");
    if (!row) throw new Error("Import a measured session before starting a Pro trial.");
    await assertCanStartProTrial(userId, tx);
    if (row.checkoutUrl && row.checkoutSessionId)
      return {
        requestId: row.checkoutRequestId!,
        url: row.checkoutUrl,
        sessionId: row.checkoutSessionId,
      };
    let requestId = row.checkoutRequestId;
    let requestedAt = row.checkoutRequestedAt;
    if (
      row.checkoutRequestId &&
      row.checkoutRequestedAt &&
      Date.now() - row.checkoutRequestedAt.getTime() >= 23 * 60 * 60 * 1000
    ) {
      // Never replay an idempotency key after Stripe may have pruned it. Search
      // all bounded result pages before concluding that no session was created.
      const existing = await findReservedStripeCheckout(
        userId,
        row.checkoutRequestId,
        row.checkoutRequestedAt,
      );
      if (existing?.status === "complete") throw new Error("Checkout confirmation pending.");
      if (existing?.status === "open") {
        const target = new URL(existing.url ?? "");
        if (target.protocol !== "https:" || target.hostname !== "checkout.stripe.com")
          throw new Error("Invalid recovered checkout destination.");
        await tx
          .update(billingTrials)
          .set({ checkoutSessionId: existing.id, checkoutUrl: target.href, updatedAt: new Date() })
          .where(eq(billingTrials.userId, userId));
        return { requestId: row.checkoutRequestId, url: target.href, sessionId: existing.id };
      }
      requestId = null;
      requestedAt = null;
    }
    requestId ??= randomUUID();
    await tx
      .update(billingTrials)
      .set({
        checkoutRequestId: requestId,
        checkoutRequestedAt: requestedAt ?? new Date(),
        checkoutSessionId: null,
        checkoutUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(billingTrials.userId, userId));
    return { requestId, url: null, sessionId: null };
  });
}

async function findReservedStripeCheckout(userId: string, requestId: string, requestedAt: Date) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("Checkout reconciliation is unavailable.");
  const params = new URLSearchParams({
    limit: "100",
    "created[gte]": String(Math.floor(requestedAt.getTime() / 1000) - 60),
  });
  const matches: Array<{
    id: string;
    status: "open" | "expired" | "complete";
    url: string | null;
  }> = [];
  for (let page = 0; page < 5; page++) {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const payload: unknown = await response.json();
    if (
      !response.ok ||
      !payload ||
      typeof payload !== "object" ||
      !("data" in payload) ||
      !Array.isArray(payload.data) ||
      !("has_more" in payload) ||
      typeof payload.has_more !== "boolean"
    )
      throw new Error("Could not confirm previous checkout.");
    for (const entry of payload.data) {
      if (
        entry?.client_reference_id !== userId ||
        entry?.metadata?.user_id !== userId ||
        entry?.metadata?.trial_request_id !== requestId
      )
        continue;
      if (typeof entry.id !== "string" || !["open", "expired", "complete"].includes(entry.status))
        throw new Error("Unexpected checkout reconciliation result.");
      matches.push({ id: entry.id, status: entry.status, url: entry.url ?? null });
    }
    if (!payload.has_more) {
      if (matches.length > 1) throw new Error("Multiple prior checkouts require confirmation.");
      return matches[0] ?? null;
    }
    const lastId = payload.data.at(-1)?.id;
    if (typeof lastId !== "string" || lastId === params.get("starting_after"))
      throw new Error("Incomplete checkout reconciliation.");
    params.set("starting_after", lastId);
  }
  throw new Error("Checkout reconciliation needs a narrower provider review.");
}

export async function rememberProTrialCheckout(
  userId: string,
  requestId: string,
  sessionId: string,
  url: string,
) {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.hostname !== "checkout.stripe.com")
    throw new Error("Stripe returned an invalid checkout destination.");
  await getDb().transaction(async (tx) => {
    const changed = await tx
      .update(billingTrials)
      .set({ checkoutSessionId: sessionId, checkoutUrl: url, updatedAt: new Date() })
      .where(
        and(
          eq(billingTrials.userId, userId),
          eq(billingTrials.checkoutRequestId, requestId),
          sql`${billingTrials.checkoutSessionId} is null`,
        ),
      )
      .returning({ userId: billingTrials.userId });
    if (changed.length)
      await tx.insert(usageEvents).values({
        userId,
        eventType: "pro_trial_checkout_started",
        quantity: 1,
        sourceId: sessionId,
      });
  });
}

/** Clear only a provider-confirmed expired session belonging to this reservation. */
export async function clearExpiredProTrialCheckout(
  userId: string,
  requestId: string,
  sessionId: string,
) {
  const changed = await getDb()
    .update(billingTrials)
    .set({
      checkoutRequestId: null,
      checkoutRequestedAt: null,
      checkoutSessionId: null,
      checkoutUrl: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(billingTrials.userId, userId),
        eq(billingTrials.checkoutRequestId, requestId),
        eq(billingTrials.checkoutSessionId, sessionId),
        sql`${billingTrials.proTrialConsumedAt} is null`,
      ),
    )
    .returning({ userId: billingTrials.userId });
  return changed.length > 0;
}
