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
  if (!(await proFeatureStorageReady(executor))) return false;
  const [imports] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(importFiles)
    .where(and(eq(importFiles.userId, userId), ne(importFiles.status, "duplicate")));
  if (imports?.total !== 1) return false;
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

/** A durable request ID and row lock give concurrent devices the same Stripe idempotency key.
 * An uncertain attempt is never replaced automatically; a matching expired Checkout event may clear it.
 */
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
    if (
      row.checkoutRequestId &&
      row.checkoutRequestedAt &&
      Date.now() - row.checkoutRequestedAt.getTime() >= 23 * 60 * 60 * 1000
    ) {
      throw new Error(
        "Your previous trial checkout needs confirmation before another can start. Open billing again after Stripe confirms its status.",
      );
    }
    const requestId = row.checkoutRequestId ?? randomUUID();
    await tx
      .update(billingTrials)
      .set({
        checkoutRequestId: requestId,
        checkoutRequestedAt: row.checkoutRequestedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(billingTrials.userId, userId));
    return { requestId, url: null, sessionId: null };
  });
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
