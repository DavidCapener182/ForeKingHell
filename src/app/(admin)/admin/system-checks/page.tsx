import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AdminNav, AdminPageHeader, AdminSection } from "@/app/admin/admin-components";
import { AdminRetryButton } from "@/app/admin/admin-retry-button";
import { StatusTimeline } from "@/components/app/status-timeline";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageShell, StatusPill, type Tone } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    title: "Provider status",
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
  const providerStatus =
    operations.providerImportFailures > 0 ? "Needs review" : "No failures flagged";
  const systemCheckRows = buildSystemCheckRows(operations);
  const attentionRows = systemCheckRows.filter((row) => row.tone === "amber");
  const importHealth =
    operations.importJobs > 0
      ? Math.max(
          0,
          Math.round(
            ((operations.importJobs - operations.providerImportFailures) / operations.importJobs) *
              100,
          ),
        )
      : 0;

  return (
    <PageShell>
      <AdminNav active="/admin/system-checks" />

      <DesktopWorkbenchLayout scope="admin-system-checks">
        <AdminPageHeader
          eyebrow="Admin system checks"
          title="Provider status and platform checks"
          description="Review provider imports, billing failures and operating signals before opening support or moderation work."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={operations.providerImportFailures > 0 ? "amber" : "green"}>
                {providerStatus}
              </StatusPill>
              <AdminRetryButton />
            </div>
          }
        />

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Overall system status</CardTitle>
              <Badge
                variant={attentionRows.length > 0 ? "destructive" : "secondary"}
                className="w-fit"
              >
                {attentionRows.length > 0
                  ? `${attentionRows.length} need review`
                  : "No failures flagged"}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>Provider import health</span>
                  <span className="font-medium">{importHealth}%</span>
                </div>
                <Progress value={importHealth} className="mt-2" />
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Based on {operations.importJobs} tracked import jobs and{" "}
                {operations.providerImportFailures} flagged failures.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service health</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {systemCheckRows.slice(0, 4).map((row) => (
                <Item key={row.id} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{row.label}</ItemTitle>
                    <ItemDescription>{row.detail}</ItemDescription>
                  </ItemContent>
                  <Badge variant={row.tone === "amber" ? "destructive" : "secondary"}>
                    {row.status}
                  </Badge>
                </Item>
              ))}
            </CardContent>
          </Card>
        </section>

        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Live verification configuration is separate</AlertTitle>
          <AlertDescription>
            This operations snapshot does not query CI, RLS, or automated test state. Use current
            deployment evidence before changing access controls; missing verification is not treated
            as an outage.
          </AlertDescription>
        </Alert>

        <AdminSection
          title="Incident history"
          description="Current checks that require operator attention."
        >
          <StatusTimeline
            label="System incident history"
            items={attentionRows.map((row) => ({
              id: row.id,
              title: row.label,
              description: row.impact,
              status: row.status,
              kind: "warning",
              href: row.href,
            }))}
            empty={<p className="text-sm text-muted-foreground">No current incident rows.</p>}
          />
        </AdminSection>

        <AdminSection
          title="Operational check register"
          description="Provider, billing, social, partner and access-control signals in one keyboardable desktop table."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/providers?tab=diagnostics#provider-health">Open provider console</Link>
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
            <Table
              id="admin-system-checks-table"
              className="w-full min-w-[920px] text-left text-sm"
              data-workbench-scope="admin-system-checks"
              data-workbench-export-table="admin-system-checks"
              aria-describedby="admin-system-checks-summary"
            >
              <TableCaption id="admin-system-checks-summary" className="sr-only">
                Admin system checks table with check, area, status, count, impact and action.
              </TableCaption>
              <TableHeader className="text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <TableRow>
                  <TableHead
                    data-column="check"
                    className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    Check
                  </TableHead>
                  <TableHead data-column="area">Area</TableHead>
                  <TableHead data-column="status">Status</TableHead>
                  <TableHead data-column="count">Count</TableHead>
                  <TableHead data-column="impact">Impact</TableHead>
                  <TableHead data-column="action">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemCheckRows.map((row) => (
                  <TableRow key={row.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="check"
                      className="sticky left-0 z-10 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                    >
                      <p className="font-medium">{row.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                    </TableCell>
                    <TableCell data-column="area">
                      <StatusPill tone="slate">{row.area}</StatusPill>
                    </TableCell>
                    <TableCell data-column="status">
                      <StatusPill tone={row.tone}>{row.status}</StatusPill>
                    </TableCell>
                    <TableCell data-column="count" className="font-mono text-xs">
                      {row.count}
                    </TableCell>
                    <TableCell data-column="impact" className="text-sm text-muted-foreground">
                      {row.impact}
                    </TableCell>
                    <TableCell data-column="action">
                      {row.href && row.action ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={row.href}>{row.action}</Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No live result</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </AdminSection>

        <section className="grid gap-4 lg:grid-cols-3">
          <AdminSection title="Next admin actions">
            <div className="grid gap-2">
              <AdminAction
                href="/providers?tab=diagnostics#provider-jobs"
                label="Review provider jobs"
              />
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
  href?: string;
  action?: string;
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
      href: "/providers?tab=diagnostics#provider-health",
      action: "Provider console",
    },
    {
      id: "import-jobs",
      label: "Import jobs",
      detail: "Provider and source-file imports tracked by the platform.",
      area: "Provider",
      status:
        operations.providerImportFailures > 0
          ? "Needs review"
          : operations.importJobs > 0
            ? "No failures flagged"
            : "No jobs",
      tone:
        operations.providerImportFailures > 0
          ? "amber"
          : operations.importJobs > 0
            ? "green"
            : "slate",
      count: operations.importJobs.toLocaleString("en-GB"),
      impact:
        operations.providerImportFailures > 0
          ? "Review failed jobs before trusting fresh launch-monitor advice."
          : "No failed provider jobs are currently flagged.",
      href: "/providers?tab=diagnostics#provider-jobs",
      action: "Review jobs",
    },
    {
      id: "provider-failures",
      label: "Provider failures",
      detail: "Provider imports that need operator review.",
      area: "Provider",
      status: operations.providerImportFailures > 0 ? "Needs review" : "Clear",
      tone: operations.providerImportFailures > 0 ? "amber" : "green",
      count: operations.providerImportFailures.toLocaleString("en-GB"),
      impact:
        operations.providerImportFailures > 0
          ? "Treat recent provider data as lower confidence until resolved."
          : "No provider failure rows are currently flagged.",
      href: "/providers?tab=diagnostics#provider-jobs",
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
      id: "verification-evidence",
      label: "Verification evidence",
      detail: "CI, RLS and automated test results are not queried by this operations snapshot.",
      area: "Access",
      status: "No live verification result",
      tone: "slate",
      count: "--",
      impact: "Use current CI and database-check evidence before changing access controls.",
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
