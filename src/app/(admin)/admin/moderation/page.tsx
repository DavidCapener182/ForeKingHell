import { AdminNav, formatDateTime, label } from "@/app/admin/admin-components";
import { ModerationQueue, type ModerationRecord } from "@/app/admin/moderation-queue";
import { PageHeader, PageShell } from "@/components/premium";
import { getAdminModerationData } from "@/lib/admin";
export const dynamic = "force-dynamic";
export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams?: Promise<{
    reportQ?: string;
    reportStatus?: string;
    eventQ?: string;
    eventStatus?: string;
    reportSort?: string;
    reportDir?: string;
    eventSort?: string;
    eventDir?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getAdminModerationData();
  const reports: ModerationRecord[] = data.reports.map((row) => ({
    id: row.id,
    kind: "report",
    label: label(row.reason),
    status: row.status,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    details: row.details ?? "No additional details",
    actor: row.reporterUserId,
    reportedUser: row.reportedUserId ?? "Not recorded",
    severity: "Not assigned to user reports",
    created: row.createdAt.toISOString(),
    resolved: row.resolvedAt?.toISOString() ?? null,
    metadata: "Not recorded",
  }));
  const events: ModerationRecord[] = data.events.map((row) => ({
    id: row.id,
    kind: "event",
    label: label(row.eventType),
    status: row.status,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason ?? "Not recorded",
    details: row.reason ?? "No additional evidence",
    actor: row.actorUserId ?? "Not recorded",
    reportedUser: "Not recorded",
    severity: row.severity,
    created: row.createdAt.toISOString(),
    resolved: row.resolvedAt?.toISOString() ?? null,
    metadata: JSON.stringify(row.metadataJson, null, 2),
  }));
  const all = [...reports, ...events];
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <AdminNav active="/admin/moderation" />
        <PageHeader
          title="Moderation queue"
          description="Review user reports and detected events separately. Resolution closes a record; it does not delete the underlying content."
        />
        <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
          {[
            ["Loaded reports", reports.length],
            ["Loaded events", events.length],
            ["Open loaded records", all.filter((row) => row.status === "open").length],
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm text-muted-foreground">{key}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ModerationQueue
          kind="report"
          rows={reports}
          initialQuery={params?.reportQ}
          initialStatus={params?.reportStatus}
          initialSort={params?.reportSort}
          initialDir={params?.reportDir}
        />
        <ModerationQueue
          kind="event"
          rows={events}
          initialQuery={params?.eventQ}
          initialStatus={params?.eventStatus}
          initialSort={params?.eventSort}
          initialDir={params?.eventDir}
        />
        <section className="grid gap-3" aria-labelledby="moderation-audit">
          <h2 id="moderation-audit" className="text-xl font-semibold">
            Moderation audit history
          </h2>
          <p className="text-sm text-muted-foreground">
            Latest {data.auditRows.length} recorded decisions, up to 80, newest first. A decision
            closes the record and does not establish whether the original allegation was true.
          </p>
          <ol className="grid gap-3">
            {data.auditRows.map((row) => (
              <li key={row.id}>
                <details className="rounded-xl border p-4">
                  <summary className="min-h-11 cursor-pointer">
                    <span className="font-medium">{label(row.action)}</span>
                    <span className="mt-1 block text-xs">
                      {formatDateTime(row.createdAt)} ·{" "}
                      {row.actorEmail ?? row.actorUserId ?? "Unknown actor"}
                    </span>
                  </summary>
                  <dl className="mt-3 grid gap-3 text-sm">
                    {Object.entries({
                      Actor: row.actorEmail ?? row.actorUserId ?? "Not recorded",
                      Decision: label(row.action),
                      "Target type": row.targetType ?? "Not recorded",
                      Target: row.targetId ?? "Not recorded",
                      Outcome:
                        typeof row.metadataJson.outcome === "string"
                          ? row.metadataJson.outcome
                          : "Not recorded separately",
                      Source: "Administrator audit log",
                      Metadata: JSON.stringify(row.metadataJson, null, 2),
                    }).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="whitespace-pre-wrap break-all">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </li>
            ))}
          </ol>
          {!data.auditRows.length ? (
            <p className="rounded-xl border p-4">
              No moderation decisions in the recorded audit history.
            </p>
          ) : null}
        </section>
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Record status history</h2>
          <p className="text-sm text-muted-foreground">
            Current states from both loaded queues; created and resolved times remain available in
            each record’s detail panel.
          </p>
          <ol className="grid gap-2">
            {all
              .sort((a, b) => (b.resolved ?? b.created).localeCompare(a.resolved ?? a.created))
              .slice(0, 8)
              .map((row) => (
                <li key={`${row.kind}-${row.id}`} className="rounded-lg border p-3">
                  <p>
                    {row.kind}: {row.label} · {row.status}
                  </p>
                  <p className="text-xs">{formatDateTime(new Date(row.resolved ?? row.created))}</p>
                  <p className="break-all text-sm">
                    {row.targetType} · {row.targetId}
                  </p>
                </li>
              ))}
          </ol>
        </section>
      </div>
    </PageShell>
  );
}
