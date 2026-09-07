import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Cable,
  CreditCard,
  Database,
  Flag,
  ShieldAlert,
  UserCog,
} from "lucide-react";

import { AdminNav, AdminNotice, formatDateTime, label } from "@/app/admin/admin-components";
import {
  OperationsPanel,
  OperationalStatusStrip,
  type OperationalStatus,
  type OperationalStatusItem,
} from "@/app/admin/admin-overview-components";
import { AdminAttention } from "@/app/admin/admin-attention";

import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getAdminOverviewData } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{
    adminStatus?: string;
    adminError?: string;
  }>;
};

type AttentionRow = {
  id: string;
  area: string;
  status: OperationalStatus;
  statusLabel: string;
  evidence: string;
  href: string;
  action: string;
};

const quickActions = [
  {
    href: "/admin/users",
    label: "User and account actions",
    description: "Find an account, inspect plan state and manage admin access.",
    icon: UserCog,
  },
  {
    href: "/admin/billing",
    label: "Billing operations",
    description: "Review subscriptions, entitlements and failed billing states.",
    icon: CreditCard,
  },
  {
    href: "/admin/moderation",
    label: "Moderation queue",
    description: "Resolve open reports and moderation events.",
    icon: ShieldAlert,
  },
  {
    href: "/admin/system-checks",
    label: "System checks",
    description: "Inspect recorded provider and platform evidence.",
    icon: Cable,
  },
  {
    href: "/providers?tab=diagnostics#provider-health",
    label: "Provider diagnostics",
    description: "Open provider accounts, import jobs and diagnostics.",
    icon: Database,
  },
  {
    href: "/admin/challenges",
    label: "Challenge operations",
    description: "Manage templates, entries, attempts and results.",
    icon: Flag,
  },
] as const;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const { data, operations } = await getAdminOverviewData();
  const moderationQueue = data.metrics.openReports + operations.openModerationEvents;
  const actualFailureCount = operations.providerImportFailures + operations.billingFailures;

  const statusItems: OperationalStatusItem[] = [
    {
      label: "Provider issues",
      value:
        operations.providerImportFailures > 0
          ? `${operations.providerImportFailures} failed`
          : "None recorded",
      detail: `${operations.importJobs} import jobs · live health unverified`,
      status: operations.providerImportFailures > 0 ? "failure" : "recorded-none",
    },
    {
      label: "Billing issues",
      value:
        operations.billingFailures > 0 ? `${operations.billingFailures} failed` : "None recorded",
      detail: "Failed subscription states in the current snapshot",
      status: operations.billingFailures > 0 ? "failure" : "recorded-none",
    },
    {
      label: "Moderation queue",
      value: `${moderationQueue} open`,
      detail: `${data.metrics.openReports} reports · ${operations.openModerationEvents} events`,
      status: moderationQueue > 0 ? "queue" : "recorded-none",
    },
    {
      label: "User/account actions",
      value: "Unknown",
      detail: "No account-action queue is connected",
      status: "unverified",
    },
    {
      label: "System verification",
      value: "Unverified",
      detail: "No live CI, RLS or automated test result",
      status: "unverified",
    },
  ];

  const attentionRows: AttentionRow[] = [
    {
      id: "provider-imports",
      area: "Provider imports",
      status: operations.providerImportFailures > 0 ? "failure" : "recorded-none",
      statusLabel:
        operations.providerImportFailures > 0
          ? `${operations.providerImportFailures} failures`
          : "No failures recorded",
      evidence: `${operations.providerImportFailures} failed jobs across ${operations.importJobs} tracked import jobs. This is a database snapshot, not a live provider check.`,
      href: "/admin/system-checks",
      action: "Review checks",
    },
    {
      id: "billing",
      area: "Billing",
      status: operations.billingFailures > 0 ? "failure" : "recorded-none",
      statusLabel:
        operations.billingFailures > 0
          ? `${operations.billingFailures} failed states`
          : "No failures recorded",
      evidence: `${operations.billingFailures} subscriptions are recorded as past due, unpaid or incomplete expired. Payment-provider availability is not checked here.`,
      href: "/admin/billing",
      action: "Open billing",
    },
    {
      id: "moderation",
      area: "Moderation",
      status: moderationQueue > 0 ? "queue" : "recorded-none",
      statusLabel: moderationQueue > 0 ? `${moderationQueue} open` : "No open work recorded",
      evidence: `${data.metrics.openReports} open reports and ${operations.openModerationEvents} open moderation events are recorded.`,
      href: "/admin/moderation",
      action: "Open queue",
    },
    {
      id: "account-actions",
      area: "User/account actions",
      status: "unverified",
      statusLabel: "Unknown",
      evidence:
        "No dedicated account-action or support queue is connected to this overview. Recent account creation does not prove that an action is required.",
      href: "/admin/users",
      action: "Search users",
    },
    {
      id: "system-verification",
      area: "System verification",
      status: "unverified",
      statusLabel: "Unverified",
      evidence:
        "This snapshot does not run deployment, CI, RLS or automated test checks. Missing verification is not treated as system health.",
      href: "/admin/system-checks",
      action: "View register",
    },
  ];

  return (
    <PageShell>
      <div className="grid gap-3">
        <AdminNav active="/admin" />
        <AdminNotice status={params?.adminStatus} error={params?.adminError} />
      </div>

      <div className="grid min-w-0 gap-5 pb-28">
        <header className="border-b border-border pb-4 pt-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Admin operations
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Operations console
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Review recorded failures, queued work and operator activity from one protected
                control surface.
              </p>
            </div>
            <Badge variant="outline" className="w-fit rounded-md">
              Protected operator surface
            </Badge>
          </div>
        </header>

        <section aria-labelledby="operational-status-title">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 id="operational-status-title" className="text-sm font-semibold">
              Operational status
            </h2>
            <p className="text-xs text-muted-foreground">
              Snapshot at {formatDateTime(new Date())} · live health unverified
            </p>
          </div>
          <OperationalStatusStrip
            items={statusItems.map((item, index) => ({
              ...item,
              href: [
                "/admin/system-checks",
                "/admin/billing",
                "/admin/moderation",
                "/admin/users",
                "/admin/system-checks",
              ][index],
            }))}
          />
        </section>

        {actualFailureCount > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Recorded operational failures require review</AlertTitle>
            <AlertDescription>
              {operations.providerImportFailures} failed provider imports and{" "}
              {operations.billingFailures} failed billing states are present in the current
              snapshot.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)] xl:items-start">
          <OperationsPanel
            title="Attention required"
            description="Failures, open queues and verification gaps. Neutral rows mean no issue is recorded, not that a live service is healthy."
          >
            <AdminAttention rows={attentionRows} />
          </OperationsPanel>

          <OperationsPanel
            title="Recent operational activity"
            description="Latest recorded owner and operator audit events."
          >
            <div className="p-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Latest {data.recentAuditRows.length} recorded events, up to 8, newest first. An
                audit record alone does not verify an external outcome.
              </p>
              {data.recentAuditRows.length ? (
                <ol className="grid gap-3">
                  {data.recentAuditRows.map((row) => (
                    <li key={row.id}>
                      <details className="rounded-xl border p-3">
                        <summary className="min-h-11 cursor-pointer break-words">
                          <span className="font-medium">{label(row.action)}</span>
                          <span className="mt-1 block text-xs">
                            {formatDateTime(row.createdAt)}
                          </span>
                        </summary>
                        <dl className="mt-3 grid gap-3 text-sm">
                          {Object.entries({
                            Actor: row.actorEmail ?? "System actor",
                            Action: label(row.action),
                            "Target type": row.targetType ?? "Not recorded",
                            Target: row.targetId ?? "Not recorded",
                            Outcome: "Not recorded separately",
                            Source: "Administrator audit log",
                          }).map(([key, value]) => (
                            <div key={key}>
                              <dt className="text-muted-foreground">{key}</dt>
                              <dd className="break-all">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No audit events are recorded. Activity outside this log is unknown.</p>
              )}
            </div>
          </OperationsPanel>
        </section>

        <section aria-labelledby="quick-admin-actions-title">
          <div className="mb-2">
            <h2 id="quick-admin-actions-title" className="text-sm font-semibold">
              Quick admin actions
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Open the protected workflow that owns the underlying data.
            </p>
          </div>
          <div className="grid overflow-hidden rounded-lg border border-border bg-background sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex min-h-24 items-start gap-3 border-b border-border p-4 outline-none transition-colors hover:bg-muted/45 focus-visible:bg-muted/45 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0 xl:[&:nth-last-child(-n+3)]:border-b-0"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3 text-sm font-medium">
                      {action.label}
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
