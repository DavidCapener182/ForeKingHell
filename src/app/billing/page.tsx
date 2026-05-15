import Link from "next/link";
import type { ReactNode } from "react";
import { Check, CreditCard, Sparkles, Trophy, Zap } from "lucide-react";

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
            <StatusPill tone="sky">Pricing</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Choose the plan for your golf network</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Social basics stay free. Upgrade when you need deeper analytics, AI coaching, private leagues, provider adapters or coach/club tools.
            </p>
          </div>
          {data.latestSubscription ? (
            <Badge variant="secondary" className="gap-1">
              <CreditCard className="size-3" />
              Current plan: {planLabel(data.plans, data.activePlanKey)}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
            <CreditCard className="size-3" />
              Free plan
            </Badge>
          )}
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
            <PlanCard
              key={plan.key}
              plan={plan}
              active={plan.key === data.activePlanKey}
              stripeConfigured={data.stripeConfigured}
              limits={data.planLimits.filter((limit) => limit.planKey === plan.key).slice(0, 4)}
            />
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
            <p className="text-sm font-semibold">Upgrade prompts</p>
            <div className="mt-3 grid gap-2">
              <Prompt icon={<Trophy className="size-4 text-amber-600" />} text="Private challenges are unlimited on Plus and above." />
              <Prompt icon={<Sparkles className="size-4 text-emerald-600" />} text="AI comparison and coaching unlock on Pro." />
              <Prompt icon={<CreditCard className="size-4 text-sky-600" />} text="Coach dashboard and player seats unlock on Coach / Club." />
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold">Manage access</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Billing changes update plan entitlements through the Stripe webhook. Social privacy stays controlled from your profile.
            </p>
            <div className="mt-3 grid gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile" prefetch={false}>Profile privacy</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/providers" prefetch={false}>Provider adapters</Link>
              </Button>
            </div>
          </section>
        </aside>
      </section>
    </PageShell>
  );
}

function PlanCard({
  plan,
  active,
  stripeConfigured,
  limits,
}: {
  plan: BillingPlan;
  active: boolean;
  stripeConfigured: boolean;
  limits: Array<{ id: string; limitKey: string; limitValueJson: Record<string, unknown> }>;
}) {
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
      {limits.length > 0 ? (
        <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Usage limits</p>
          {limits.map((limit) => (
            <p key={limit.id} className="text-sm">
              {label(limit.limitKey)}: <span className="font-medium">{limitValue(limit.limitValueJson)}</span>
            </p>
          ))}
        </div>
      ) : null}
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

function Prompt({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      {icon}
      <span>{text}</span>
    </div>
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

function limitValue(value: Record<string, unknown>) {
  if (typeof value.label === "string") {
    return value.label;
  }

  if (typeof value.value === "boolean") {
    return value.value ? "Included" : "Not included";
  }

  if (typeof value.value === "number") {
    return value.value >= 999999 ? "Unlimited" : new Intl.NumberFormat("en-GB").format(value.value);
  }

  return "Included";
}

function planLabel(plans: BillingPlan[], value: string) {
  return plans.find((plan) => plan.key === value)?.name ?? label(value);
}
