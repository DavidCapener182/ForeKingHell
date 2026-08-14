import Link from "next/link";
import { AlertTriangle, CircleDashed } from "lucide-react";

import { AdminNav, AdminPageHeader, AdminSection } from "@/app/admin/admin-components";
import { AdminRetryButton } from "@/app/admin/admin-retry-button";
import { StatusTimeline } from "@/components/app/status-timeline";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const adminSystemCheckColumns: DesktopWorkbenchColumn[] = [
  { id: "check", label: "Check", locked: true },
  { id: "area", label: "Area" },
  { id: "status", label: "Status" },
  { id: "lastCheck", label: "Last check" },
  { id: "evidence", label: "Evidence" },
  { id: "impact", label: "Impact" },
  { id: "action", label: "Action", locked: true },
];

const adminSystemCheckViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Failures and attention",
    href: "/admin/system-checks#main-incident-timeline",
    detail: "Review checks with recorded failures or an operator action.",
  },
  {
    title: "Verification gaps",
    href: "/admin/system-checks#admin-system-checks-table",
    detail: "Find areas without a live health result in the current snapshot.",
  },
  {
    title: "System check export",
    href: "/admin/system-checks#admin-system-checks-table",
    detail: "Export the full evidence register for an admin report.",
  },
];

export default async function AdminSystemChecksPage() {
  const operations = await getAdminOperationsSnapshot();
  const healthRows = buildHealthRows(operations);
  const systemCheckRows = buildSystemCheckRows(operations);
  const incidentRows = systemCheckRows.filter(
    (row) => row.state === "failure" || row.state === "attention",
  );
  const failureCount = operations.providerImportFailures + operations.billingFailures;
  const unverifiedRows = healthRows.filter((row) => !row.verified);
  const verifiedCoverage = Math.round(
    (healthRows.filter((row) => row.verified).length / healthRows.length) * 100,
  );

  return (
    <PageShell>
      <AdminNav active="/admin/system-checks" />

      <DesktopWorkbenchLayout scope="admin-system-checks">
        <AdminPageHeader
          eyebrow="Admin system checks"
          title="System health console"
          description="See what the platform actually checked, what needs attention, and where live verification is still missing."
          tone="amber"
          action={<AdminRetryButton />}
        />

        <Card className="ring-[var(--status-warning-border)]">
          <CardHeader className="border-b bg-[var(--status-warning-surface)]/55 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-[var(--status-warning-border)] bg-background text-[var(--status-warning-foreground)]">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <CardDescription>Overall state</CardDescription>
                <CardTitle className="mt-0.5 text-xl font-semibold tracking-normal">
                  Needs attention
                </CardTitle>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {failureCount > 0
                    ? "Recorded failures need review, and several services have no live health result."
                    : "No recorded failures were found, but several services have no live health result."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant={failureCount > 0 ? "destructive" : "outline"}>
                {failureCount > 0
                  ? `${failureCount.toLocaleString("en-GB")} failures flagged`
                  : "No failures flagged"}
              </Badge>
              <Badge variant="secondary">Unverified · {unverifiedRows.length} areas</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-1 sm:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] sm:items-center">
            <Alert>
              <CircleDashed className="size-4" />
              <AlertTitle>Unchecked does not mean working</AlertTitle>
              <AlertDescription>
                This snapshot reads recorded operational rows. It does not run live service, CI,
                access-control, or connectivity probes.
              </AlertDescription>
            </Alert>
            <div>
              <div className="flex items-center justify-between gap-3 text-xs font-medium">
                <span>Live verification coverage</span>
                <span>{verifiedCoverage}%</span>
              </div>
              <Progress
                value={verifiedCoverage}
                aria-label="System check verification coverage"
                className="mt-2"
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {healthRows.filter((row) => row.verified).length} of {healthRows.length} areas have
                a result from a check this snapshot actually performs.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Health register</CardTitle>
            <CardDescription>
              Compact service rows with the latest evidence, operational impact, and next action.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div
              className="hidden grid-cols-[minmax(150px,0.7fr)_minmax(140px,0.65fr)_minmax(120px,0.55fr)_minmax(220px,1fr)_auto] gap-4 border-b bg-muted/30 px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:grid"
              aria-hidden
            >
              <span>Service</span>
              <span>Status</span>
              <span>Last check</span>
              <span>Impact</span>
              <span>Action</span>
            </div>
            <div className="divide-y">
              {healthRows.map((row) => (
                <HealthRow key={row.id} row={row} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div id="main-incident-timeline" className="scroll-mt-24">
          <AdminSection
            title="Main incident timeline"
            description="Recorded failures and operator-attention events from the current snapshot."
          >
            <StatusTimeline
              label="Main system incident timeline"
              items={incidentRows.map((row) => ({
                id: row.id,
                dateGroup: "Current snapshot",
                timestamp: row.lastCheck,
                title: row.label,
                description: row.impact,
                meta: row.evidence,
                status: row.status,
                kind: "warning",
                href: row.href,
                featured: row.state === "failure",
              }))}
              empty={
                <p className="text-sm text-muted-foreground">
                  No incidents are recorded in this snapshot. Unverified areas remain listed above
                  and are not treated as clear.
                </p>
              }
            />
          </AdminSection>
        </div>

        <AdminSection
          title="Full system check table"
          description="Every observed signal and verification gap, with no inferred service state."
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
              className="w-full min-w-[1120px] text-left text-sm"
              data-workbench-scope="admin-system-checks"
              data-workbench-export-table="admin-system-checks"
              aria-describedby="admin-system-checks-summary"
            >
              <TableCaption id="admin-system-checks-summary" className="sr-only">
                Admin system checks table with check, area, status, last check, evidence, impact and
                action.
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
                  <TableHead data-column="lastCheck">Last check</TableHead>
                  <TableHead data-column="evidence">Evidence</TableHead>
                  <TableHead data-column="impact">Impact</TableHead>
                  <TableHead data-column="action">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemCheckRows.map((row) => (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    className={cn(
                      "focus-aaa outline-none",
                      row.state === "failure" && "bg-destructive/[0.055] hover:bg-destructive/10",
                    )}
                  >
                    <TableCell
                      data-column="check"
                      className={cn(
                        "sticky left-0 z-10 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]",
                        row.state === "failure" &&
                          "bg-[color-mix(in_srgb,var(--destructive)_6%,var(--card))]",
                      )}
                    >
                      <p className="font-medium">{row.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                    </TableCell>
                    <TableCell data-column="area">
                      <Badge variant="outline">{row.area}</Badge>
                    </TableCell>
                    <TableCell data-column="status">
                      <HealthStatusBadge state={row.state} status={row.status} />
                    </TableCell>
                    <TableCell data-column="lastCheck" className="text-xs text-muted-foreground">
                      {row.lastCheck}
                    </TableCell>
                    <TableCell data-column="evidence" className="font-mono text-xs">
                      {row.evidence}
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
                        <span className="text-xs text-muted-foreground">No live check</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableFrame>
        </AdminSection>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type HealthState = "failure" | "attention" | "quiet" | "unverified";

type HealthSummaryRow = {
  id: string;
  label: string;
  status: string;
  state: HealthState;
  verified: boolean;
  lastCheck: string;
  impact: string;
  href?: string;
  action?: string;
};

type SystemCheckTableRow = {
  id: string;
  label: string;
  detail: string;
  area: string;
  status: string;
  state: HealthState;
  lastCheck: string;
  evidence: string;
  impact: string;
  href?: string;
  action?: string;
};

function HealthRow({ row }: { row: HealthSummaryRow }) {
  return (
    <Item
      variant="default"
      size="sm"
      className={cn(
        "grid rounded-none border-0 bg-transparent px-4 py-3 lg:grid-cols-[minmax(150px,0.7fr)_minmax(140px,0.65fr)_minmax(120px,0.55fr)_minmax(220px,1fr)_auto] lg:gap-4",
        row.state === "failure" &&
          "bg-destructive/[0.055] shadow-[inset_3px_0_0_var(--destructive)]",
        row.state === "attention" &&
          "bg-[var(--status-warning-surface)]/45 shadow-[inset_3px_0_0_var(--status-warning-border)]",
      )}
    >
      <ItemContent>
        <ItemTitle>{row.label}</ItemTitle>
        <ItemDescription className="whitespace-normal lg:hidden">Service</ItemDescription>
      </ItemContent>
      <div>
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
          Status
        </span>
        <HealthStatusBadge state={row.state} status={row.status} />
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="mb-1 block font-semibold uppercase tracking-[0.08em] lg:hidden">
          Last check
        </span>
        {row.lastCheck}
      </div>
      <p className="text-sm leading-5 text-muted-foreground">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] lg:hidden">
          Impact
        </span>
        {row.impact}
      </p>
      <ItemActions className="ml-0 justify-start lg:ml-auto lg:justify-end">
        {row.href && row.action ? (
          <Button asChild variant="outline" size="sm">
            <Link href={row.href}>{row.action}</Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No live check</span>
        )}
      </ItemActions>
    </Item>
  );
}

function HealthStatusBadge({ state, status }: { state: HealthState; status: string }) {
  if (state === "failure") {
    return <Badge variant="destructive">{status}</Badge>;
  }

  if (state === "attention") {
    return (
      <Badge
        variant="outline"
        className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]"
      >
        {status}
      </Badge>
    );
  }

  if (state === "unverified") {
    return <Badge variant="secondary">{status}</Badge>;
  }

  return <Badge variant="outline">{status}</Badge>;
}

function buildHealthRows(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): HealthSummaryRow[] {
  const importStatus = importHealthState(operations);

  return [
    {
      id: "provider",
      label: "Provider",
      status: operations.providerAccounts > 0 ? "Unverified" : "Needs attention",
      state: operations.providerAccounts > 0 ? "unverified" : "attention",
      verified: false,
      lastCheck: "Registry only",
      impact:
        operations.providerAccounts > 0
          ? `${operations.providerAccounts.toLocaleString("en-GB")} provider accounts exist, but live availability was not checked.`
          : "No provider identities are available for sync.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Inspect",
    },
    {
      id: "imports",
      label: "Imports",
      status: importStatus.status,
      state: importStatus.state,
      verified: importStatus.verified,
      lastCheck: importStatus.verified ? "Current snapshot" : "No job evidence",
      impact:
        operations.providerImportFailures > 0
          ? "Fresh launch-monitor data may be incomplete until failed jobs are resolved."
          : operations.importJobs > 0
            ? `${operations.importJobs.toLocaleString("en-GB")} jobs checked; no recorded failures found.`
            : "There are no tracked jobs from which to judge import health.",
      href: "/providers?tab=diagnostics#provider-jobs",
      action: "Review jobs",
    },
    {
      id: "billing",
      label: "Billing",
      status:
        operations.billingFailures > 0
          ? `${operations.billingFailures.toLocaleString("en-GB")} failures flagged`
          : "No failures flagged",
      state: operations.billingFailures > 0 ? "failure" : "quiet",
      verified: true,
      lastCheck: "Current snapshot",
      impact:
        operations.billingFailures > 0
          ? "Subscription access or support cases may be affected."
          : "No failed billing rows are currently recorded.",
      href: "/admin/billing",
      action: "Inspect",
    },
    {
      id: "auth",
      label: "Auth",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Sign-in and session availability are unknown from this snapshot.",
    },
    {
      id: "rls",
      label: "RLS",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Database access-policy enforcement has no live result here.",
    },
    {
      id: "ai",
      label: "AI",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Stored rows only",
      impact: `${operations.aiSummaries.toLocaleString("en-GB")} stored summaries do not prove model availability or output quality.`,
      href: "/data-chat",
      action: "Inspect evidence",
    },
    {
      id: "storage",
      label: "Storage",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Upload, download, capacity, and object access are unknown.",
    },
    {
      id: "external-connections",
      label: "External connections",
      status: "Unverified",
      state: "unverified",
      verified: false,
      lastCheck: "Not checked",
      impact: "Third-party reachability and credentials were not probed.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Inspect",
    },
  ];
}

function buildSystemCheckRows(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): SystemCheckTableRow[] {
  const importStatus = importHealthState(operations);

  return [
    {
      id: "provider-accounts",
      label: "Provider account registry",
      detail: "Connected provider identities available to the import system.",
      area: "Provider",
      status: operations.providerAccounts > 0 ? "Unverified" : "Needs attention",
      state: operations.providerAccounts > 0 ? "unverified" : "attention",
      lastCheck: "Registry only",
      evidence: `${operations.providerAccounts.toLocaleString("en-GB")} accounts`,
      impact:
        operations.providerAccounts > 0
          ? "Account presence does not prove provider availability."
          : "No provider identity is available for sync.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Provider console",
    },
    {
      id: "import-jobs",
      label: "Tracked import jobs",
      detail: "Provider and source-file imports recorded by the platform.",
      area: "Imports",
      status: importStatus.status,
      state: importStatus.state,
      lastCheck: importStatus.verified ? "Current snapshot" : "No job evidence",
      evidence: `${operations.importJobs.toLocaleString("en-GB")} jobs`,
      impact:
        operations.importJobs > 0
          ? "The failure register can be judged against tracked job volume."
          : "Import health cannot be judged without tracked jobs.",
      href: "/providers?tab=diagnostics#provider-jobs",
      action: "Review jobs",
    },
    {
      id: "provider-failures",
      label: "Provider import failures",
      detail: "Recorded provider imports that need operator review.",
      area: "Imports",
      status:
        operations.providerImportFailures > 0
          ? `${operations.providerImportFailures.toLocaleString("en-GB")} failures flagged`
          : "No failures flagged",
      state: operations.providerImportFailures > 0 ? "failure" : "quiet",
      lastCheck: "Current snapshot",
      evidence: `${operations.providerImportFailures.toLocaleString("en-GB")} failures`,
      impact:
        operations.providerImportFailures > 0
          ? "Treat recent provider data as lower confidence until resolved."
          : "No provider failure rows are currently recorded.",
      href: "/providers?tab=diagnostics#provider-jobs",
      action: "Open failures",
    },
    {
      id: "billing-failures",
      label: "Billing failure register",
      detail: "Subscription rows that may affect access or support.",
      area: "Billing",
      status:
        operations.billingFailures > 0
          ? `${operations.billingFailures.toLocaleString("en-GB")} failures flagged`
          : "No failures flagged",
      state: operations.billingFailures > 0 ? "failure" : "quiet",
      lastCheck: "Current snapshot",
      evidence: `${operations.billingFailures.toLocaleString("en-GB")} failures`,
      impact:
        operations.billingFailures > 0
          ? "Inspect subscriptions before escalating access issues."
          : "No failed billing rows are currently recorded.",
      href: "/admin/billing",
      action: "Inspect billing",
    },
    ...unverifiedSystemRows(operations),
  ];
}

function importHealthState(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): Pick<HealthSummaryRow, "status" | "state" | "verified"> {
  if (operations.providerImportFailures > 0) {
    return {
      status: `${operations.providerImportFailures.toLocaleString("en-GB")} failures flagged`,
      state: "failure",
      verified: true,
    };
  }

  if (operations.importJobs > 0) {
    return { status: "No failures flagged", state: "quiet", verified: true };
  }

  return { status: "Unverified", state: "unverified", verified: false };
}

function unverifiedSystemRows(
  operations: Awaited<ReturnType<typeof getAdminOperationsSnapshot>>,
): SystemCheckTableRow[] {
  return [
    {
      id: "auth-live-check",
      label: "Authentication availability",
      detail: "Live sign-in, provider enablement, and session checks.",
      area: "Auth",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "Authentication availability is unknown from this snapshot.",
    },
    {
      id: "rls-live-check",
      label: "RLS policy enforcement",
      detail: "Database persona and access-policy verification.",
      area: "RLS",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "Use current database-check evidence before changing access controls.",
    },
    {
      id: "ai-live-check",
      label: "AI service availability",
      detail: "Live model response and evidence-quality verification.",
      area: "AI",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Stored rows only",
      evidence: `${operations.aiSummaries.toLocaleString("en-GB")} summaries`,
      impact: "Stored summaries do not prove current model availability or output quality.",
      href: "/data-chat",
      action: "Inspect evidence",
    },
    {
      id: "storage-live-check",
      label: "Storage availability",
      detail: "Upload, download, object access, and capacity verification.",
      area: "Storage",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "Storage reachability and object access are unknown.",
    },
    {
      id: "external-live-check",
      label: "External connection reachability",
      detail: "Third-party network reachability and credential verification.",
      area: "External connections",
      status: "No live verification result",
      state: "unverified",
      lastCheck: "Not checked",
      evidence: "--",
      impact: "No third-party connection was actively probed by this snapshot.",
      href: "/providers?tab=diagnostics#provider-health",
      action: "Provider console",
    },
  ];
}
