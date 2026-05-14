import Link from "next/link";
import { Activity, Database, Flag, Radio, ShieldCheck, UserRound, Zap } from "lucide-react";

import { AdminMetric, AdminNav, AdminNotice, AdminSection, formatDateTime, label, PlanBadge } from "@/app/admin/admin-components";
import { PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminDashboardData, getAdminOperationsSnapshot } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{
    adminStatus?: string;
    adminError?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const [data, operations] = await Promise.all([getAdminDashboardData(), getAdminOperationsSnapshot()]);

  return (
    <PageShell size="7xl">
      <AdminNav active="/admin" />
      <AdminNotice status={params?.adminStatus} error={params?.adminError} />

      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusPill tone="sky">Admin operations</StatusPill>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Site control room</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Monitor growth, billing access, social safety and challenge operations from one protected surface.
            </p>
          </div>
          <Badge variant="secondary">Owner access</Badge>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetric icon={UserRound} label="Users" value={data.metrics.users} detail={`${data.metrics.activeSubscriptions} active paid rows`} />
        <AdminMetric icon={Database} label="Golf data" value={data.metrics.shots} detail={`${data.metrics.sessions} sessions`} />
        <AdminMetric icon={Radio} label="Feed cards" value={data.metrics.feedItems} detail={`${operations.comments} comments`} />
        <AdminMetric icon={ShieldCheck} label="Open reports" value={data.metrics.openReports} detail={`${data.metrics.lifetimeGrants} lifetime grants`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <AdminSection title="Operating pages" description="Daily admin workflows for running the site.">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminLink href="/admin/users" title="Users" description="Find accounts, check plans, grant lifetime access and manage admin operators." />
            <AdminLink href="/admin/billing" title="Billing" description="Inspect subscriptions, entitlements and plan limits." />
            <AdminLink href="/admin/moderation" title="Moderation" description="Resolve reports and moderation events before the feed grows." />
            <AdminLink href="/admin/challenges" title="Challenges" description="Track templates, open challenges, entries, attempts and results." />
          </div>
        </AdminSection>

        <AdminSection title="Network snapshot">
          <div className="grid gap-2 text-sm">
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
        <AdminSection title="Recent users" action={<Button asChild variant="outline"><Link href="/admin/users">Open users</Link></Button>}>
          <div className="grid gap-2">
            {data.recentUsers.map((user) => (
              <div key={user.id} className="grid gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email ?? "No email"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PlanBadge plan={user.activePlan} />
                  {user.adminRole ? <Badge variant="outline">{label(user.adminRole)}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection title="Audit log" description="Recent owner/operator changes.">
          <div className="grid gap-2">
            {data.recentAuditRows.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No admin changes have been recorded yet.</p>
            ) : (
              data.recentAuditRows.map((row) => (
                <div key={row.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium">{label(row.action)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.actorEmail ?? "System"} · {row.targetType ?? "target"} · {row.targetId ?? "none"} · {formatDateTime(row.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </AdminSection>
      </section>
    </PageShell>
  );
}

function AdminLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-slate-50 p-4 text-sm hover:bg-slate-100">
      <div className="flex items-center gap-2 font-semibold">
        {title === "Challenges" ? <Flag className="size-4 text-amber-600" /> : title === "Billing" ? <Zap className="size-4 text-emerald-600" /> : <Activity className="size-4 text-sky-600" />}
        {title}
      </div>
      <p className="mt-2 leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function SnapshotRow({ label: rowLabel, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-muted-foreground">{rowLabel}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
