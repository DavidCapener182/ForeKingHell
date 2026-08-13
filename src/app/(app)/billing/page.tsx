import Link from "next/link";
import type { ReactNode } from "react";
import { Check, CreditCard, Sparkles, Trophy, Zap } from "lucide-react";

import { createCheckoutAction, openCustomerPortalAction } from "@/app/billing/actions";
import { BillingManageDialog } from "@/app/billing/billing-manage-dialog";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageArtwork } from "@/components/visuals/page-artwork";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBillingPageData, type BillingPlan } from "@/lib/billing";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: Promise<{
    checkout?: string;
    portal?: string;
    plan?: string;
  }>;
};

type BillingPageData = Awaited<ReturnType<typeof getBillingPageData>>;
type BillingPlanLimit = BillingPageData["planLimits"][number];

const billingLimitColumns: DesktopWorkbenchColumn[] = [
  { id: "plan", label: "Plan", locked: true },
  { id: "limit", label: "Limit" },
  { id: "value", label: "Value" },
  { id: "status", label: "Current status" },
];

const billingLimitSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "AI allowances",
    href: "/billing#billing-limits",
    detail: "Compare AI credits, chat messages and scorecard extracts.",
  },
  {
    title: "Private play access",
    href: "/billing#billing-limits",
    detail: "Review private challenges, boards and friend tournament limits.",
  },
  {
    title: "Provider and admin access",
    href: "/billing#billing-limits",
    detail: "Check device adapter, coach and operations entitlements.",
  },
];

