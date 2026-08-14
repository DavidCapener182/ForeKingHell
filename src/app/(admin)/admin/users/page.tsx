import { ArrowDown, ArrowUp, ArrowUpDown, Search, ShieldCheck, UserPlus, Zap } from "lucide-react";

import { grantAdminAccessAction, grantLifetimeFullAction } from "@/app/admin/actions";
import { AdminConfirmSubmitButton } from "@/app/admin/admin-confirm-submit-button";
import { AdminUserActions } from "@/app/admin/admin-user-actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
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
} from "@/app/admin/admin-components";
import { DataTableFrame, PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminUsers, requireAdminUser } from "@/lib/admin";
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

type AdminUsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    adminStatus?: string;
    adminError?: string;
    sort?: string;
    dir?: string;
    view?: string;
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
  const [actor, users] = await Promise.all([requireAdminUser(), getAdminUsers({ q: params?.q })]);
  const canManageOwners = actor.role === "owner";
  const sortedUsers = sortAdminUsers(users, sortState);
  const adminCount = users.filter((user) => user.adminRole).length;
  const lifetimeCount = users.filter((user) => user.activePlan === "full").length;

  return (
    <PageShell>
      <div className="grid gap-3">
        <AdminNav active="/admin/users" />
        <AdminNotice status={params?.adminStatus} error={params?.adminError} />
      </div>

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
                  className="h-10 rounded-xl bg-background"
                />
                <Button type="submit" className="rounded-xl">
                  <Search className="size-4" />
                  Search
                </Button>
              </form>
            </AdminSection>

            {canManageOwners ? (
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
                    Grant full
                  </AdminConfirmSubmitButton>
                </form>
              </AdminSection>
            ) : null}

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
                  className="h-10 rounded-xl bg-background"
                  required
                />
                <Select name="role" defaultValue="operator">
                  <SelectTrigger className="w-full bg-background" aria-label="Admin role">
                    <SelectValue placeholder="Choose admin role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">Operator</SelectItem>
                    {canManageOwners ? <SelectItem value="owner">Owner</SelectItem> : null}
                  </SelectContent>
                </Select>
                <AdminConfirmSubmitButton
                  type="submit"
                  variant="outline"
                  confirmTitle="Grant admin access"
                  confirmMessage="Grant admin access to this email? Owner and operator roles can change platform operations."
                  confirmActionLabel="Grant admin"
                >
                  <UserPlus className="size-4" />
                  Grant admin
                </AdminConfirmSubmitButton>
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
              <Table
                className="w-full min-w-[900px] text-left text-sm"
                data-workbench-scope="admin-users"
                data-workbench-export-table="admin-users"
                aria-describedby="admin-users-table-summary"
              >
                <TableCaption id="admin-users-table-summary" className="sr-only">
                  Admin user accounts with plan, activity, admin role, creation date and actions.
                </TableCaption>
                <TableHeader className="border-b text-xs uppercase text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                  <TableRow>
                    <SortableAdminUserHead
                      columnId="user"
                      metric="user"
                      query={params?.q ?? ""}
                      sortState={sortState}
                      className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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
                    <TableHead data-column="action" className="px-3 py-2 font-medium">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.length > 0 ? (
                    sortedUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        tabIndex={0}
                        className="focus-aaa border-b outline-none last:border-b-0"
                      >
                        <TableCell
                          data-column="user"
                          className="sticky left-0 z-10 bg-card px-3 py-3 shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                        >
                          <p className="font-medium">{user.displayName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {user.email ?? "No email"}
                          </p>
                          {user.username ? (
                            <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p>
                          ) : null}
                        </TableCell>
                        <TableCell data-column="plan" className="px-3 py-3">
                          <PlanBadge plan={user.activePlan} />
                        </TableCell>
                        <TableCell
                          data-column="activity"
                          className="px-3 py-3 text-muted-foreground"
                        >
                          {user.sessionCount} sessions · {user.feedCount} cards
                        </TableCell>
                        <TableCell data-column="admin" className="px-3 py-3">
                          {user.adminRole && canManageOwners && user.id !== actor.userId ? (
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{label(user.adminRole)}</Badge>
                              <Badge variant="outline">{label(user.adminStatus ?? "active")}</Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No admin access</span>
                          )}
                        </TableCell>
                        <TableCell
                          data-column="created"
                          className="px-3 py-3 text-xs text-muted-foreground"
                        >
                          {formatDateTime(user.createdAt)}
                        </TableCell>
                        <TableCell data-column="action" className="px-3 py-3">
                          <AdminUserActions
                            user={{
                              id: user.id,
                              displayName: user.displayName,
                              email: user.email,
                              username: user.username,
                              activePlan: user.activePlan,
                              sessionCount: user.sessionCount,
                              feedCount: user.feedCount,
                              adminRole: user.adminRole,
                              adminStatus: user.adminStatus,
                              createdLabel: formatDateTime(user.createdAt),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="p-4">
                        <AppEmptyState
                          icon={<Search className="size-5" />}
                          title="No users match this view"
                          description="Clear the current search and filters to return to the full account directory."
                          primaryAction={
                            <Button asChild variant="outline" size="sm">
                              <a href="/admin/users">Clear filters</a>
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
    <TableHead
      data-column={columnId}
      className={["px-3 py-2 font-medium", className].filter(Boolean).join(" ")}
      aria-sort={active ? adminUserSortAriaValue(sortState.dir) : "none"}
    >
      <SortableAdminUserHeadLink metric={metric} query={query} sortState={sortState} />
    </TableHead>
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
    <a
      href={adminUserSortHref({ dir: nextDir, metric, query })}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin users by ${label}, ${adminUserSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-primary" : "opacity-45"}`} aria-hidden />
    </a>
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
