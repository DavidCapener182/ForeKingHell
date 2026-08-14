import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CreditCard,
  KeyRound,
  ListChecks,
  Zap,
} from "lucide-react";

import { grantLifetimeFullAction } from "@/app/admin/actions";
import { AdminConfirmSubmitButton } from "@/app/admin/admin-confirm-submit-button";
import { AdminBillingActions } from "@/app/admin/admin-billing-actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusTimeline } from "@/components/app/status-timeline";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  AdminMetric,
  AdminNav,
  AdminNotice,
  AdminPageHeader,
  AdminSection,
  formatDateTime,
  label,
  PlanBadge,
  StatusBadge,
} from "@/app/admin/admin-components";
import { DataTableFrame, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminBillingData, requireAdminUser } from "@/lib/admin";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const adminBillingColumns: DesktopWorkbenchColumn[] = [
  { id: "user", label: "User", locked: true },
  { id: "plan", label: "Plan" },
  { id: "status", label: "Status" },
  { id: "renews", label: "Renews" },
  { id: "created", label: "Created" },
  { id: "action", label: "Action", locked: true },
];

const adminBillingSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Active subscriptions",
    href: "/admin/billing",
    detail: "Review active and trialing subscription rows.",
  },
  {
    title: "Lifetime entitlement audit",
    href: "/admin/users",
    detail: "Move to account-level lifetime and admin access review.",
  },
  {
    title: "Provider health follow-up",
    href: "/admin",
    detail: "Check provider and system signals before support action.",
  },
];

type AdminBillingPageProps = {
  searchParams?: Promise<{
    adminStatus?: string;
    adminError?: string;
    sort?: string;
    dir?: string;
    view?: string;
  }>;
};

type AdminBillingData = Awaited<ReturnType<typeof getAdminBillingData>>;
type AdminBillingSubscription = AdminBillingData["subscriptions"][number];
type AdminBillingSortMetric = "user" | "plan" | "status" | "renews" | "created";
type AdminBillingSortDirection = "asc" | "desc";
type AdminBillingSortState = {
  metric: AdminBillingSortMetric;
  dir: AdminBillingSortDirection;
};

const adminBillingSortLabels: Record<AdminBillingSortMetric, string> = {
  user: "User",
  plan: "Plan",
  status: "Status",
  renews: "Renews",
  created: "Created",
};

const adminBillingSortDefaultDirections: Record<AdminBillingSortMetric, AdminBillingSortDirection> =
  {
    user: "asc",
    plan: "desc",
    status: "asc",
    renews: "asc",
    created: "desc",
  };

