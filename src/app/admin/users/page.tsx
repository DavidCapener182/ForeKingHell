import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, ShieldCheck, UserPlus, Zap } from "lucide-react";

import {
  deactivateAdminAccessAction,
  grantAdminAccessAction,
  grantLifetimeFullAction,
} from "@/app/admin/actions";
import { AdminConfirmSubmitButton } from "@/app/admin/admin-confirm-submit-button";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
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
} from "@/app/admin/admin-components";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { DataTableFrame, PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminUsers } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    adminStatus?: string;
    adminError?: string;
    sort?: string;
    dir?: string;
  }>;
};

type AdminUserListItem = Awaited<ReturnType<typeof getAdminUsers>>[number];
type AdminUserSortMetric = "user" | "plan" | "activity" | "admin" | "created";
type AdminUserSortDirection = "asc" | "desc";
type AdminUserSortState = {
  metric: AdminUserSortMetric;
  dir: AdminUserSortDirection;
};

const adminUserColumns: DesktopWorkbenchColumn[] = [
  { id: "user", label: "User", locked: true },
  { id: "plan", label: "Plan" },
  { id: "activity", label: "Activity" },
  { id: "admin", label: "Admin" },
  { id: "created", label: "Created" },
  { id: "action", label: "Action", locked: true },
];

const adminUserSortLabels: Record<AdminUserSortMetric, string> = {
  user: "User",
  plan: "Plan",
  activity: "Activity",
  admin: "Admin",
  created: "Created",
};

const adminUserSortDefaultDirections: Record<AdminUserSortMetric, AdminUserSortDirection> = {
  user: "asc",
  plan: "desc",
  activity: "desc",
  admin: "desc",
  created: "desc",
};

const adminUserSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Owner/operator review",
    href: "/admin/users",
    detail: "Check current admin roles before changing access.",
  },
  {
    title: "Lifetime entitlement audit",
    href: "/admin/billing",
    detail: "Review permanent full-plan grants and subscription state.",
  },
  {
    title: "Moderation follow-up",
    href: "/admin/moderation",
    detail: "Move from user lookup to reports and safety decisions.",
  },
];

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const sortState = parseAdminUserSort(params?.sort, params?.dir);
  const users = await getAdminUsers({ q: params?.q });
  const sortedUsers = sortAdminUsers(users, sortState);
  const adminCount = users.filter((user) => user.adminRole).length;
  const lifetimeCount = users.filter((user) => user.activePlan === "full").length;

  return (
    <PageShell>
      <MobileRouteHeader title="Platform" group="platform" activeKey="admin" />
      <AdminNav active="/admin/users" />
      <AdminNotice status={params?.adminStatus} error={params?.adminError} />

      <DesktopWorkbenchLayout scope="admin-users">
        <AdminPageHeader
          eyebrow="Admin users"
          title="Users and access"
          description="Search accounts, grant lifetime full access and add owner/operator access for people running the site."
        />

        <section className="grid gap-3 md:grid-cols-3">
          <AdminMetric
            icon={Search}
            label="Listed users"
            value={users.length}
            detail={params?.q ? `Filtered by ${params.q}` : "Latest accounts"}
          />
          <AdminMetric
            icon={Zap}
            label="Lifetime full"
            value={lifetimeCount}
            detail="Permanent entitlement grants in this view"
          />
          <AdminMetric
            icon={ShieldCheck}
            label="Admin access"
            value={adminCount}
            detail="Active owner/operator rows in this view"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <section className="grid gap-4 lg:sticky lg:top-28">
            <AdminSection title="Find user" description="Search by email, profile name or handle.">
              <form action="/admin/users" className="grid gap-3">
                <input type="hidden" name="sort" value={sortState.metric} />
                <input type="hidden" name="dir" value={sortState.dir} />
                <Input
                  name="q"
                  defaultValue={params?.q ?? ""}
                  placeholder="Email, name or username"
                  className="h-10 rounded-xl bg-slate-50"
                />
                <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                  <Search className="size-4" />
                  Search
                </Button>
              </form>
            </AdminSection>

            <AdminSection
              title="Grant lifetime full"
              description="Creates a lifetime plan row and all full entitlements."
            >
              <form action={grantLifetimeFullAction} className="grid gap-3">
                <input type="hidden" name="returnTo" value="/admin/users" />
                <Input
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  className="h-10 rounded-xl bg-slate-50"
                  required
                />
                <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                  <Zap className="size-4" />
                  Grant full
                </Button>
              </form>
            </AdminSection>

            <AdminSection
              title="Add admin operator"
              description="Owner has all operations; operator is for routine site work."
            >
              <form action={grantAdminAccessAction} className="grid gap-3">
                <input type="hidden" name="returnTo" value="/admin/users" />
                <Input
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  className="h-10 rounded-xl bg-slate-50"
                  required
                />
                <select
                  name="role"
                  aria-label="Admin role"
                  defaultValue="operator"
                  className="h-10 rounded-xl border bg-slate-50 px-3 text-sm"
                >
                  <option value="operator">Operator</option>
                  <option value="owner">Owner</option>
                </select>
                <Button type="submit" variant="outline">
                  <UserPlus className="size-4" />
                  Grant admin
                </Button>
              </form>
            </AdminSection>
          </section>

          <AdminSection
            title="Accounts"
            description="Names are cleaned before display so shared database artifacts are not exposed."
          >
            <DesktopTableWorkbenchControls
              viewKey="admin-users"
              scope="admin-users"
              currentViewLabel={params?.q ? `User search: ${params.q}` : "Admin user accounts"}
              resultLabel={`${users.length.toLocaleString("en-GB")} users`}
              columns={adminUserColumns}
              suggestedViews={adminUserSuggestedViews}
              exportTableId="admin-users"
              exportFileName="forekinghell-admin-users-view.csv"
              className="mb-3"
            />
            <DataTableFrame
              mainTable
              mainTableLabel="Admin user accounts table"
              stickyFirstColumn
              className="overflow-x-auto"
            >
              <table
                className="w-full min-w-[900px] text-left text-sm"
                data-workbench-export-table="admin-users"
                aria-describedby="admin-users-table-summary"
              >
                <caption id="admin-users-table-summary" className="sr-only">
                  Admin user accounts with plan, activity, admin role, creation date and actions.
                </caption>
                <thead className="border-b text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                  <tr>
                    <SortableAdminUserHead
                      columnId="user"
                      metric="user"
                      query={params?.q ?? ""}
                      sortState={sortState}
                      className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                    />
                    <SortableAdminUserHead
                      columnId="plan"
                      metric="plan"
                      query={params?.q ?? ""}
                      sortState={sortState}
                    />
                    <SortableAdminUserHead
                      columnId="activity"
                      metric="activity"
                      query={params?.q ?? ""}
                      sortState={sortState}
                    />
                    <SortableAdminUserHead
                      columnId="admin"
                      metric="admin"
                      query={params?.q ?? ""}
                      sortState={sortState}
                    />
                    <SortableAdminUserHead
                      columnId="created"
                      metric="created"
                      query={params?.q ?? ""}
                      sortState={sortState}
                    />
                    <th data-column="action" className="px-3 py-2 font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user) => (
                    <tr
                      key={user.id}
                      tabIndex={0}
                      className="focus-aaa border-b outline-none last:border-b-0"
                    >
                      <td
                        data-column="user"
                        className="sticky left-0 z-10 bg-white px-3 py-3 shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        <p className="font-medium">{user.displayName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {user.email ?? "No email"}
                        </p>
                        {user.username ? (
                          <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
                        ) : null}
                      </td>
                      <td data-column="plan" className="px-3 py-3">
                        <PlanBadge plan={user.activePlan} />
                      </td>
                      <td data-column="activity" className="px-3 py-3 text-muted-foreground">
                        {user.sessionCount} sessions · {user.feedCount} cards
                      </td>
                      <td data-column="admin" className="px-3 py-3">
                        {user.adminRole ? (
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{label(user.adminRole)}</Badge>
                            <Badge variant="outline">{label(user.adminStatus ?? "active")}</Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No admin access</span>
                        )}
                      </td>
                      <td data-column="created" className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td data-column="action" className="px-3 py-3">
                        {user.adminRole ? (
                          <form action={deactivateAdminAccessAction}>
                            <input type="hidden" name="userId" value={user.id} />
                            <AdminConfirmSubmitButton
                              confirmMessage={`Deactivate admin access for ${user.displayName}? This removes their active admin role and writes an audit entry.`}
                              variant="outline"
                              size="sm"
                            >
                              Deactivate
                            </AdminConfirmSubmitButton>
                          </form>
                        ) : (
                          <span className="text-xs text-muted-foreground">Use form</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableFrame>
          </AdminSection>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SortableAdminUserHead({
  className,
  columnId,
  metric,
  query,
  sortState,
}: {
  className?: string;
  columnId: string;
  metric: AdminUserSortMetric;
  query: string;
  sortState: AdminUserSortState;
}) {
  const active = sortState.metric === metric;

  return (
    <th
      data-column={columnId}
      className={["px-3 py-2 font-medium", className].filter(Boolean).join(" ")}
      aria-sort={active ? adminUserSortAriaValue(sortState.dir) : "none"}
    >
      <SortableAdminUserHeadLink metric={metric} query={query} sortState={sortState} />
    </th>
  );
}

function SortableAdminUserHeadLink({
  metric,
  query,
  sortState,
}: {
  metric: AdminUserSortMetric;
  query: string;
  sortState: AdminUserSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: AdminUserSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : adminUserSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = adminUserSortLabels[metric];

  return (
    <Link
      href={adminUserSortHref({ dir: nextDir, metric, query })}
      prefetch={false}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin users by ${label}, ${adminUserSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
    </Link>
  );
}

function adminUserSortHref({
  dir,
  metric,
  query,
}: {
  dir: AdminUserSortDirection;
  metric: AdminUserSortMetric;
  query: string;
}) {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  params.set("sort", metric);
  params.set("dir", dir);

  return `/admin/users?${params.toString()}`;
}

function sortAdminUsers(users: AdminUserListItem[], sortState: AdminUserSortState) {
  return [...users].sort((left, right) => {
    const result = compareAdminUserValues(left, right, sortState);

    if (result !== 0) {
      return result;
    }

    return compareAdminUserDates(left.createdAt, right.createdAt, "desc");
  });
}

function compareAdminUserValues(
  left: AdminUserListItem,
  right: AdminUserListItem,
  sortState: AdminUserSortState,
) {
  switch (sortState.metric) {
    case "user":
      return compareAdminUserStrings(left.displayName, right.displayName, sortState.dir);
    case "plan":
      return compareAdminUserNumbers(
        planSortWeight(left.activePlan),
        planSortWeight(right.activePlan),
        sortState.dir,
      );
    case "activity":
      return compareAdminUserNumbers(
        left.sessionCount + left.feedCount,
        right.sessionCount + right.feedCount,
        sortState.dir,
      );
    case "admin":
      return compareAdminUserNumbers(
        adminRoleSortWeight(left),
        adminRoleSortWeight(right),
        sortState.dir,
      );
    case "created":
      return compareAdminUserDates(left.createdAt, right.createdAt, sortState.dir);
  }
}

function planSortWeight(plan: string) {
  if (plan === "full") return 3;
  if (plan === "pro") return 2;
  if (plan === "plus") return 1;
  return 0;
}

function adminRoleSortWeight(user: AdminUserListItem) {
  if (user.adminRole === "owner") return 3;
  if (user.adminRole === "operator") return 2;
  if (user.adminStatus) return 1;
  return 0;
}

function compareAdminUserNumbers(left: number, right: number, dir: AdminUserSortDirection) {
  return dir === "asc" ? left - right : right - left;
}

function compareAdminUserDates(left: Date, right: Date, dir: AdminUserSortDirection) {
  return compareAdminUserNumbers(left.getTime(), right.getTime(), dir);
}

function compareAdminUserStrings(
  left: string | null,
  right: string | null,
  dir: AdminUserSortDirection,
) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const result = left.localeCompare(right);
  return dir === "asc" ? result : -result;
}

function parseAdminUserSort(
  metricValue: string | undefined,
  dirValue: string | undefined,
): AdminUserSortState {
  const metric = parseAdminUserSortMetric(metricValue);

  return {
    metric,
    dir: parseAdminUserSortDirection(dirValue, adminUserSortDefaultDirections[metric]),
  };
}

function parseAdminUserSortMetric(value: string | undefined): AdminUserSortMetric {
  if (
    value === "user" ||
    value === "plan" ||
    value === "activity" ||
    value === "admin" ||
    value === "created"
  ) {
    return value;
  }

  return "created";
}

function parseAdminUserSortDirection(
  value: string | undefined,
  fallback: AdminUserSortDirection,
): AdminUserSortDirection {
  return value === "asc" || value === "desc" ? value : fallback;
}

function adminUserSortAriaValue(dir: AdminUserSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
}

function adminUserSortDirectionCopy(metric: AdminUserSortMetric, dir: AdminUserSortDirection) {
  if (metric === "user") {
    return dir === "asc" ? "A to Z" : "Z to A";
  }

  if (metric === "created") {
    return dir === "desc" ? "newest first" : "oldest first";
  }

  return dir === "desc" ? "high to low" : "low to high";
}
