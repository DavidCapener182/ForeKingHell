import { CreditCard, KeyRound, ListChecks, Zap } from "lucide-react";

import { grantLifetimeFullAction } from "@/app/admin/actions";
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
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminBillingData } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AdminBillingPageProps = {
  searchParams?: Promise<{
    adminStatus?: string;
    adminError?: string;
  }>;
};

export default async function AdminBillingPage({ searchParams }: AdminBillingPageProps) {
  const params = await searchParams;
  const data = await getAdminBillingData();
  const lifetimeEntitlements = data.entitlements.filter(
    (row) => row.entitlementKey === "lifetime_full" && row.valueJson?.value === true,
  );
  const activeSubscriptions = data.subscriptions.filter(
    (row) => row.status === "active" || row.status === "trialing",
  );

  return (
    <PageShell size="7xl">
      <AdminNav active="/admin/billing" />
      <AdminNotice status={params?.adminStatus} error={params?.adminError} />

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
        <aside className="grid gap-4 lg:sticky lg:top-28">
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
                className="h-10 rounded-xl bg-slate-50"
                required
              />
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Zap className="size-4" />
                Grant full access
              </Button>
            </form>
          </AdminSection>

          <AdminSection title="Full plan limits">
            <div className="grid gap-2 text-sm">
              {data.planLimits
                .filter((limit) => limit.planKey === "full")
                .map((limit) => (
                  <div key={limit.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-medium">{label(limit.limitKey)}</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {JSON.stringify(limit.limitValueJson)}
                    </p>
                  </div>
                ))}
            </div>
          </AdminSection>
        </aside>

        <section className="grid gap-4">
          <AdminSection title="Subscriptions" description="Latest subscription and lifetime rows.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Plan</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Renews</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3">
                        <p className="font-medium">{subscription.displayName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {subscription.email ?? "No email"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <PlanBadge plan={subscription.planKey} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={subscription.status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {subscription.currentPeriodEnd
                          ? formatDateTime(subscription.currentPeriodEnd)
                          : "No renewal"}
                        {subscription.cancelAtPeriodEnd ? " · cancels" : ""}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDateTime(subscription.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminSection>

          <AdminSection title="Recent entitlements">
            <div className="grid gap-2">
              {data.entitlements.slice(0, 40).map((entitlement) => (
                <div
                  key={entitlement.id}
                  className="grid gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entitlement.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entitlement.email ?? "No email"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{label(entitlement.entitlementKey)}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {JSON.stringify(entitlement.valueJson)}
                    </p>
                  </div>
                  <StatusBadge status={entitlement.source} />
                </div>
              ))}
            </div>
          </AdminSection>
        </section>
      </section>
    </PageShell>
  );
}
