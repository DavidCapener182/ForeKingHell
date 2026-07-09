import Link from "next/link";
import { AlertTriangle, Bot, Cable, CreditCard, ShieldCheck } from "lucide-react";

import { AdminMetric, AdminNav, AdminPageHeader, AdminSection } from "@/app/admin/admin-components";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { DataTableFrame, PageShell, StatusPill, type Tone } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getAdminOperationsSnapshot } from "@/lib/admin";

export const dynamic = "force-dynamic";

const adminSystemCheckColumns: DesktopWorkbenchColumn[] = [
  { id: "check", label: "Check", locked: true },
  { id: "area", label: "Area" },
  { id: "status", label: "Status" },
  { id: "count", label: "Count" },
  { id: "impact", label: "Impact" },
  { id: "action", label: "Action", locked: true },
];

const adminSystemCheckViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Provider health",
    href: "/admin/system-checks#admin-system-checks-table",
    detail: "Review provider accounts, import jobs and failed provider imports.",
  },
  {
    title: "Support risk",
    href: "/admin/system-checks#admin-system-checks-table",
    detail: "Check billing failures and operational signals before support action.",
  },
  {
    title: "Admin report export",
    href: "/admin/system-checks#admin-system-checks-table",
    detail: "Export the visible system-check register for an admin report.",
  },
];

export default async function AdminSystemChecksPage() {
  const operations = await getAdminOperationsSnapshot();
  const providerStatus = operations.providerImportFailures > 0 ? "Needs review" : "Healthy";
  const billingStatus = operations.billingFailures > 0 ? "Needs review" : "Clear";
  const systemCheckRows = buildSystemCheckRows(operations);

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

        <AdminSection
          title="Operational check register"
          description="Provider, billing, social, partner and access-control signals in one keyboardable desktop table."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/providers#provider-health">Open provider console</Link>
            </Button>
          }
        >
          <DesktopTableWorkbenchControls
            viewKey="admin-system-checks"
            scope="admin-system-checks"
            currentViewLabel="Admin system checks"
            resultLabel={`${systemCheckRows.length} checks`}
            columns={adminSystemCheckColumns}
            suggestedViews={adminSystemCheckViews}
            exportTableId="admin-system-checks"
            exportFileName="forekinghell-admin-system-checks.csv"
            className="mb-3"
          />
          <DataTableFrame
            mainTable
            mainTableLabel="Admin system checks table"
            stickyFirstColumn
            className="overflow-x-auto"
          >
            <table
              id="admin-system-checks-table"
              className="w-full min-w-[920px] text-left text-sm"
              data-workbench-scope="admin-system-checks"
              data-workbench-export-table="admin-system-checks"
              aria-describedby="admin-system-checks-summary"
            >
              <caption id="admin-system-checks-summary" className="sr-only">
                Admin system checks table with check, area, status, count, impact and action.
              </caption>
              <thead className="border-b text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                <tr>
                  <th
                    data-column="check"
                    className="sticky left-0 z-20 bg-white px-3 py-2 font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    Check
                  </th>
                  <th data-column="area" className="px-3 py-2 font-medium">
                    Area
                  </th>
                  <th data-column="status" className="px-3 py-2 font-medium">
                    Status
                  </th>
                  <th data-column="count" className="px-3 py-2 font-medium">
                    Count
                  </th>
                  <th data-column="impact" className="px-3 py-2 font-medium">
                    Impact
                  </th>
                  <th data-column="action" className="px-3 py-2 font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {systemCheckRows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    className="focus-aaa border-b outline-none last:border-b-0"
                  >
                    <td
                      data-column="check"
                      className="sticky left-0 z-10 bg-white px-3 py-3 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      <p className="font-medium">{row.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                    </td>
                    <td data-column="area" className="px-3 py-3">
                      <StatusPill tone="slate">{row.area}</StatusPill>
                    </td>
                    <td data-column="status" className="px-3 py-3">
                      <StatusPill tone={row.tone}>{row.status}</StatusPill>
                    </td>
                    <td data-column="count" className="px-3 py-3 font-mono text-xs">
                      {row.count}
                    </td>
                    <td data-column="impact" className="px-3 py-3 text-sm text-muted-foreground">
                      {row.impact}
                    </td>
                    <td data-column="action" className="px-3 py-3">
                      <Button asChild variant="outline" size="sm">
                        <Link href={row.href}>{row.action}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </AdminSection>

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

