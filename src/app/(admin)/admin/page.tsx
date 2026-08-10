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
  AdminMobileShell,
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
import { MobileStatusAction } from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
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
      <AdminMobileShell
        title="Operations"
        active="/admin"
        status={params?.adminStatus}
        error={params?.adminError}
      >
        <AdminMobileOverview data={data} operations={operations} />
      </AdminMobileShell>

      <div className="hidden gap-3 lg:grid">
        <AdminNav active="/admin" />
        <AdminNotice status={params?.adminStatus} error={params?.adminError} />
      </div>

      <DesktopWorkbenchLayout
        scope="admin"
        className="hidden lg:grid"
        railBreakpoint="wide"
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
              <SnapshotRow label="Billing failures" value={operations.billingFailures} />
              <SnapshotRow
                label="Provider import failures"
                value={operations.providerImportFailures}
              />
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

function AdminMobileOverview({
  data,
  operations,
}: {
  data: AdminOverviewData["data"];
  operations: AdminOverviewData["operations"];
}) {
  const urgentCount =
    data.metrics.openReports + operations.providerImportFailures + operations.billingFailures;
  const primaryHref = data.metrics.openReports
    ? "/admin/moderation"
    : operations.providerImportFailures
      ? "/providers#provider-jobs"
      : operations.billingFailures
        ? "/admin/billing"
        : "/admin/system-checks";
  const olderUsers = data.recentUsers.slice(5);

  return (
    <>
      <MobileStatusAction
        label="Needs attention"
        value={urgentCount}
        detail={
          urgentCount > 0
            ? `${data.metrics.openReports} reports · ${operations.providerImportFailures} provider failures · ${operations.billingFailures} billing failures`
            : "No report, provider-import or billing failures are flagged"
        }
        action={
          <Button asChild className="min-h-11">
            <Link href={primaryHref}>{urgentCount > 0 ? "Review" : "Checks"}</Link>
          </Button>
        }
      />

      <section className="grid gap-2" aria-label="Admin operations queue">
        <IOSSectionHeader
          title="Operations queue"
          description="Live rows that can require an owner or operator decision"
        />
        <AdminOperationsQueue data={data} operations={operations} />
      </section>

      <section className="grid gap-2" aria-label="Admin operating pages">
        <IOSSectionHeader title="Run the platform" />
        <IOSGroupedList label="Admin operating pages">
          <IOSListRow
            label="Users and access"
            value={data.metrics.users}
            detail={`${data.metrics.activeSubscriptions} active paid rows`}
            href="/admin/users"
            icon={UserRound}
          />
          <IOSListRow
            label="Challenges"
            value={data.metrics.challenges}
            detail="Boards, entries, attempts and results"
            href="/admin/challenges"
            icon={Flag}
          />
          <IOSListRow
            label="Partners"
            value={operations.partnerOffers}
            detail={`${operations.sponsors} sponsors`}
            href="/partners"
            icon={Zap}
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-label="Recent admin users">
        <IOSSectionHeader
          title="Recent users"
          description={`${data.recentUsers.length} latest accounts`}
        />
        <MobileAdminOverviewUsers users={data.recentUsers.slice(0, 5)} />
        {olderUsers.length > 0 ? (
          <IOSDisclosureGroup
            label="More recent admin users"
            items={[
              {
                value: "more-recent-users",
                title: "More recent users",
                summary: olderUsers.length,
                description: "Earlier accounts in this snapshot",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileAdminOverviewUsers users={olderUsers} />,
              },
            ]}
          />
        ) : null}
      </section>

      <IOSDisclosureGroup
        label="Admin supporting evidence"
        items={[
          {
            value: "network-snapshot",
            title: "Network snapshot",
            summary: operations.groups + operations.friendships,
            description: "Social, provider, partner and AI row counts",
            contentClassName: "px-0 pb-0 pt-0",
            content: (
              <IOSGroupedList label="Network snapshot rows" className="border-0">
                <IOSListRow label="Groups" value={operations.groups} />
                <IOSListRow label="Friendships" value={operations.friendships} />
                <IOSListRow label="Friend requests" value={operations.friendRequests} />
                <IOSListRow label="Provider accounts" value={operations.providerAccounts} />
                <IOSListRow label="Import jobs" value={operations.importJobs} />
                <IOSListRow label="Sponsors" value={operations.sponsors} />
                <IOSListRow label="Partner offers" value={operations.partnerOffers} />
                <IOSListRow label="AI summaries" value={operations.aiSummaries} />
              </IOSGroupedList>
            ),
          },
          {
            value: "recent-audit-log",
            title: "Recent audit log",
            summary: data.recentAuditRows.length,
            description: "Latest owner and operator changes",
            contentClassName: "px-0 pb-0 pt-0",
            content: (
              <IOSGroupedList label="Recent admin audit rows" className="border-0">
                {data.recentAuditRows.length > 0 ? (
                  data.recentAuditRows.map((row) => (
                    <IOSListRow
                      key={row.id}
                      label={label(row.action)}
                      detail={`${row.actorEmail ?? "System"} · ${formatDateTime(row.createdAt)}`}
                      value={row.targetType ? label(row.targetType) : undefined}
                    />
                  ))
                ) : (
                  <IOSListRow
                    label="No admin changes recorded"
                    detail="Audit activity will appear after an owner or operator change."
                  />
                )}
              </IOSGroupedList>
            ),
          },
        ]}
      />
    </>
  );
}

