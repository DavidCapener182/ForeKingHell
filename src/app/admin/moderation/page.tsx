import { Flag, MessageSquareWarning, ShieldCheck } from "lucide-react";

import { resolveModerationEventAction, resolveSocialReportAction } from "@/app/admin/actions";
import {
  AdminMetric,
  AdminNav,
  AdminNotice,
  AdminSection,
  formatDateTime,
  label,
  StatusBadge,
} from "@/app/admin/admin-components";
import { PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getAdminModerationData } from "@/lib/admin";

export const dynamic = "force-dynamic";

type AdminModerationPageProps = {
  searchParams?: Promise<{
    adminStatus?: string;
    adminError?: string;
  }>;
};

export default async function AdminModerationPage({ searchParams }: AdminModerationPageProps) {
  const params = await searchParams;
  const data = await getAdminModerationData();
  const openReports = data.reports.filter((report) => report.status === "open");
  const openEvents = data.events.filter((event) => event.status === "open");

  return (
    <PageShell size="7xl">
      <AdminNav active="/admin/moderation" />
      <AdminNotice status={params?.adminStatus} error={params?.adminError} />

      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <StatusPill tone="amber">Safety</StatusPill>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Moderation queue</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Review user reports, suspicious social activity and automated moderation events.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <AdminMetric
          icon={MessageSquareWarning}
          label="Reports"
          value={data.reports.length}
          detail={`${openReports.length} open`}
        />
        <AdminMetric
          icon={Flag}
          label="Events"
          value={data.events.length}
          detail={`${openEvents.length} open`}
        />
        <AdminMetric
          icon={ShieldCheck}
          label="Resolved"
          value={data.reports.length + data.events.length - openReports.length - openEvents.length}
          detail="Closed safety records"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <AdminSection
          title="User reports"
          description="Reports created from the Recaps & Safety reporting flow."
        >
          <div className="grid gap-3">
            {data.reports.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No reports yet.
              </p>
            ) : (
              data.reports.map((report) => (
                <article key={report.id} className="rounded-xl border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={report.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(report.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-3 font-semibold">{label(report.reason)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.targetType} · {report.targetId}
                  </p>
                  {report.details ? (
                    <p className="mt-3 text-sm leading-6">{report.details}</p>
                  ) : null}
                  {report.status === "open" ? (
                    <form action={resolveSocialReportAction} className="mt-4">
                      <input type="hidden" name="reportId" value={report.id} />
                      <Button type="submit" size="sm">
                        Resolve
                      </Button>
                    </form>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </AdminSection>

        <AdminSection
          title="Moderation events"
          description="Automated or operator-created safety records."
        >
          <div className="grid gap-3">
            {data.events.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No moderation events yet.
              </p>
            ) : (
              data.events.map((event) => (
                <article key={event.id} className="rounded-xl border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={event.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-3 font-semibold">
                    {label(event.eventType)} · {label(event.severity)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.targetType} · {event.targetId}
                  </p>
                  {event.reason ? <p className="mt-3 text-sm leading-6">{event.reason}</p> : null}
                  {event.status === "open" ? (
                    <form action={resolveModerationEventAction} className="mt-4">
                      <input type="hidden" name="eventId" value={event.id} />
                      <Button type="submit" size="sm">
                        Resolve
                      </Button>
                    </form>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </AdminSection>
      </section>
    </PageShell>
  );
}
