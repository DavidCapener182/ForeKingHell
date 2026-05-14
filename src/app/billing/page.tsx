import Link from "next/link";
import { Check, CreditCard, LockKeyhole, Sparkles, Zap } from "lucide-react";

import { createCheckoutAction, openCustomerPortalAction } from "@/app/billing/actions";
import { PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBillingPageData, type BillingPlan } from "@/lib/billing";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: Promise<{
    checkout?: string;
    portal?: string;
    plan?: string;
  }>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const data = await getBillingPageData();
  const visiblePlans = data.plans.filter((plan) => !plan.internal || plan.key === data.activePlanKey);

  return (
    <PageShell size="7xl">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusPill tone="sky">Monetisation</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Billing and entitlements</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Social basics stay free. Advanced analytics, AI coaching, private leagues and coach/group tools are controlled by entitlements.
            </p>
          </div>
          <Badge variant={data.stripeConfigured ? "secondary" : "outline"} className="gap-1">
            <CreditCard className="size-3" />
            Stripe {data.stripeConfigured ? "configured" : "not configured"}
          </Badge>
        </div>
        {params?.checkout || params?.portal ? (
          <div className="mt-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            {billingStatusMessage(params.checkout, params.portal, params.plan)}
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <main className="grid gap-4 md:grid-cols-2">
          {visiblePlans.map((plan) => (
            <PlanCard key={plan.key} plan={plan} active={plan.key === data.activePlanKey} stripeConfigured={data.stripeConfigured} />
          ))}
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Current plan</p>
            <div className="mt-3 rounded-xl bg-slate-50 p-4">
              <p className="text-2xl font-semibold tracking-normal">{planLabel(data.plans, data.activePlanKey)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.activePlanKey === "full"
                  ? "Lifetime full access."
                  : data.latestSubscription
                    ? `${data.latestSubscription.status} subscription`
                    : "No paid subscription yet."}
              </p>
            </div>
            <form action={openCustomerPortalAction} className="mt-3">
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={!data.stripeConfigured || !data.billingCustomer?.stripeCustomerId}
              >
                <CreditCard className="size-4" />
                Customer portal
              </Button>
            </form>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Entitlement snapshot</p>
            <div className="mt-3 grid gap-2">
              {data.planLimits
                .filter((limit) => limit.planKey === data.activePlanKey)
                .slice(0, 8)
                .map((limit) => (
                  <div key={limit.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium">{label(limit.limitKey)}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{JSON.stringify(limit.limitValueJson)}</p>
                  </div>
                ))}
              {data.planLimits.filter((limit) => limit.planKey === data.activePlanKey).length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Free plan defaults apply.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole className="size-4 text-emerald-600" />
              Implementation state
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Checkout is wired to Stripe price environment variables. Subscription webhooks can update these tables without changing feature checks.
            </p>
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href="/settings" prefetch={false}>Account settings</Link>
            </Button>
          </section>
        </aside>
      </section>
    </PageShell>
  );
}

function PlanCard({ plan, active, stripeConfigured }: { plan: BillingPlan; active: boolean; stripeConfigured: boolean }) {
  return (
    <article className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={active ? "secondary" : "outline"}>{active ? "Current" : plan.audience}</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">{plan.name}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{plan.description}</p>
        </div>
        {plan.key === "pro" ? <Sparkles className="size-5 text-emerald-600" /> : <Zap className="size-5 text-slate-500" />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Price label="Monthly" value={plan.monthlyPrice} />
        <Price label="Yearly" value={plan.yearlyPrice} />
      </div>
      <ul className="mt-4 grid gap-2 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <form action={createCheckoutAction} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="planKey" value={plan.key} />
        <select name="interval" className="h-9 rounded-xl border bg-slate-50 px-3 text-sm" disabled={plan.key === "free"}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <Button type="submit" disabled={active || (plan.key !== "free" && !stripeConfigured)}>
          {active ? "Active" : plan.internal ? "Granted internally" : plan.key === "free" ? "Use free" : "Checkout"}
        </Button>
      </form>
    </article>
  );
}

function Price({ label: priceLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{priceLabel}</p>
      <p className="mt-1 text-lg font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function billingStatusMessage(checkout?: string, portal?: string, plan?: string) {
  if (portal === "not-configured") {
    return "Stripe Billing Portal is not configured yet. Add STRIPE_SECRET_KEY and enable the customer portal in Stripe.";
  }

  if (portal === "missing-customer") {
    return "No Stripe customer is linked to this account yet. Start checkout first, then the webhook can attach the customer ID.";
  }

  if (portal === "error") {
    return "Stripe Billing Portal could not be opened.";
  }

  if (checkout === "not-configured") {
    return `Stripe price IDs are not configured for ${plan ?? "that plan"} yet. Add STRIPE_SECRET_KEY and the matching STRIPE_*_PRICE_ID values.`;
  }

  if (checkout === "success") {
    return "Checkout completed. Subscription state will update after the Stripe webhook records the entitlement.";
  }

  if (checkout === "cancelled") {
    return "Checkout was cancelled.";
  }

  return "Checkout could not be started.";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function planLabel(plans: BillingPlan[], value: string) {
  return plans.find((plan) => plan.key === value)?.name ?? label(value);
}
