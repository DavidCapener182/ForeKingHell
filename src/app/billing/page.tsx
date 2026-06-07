import Link from "next/link";
import type { ReactNode } from "react";
import { Check, CreditCard, Sparkles, Trophy, Zap } from "lucide-react";

import { createCheckoutAction, openCustomerPortalAction } from "@/app/billing/actions";
import { MobileRouteHeader } from "@/components/mobile-sports";
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
  const visiblePlans = data.plans.filter(
    (plan) => !plan.internal || plan.key === data.activePlanKey,
  );

  return (
    <PageShell size="full">
      <MobileRouteHeader title="Platform" group="platform" activeKey="billing" />

      <header className="premium-hero p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusPill tone="sky">Pricing</StatusPill>
            <h1 className="mt-2 text-lg font-semibold leading-tight tracking-normal sm:mt-3 sm:text-3xl">
              Choose the plan for your golf network
            </h1>
            <p className="mt-1 hidden max-w-3xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:block sm:leading-6">
              Social basics stay free. Upgrade when you need deeper analytics, AI coaching, private
              leagues, provider adapters or coach/club tools.
            </p>
          </div>
          <div className="grid shrink-0 gap-2">
            {data.latestSubscription ? (
              <Badge variant="secondary" className="hidden gap-1 sm:inline-flex">
                <CreditCard className="size-3" />
                Current plan: {planLabel(data.plans, data.activePlanKey)}
              </Badge>
            ) : (
              <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
                <CreditCard className="size-3" />
                Free plan
              </Badge>
            )}
            <div data-primary-action>
              <Button asChild size="sm" variant="outline" className="w-full rounded-lg bg-white">
                <a href="#plans">
                  <Sparkles className="size-4" />
                  Compare plans
                </a>
              </Button>
            </div>
          </div>
        </div>
        {params?.checkout || params?.portal ? (
          <div className="mt-4 rounded-lg border bg-[#F5F6F4] px-4 py-3 text-sm text-muted-foreground">
            {billingStatusMessage(params.checkout, params.portal, params.plan)}
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section id="plans" className="grid scroll-mt-28 gap-4 md:grid-cols-2">
          {visiblePlans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              active={plan.key === data.activePlanKey}
              stripeConfigured={data.stripeConfigured}
              limits={planLimitsForDisplay(
                data.planLimits.filter((limit) => limit.planKey === plan.key),
              )}
            />
          ))}
        </section>

        <section className="grid gap-4 lg:sticky lg:top-28">
          <section className="premium-card p-4">
            <p className="text-sm font-semibold">Current plan</p>
            <div className="mt-3 rounded-lg bg-[#F5F6F4] p-4">
              <p className="text-2xl font-semibold tracking-normal">
                {planLabel(data.plans, data.activePlanKey)}
              </p>
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

          <section className="premium-card p-4">
            <p className="text-sm font-semibold">Upgrade prompts</p>
            <div className="mt-3 grid gap-2">
              <Prompt
                icon={<Trophy className="size-4 text-amber-600" />}
                text="Plus unlocks private course records and friend tournaments."
              />
              <Prompt
                icon={<Sparkles className="size-4 text-emerald-600" />}
                text="Pro adds AI tournament prep, record strategy and verification analytics."
              />
              <Prompt
                icon={<CreditCard className="size-4 text-sky-600" />}
                text="Coach / Club can host leagues, majors and evidence review queues."
              />
            </div>
          </section>

          <section className="premium-card p-4">
            <p className="text-sm font-semibold">Manage access</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Plan changes update access automatically. Social privacy stays controlled from your
              profile.
            </p>
            <div className="mt-3 grid gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile" prefetch={false}>
                  Profile privacy
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/providers" prefetch={false}>
                  Provider adapters
                </Link>
              </Button>
            </div>
          </section>
        </section>
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
    <article className="premium-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant={active ? "secondary" : "outline"}>
            {active ? "Current" : plan.audience}
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">{plan.name}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{plan.description}</p>
        </div>
        {plan.key === "pro" ? (
          <Sparkles className="size-5 text-emerald-600" />
        ) : (
          <Zap className="size-5 text-slate-500" />
        )}
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
        <div className="mt-4 grid gap-2 rounded-lg bg-[#F5F6F4] p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Usage limits</p>
          {limits.map((limit) => (
            <p key={limit.id} className="text-sm">
              {label(limit.limitKey)}:{" "}
              <span className="font-medium">{limitValue(limit.limitValueJson)}</span>
            </p>
          ))}
        </div>
      ) : null}
      <form action={createCheckoutAction} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="planKey" value={plan.key} />
        <select
          name="interval"
          aria-label={`${plan.name} billing interval`}
          className="h-9 rounded-lg border bg-white px-3 text-sm"
          disabled={plan.key === "free"}
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <Button type="submit" disabled={active || (plan.key !== "free" && !stripeConfigured)}>
          {active
            ? "Active"
            : plan.internal
              ? "Included"
              : plan.key === "free"
                ? "Use free"
                : "Checkout"}
        </Button>
      </form>
    </article>
  );
}

function Prompt({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function Price({ label: priceLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-[#F5F6F4] px-3 py-2">
      <p className="text-xs text-muted-foreground">{priceLabel}</p>
      <p className="mt-1 text-lg font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function billingStatusMessage(checkout?: string, portal?: string, plan?: string) {
  if (portal === "not-configured") {
    return "Account management is not available in this environment yet.";
  }

  if (portal === "missing-customer") {
    return "Start checkout first, then plan management will be available here.";
  }

  if (portal === "error") {
    return "Plan management could not be opened.";
  }

  if (checkout === "not-configured") {
    return `${plan ?? "That plan"} is not available for checkout in this environment yet.`;
  }

  if (checkout === "success") {
    return "Checkout completed. Your plan access will update shortly.";
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
    .join(" ")
    .replace(/\bAi\b/g, "AI");
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

function planLimitsForDisplay<T extends { limitKey: string }>(limits: T[]) {
  const priority = new Map([
    ["ai_monthly_credits", 0],
    ["ai_scorecard_extracts_monthly", 1],
    ["ai_daily_chat_messages", 2],
    ["max_monthly_imports", 3],
    ["max_private_challenges", 4],
  ]);

  return [...limits]
    .sort(
      (left, right) => (priority.get(left.limitKey) ?? 99) - (priority.get(right.limitKey) ?? 99),
    )
    .slice(0, 5);
}

function planLabel(plans: BillingPlan[], value: string) {
  return plans.find((plan) => plan.key === value)?.name ?? label(value);
}
