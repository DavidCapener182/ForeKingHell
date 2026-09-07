import { AdminAccessDialog, AdminUserDirectory } from "@/app/admin/admin-user-actions";
import { AdminNav } from "@/app/admin/admin-components";
import { AdminUserFilters } from "@/app/admin/admin-user-filters";
import { PageShell, PageHeader } from "@/components/premium";
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
type AdminUserPlanFilter = "all" | "free" | "plus" | "pro" | "coach" | "full";
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
      <div className="grid min-w-0 gap-5 pb-28">
        <AdminNav active="/admin/users" />
        <PageHeader
          title="Account management"
          description="Search accounts and review their saved access. Role changes follow your current administrator permissions; permanent access and owner changes require an owner."
          actions={<AdminAccessDialog canManageOwners={canManageOwners} />}
        />
        <AdminUserFilters
          q={params?.q ?? ""}
          {...filters}
          order={order}
          count={visibleUsers.length}
          loaded={users.length}
        />
        <AdminUserDirectory
          order={order}
          currentUserId={actor.userId}
          canManageOwners={canManageOwners}
          users={visibleUsers.map((user) => ({
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
          }))}
        />
      </div>
    </PageShell>
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
  if (plan === "full") return 5;
  if (plan === "coach") return 4;
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
  return value === "free" ||
    value === "plus" ||
    value === "pro" ||
    value === "coach" ||
    value === "full"
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