export default async function AdminBillingPage({ searchParams }: AdminBillingPageProps) {
  const params = await searchParams;
  const sortState = parseAdminBillingSort(params?.sort, params?.dir);
  const [actor, data] = await Promise.all([requireAdminUser(), getAdminBillingData()]);
  const canGrantLifetime = actor.role === "owner";
  const sortedSubscriptions = sortAdminBillingSubscriptions(data.subscriptions, sortState);
  const lifetimeEntitlements = data.entitlements.filter(
    (row) => row.entitlementKey === "lifetime_full" && row.valueJson?.value === true,
  );
  const activeSubscriptions = data.subscriptions.filter(
    (row) => row.status === "active" || row.status === "trialing",
  );

  return (
    <PageShell>
      <div className="grid gap-3">
        <AdminNav active="/admin/billing" />
        <AdminNotice status={params?.adminStatus} error={params?.adminError} />
      </div>

      <DesktopWorkbenchLayout scope="admin-billing">
        <AdminPageHeader
          eyebrow="Admin billing"
          title="Billing and entitlements"
          description="Inspect active subscriptions, full-access grants and the entitlement limits that feature checks use."
        />

        <section className="grid gap-3 md:grid-cols-4">
          <AdminMetric
            icon={CreditCard}
            label="Subscriptions"
            value={data.subscriptions.length}
            detail={`${activeSubscriptions.length} active or trialing`}
          />
          <AdminMetric
            icon={Zap}
            label="Lifetime full"
            value={lifetimeEntitlements.length}
            detail="Permanent full-access grants"
          />
          <AdminMetric
            icon={KeyRound}
            label="Entitlements"
            value={data.entitlements.length}
            detail="User entitlement rows"
          />
          <AdminMetric
            icon={ListChecks}
            label="Plan limits"
            value={data.planLimits.length}
            detail="Configured limit rows"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <section className="grid gap-4 lg:sticky lg:top-28">
            {canGrantLifetime ? (
              <AdminSection
                title="Grant lifetime full"
                description="Use this for owner, tester and permanent internal accounts."
              >
                <form action={grantLifetimeFullAction} className="grid gap-3">
                  <input type="hidden" name="returnTo" value="/admin/billing" />
                  <Input
                    name="email"
                    type="email"
                    placeholder="user@example.com"
                    className="h-10 rounded-xl bg-background"
                    required
                  />
                  <AdminConfirmSubmitButton
                    type="submit"
                    className="rounded-xl"
                    confirmTitle="Grant lifetime full access"
                    confirmMessage="Grant lifetime full access to this email? This creates a permanent full-plan entitlement and writes admin billing state."
                    confirmActionLabel="Grant full access"
                  >
                    <Zap className="size-4" />
                    Grant full access
                  </AdminConfirmSubmitButton>
                </form>
              </AdminSection>
            ) : null}

            <AdminSection title="Full plan limits">
              <div className="grid gap-2 text-sm">
                {data.planLimits
                  .filter((limit) => limit.planKey === "full")
                  .map((limit) => (
                    <div key={limit.id} className="rounded-lg bg-muted/55 px-3 py-2">
                      <p className="font-medium">{label(limit.limitKey)}</p>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                        {JSON.stringify(limit.limitValueJson)}
                      </p>
                    </div>
                  ))}
              </div>
            </AdminSection>
          </section>

          <section className="grid gap-4">
            <AdminSection
              title="Subscriptions"
              description="Latest subscription and lifetime rows."
            >
              <DesktopTableWorkbenchControls
                viewKey="admin-billing"
                scope="admin-billing"
                currentViewLabel="Admin subscription rows"
                resultLabel={`${data.subscriptions.length.toLocaleString("en-GB")} subscriptions`}
                columns={adminBillingColumns}
                suggestedViews={adminBillingSuggestedViews}
                exportTableId="admin-billing"
                exportFileName="forekinghell-admin-billing-view.csv"
                className="mb-3"
              />
              <DataTableFrame
                mainTable
                mainTableLabel="Subscriptions table"
                stickyFirstColumn
                className="overflow-x-auto"
              >
                <Table
                  className="w-full min-w-[780px] text-left text-sm"
                  data-workbench-scope="admin-billing"
                  data-workbench-export-table="admin-billing"
                  aria-describedby="admin-billing-table-summary"
                >
                  <TableCaption id="admin-billing-table-summary" className="sr-only">
                    Admin subscription rows with user, plan, status, renewal and creation date.
                  </TableCaption>
                  <TableHeader className="border-b text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                    <TableRow>
                      <SortableAdminBillingHead
                        columnId="user"
                        metric="user"
                        sortState={sortState}
                        className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                      />
                      <SortableAdminBillingHead
                        columnId="plan"
                        metric="plan"
                        sortState={sortState}
                      />
                      <SortableAdminBillingHead
                        columnId="status"
                        metric="status"
                        sortState={sortState}
                      />
                      <SortableAdminBillingHead
                        columnId="renews"
                        metric="renews"
                        sortState={sortState}
                      />
                      <SortableAdminBillingHead
                        columnId="created"
                        metric="created"
                        sortState={sortState}
                      />
                      <TableHead data-column="action" className="px-3 py-2 font-medium">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSubscriptions.length > 0 ? (
                      sortedSubscriptions.map((subscription) => (
                        <TableRow
                          key={subscription.id}
                          tabIndex={0}
                          className="focus-aaa border-b outline-none last:border-b-0"
                        >
                          <TableCell
                            data-column="user"
                            className="sticky left-0 z-10 bg-card px-3 py-3 shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                          >
                            <p className="font-medium">{subscription.displayName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {subscription.email ?? "No email"}
                            </p>
                          </TableCell>
                          <TableCell data-column="plan" className="px-3 py-3">
                            <PlanBadge plan={subscription.planKey} />
                          </TableCell>
                          <TableCell data-column="status" className="px-3 py-3">
                            <StatusBadge status={subscription.status} />
                          </TableCell>
                          <TableCell
                            data-column="renews"
                            className="px-3 py-3 text-xs text-muted-foreground"
                          >
                            {subscription.currentPeriodEnd
                              ? formatDateTime(subscription.currentPeriodEnd)
                              : "No renewal"}
                            {subscription.cancelAtPeriodEnd ? " · cancels" : ""}
                          </TableCell>
                          <TableCell
                            data-column="created"
                            className="px-3 py-3 text-xs text-muted-foreground"
                          >
                            {formatDateTime(subscription.createdAt)}
                          </TableCell>
                          <TableCell data-column="action" className="px-3 py-3">
                            <AdminBillingActions
                              subscription={{
                                displayName: subscription.displayName,
                                email: subscription.email,
                                plan: subscription.planKey,
                                status: subscription.status,
                                renewal: subscription.currentPeriodEnd
                                  ? formatDateTime(subscription.currentPeriodEnd)
                                  : "No renewal",
                                created: formatDateTime(subscription.createdAt),
                                cancels: subscription.cancelAtPeriodEnd,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="p-4">
                          <AppEmptyState
                            icon={<CreditCard className="size-5" />}
                            title="No subscriptions in this view"
                            description="Subscription records will appear after billing creates a paid or trial account."
                            primaryAction={
                              <Button asChild variant="outline" size="sm">
                                <a href="/admin/users">Open users</a>
                              </Button>
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </AdminSection>

            <AdminSection title="Recent entitlements">
              <StatusTimeline
                label="Entitlement audit history"
                items={data.entitlements.slice(0, 40).map((entitlement) => ({
                  id: entitlement.id,
                  timestamp: formatDateTime(entitlement.updatedAt),
                  title: `${entitlement.displayName} · ${label(entitlement.entitlementKey)}`,
                  description: entitlement.email ?? "No email",
                  meta: JSON.stringify(entitlement.valueJson),
                  status: label(entitlement.source),
                  kind: "reviewed",
                }))}
                empty={
                  <p className="text-sm text-muted-foreground">No entitlement audit rows yet.</p>
                }
              />
            </AdminSection>
          </section>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SortableAdminBillingHead({
  className,
  columnId,
  metric,
  sortState,
}: {
  className?: string;
  columnId: string;
  metric: AdminBillingSortMetric;
  sortState: AdminBillingSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <TableHead
      data-column={columnId}
      className={["px-3 py-2 font-medium", className].filter(Boolean).join(" ")}
      aria-sort={active ? adminBillingSortAriaValue(sortState.dir) : "none"}
    >
      <SortableAdminBillingHeadLink metric={metric} sortState={sortState} />
    </TableHead>
  );
}

function SortableAdminBillingHeadLink({
  metric,
  sortState,
}: {
  metric: AdminBillingSortMetric;
  sortState: AdminBillingSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: AdminBillingSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : adminBillingSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = adminBillingSortLabels[metric];

  return (
    <a
      href={`/admin/billing?sort=${metric}&dir=${nextDir}`}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin billing by ${label}, ${adminBillingSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-primary" : "opacity-45"}`} aria-hidden />
    </a>
  );
}

function sortAdminBillingSubscriptions(
  subscriptions: AdminBillingSubscription[],
  sortState: AdminBillingSortState,
) {
  return [...subscriptions].sort((left, right) => {
    const result = compareAdminBillingValues(left, right, sortState);

    if (result !== 0) {
      return result;
    }

    return compareAdminBillingDates(left.createdAt, right.createdAt, "desc");
  });
}

function compareAdminBillingValues(
  left: AdminBillingSubscription,
  right: AdminBillingSubscription,
  sortState: AdminBillingSortState,
) {
  switch (sortState.metric) {
    case "user":
      return compareAdminBillingStrings(left.displayName, right.displayName, sortState.dir);
    case "plan":
      return compareAdminBillingNumbers(
        planSortWeight(left.planKey),
        planSortWeight(right.planKey),
        sortState.dir,
      );
    case "status":
      return compareAdminBillingNumbers(
        subscriptionStatusSortWeight(left.status),
        subscriptionStatusSortWeight(right.status),
        sortState.dir,
      );
    case "renews":
      return compareNullableAdminBillingDates(
        left.currentPeriodEnd,
        right.currentPeriodEnd,
        sortState.dir,
      );
    case "created":
      return compareAdminBillingDates(left.createdAt, right.createdAt, sortState.dir);
  }
}

function planSortWeight(plan: string) {
  if (plan === "full") return 3;
  if (plan === "pro") return 2;
  if (plan === "plus") return 1;
  return 0;
}

function subscriptionStatusSortWeight(status: string) {
  if (status === "active") return 5;
  if (status === "trialing") return 4;
  if (status === "past_due") return 3;
  if (status === "incomplete") return 2;
  if (status === "unpaid") return 1;
  return 0;
}

function compareAdminBillingNumbers(left: number, right: number, dir: AdminBillingSortDirection) {
  return dir === "asc" ? left - right : right - left;
}

function compareAdminBillingDates(left: Date, right: Date, dir: AdminBillingSortDirection) {
  return compareAdminBillingNumbers(left.getTime(), right.getTime(), dir);
}

function compareNullableAdminBillingDates(
  left: Date | null,
  right: Date | null,
  dir: AdminBillingSortDirection,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareAdminBillingDates(left, right, dir);
}

function compareAdminBillingStrings(
  left: string | null,
  right: string | null,
  dir: AdminBillingSortDirection,
) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const result = left.localeCompare(right);
  return dir === "asc" ? result : -result;
}

function parseAdminBillingSort(
  metricValue: string | undefined,
  dirValue: string | undefined,
): AdminBillingSortState {
  const metric = parseAdminBillingSortMetric(metricValue);

  return {
    metric,
    dir: parseAdminBillingSortDirection(dirValue, adminBillingSortDefaultDirections[metric]),
  };
}

function parseAdminBillingSortMetric(value: string | undefined): AdminBillingSortMetric {
  if (
    value === "user" ||
    value === "plan" ||
    value === "status" ||
    value === "renews" ||
    value === "created"
  ) {
    return value;
  }

  return "created";
}

function parseAdminBillingSortDirection(
  value: string | undefined,
  fallback: AdminBillingSortDirection,
): AdminBillingSortDirection {
  return value === "asc" || value === "desc" ? value : fallback;
}

function adminBillingSortAriaValue(dir: AdminBillingSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
}

function adminBillingSortDirectionCopy(
  metric: AdminBillingSortMetric,
  dir: AdminBillingSortDirection,
) {
  if (metric === "user" || metric === "status") {
    return dir === "asc" ? "A to Z" : "Z to A";
  }

  if (metric === "renews") {
    return dir === "asc" ? "soonest first" : "latest first";
  }

  if (metric === "created") {
    return dir === "desc" ? "newest first" : "oldest first";
  }

  return dir === "desc" ? "high to low" : "low to high";
}
