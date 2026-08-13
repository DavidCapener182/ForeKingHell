import { ArrowDown, ArrowUp, ArrowUpDown, Search, ShieldCheck, UserPlus, Zap } from "lucide-react";

import {
  deactivateAdminAccessAction,
  grantAdminAccessAction,
  grantLifetimeFullAction,
} from "@/app/admin/actions";
import { AdminConfirmSubmitButton } from "@/app/admin/admin-confirm-submit-button";
import { AdminUserActions } from "@/app/admin/admin-user-actions";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
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
import { BottomSheet, MobileStatusAction, MobileTabBar } from "@/components/mobile-sports";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminUsers, requireAdminUser } from "@/lib/admin";

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
  const mobileView = parseAdminUserMobileView(params?.view);
  const mobileUsers = sortedUsers.filter((user) => {
    if (mobileView === "admins") return Boolean(user.adminRole);
    if (mobileView === "paid") return user.activePlan !== "free";
    return true;
  });

  return (
    <PageShell>
      <AdminMobileShell
        title="Users"
        active="/admin/users"
        status={params?.adminStatus}
        error={params?.adminError}
      >
        <AdminMobileUsers
          users={mobileUsers}
          allUsers={users}
          actorUserId={actor.userId}
          canManageOwners={canManageOwners}
          query={params?.q ?? ""}
          mobileView={mobileView}
          sortState={sortState}
        />
      </AdminMobileShell>

      <div className="hidden gap-3 lg:grid">
        <AdminNav active="/admin/users" />
        <AdminNotice status={params?.adminStatus} error={params?.adminError} />
      </div>

      <DesktopWorkbenchLayout scope="admin-users" className="hidden lg:grid">
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
                    className="h-10 rounded-xl bg-slate-50"
                    required
                  />
                  <AdminConfirmSubmitButton
                    type="submit"
                    className="rounded-xl bg-[#111827] text-white"
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
                  className="h-10 rounded-xl bg-slate-50"
                  required
                />
                <Select name="role" defaultValue="operator">
                  <SelectTrigger className="w-full bg-slate-50" aria-label="Admin role">
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
              <table
                className="w-full min-w-[900px] text-left text-sm"
                data-workbench-scope="admin-users"
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
                        {user.adminRole && canManageOwners && user.id !== actor.userId ? (
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

type AdminUserMobileView = "all" | "admins" | "paid";

function AdminMobileUsers({
  users,
  allUsers,
  actorUserId,
  canManageOwners,
  query,
  mobileView,
  sortState,
}: {
  users: AdminUserListItem[];
  allUsers: AdminUserListItem[];
  actorUserId: string;
  canManageOwners: boolean;
  query: string;
  mobileView: AdminUserMobileView;
  sortState: AdminUserSortState;
}) {
  const primaryUsers = users.slice(0, 12);
  const olderUsers = users.slice(12);
  const adminUsers = allUsers.filter((user) => user.adminRole && user.id !== actorUserId);
  const paidCount = allUsers.filter((user) => user.activePlan !== "free").length;

  return (
    <>
      <MobileStatusAction
        label={query ? "Search results" : "Accounts in view"}
        value={users.length}
        detail={`${adminUsers.length} manageable admins · ${paidCount} paid/full accounts`}
        action={
          <BottomSheet label="Search" title="Find user">
            <MobileAdminUserSearchForm query={query} sortState={sortState} />
          </BottomSheet>
        }
      />

      <MobileTabBar
        activeKey={mobileView}
        ariaLabel="Filter admin users"
        tabs={[
          { key: "all", label: "All", href: adminUserMobileHref("all", query) },
          { key: "admins", label: "Admins", href: adminUserMobileHref("admins", query) },
          { key: "paid", label: "Paid", href: adminUserMobileHref("paid", query) },
        ]}
      />

      <section className="grid gap-2" aria-label="Admin user directory">
        <IOSSectionHeader
          title="User directory"
          description={query ? `Filtered by “${query}”` : "Latest accounts first"}
          action={<MobileUserTools canManageOwners={canManageOwners} />}
        />
        <MobileAdminUserRows users={primaryUsers} />
        {olderUsers.length > 0 ? (
          <IOSDisclosureGroup
            label="More admin users"
            items={[
              {
                value: "more-admin-users",
                title: "More accounts",
                summary: olderUsers.length,
                description: "Additional users in this view",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileAdminUserRows users={olderUsers} />,
              },
            ]}
          />
        ) : null}
      </section>

      {adminUsers.length > 0 && canManageOwners ? (
        <IOSDisclosureGroup
          label="Admin access management"
          items={[
            {
              value: "admin-access-management",
              title: "Manage admin access",
              summary: adminUsers.length,
              description: "Deactivate an owner or operator role",
              contentClassName: "px-0 pb-0 pt-0",
              content: (
                <IOSGroupedList label="Manage admin access rows" className="border-0">
                  {adminUsers.map((user) => (
                    <IOSListRow
                      key={user.id}
                      label={user.displayName}
                      detail={`${user.email ?? "No email"} · ${label(user.adminRole ?? "admin")}`}
                      trailing={
                        <form action={deactivateAdminAccessAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <AdminConfirmSubmitButton
                            confirmMessage={`Deactivate admin access for ${user.displayName}? This removes their active admin role and writes an audit entry.`}
                            variant="outline"
                            className="min-h-11"
                          >
                            Deactivate
                          </AdminConfirmSubmitButton>
                        </form>
                      }
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
          ]}
        />
      ) : null}
    </>
  );
}

function MobileAdminUserRows({ users }: { users: AdminUserListItem[] }) {
  return (
    <IOSGroupedList label="Admin user account rows">
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
        <IOSListRow label="No accounts found" detail="Try a different search or account filter." />
      )}
    </IOSGroupedList>
  );
}

function MobileAdminUserSearchForm({
  query,
  sortState,
}: {
  query: string;
  sortState: AdminUserSortState;
}) {
  return (
    <form action="/admin/users" className="grid gap-3">
      <input type="hidden" name="sort" value={sortState.metric} />
      <input type="hidden" name="dir" value={sortState.dir} />
      <label className="grid gap-1 text-sm font-medium">
        Email, name or username
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search accounts"
          autoCapitalize="none"
          autoCorrect="off"
          className="h-11"
        />
      </label>
      <Button type="submit" className="min-h-11">
        <Search className="size-4" />
        Search
      </Button>
    </form>
  );
}

function MobileUserTools({ canManageOwners }: { canManageOwners: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canManageOwners ? (
        <BottomSheet label="Full" title="Grant lifetime full">
          <form action={grantLifetimeFullAction} className="grid gap-3">
            <input type="hidden" name="returnTo" value="/admin/users" />
            <label className="grid gap-1 text-sm font-medium">
              User email
              <Input name="email" type="email" className="h-11" required />
            </label>
            <AdminConfirmSubmitButton
              type="submit"
              className="min-h-11"
              confirmTitle="Grant lifetime full access"
              confirmMessage="Grant lifetime full access to this email? This creates a permanent full-plan entitlement and writes admin billing state."
              confirmActionLabel="Grant full access"
            >
              <Zap className="size-4" />
              Grant full access
            </AdminConfirmSubmitButton>
          </form>
        </BottomSheet>
      ) : null}
      <BottomSheet label="Admin" title="Grant admin access">
        <form action={grantAdminAccessAction} className="grid gap-3">
          <input type="hidden" name="returnTo" value="/admin/users" />
          <label className="grid gap-1 text-sm font-medium">
            User email
            <Input name="email" type="email" className="h-11" required />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Admin role
            <Select name="role" defaultValue="operator">
              <SelectTrigger className="min-h-11 w-full" aria-label="Admin role">
                <SelectValue placeholder="Choose admin role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operator">Operator</SelectItem>
                {canManageOwners ? <SelectItem value="owner">Owner</SelectItem> : null}
              </SelectContent>
            </Select>
          </label>
          <AdminConfirmSubmitButton
            type="submit"
            className="min-h-11"
            confirmTitle="Grant admin access"
            confirmMessage="Grant admin access to this email? Owner and operator roles can change platform operations."
            confirmActionLabel="Grant admin"
          >
            <UserPlus className="size-4" />
            Grant admin
          </AdminConfirmSubmitButton>
        </form>
      </BottomSheet>
    </div>
  );
}

function parseAdminUserMobileView(value: string | undefined): AdminUserMobileView {
  return value === "admins" || value === "paid" ? value : "all";
}

function adminUserMobileHref(view: AdminUserMobileView, query: string) {
  const params = new URLSearchParams();
  params.set("view", view);
  if (query.trim()) params.set("q", query.trim());
  return `/admin/users?${params.toString()}`;
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
    <a
      href={adminUserSortHref({ dir: nextDir, metric, query })}
      className="focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold outline-none transition-colors hover:text-foreground"
      aria-label={`Sort admin users by ${label}, ${adminUserSortDirectionCopy(metric, nextDir)}`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
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