type SystemCheckTableRow = {
  id: string;
  label: string;
  detail: string;
  area: string;
  status: string;
  tone: Tone;
  count: string;
  impact: string;
  href: string;
  action: string;
};

function buildSystemCheckRows(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): SystemCheckTableRow[] {
  return [
    {
      id: "provider-accounts",
      label: "Provider accounts",
      detail: "Connected provider identities available for sync.",
      area: "Provider",
      status: operations.providerAccounts > 0 ? "Available" : "No accounts",
      tone: operations.providerAccounts > 0 ? "green" : "amber",
      count: operations.providerAccounts.toLocaleString("en-GB"),
      impact:
        operations.providerAccounts > 0
          ? "Sync checks can compare accounts against import jobs."
          : "Provider advice should stay cautious until accounts exist.",
      href: "/providers#provider-health",
      action: "Provider console",
    },
    {
      id: "import-jobs",
      label: "Import jobs",
      detail: "Provider and source-file imports tracked by the platform.",
      area: "Provider",
      status: operations.providerImportFailures > 0 ? "Needs review" : "Tracked",
      tone: operations.providerImportFailures > 0 ? "amber" : "green",
      count: operations.importJobs.toLocaleString("en-GB"),
      impact:
        operations.providerImportFailures > 0
          ? "Review failed jobs before trusting fresh launch-monitor advice."
          : "No failed provider jobs are currently flagged.",
      href: "/providers#provider-jobs",
      action: "Review jobs",
    },
    {
      id: "provider-failures",
      label: "Failed provider imports",
      detail: "Provider imports that need operator review.",
      area: "Provider",
      status: operations.providerImportFailures > 0 ? "Needs review" : "Clear",
      tone: operations.providerImportFailures > 0 ? "amber" : "green",
      count: operations.providerImportFailures.toLocaleString("en-GB"),
      impact:
        operations.providerImportFailures > 0
          ? "Treat recent provider data as lower confidence until resolved."
          : "No provider failure rows are currently flagged.",
      href: "/providers#provider-jobs",
      action: "Open failures",
    },
    {
      id: "billing-failures",
      label: "Billing failures",
      detail: "Subscription rows that may affect access or support.",
      area: "Billing",
      status: operations.billingFailures > 0 ? "Needs review" : "Clear",
      tone: operations.billingFailures > 0 ? "amber" : "green",
      count: operations.billingFailures.toLocaleString("en-GB"),
      impact:
        operations.billingFailures > 0
          ? "Inspect subscriptions before escalating access issues."
          : "No failed billing rows are currently flagged.",
      href: "/admin/billing",
      action: "Inspect billing",
    },
    {
      id: "social-operations",
      label: "Social operations",
      detail: "Groups, friend requests and comments visible to the platform.",
      area: "Social",
      status: "Observed",
      tone: "sky",
      count: (operations.groups + operations.friendRequests + operations.comments).toLocaleString(
        "en-GB",
      ),
      impact: `${operations.groups.toLocaleString("en-GB")} groups, ${operations.friendRequests.toLocaleString(
        "en-GB",
      )} friend requests and ${operations.comments.toLocaleString("en-GB")} comments.`,
      href: "/admin/moderation",
      action: "Moderation",
    },
    {
      id: "partner-operations",
      label: "Partner operations",
      detail: "Sponsor and partner offer rows that affect commercial surfaces.",
      area: "Partner",
      status: "Observed",
      tone: "sky",
      count: (operations.sponsors + operations.partnerOffers).toLocaleString("en-GB"),
      impact: `${operations.sponsors.toLocaleString("en-GB")} sponsors and ${operations.partnerOffers.toLocaleString(
        "en-GB",
      )} offers.`,
      href: "/partners",
      action: "Partners",
    },
    {
      id: "ai-summaries",
      label: "AI summaries",
      detail: "Stored AI social summaries available for review.",
      area: "AI",
      status: "Observed",
      tone: "sky",
      count: operations.aiSummaries.toLocaleString("en-GB"),
      impact: "Summaries should still cite visible app evidence before admin action.",
      href: "/data-chat",
      action: "Data chat",
    },
    {
      id: "rls-runbook",
      label: "RLS/test status",
      detail: "Use the CI and Supabase runbooks before changing access controls.",
      area: "Access",
      status: "Runbook ready",
      tone: "green",
      count: "Runbook",
      impact: "Do not change access controls without the runbook and test gate.",
      href: "/admin",
      action: "Admin overview",
    },
  ];
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