const mobilePlanLimitPriority = [
  "max_monthly_imports",
  "can_use_ai_coach",
  "max_private_challenges",
  "ai_daily_chat_messages",
] as const;

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const data = await getBillingPageData();
  const visiblePlans = data.plans.filter(
    (plan) => !plan.internal || plan.key === data.activePlanKey,
  );
  const visiblePlanKeys = new Set<string>(visiblePlans.map((plan) => plan.key));
  const visiblePlanLimits = data.planLimits.filter((limit) => visiblePlanKeys.has(limit.planKey));
  const activePlan = visiblePlans.find((plan) => plan.key === data.activePlanKey);
  const activePlanLimits = visiblePlanLimits.filter(
    (limit) => limit.planKey === data.activePlanKey,
  );
  const orderedActivePlanLimits = [...activePlanLimits].sort((left, right) => {
    const leftIndex = mobilePlanLimitPriority.indexOf(
      left.limitKey as (typeof mobilePlanLimitPriority)[number],
    );
    const rightIndex = mobilePlanLimitPriority.indexOf(
      right.limitKey as (typeof mobilePlanLimitPriority)[number],
    );
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });
  const primaryActivePlanLimits = orderedActivePlanLimits.slice(0, 4);
  const secondaryActivePlanLimits = orderedActivePlanLimits.slice(4);
  const comparisonPlans = visiblePlans.filter((plan) => plan.key !== data.activePlanKey);

  return (
    <PageShell size="full">
      <DesktopWorkbenchLayout scope="billing">
        <div className="grid gap-5 lg:hidden">
          <header className="px-1 pt-1">
            <p className="text-sm font-medium text-primary">Account</p>
            <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-[-0.025em]">
              Membership
            </h1>
            <p className="mt-1 text-[15px] leading-5 text-muted-foreground">
              Your plan, included access and upgrade options.
            </p>
          </header>

          {params?.checkout || params?.portal ? (
            <Alert>
              <CreditCard className="size-4" />
              <AlertTitle>Billing update</AlertTitle>
              <AlertDescription>
                {billingStatusMessage(params.checkout, params.portal, params.plan)}
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="grid gap-3" aria-label="Current membership">
            <div className="rounded-2xl bg-card p-5 ring-1 ring-border/70">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.035em] text-muted-foreground">
                    Current plan
                  </p>
                  <h2 className="mt-1 text-3xl font-bold tracking-[-0.025em]">
                    {planLabel(data.plans, data.activePlanKey)}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {data.activePlanKey === "full"
                      ? "Lifetime full access."
                      : data.latestSubscription
                        ? `${data.latestSubscription.status} subscription`
                        : "No paid subscription yet."}
                  </p>
                </div>
                <CreditCard className="size-6 shrink-0 text-primary" aria-hidden />
              </div>
              <form action={openCustomerPortalAction} className="mt-4">
                <Button
                  type="submit"
                  variant="outline"
                  className="min-h-11 w-full rounded-xl"
                  disabled={!data.stripeConfigured || !data.billingCustomer?.stripeCustomerId}
                >
                  <CreditCard className="size-4" />
                  Manage subscription
                </Button>
              </form>
            </div>
          </section>

          <section className="grid gap-2" aria-label="Current plan access">
            <IOSSectionHeader
              title="Included access"
              description={
                activePlanLimits.length > 0
                  ? `${activePlanLimits.length} source-backed entitlements and limits`
                  : "No plan limits are configured"
              }
            />
            <IOSGroupedList label="Current plan access">
              {primaryActivePlanLimits.length > 0 ? (
                primaryActivePlanLimits.map((limit) => (
                  <IOSListRow
                    key={limit.id}
                    label={label(limit.limitKey)}
                    value={limitValue(limit.limitValueJson)}
                    detail={activePlan?.name ?? planLabel(data.plans, data.activePlanKey)}
                  />
                ))
              ) : (
                <IOSListRow
                  label="No configured limits"
                  detail="Your active plan remains available; no usage ledger has been added."
                />
              )}
            </IOSGroupedList>
            {secondaryActivePlanLimits.length > 0 ? (
              <IOSDisclosureGroup
                label="Additional plan entitlements"
                items={[
                  {
                    value: "all-entitlements",
                    title: "All plan entitlements",
                    summary: `${activePlanLimits.length}`,
                    description: `${secondaryActivePlanLimits.length} additional limits and permissions`,
                    content: (
                      <IOSGroupedList label="Additional plan access">
                        {secondaryActivePlanLimits.map((limit) => (
                          <IOSListRow
                            key={limit.id}
                            label={label(limit.limitKey)}
                            value={limitValue(limit.limitValueJson)}
                          />
                        ))}
                      </IOSGroupedList>
                    ),
                  },
                ]}
              />
            ) : null}
          </section>

          {comparisonPlans.length > 0 ? (
            <section className="grid gap-2" aria-label="Compare memberships">
              <IOSSectionHeader
                title="Compare plans"
                description="Open a plan to see its price, features, limits and checkout action."
              />
              <IOSDisclosureGroup
                label="Membership options"
                items={comparisonPlans.map((plan) => ({
                  value: plan.key,
                  title: plan.name,
                  summary: plan.monthlyPrice,
                  description: plan.description,
                  content: (
                    <PlanCard
                      plan={plan}
                      active={false}
                      stripeConfigured={data.stripeConfigured}
                      limits={planLimitsForDisplay(
                        data.planLimits.filter((limit) => limit.planKey === plan.key),
                      )}
                      embedded
                    />
                  ),
                }))}
              />
            </section>
          ) : null}

          <section className="grid gap-2" aria-label="Membership links">
            <IOSSectionHeader title="Account access" />
            <IOSGroupedList label="Account access">
              <IOSListRow
                label="Profile privacy"
                detail="Control social and public visibility separately from your plan"
                href="/profile"
              />
              <IOSListRow
                label="Provider adapters"
                detail="Review connected data sources and available adapters"
                href="/providers"
              />
            </IOSGroupedList>
          </section>
        </div>

        <div className="hidden lg:contents">
          <header className="premium-hero p-3 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <StatusPill tone="sky">Pricing</StatusPill>
                <h1 className="mt-2 text-lg font-semibold leading-tight tracking-normal sm:mt-3 sm:text-3xl">
                  Choose the plan for your golf network
                </h1>
                <p className="mt-1 hidden max-w-3xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:block sm:leading-6">
                  Social basics stay free. Upgrade when you need deeper analytics, AI coaching,
                  private leagues, provider adapters or coach/club tools.
                </p>
              </div>
              <PageArtwork
                variant="billing"
                alt=""
                className="hidden h-28 w-48 shrink-0 lg:block"
                sizes="192px"
                priority
              />
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
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full rounded-lg bg-white"
                  >
                    <a href="#plans">
                      <Sparkles className="size-4" />
                      Compare plans
                    </a>
                  </Button>
                </div>
              </div>
            </div>
            {params?.checkout || params?.portal ? (
              <Alert className="mt-4">
                <CreditCard className="size-4" />
                <AlertTitle>Billing update</AlertTitle>
                <AlertDescription>
                  {billingStatusMessage(params.checkout, params.portal, params.plan)}
                </AlertDescription>
              </Alert>
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
              <Card>
                <CardHeader>
                  <CardTitle>Current plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted/60 p-4">
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
                </CardContent>
                <CardFooter>
                  <BillingManageDialog
                    disabled={!data.stripeConfigured || !data.billingCustomer?.stripeCustomerId}
                  />
                </CardFooter>
              </Card>

              <section className="premium-card p-4">
                <p className="text-sm font-semibold">Upgrade prompts</p>
                <div className="mt-3 grid gap-2">
                  <Prompt
                    icon={<Trophy className="size-4 text-amber-600" />}
                    text="Plus unlocks private course records and friend tournaments."
                  />
                  <Prompt
                    icon={<Sparkles className="size-4 text-emerald-600" />}
                    text="Pro adds AI coaching, Data Chat, course strategy and deeper analytics."
                  />
                  <Prompt
                    icon={<CreditCard className="size-4 text-sky-600" />}
                    text="Coach / Club adds 25 player seats, hosted events and evidence review."
                  />
                </div>
              </section>

              <section className="premium-card p-4">
                <p className="text-sm font-semibold">Manage access</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Plan changes update access automatically. Social privacy stays controlled from
                  your profile.
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

          <BillingLimitsTable
            limits={visiblePlanLimits}
            plans={visiblePlans}
            activePlanKey={data.activePlanKey}
          />
          <BillingHistoryTable history={data.subscriptionHistory} plans={data.plans} />
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function BillingLimitsTable({
  limits,
  plans,
  activePlanKey,
}: {
  limits: BillingPlanLimit[];
  plans: BillingPlan[];
  activePlanKey: string;
}) {
  return (
    <section
      id="billing-limits"
      data-workbench-scope="billing-limits"
      className="premium-card scroll-mt-28 p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Plan limits ledger</p>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
            Source-backed entitlements and limits for the visible plans, with current-plan status
            and export controls.
          </p>
        </div>
        <StatusPill tone={limits.length > 0 ? "green" : "slate"}>{limits.length} rows</StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey="billing-limits"
        scope="billing-limits"
        currentViewLabel="Billing limits"
        resultLabel={`${limits.length} limits`}
        columns={billingLimitColumns}
        suggestedViews={billingLimitSuggestedViews}
        exportTableId="billing-limits"
        exportFileName="forekinghell-billing-limits.csv"
        className="my-3"
      />

      <DataTableFrame mainTable mainTableLabel="Billing plan limits table" stickyFirstColumn>
        <Table
          data-workbench-export-table="billing-limits"
          aria-describedby="billing-limits-summary"
        >
          <TableCaption id="billing-limits-summary" className="sr-only">
            Billing plan limits table showing plan, entitlement or limit, source-backed value and
            whether the row belongs to the current plan.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="plan"
                className="sticky left-0 z-20 min-w-48 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Plan
              </TableHead>
              <TableHead data-column="limit">Limit</TableHead>
              <TableHead data-column="value">Value</TableHead>
              <TableHead data-column="status">Current status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {limits.length > 0 ? (
              limits.map((limit) => {
                const isCurrent = limit.planKey === activePlanKey;

                return (
                  <TableRow
                    key={limit.id}
                    tabIndex={0}
                    className="focus-aaa outline-none"
                    aria-label={`${planLabel(plans, limit.planKey)} ${label(limit.limitKey)} limit`}
                  >
                    <TableCell
                      data-column="plan"
                      className="sticky left-0 z-10 min-w-48 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      {planLabel(plans, limit.planKey)}
                    </TableCell>
                    <TableCell data-column="limit">{label(limit.limitKey)}</TableCell>
                    <TableCell data-column="value">{limitValue(limit.limitValueJson)}</TableCell>
                    <TableCell data-column="status">
                      <StatusPill tone={isCurrent ? "green" : "slate"}>
                        {isCurrent ? "Current plan" : "Upgrade option"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No billing limits are configured yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function BillingHistoryTable({
  history,
  plans,
}: {
  history: BillingPageData["subscriptionHistory"];
  plans: BillingPlan[];
}) {
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Source-backed subscription periods recorded for this account. Invoice data is not invented
          when Stripe has not supplied it.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption className="sr-only">
            Subscription history showing plan, status, period and cancellation state.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Renewal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length > 0 ? (
              history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{planLabel(plans, entry.planKey)}</TableCell>
                  <TableCell>
                    <Badge variant={entry.status === "active" ? "secondary" : "outline"}>
                      {label(entry.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.currentPeriodStart && entry.currentPeriodEnd
                      ? `${dateFormatter.format(entry.currentPeriodStart)} – ${dateFormatter.format(entry.currentPeriodEnd)}`
                      : dateFormatter.format(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    {entry.cancelAtPeriodEnd ? "Ends after period" : "Continues"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No paid subscription history is recorded for this account.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlanCard({
  plan,
  active,
  stripeConfigured,
  limits,
  embedded = false,
}: {
  plan: BillingPlan;
  active: boolean;
  stripeConfigured: boolean;
  limits: Array<{ id: string; limitKey: string; limitValueJson: Record<string, unknown> }>;
  embedded?: boolean;
}) {
  const content = (
    <>
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
      <div className={embedded ? "grid grid-cols-2 gap-2" : "mt-4 grid grid-cols-2 gap-2"}>
        <Price label="Monthly" value={plan.monthlyPrice} />
        <Price label="Yearly" value={plan.yearlyPrice} />
      </div>
      <ul className={embedded ? "grid gap-2 text-sm" : "mt-4 grid gap-2 text-sm"}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {limits.length > 0 ? (
        <div className="grid gap-2 rounded-lg bg-secondary/55 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Usage limits</p>
          {limits.map((limit) => (
            <p key={limit.id} className="text-sm">
              {label(limit.limitKey)}:{" "}
              <span className="font-medium">{limitValue(limit.limitValueJson)}</span>
            </p>
          ))}
        </div>
      ) : null}
      <form
        action={createCheckoutAction}
        className={embedded ? "grid gap-2" : "mt-5 grid gap-2 sm:grid-cols-[1fr_auto]"}
      >
        <input type="hidden" name="planKey" value={plan.key} />
        <Select name="interval" defaultValue="monthly" disabled={plan.key === "free"}>
          <SelectTrigger className="min-h-11 w-full" aria-label={`${plan.name} billing interval`}>
            <SelectValue placeholder="Billing interval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          className="min-h-11"
          disabled={active || (plan.key !== "free" && !stripeConfigured)}
        >
          {active
            ? "Active"
            : plan.internal
              ? "Included"
              : plan.key === "free"
                ? "Use free"
                : "Checkout"}
        </Button>
      </form>
    </>
  );

  if (embedded) {
    return <div className="grid gap-4">{content}</div>;
  }

  return (
    <Card>
      <CardContent className="grid gap-4">{content}</CardContent>
    </Card>
  );
}

function Prompt({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-secondary/55 px-3 py-2 text-sm">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function Price({ label: priceLabel, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/55 px-3 py-2">
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
