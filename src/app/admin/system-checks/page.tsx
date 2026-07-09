import Link from "next/link";
import { AlertTriangle, Bot, Cable, CreditCard, ShieldCheck } from "lucide-react";

import { AdminMetric, AdminNav, AdminPageHeader, AdminSection } from "@/app/admin/admin-components";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getAdminOperationsSnapshot } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminSystemChecksPage() {
  const operations = await getAdminOperationsSnapshot();
  const providerStatus = operations.providerImportFailures > 0 ? "Needs review" : "Healthy";
  const billingStatus = operations.billingFailures > 0 ? "Needs review" : "Clear";

  return (
    <PageShell>
      <MobileRouteHeader title="Platform" group="platform" activeKey="admin" />
      <AdminNav active="/admin/system-checks" />

      <DesktopWorkbenchLayout scope="admin-system-checks">
        <AdminPageHeader
          eyebrow="Admin system checks"
          title="Provider health and platform checks"
          description="Review provider imports, billing failures and operating signals before opening support or moderation work."
          action={
            <StatusPill tone={operations.providerImportFailures > 0 ? "amber" : "green"}>
              {providerStatus}
            </StatusPill>
          }
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetric
            icon={Cable}
            label="Provider accounts"
            value={operations.providerAccounts}
            detail={`${operations.importJobs} import jobs tracked`}
          />
          <AdminMetric
            icon={AlertTriangle}
            label="Provider failures"
            value={operations.providerImportFailures}
            detail={providerStatus}
          />
          <AdminMetric
            icon={CreditCard}
            label="Billing failures"
            value={operations.billingFailures}
            detail={billingStatus}
          />
          <AdminMetric
            icon={Bot}
            label="AI summaries"
            value={operations.aiSummaries}
            detail={`${operations.groups} groups and ${operations.friendships} friendships`}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.44fr)] xl:items-start">
          <AdminSection
            title="Provider health"
            description="Import accounts and jobs that determine whether launch-monitor evidence can be trusted."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/providers#provider-health">Open provider console</Link>
              </Button>
            }
          >
            <div className="grid gap-2">
              <SystemCheckRow
                label="Provider accounts"
                value={operations.providerAccounts}
                detail="Connected provider identities available for sync."
              />
              <SystemCheckRow
                label="Import jobs"
                value={operations.importJobs}
                detail="Provider and source-file imports tracked by the platform."
              />
              <SystemCheckRow
                label="Failed provider imports"
                value={operations.providerImportFailures}
                detail={
                  operations.providerImportFailures > 0
                    ? "Review provider job logs before trusting fresh advice."
                    : "No failed provider import jobs are currently flagged."
                }
                warning={operations.providerImportFailures > 0}
              />
            </div>
          </AdminSection>

          <AdminSection
            title="System checks"
            description="Cross-platform signals that affect support, safety and commercial operations."
          >
            <div className="grid gap-2">
              <SystemCheckRow
                label="Billing failures"
                value={operations.billingFailures}
                detail={
                  operations.billingFailures > 0
                    ? "Inspect subscriptions before escalating access issues."
                    : "No failed billing rows are currently flagged."
                }
                warning={operations.billingFailures > 0}
              />
              <SystemCheckRow
                label="Groups"
                value={operations.groups}
                detail={`${operations.friendRequests} friend requests and ${operations.comments} comments`}
              />
              <SystemCheckRow
                label="Partner operations"
                value={operations.sponsors + operations.partnerOffers}
                detail={`${operations.sponsors} sponsors and ${operations.partnerOffers} offers`}
              />
              <SystemCheckRow
                label="RLS/test status"
                value="Runbook ready"
                detail="Use the CI and Supabase runbooks before changing access controls."
              />
            </div>
          </AdminSection>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <AdminSection title="Next admin actions">
            <div className="grid gap-2">
              <AdminAction href="/providers#provider-jobs" label="Review provider jobs" />
              <AdminAction href="/admin/billing" label="Inspect billing failures" />
              <AdminAction href="/admin/moderation" label="Open moderation queue" />
            </div>
          </AdminSection>

          <AdminSection title="Evidence policy">
            <p className="text-sm leading-6 text-muted-foreground">
              Admin recommendations should cite visible provider counts, billing state and audit
              rows. Do not infer a provider outage from missing data alone.
            </p>
          </AdminSection>

          <AdminSection title="Access note">
            <p className="text-sm leading-6 text-muted-foreground">
              This page uses the protected admin data helper, so only active owner or operator
              accounts can see system checks.
            </p>
          </AdminSection>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SystemCheckRow({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: number | string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-border bg-white/78 p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5 text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
      <StatusPill tone={warning ? "amber" : "green"}>{value}</StatusPill>
    </div>
  );
}

function AdminAction({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="justify-start">
      <Link href={href}>
        <ShieldCheck className="size-4" />
        {label}
      </Link>
    </Button>
  );
}
