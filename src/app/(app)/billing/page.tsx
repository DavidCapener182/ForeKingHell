import { AlertTriangle, Check, CheckCircle2, Minus, ShieldCheck } from "lucide-react";

import { createCheckoutAction } from "@/app/billing/actions";
import { BillingManageDialog } from "@/app/billing/billing-manage-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageShell, StatusPill } from "@/components/premium";
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

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fullPlanComparison = [
  { feature: "Session imports and history", free: "5 imports / month", full: "Unlimited" },
  { feature: "Bag and progress views", free: "Essentials", full: "Advanced" },
  { feature: "AI coach", free: false, full: true },
  { feature: "Data Chat", free: false, full: true },
  { feature: "Course strategy", free: false, full: true },
  { feature: "Private challenges and tournaments", free: false, full: true },
  { feature: "Friend comparison insights", free: false, full: true },
  { feature: "Scorecard extracts", free: false, full: "10 / month" },
] as const;

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const data = await getBillingPageData();
  const notice = billingNotice(params?.checkout, params?.portal, params?.plan);
  const fullPlan = data.plans.find((plan) => plan.key === "pro") ?? null;
  const activePlanName = accountPlanLabel(data.plans, data.activePlanKey);
  const isFullPlan = data.activePlanKey === "pro" || data.activePlanKey === "full";
  const activePlanLimits = data.planLimits.filter((limit) => limit.planKey === data.activePlanKey);

  return (
    <PageShell size="full" contentClassName="gap-6 lg:gap-8">
      <header className="flex flex-col gap-2 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="mb-3">
            Account
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your plan
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            See what you have, what happens next, and manage your billing in one place.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{data.user?.email}</p>
      </header>

      {notice ? (
        <Alert variant={notice.error ? "destructive" : "default"}>
          {notice.error ? (
            <AlertTriangle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <CurrentPlanCard data={data} planName={activePlanName} />

      <section id="compare-plans" className="scroll-mt-24" aria-labelledby="compare-plans-title">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="compare-plans-title" className="text-xl font-semibold tracking-tight">
              Free or Full
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A straightforward view of the differences that matter day to day.
            </p>
          </div>
        </div>

        <Card className="overflow-hidden py-0">
          <Table className="text-xs sm:text-sm" containerClassName="rounded-xl">
            <TableCaption className="sr-only">
              Comparison of the Free and Full account plans.
            </TableCaption>
            <TableHeader>
              <TableRow className="bg-muted/35 hover:bg-muted/35">
                <TableHead className="min-w-40 px-3 py-4 text-foreground sm:min-w-48 sm:px-4">
                  What you get
                </TableHead>
                <TableHead className="min-w-24 px-3 py-4 text-foreground sm:min-w-36 sm:px-4">
                  <PlanColumnHeading label="Free" current={data.activePlanKey === "free"} />
                </TableHead>
                <TableHead className="min-w-24 px-3 py-4 text-foreground sm:min-w-36 sm:px-4">
                  <PlanColumnHeading label="Full" current={isFullPlan} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="px-3 font-medium sm:px-4">Price</TableCell>
                <TableCell className="px-3 sm:px-4">£0</TableCell>
                <TableCell className="px-3 font-medium whitespace-normal sm:px-4">
                  {fullPlan ? `${fullPlan.monthlyPrice} / month` : "Not available"}
                </TableCell>
              </TableRow>
              {fullPlanComparison.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="px-3 font-medium whitespace-normal sm:px-4">
                    {row.feature}
                  </TableCell>
                  <TableCell className="px-3 whitespace-normal sm:px-4">
                    {comparisonValue(row.free)}
                  </TableCell>
                  <TableCell className="px-3 whitespace-normal sm:px-4">
                    {comparisonValue(row.full)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isFullPlan
                ? "Full is your current plan."
                : data.activePlanKey === "free"
                  ? "Upgrade when you want the complete coaching and analysis toolkit."
                  : `${activePlanName} is your current plan; it remains available to manage above.`}
            </p>
            {data.activePlanKey === "free" && fullPlan ? (
              <FullPlanCheckout plan={fullPlan} stripeConfigured={data.stripeConfigured} />
            ) : null}
          </div>
        </Card>
      </section>

      <BillingHistoryTable history={data.subscriptionHistory} plans={data.plans} />

      <TechnicalPlanDetails
        limits={activePlanLimits}
        entitlements={data.entitlements}
        planName={activePlanName}
      />
    </PageShell>
  );
}

function CurrentPlanCard({ data, planName }: { data: BillingPageData; planName: string }) {
  const subscription = data.latestSubscription;
  const status = planStatus(subscription?.status, data.activePlanKey);
  const renewal = renewalState(subscription, data.activePlanKey);
  const hasBillingProblem = subscription
    ? ["past_due", "unpaid", "incomplete_expired"].includes(subscription.status)
    : false;

  return (
    <section aria-labelledby="current-plan-title">
      <Card className="overflow-hidden border-primary/20 bg-[linear-gradient(125deg,color-mix(in_srgb,var(--card)_96%,var(--primary)_4%),var(--card))] py-0 shadow-sm">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p id="current-plan-title" className="text-sm font-medium text-muted-foreground">
                Current plan
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-3xl font-semibold tracking-tight">{planName}</p>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{renewal}</p>
            </div>
          </div>

          <div
            data-primary-action
            className="flex flex-col items-stretch gap-2 sm:items-start lg:items-end"
          >
            {data.billingCustomer?.stripeCustomerId ? (
              <BillingManageDialog disabled={!data.stripeConfigured} />
            ) : data.activePlanKey === "free" ? (
              <Button asChild>
                <a href="#compare-plans">View Full plan</a>
              </Button>
            ) : (
              <Button disabled>No billing to manage</Button>
            )}
            <p className="text-xs text-muted-foreground">
              {data.billingCustomer?.stripeCustomerId
                ? "Securely managed by Stripe"
                : data.activePlanKey === "free"
                  ? "No payment method on file"
                  : "This access does not renew"}
            </p>
          </div>
        </CardContent>

        {hasBillingProblem ? (
          <div className="border-t border-destructive/20 p-4 sm:px-6">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Payment needs attention</AlertTitle>
              <AlertDescription>
                Open plan management to update your payment details and restore normal renewal.
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function PlanColumnHeading({ label, current }: { label: string; current: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-base font-semibold">{label}</span>
      {current ? <Badge variant="secondary">Current plan</Badge> : null}
    </div>
  );
}

function FullPlanCheckout({
  plan,
  stripeConfigured,
}: {
  plan: BillingPlan;
  stripeConfigured: boolean;
}) {
  return (
    <form action={createCheckoutAction} className="flex w-full gap-2 sm:w-auto">
      <input type="hidden" name="planKey" value={plan.key} />
      <Select name="interval" defaultValue="monthly">
        <SelectTrigger className="min-h-11 min-w-32" aria-label="Full plan billing interval">
          <SelectValue placeholder="Billing interval" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="yearly">Yearly</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" className="min-h-11 flex-1 sm:flex-none" disabled={!stripeConfigured}>
        Choose Full
      </Button>
    </form>
  );
}

function BillingHistoryTable({
  history,
  plans,
}: {
  history: BillingPageData["subscriptionHistory"];
  plans: BillingPlan[];
}) {
  return (
    <section aria-labelledby="billing-history-title">
      <div className="mb-3">
        <h2 id="billing-history-title" className="text-xl font-semibold tracking-tight">
          Billing history
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Your recorded subscription periods.</p>
      </div>
      <Card className="overflow-hidden py-0">
        <Table>
          <TableCaption className="sr-only">
            Subscription history showing plan, status, period and renewal state.
          </TableCaption>
          <TableHeader>
            <TableRow className="bg-muted/35 hover:bg-muted/35">
              <TableHead className="px-4">Plan</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4">Period</TableHead>
              <TableHead className="px-4">Renewal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length > 0 ? (
              history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="px-4 font-medium">
                    {accountPlanLabel(plans, entry.planKey)}
                  </TableCell>
                  <TableCell className="px-4">{label(entry.status)}</TableCell>
                  <TableCell className="px-4">
                    {entry.currentPeriodStart && entry.currentPeriodEnd
                      ? `${dateFormatter.format(entry.currentPeriodStart)} – ${dateFormatter.format(entry.currentPeriodEnd)}`
                      : dateFormatter.format(entry.createdAt)}
                  </TableCell>
                  <TableCell className="px-4">
                    {entry.cancelAtPeriodEnd ? "Ends after this period" : "Continues"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-5 text-muted-foreground">
                  No paid billing history yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

function TechnicalPlanDetails({
  limits,
  entitlements,
  planName,
}: {
  limits: BillingPageData["planLimits"];
  entitlements: BillingPageData["entitlements"];
  planName: string;
}) {
  return (
    <section aria-label="Technical plan details">
      <Card className="px-4 py-0 sm:px-5">
        <Accordion type="single" collapsible>
          <AccordionItem value="technical-details" className="border-0">
            <AccordionTrigger className="py-5 hover:no-underline">
              <span>
                <span className="block text-left font-semibold">Technical plan details</span>
                <span className="mt-1 block text-left text-xs font-normal text-muted-foreground">
                  Account grants and limits used to apply your access
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <TechnicalList
                  title={`${planName} limits`}
                  rows={limits.map((limit) => ({
                    key: limit.id,
                    label: label(limit.limitKey),
                    value: limitValue(limit.limitValueJson),
                  }))}
                  empty="No additional limits are recorded for this plan."
                />
                <TechnicalList
                  title="Account grants"
                  rows={entitlements.map((entitlement) => ({
                    key: entitlement.id,
                    label: label(entitlement.entitlementKey),
                    value: limitValue(entitlement.valueJson),
                  }))}
                  empty="No additional account grants are recorded."
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </section>
  );
}

function TechnicalList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ key: string; label: string; value: string }>;
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length > 0 ? (
        <dl className="mt-2 divide-y rounded-lg border">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </div>
  );
}

function comparisonValue(value: string | boolean) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Check className="size-4 text-primary" aria-hidden="true" /> Included
      </span>
    );
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Minus className="size-4" aria-hidden="true" /> Not included
      </span>
    );
  }

  return value;
}

function planStatus(status: string | undefined, activePlanKey: string) {
  if (activePlanKey === "full") {
    return { label: "Active", tone: "green" as const };
  }

  switch (status) {
    case "active":
      return { label: "Active", tone: "green" as const };
    case "trialing":
      return { label: "Trial", tone: "sky" as const };
    case "past_due":
    case "unpaid":
    case "incomplete_expired":
      return { label: "Payment issue", tone: "amber" as const };
    case "canceled":
      return { label: "Cancelled", tone: "slate" as const };
    default:
      return activePlanKey === "free"
        ? { label: "Active", tone: "green" as const }
        : { label: label(status ?? "active"), tone: "slate" as const };
  }
}

function renewalState(subscription: BillingPageData["latestSubscription"], activePlanKey: string) {
  if (activePlanKey === "full") {
    return "Lifetime access. There is no renewal date.";
  }

  if (!subscription) {
    return "Free stays free. There is no renewal date.";
  }

  if (subscription.cancelAtPeriodEnd) {
    return subscription.currentPeriodEnd
      ? `Cancellation scheduled. Access continues until ${dateFormatter.format(subscription.currentPeriodEnd)}.`
      : "Cancellation scheduled for the end of the current billing period.";
  }

  if (subscription.status === "canceled") {
    return "This subscription is cancelled and will not renew.";
  }

  return subscription.currentPeriodEnd
    ? `Renews on ${dateFormatter.format(subscription.currentPeriodEnd)}.`
    : "Renews automatically until cancelled.";
}

function billingNotice(checkout?: string, portal?: string, plan?: string) {
  if (portal === "not-configured") {
    return {
      error: true,
      title: "Plan management is unavailable",
      message: "Account management is not configured in this environment yet.",
    };
  }

  if (portal === "missing-customer") {
    return {
      error: true,
      title: "No billing account found",
      message: "Complete checkout first, then plan management will be available here.",
    };
  }

  if (portal === "error") {
    return {
      error: true,
      title: "Plan management could not open",
      message: "Please try again. No changes were made to your plan.",
    };
  }

  if (checkout === "not-configured") {
    return {
      error: true,
      title: "Checkout is unavailable",
      message: `${plan ? accountPlanName(plan) : "That plan"} is not configured for checkout yet.`,
    };
  }

  if (checkout === "error") {
    return {
      error: true,
      title: "Checkout could not start",
      message: "Please try again. You have not been charged.",
    };
  }

  if (checkout === "success") {
    return {
      error: false,
      title: "Checkout complete",
      message: "Your plan access will update shortly.",
    };
  }

  if (checkout === "cancelled") {
    return {
      error: false,
      title: "Checkout cancelled",
      message: "Your plan and payment details have not changed.",
    };
  }

  return null;
}

function accountPlanLabel(plans: BillingPlan[], value: string) {
  if (value === "pro" || value === "full") {
    return "Full";
  }

  return plans.find((plan) => plan.key === value)?.name ?? label(value);
}

function accountPlanName(value: string) {
  return value === "pro" || value === "full" ? "Full" : label(value);
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
