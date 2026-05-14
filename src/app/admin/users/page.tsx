import { Search, ShieldCheck, UserPlus, Zap } from "lucide-react";

import { deactivateAdminAccessAction, grantAdminAccessAction, grantLifetimeFullAction } from "@/app/admin/actions";
import { AdminMetric, AdminNav, AdminNotice, AdminSection, formatDateTime, label, PlanBadge } from "@/app/admin/admin-components";
import { PageShell, StatusPill } from "@/components/premium";
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
  }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const users = await getAdminUsers({ q: params?.q });
  const adminCount = users.filter((user) => user.adminRole).length;
  const lifetimeCount = users.filter((user) => user.activePlan === "full").length;

  return (
    <PageShell size="7xl">
      <AdminNav active="/admin/users" />
      <AdminNotice status={params?.adminStatus} error={params?.adminError} />

      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <StatusPill tone="sky">Admin users</StatusPill>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Users and access</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Search accounts, grant lifetime full access and add owner/operator access for people running the site.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <AdminMetric icon={Search} label="Listed users" value={users.length} detail={params?.q ? `Filtered by ${params.q}` : "Latest accounts"} />
        <AdminMetric icon={Zap} label="Lifetime full" value={lifetimeCount} detail="Permanent entitlement grants in this view" />
        <AdminMetric icon={ShieldCheck} label="Admin access" value={adminCount} detail="Active owner/operator rows in this view" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <aside className="grid gap-4 lg:sticky lg:top-28">
          <AdminSection title="Find user" description="Search by email, profile name or handle.">
            <form action="/admin/users" className="grid gap-3">
              <Input name="q" defaultValue={params?.q ?? ""} placeholder="Email, name or username" className="h-10 rounded-xl bg-slate-50" />
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Search className="size-4" />
                Search
              </Button>
            </form>
          </AdminSection>

          <AdminSection title="Grant lifetime full" description="Creates a lifetime plan row and all full entitlements.">
            <form action={grantLifetimeFullAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value="/admin/users" />
              <Input name="email" type="email" placeholder="user@example.com" className="h-10 rounded-xl bg-slate-50" required />
              <Button type="submit" className="rounded-xl bg-[#111827] text-white">
                <Zap className="size-4" />
                Grant full
              </Button>
            </form>
          </AdminSection>

          <AdminSection title="Add admin operator" description="Owner has all operations; operator is for routine site work.">
            <form action={grantAdminAccessAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value="/admin/users" />
              <Input name="email" type="email" placeholder="user@example.com" className="h-10 rounded-xl bg-slate-50" required />
              <select name="role" defaultValue="operator" className="h-10 rounded-xl border bg-slate-50 px-3 text-sm">
                <option value="operator">Operator</option>
                <option value="owner">Owner</option>
              </select>
              <Button type="submit" variant="outline">
                <UserPlus className="size-4" />
                Grant admin
              </Button>
            </form>
          </AdminSection>
        </aside>

        <AdminSection title="Accounts" description="Names are cleaned before display so shared database artifacts are not exposed.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Activity</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3">
                      <p className="font-medium">{user.displayName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{user.email ?? "No email"}</p>
                      {user.username ? <p className="mt-1 text-xs text-muted-foreground">@{user.username}</p> : null}
                    </td>
                    <td className="px-3 py-3">
                      <PlanBadge plan={user.activePlan} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {user.sessionCount} sessions · {user.feedCount} cards
                    </td>
                    <td className="px-3 py-3">
                      {user.adminRole ? (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{label(user.adminRole)}</Badge>
                          <Badge variant="outline">{label(user.adminStatus ?? "active")}</Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No admin access</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(user.createdAt)}</td>
                    <td className="px-3 py-3">
                      {user.adminRole ? (
                        <form action={deactivateAdminAccessAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Deactivate
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">Use form</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      </section>
    </PageShell>
  );
}
