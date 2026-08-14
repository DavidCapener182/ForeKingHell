import { Search } from "lucide-react";

import { AdminAccessDialog, AdminUserActions } from "@/app/admin/admin-user-actions";
import { AdminNav, AdminNotice } from "@/app/admin/admin-components";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { DataTableFrame, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminUsers, requireAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    plan?: string;
    status?: string;
    order?: string;
    adminStatus?: string;
    adminError?: string;
  }>;
};

type AdminUserListItem = Awaited<ReturnType<typeof getAdminUsers>>[number];
type AdminUserRoleFilter = "all" | "owner" | "operator" | "none";
type AdminUserPlanFilter = "all" | "free" | "plus" | "pro" | "full";
type AdminUserStatusFilter = "all" | "active" | "inactive" | "standard";
type AdminUserSortOrder =
  | "created_desc"
  | "created_asc"
  | "user_asc"
  | "user_desc"
  | "activity_desc"
  | "activity_asc"
  | "plan_desc"
  | "plan_asc"
  | "admin_desc"
  | "admin_asc";

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const filters = {
    role: parseRoleFilter(params?.role),
    plan: parsePlanFilter(params?.plan),
    status: parseStatusFilter(params?.status),
  };
  const order = parseSortOrder(params?.order);
  const [actor, users] = await Promise.all([
    requireAdminUser(),
    getAdminUsers({ q: params?.q, limit: 100 }),
  ]);
  const canManageOwners = actor.role === "owner";
  const visibleUsers = sortAdminUsers(filterAdminUsers(users, filters), order);

  return (
    <PageShell>
      <div className="grid gap-3">
        <AdminNav active="/admin/users" />
        <AdminNotice status={params?.adminStatus} error={params?.adminError} />
      </div>

      <DesktopWorkbenchLayout scope="admin-users" className="gap-4">
        <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Admin users
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Account management
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Search accounts, inspect access, and make controlled plan or role changes.
            </p>
          </div>
          <AdminAccessDialog canManageOwners={canManageOwners} />
        </header>

        <form
          action="/admin/users"
          className="grid gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-xs md:grid-cols-2 xl:grid-cols-[minmax(260px,1.6fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_minmax(170px,0.8fr)_minmax(190px,0.9fr)_auto] xl:items-end"
          aria-label="Filter admin users"
        >
          <ToolbarField label="Search">
            <Input
              name="q"
              defaultValue={params?.q ?? ""}
              placeholder="Name, username, or email"
              className="h-9 bg-background"
            />
          </ToolbarField>

          <ToolbarField label="Role">
            <Select name="role" defaultValue={filters.role}>
              <SelectTrigger className="w-full bg-background" aria-label="Filter by admin role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="none">No admin role</SelectItem>
              </SelectContent>
            </Select>
          </ToolbarField>

          <ToolbarField label="Plan">
            <Select name="plan" defaultValue={filters.plan}>
              <SelectTrigger className="w-full bg-background" aria-label="Filter by plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="plus">Plus</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="full">Lifetime full</SelectItem>
              </SelectContent>
            </Select>
          </ToolbarField>

          <ToolbarField label="Status">
            <Select name="status" defaultValue={filters.status}>
              <SelectTrigger className="w-full bg-background" aria-label="Filter by admin status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Admin active</SelectItem>
                <SelectItem value="inactive">Admin inactive</SelectItem>
                <SelectItem value="standard">No admin record</SelectItem>
              </SelectContent>
            </Select>
          </ToolbarField>

          <ToolbarField label="Sort">
            <Select name="order" defaultValue={order}>
              <SelectTrigger className="w-full bg-background" aria-label="Sort users">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest first</SelectItem>
                <SelectItem value="created_asc">Oldest first</SelectItem>
                <SelectItem value="user_asc">User A–Z</SelectItem>
                <SelectItem value="user_desc">User Z–A</SelectItem>
                <SelectItem value="activity_desc">Most active</SelectItem>
                <SelectItem value="activity_asc">Least active</SelectItem>
                <SelectItem value="plan_desc">Plan high–low</SelectItem>
                <SelectItem value="plan_asc">Plan low–high</SelectItem>
                <SelectItem value="admin_desc">Admin role high–low</SelectItem>
                <SelectItem value="admin_asc">Admin role low–high</SelectItem>
              </SelectContent>
            </Select>
          </ToolbarField>

          <div className="flex items-center gap-2 xl:justify-end">
            <Button type="submit" size="sm">
              Apply
            </Button>
            <Button asChild type="button" variant="ghost" size="sm">
              <a href="/admin/users">Reset</a>
            </Button>
          </div>
        </form>

        <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">
              {visibleUsers.length.toLocaleString("en-GB")}
            </span>{" "}
            {visibleUsers.length === 1 ? "account" : "accounts"}
          </p>
          <p className="hidden sm:block">Select a user to inspect the full account record.</p>
        </div>

        <DataTableFrame
          mainTable
          mainTableLabel="Admin user accounts table"
          stickyFirstColumn
          className="w-full overflow-hidden rounded-xl"
        >
          <Table
            className="w-full min-w-[1180px] text-left text-sm"
            data-workbench-scope="admin-users"
            data-workbench-export-table="admin-users"
            aria-describedby="admin-users-table-summary"
          >
            <TableCaption id="admin-users-table-summary" className="sr-only">
              Admin user accounts with identity, email, plan, activity, admin role, creation date,
              and account actions.
            </TableCaption>
            <TableHeader className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
              <TableRow>
                <TableHead
                  data-column="user"
                  className="sticky left-0 z-20 min-w-[230px] bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                >
                  User
                </TableHead>
                <TableHead data-column="email" className="min-w-[250px]">
                  Email
                </TableHead>
                <TableHead data-column="plan" className="min-w-[120px]">
                  Plan
                </TableHead>
                <TableHead data-column="activity" className="min-w-[190px]">
                  Activity
                </TableHead>
                <TableHead data-column="admin" className="min-w-[180px]">
                  Admin role
                </TableHead>
                <TableHead data-column="created" className="min-w-[170px]">
                  Created
                </TableHead>
                <TableHead data-column="action" className="w-16 text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.length > 0 ? (
                visibleUsers.map((user) => (
                  <AdminUserActions
                    key={user.id}
                    canManageOwners={canManageOwners}
                    isCurrentUser={user.id === actor.userId}
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
                      createdLabel: formatAdminDateTime(user.createdAt),
                      auditEvents: user.recentAuditEvents.map((event) => ({
                        id: event.id,
                        actionLabel: formatAdminLabel(event.action),
                        createdLabel: formatAdminDateTime(event.createdAt),
                      })),
                    }}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="p-4">
                    <AppEmptyState
                      icon={<Search className="size-5" />}
                      title="No users match this view"
                      description="Clear the current filters to return to the full account directory."
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
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function ToolbarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function filterAdminUsers(
  users: AdminUserListItem[],
  filters: {
    role: AdminUserRoleFilter;
    plan: AdminUserPlanFilter;
    status: AdminUserStatusFilter;
  },
) {
  return users.filter((user) => {
    const roleMatches =
      filters.role === "all" ||
      (filters.role === "none" ? !user.adminRole : user.adminRole === filters.role);
    const planMatches = filters.plan === "all" || user.activePlan === filters.plan;
    const statusMatches =
      filters.status === "all" ||
      (filters.status === "standard" ? !user.adminStatus : user.adminStatus === filters.status);

    return roleMatches && planMatches && statusMatches;
  });
}

function sortAdminUsers(users: AdminUserListItem[], order: AdminUserSortOrder) {
  return [...users].sort((left, right) => {
    switch (order) {
      case "created_asc":
        return left.createdAt.getTime() - right.createdAt.getTime();
      case "created_desc":
        return right.createdAt.getTime() - left.createdAt.getTime();
      case "user_asc":
        return left.displayName.localeCompare(right.displayName);
      case "user_desc":
        return right.displayName.localeCompare(left.displayName);
      case "activity_asc":
        return activityTotal(left) - activityTotal(right);
      case "activity_desc":
        return activityTotal(right) - activityTotal(left);
      case "plan_asc":
        return planSortWeight(left.activePlan) - planSortWeight(right.activePlan);
      case "plan_desc":
        return planSortWeight(right.activePlan) - planSortWeight(left.activePlan);
      case "admin_asc":
        return adminSortWeight(left) - adminSortWeight(right);
      case "admin_desc":
        return adminSortWeight(right) - adminSortWeight(left);
    }
  });
}

function activityTotal(user: AdminUserListItem) {
  return user.sessionCount + user.feedCount;
}

function planSortWeight(plan: string) {
  if (plan === "full") return 4;
  if (plan === "pro") return 3;
  if (plan === "plus") return 2;
  if (plan === "free") return 1;
  return 0;
}

function adminSortWeight(user: AdminUserListItem) {
  if (user.adminRole === "owner") return 3;
  if (user.adminRole === "operator") return 2;
  if (user.adminStatus) return 1;
  return 0;
}

function parseRoleFilter(value: string | undefined): AdminUserRoleFilter {
  return value === "owner" || value === "operator" || value === "none" ? value : "all";
}

function parsePlanFilter(value: string | undefined): AdminUserPlanFilter {
  return value === "free" || value === "plus" || value === "pro" || value === "full"
    ? value
    : "all";
}

function parseStatusFilter(value: string | undefined): AdminUserStatusFilter {
  return value === "active" || value === "inactive" || value === "standard" ? value : "all";
}

function parseSortOrder(value: string | undefined): AdminUserSortOrder {
  if (
    value === "created_asc" ||
    value === "user_asc" ||
    value === "user_desc" ||
    value === "activity_desc" ||
    value === "activity_asc" ||
    value === "plan_desc" ||
    value === "plan_asc" ||
    value === "admin_desc" ||
    value === "admin_asc"
  ) {
    return value;
  }

  return "created_desc";
}

function formatAdminLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAdminDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