function AdminOperationsQueue({
  data,
  operations,
}: {
  data: AdminOverviewData["data"];
  operations: AdminOverviewData["operations"];
}) {
  return (
    <IOSGroupedList label="Live admin operations queue">
      <IOSListRow
        label="Open reports"
        value={data.metrics.openReports}
        detail="User reports awaiting moderation"
        href="/admin/moderation"
        status={
          <IOSInlineStatus
            label={data.metrics.openReports > 0 ? "Review required" : "None flagged"}
            tone={data.metrics.openReports > 0 ? "attention" : "positive"}
          />
        }
      />
      <IOSListRow
        label="Failed provider imports"
        value={operations.providerImportFailures}
        detail={`${operations.importJobs} import jobs tracked`}
        href="/providers#provider-jobs"
        status={
          <IOSInlineStatus
            label={operations.providerImportFailures > 0 ? "Review required" : "None flagged"}
            tone={operations.providerImportFailures > 0 ? "attention" : "positive"}
          />
        }
      />
      <IOSListRow
        label="Billing failures"
        value={operations.billingFailures}
        detail={`${data.metrics.activeSubscriptions} active paid rows`}
        href="/admin/billing"
        status={
          <IOSInlineStatus
            label={operations.billingFailures > 0 ? "Review required" : "None flagged"}
            tone={operations.billingFailures > 0 ? "attention" : "positive"}
          />
        }
      />
    </IOSGroupedList>
  );
}

function MobileAdminOverviewUsers({ users }: { users: AdminOverviewUser[] }) {
  return (
    <IOSGroupedList label="Admin recent user rows">
      {users.length > 0 ? (
        users.map((user) => (
          <IOSListRow
            key={user.id}
            label={user.displayName}
            value={label(user.activePlan)}
            detail={`${user.email ?? "No email"} · ${user.sessionCount} sessions · ${user.feedCount} cards`}
            href={`/admin/users?q=${encodeURIComponent(user.email ?? user.displayName)}`}
            status={
              user.adminRole ? (
                <IOSInlineStatus label={label(user.adminRole)} tone="info" />
              ) : undefined
            }
          />
        ))
      ) : (
        <IOSListRow
          label="No recent users"
          detail="New accounts will appear after they are created."
        />
      )}
    </IOSGroupedList>
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
        <DataTableFrame mainTable mainTableLabel="Admin recent users table" stickyFirstColumn>
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
