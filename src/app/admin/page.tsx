import Link from "next/link";
import {
  Activity,
  Brain,
  Database,
  FileText,
  Flag,
  Radio,
  Search,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";

import {
  AdminMetric,
  AdminNav,
  AdminNotice,
  AdminPageHeader,
  AdminSection,
  formatDateTime,
  label,
  PlanBadge,
} from "@/app/admin/admin-components";
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { DataTableFrame, PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getAdminOverviewData } from "@/lib/admin";

export const dynamic = "force-dynamic";

const adminWorkbenchPrompts = [
  {
    label: "Explain this page",
    prompt:
      "Explain my ForeKingHell Admin overview using only visible user, golf-data, feed, report, billing, provider, group and audit evidence.",
    icon: Brain,
  },
  {
    label: "Check operations",
    prompt:
      "Review visible admin operations and identify the first queue or provider issue that needs attention.",
    icon: ShieldCheck,
  },
  {
    label: "Find user risk",
    prompt:
      "Summarise visible user, plan, report and audit signals that may need owner review. Do not invent hidden user data.",
    icon: Search,
  },
  {
    label: "Provider health",
    prompt:
      "Review visible provider accounts, import jobs and provider failures from the admin snapshot and recommend the next check.",
    icon: Database,
  },
  {
    label: "Generate admin report",
    prompt:
      "Generate an admin operations report with network metrics, open reports, provider failures, billing failures, audit activity and next action.",
    icon: FileText,
  },
];

type AdminPageProps = {
  searchParams?: Promise<{
    adminStatus?: string;
    adminError?: string;
  }>;
};

type AdminOverviewData = Awaited<ReturnType<typeof getAdminOverviewData>>;
type AdminOverviewUser = AdminOverviewData["data"]["recentUsers"][number];

const adminOverviewUserColumns: DesktopWorkbenchColumn[] = [
  { id: "user", label: "User", locked: true },
  { id: "plan", label: "Plan" },
  { id: "role", label: "Admin role" },
  { id: "sessions", label: "Sessions" },
  { id: "feed", label: "Feed cards" },
  { id: "created", label: "Created" },
  { id: "action", label: "Action" },
];

const adminOverviewUserSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "New paid users",
    href: "/admin/users",
    detail: "Open the full user lookup to review plan and account state.",
  },
  {
    title: "Admin operators",
    href: "/admin/users",
    detail: "Review owner and operator accounts.",
  },
  {
    title: "Users with golf data",
    href: "/admin/users",
    detail: "Find users with sessions and feed activity.",
  },
];

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const { data, operations } = await getAdminOverviewData();

  return (
    <PageShell>
      <MobileRouteHeader title="Platform" group="platform" activeKey="admin" />
      <AdminNav active="/admin" />
      <AdminNotice status={params?.adminStatus} error={params?.adminError} />

      <DesktopWorkbenchLayout
        scope="admin"
        railBreakpoint="2xl"
        rail={
          <DesktopInsightRail
            title="AI admin rail"
            description="Queues, health checks and audit context stay visible while running the protected console."
            metrics={[
              {
                label: "Users",
                value: String(data.metrics.users),
                detail: `${data.metrics.activeSubscriptions} active paid rows.`,
                tone: data.metrics.users > 0 ? "sky" : "slate",
              },
              {
                label: "Open reports",
                value: String(data.metrics.openReports),
                detail: `${operations.comments} comments and moderation surfaces are visible.`,
                tone: data.metrics.openReports > 0 ? "amber" : "green",
              },
              {
                label: "Provider failures",
                value: String(operations.providerImportFailures),
                detail: `${operations.providerAccounts} provider accounts and ${operations.importJobs} import jobs.`,
                tone: operations.providerImportFailures > 0 ? "amber" : "green",
              },
              {
                label: "Billing failures",
                value: String(operations.billingFailures),
                detail: `${data.metrics.lifetimeGrants} lifetime grants are visible.`,
                tone: operations.billingFailures > 0 ? "amber" : "green",
              },
            ]}
            evidence={[
              `${data.metrics.users} users and ${data.metrics.activeSubscriptions} active paid rows are visible.`,
              `${data.metrics.openReports} open reports are visible.`,
              `${operations.providerImportFailures} provider import failures and ${operations.billingFailures} billing failures are visible.`,
              `${data.recentAuditRows.length} recent audit rows are visible.`,
            ]}
            prompts={adminWorkbenchPrompts}
            actions={[
              {
                label: "User lookup",
                href: "/admin/users",
                detail: "Find accounts, roles and plan state.",
                icon: UserRound,
              },
              {
                label: "Moderation",
                href: "/admin/moderation",
                detail: "Resolve reports and safety events.",
                icon: ShieldCheck,
              },
              {
                label: "Billing admin",
                href: "/admin/billing",
                detail: "Inspect subscriptions and entitlements.",
                icon: Zap,
              },
            ]}
          />
        }
      >
        <AdminPageHeader
          eyebrow="Admin operations"
          title="Site control room"
          description="Monitor growth, billing access, social safety and challenge operations from one protected surface."
          visual={
            <PageArtwork
              variant="admin"
              alt=""
              className="hidden h-28 w-48 shrink-0 lg:block"
              sizes="192px"
              priority
            />
          }
          action={<Badge variant="secondary">Owner access</Badge>}
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetric
            icon={UserRound}
            label="Users"
            value={data.metrics.users}
            detail={`${data.metrics.activeSubscriptions} active paid rows`}
          />
          <AdminMetric
            icon={Database}
            label="Golf data"
            value={data.metrics.shots}
            detail={`${data.metrics.sessions} sessions`}
          />
          <AdminMetric
            icon={Radio}
            label="Feed cards"
            value={data.metrics.feedItems}
            detail={`${operations.comments} comments`}
          />
          <AdminMetric
            icon={ShieldCheck}
            label="Open reports"
            value={data.metrics.openReports}
            detail={`${data.metrics.lifetimeGrants} lifetime grants`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <AdminSection
            title="Operating pages"
            description="Daily admin workflows for running the site."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminLink
                href="/admin/users"
                title="Users"
                description="Find accounts, check plans, grant lifetime access and manage admin operators."
              />
              <AdminLink
                href="/admin/billing"
                title="Billing"
                description="Inspect subscriptions, entitlements and plan limits."
              />
              <AdminLink
                href="/admin/moderation"
                title="Moderation"
                description="Resolve reports and moderation events before the feed grows."
              />
              <AdminLink
                href="/admin/challenges"
                title="Challenges"
                description="Track templates, open challenges, entries, attempts and results."
              />
            </div>
          </AdminSection>

          <AdminSection title="Network snapshot">
            <div className="grid gap-2 text-sm">
              <SnapshotRow label="New users" value={data.metrics.users} />
              <SnapshotRow label="Feed reports" value={data.metrics.openReports} />
              <SnapshotRow label="Challenge attempts flagged" value={0} />
              <SnapshotRow label="Billing failures" value={operations.billingFailures} />
              <SnapshotRow
                label="Provider import failures"
                value={operations.providerImportFailures}
              />
              <SnapshotRow label="RLS/test status" value="Runbook ready" />
              <SnapshotRow label="Groups" value={operations.groups} />
              <SnapshotRow label="Friendships" value={operations.friendships} />
              <SnapshotRow label="Friend requests" value={operations.friendRequests} />
              <SnapshotRow label="Provider accounts" value={operations.providerAccounts} />
              <SnapshotRow label="Import jobs" value={operations.importJobs} />
              <SnapshotRow label="Sponsors" value={operations.sponsors} />
              <SnapshotRow label="Partner offers" value={operations.partnerOffers} />
              <SnapshotRow label="AI summaries" value={operations.aiSummaries} />
            </div>
          </AdminSection>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AdminRecentUsersTable users={data.recentUsers} />

          <AdminSection title="Audit log" description="Recent owner/operator changes.">
            <div className="grid gap-2">
              {data.recentAuditRows.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No admin changes have been recorded yet.
                </p>
              ) : (
                data.recentAuditRows.map((row) => (
                  <div key={row.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium">{label(row.action)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.actorEmail ?? "System"} · {row.targetType ?? "target"} ·{" "}
                      {row.targetId ?? "none"} · {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </AdminSection>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function AdminRecentUsersTable({ users }: { users: AdminOverviewUser[] }) {
  return (
    <AdminSection
      title="Recent users"
      description="Desktop user lookup preview with plan, role and activity evidence."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/users">Open users</Link>
        </Button>
      }
    >
      <section data-workbench-scope="admin-overview-users" className="grid gap-3">
        <DesktopTableWorkbenchControls
          viewKey="admin-overview-users"
          scope="admin-overview-users"
          currentViewLabel="Recent admin users"
          resultLabel={`${users.length} users`}
          columns={adminOverviewUserColumns}
          suggestedViews={adminOverviewUserSuggestedViews}
          exportTableId="admin-overview-users"
          exportFileName="forekinghell-admin-overview-users.csv"
        />
        <DataTableFrame mainTable mainTableLabel="Admin recent users table">
          <Table
            data-workbench-export-table="admin-overview-users"
            aria-describedby="admin-overview-users-summary"
          >
            <TableCaption id="admin-overview-users-summary" className="sr-only">
              Recent admin users table showing user, plan, admin role, session count, feed card
              count, account creation date and action.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead
                  data-column="user"
                  className="sticky left-0 z-20 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                >
                  User
                </TableHead>
                <TableHead data-column="plan">Plan</TableHead>
                <TableHead data-column="role">Admin role</TableHead>
                <TableHead data-column="sessions">Sessions</TableHead>
                <TableHead data-column="feed">Feed cards</TableHead>
                <TableHead data-column="created">Created</TableHead>
                <TableHead data-column="action" className="text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="user"
                      className="sticky left-0 z-10 min-w-64 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    >
                      <span className="block max-w-72 truncate">{user.displayName}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {user.email ?? "No email"}
                      </span>
                    </TableCell>
                    <TableCell data-column="plan">
                      <PlanBadge plan={user.activePlan} />
                    </TableCell>
                    <TableCell data-column="role">
                      {user.adminRole ? (
                        <Badge variant="outline">{label(user.adminRole)}</Badge>
                      ) : (
                        "--"
                      )}
                    </TableCell>
                    <TableCell data-column="sessions">{user.sessionCount}</TableCell>
                    <TableCell data-column="feed">{user.feedCount}</TableCell>
                    <TableCell data-column="created">{formatDateTime(user.createdAt)}</TableCell>
                    <TableCell data-column="action" className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/admin/users?q=${encodeURIComponent(user.email ?? user.displayName)}`}
                        >
                          Open
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No recent users are available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </section>
    </AdminSection>
  );
}

function AdminLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="rounded-xl border bg-slate-50 p-4 text-sm hover:bg-slate-100">
      <div className="flex items-center gap-2 font-semibold">
        {title === "Challenges" ? (
          <Flag className="size-4 text-amber-600" />
        ) : title === "Billing" ? (
          <Zap className="size-4 text-emerald-600" />
        ) : (
          <Activity className="size-4 text-sky-600" />
        )}
        {title}
      </div>
      <p className="mt-2 leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function SnapshotRow({ label: rowLabel, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-muted-foreground">{rowLabel}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
