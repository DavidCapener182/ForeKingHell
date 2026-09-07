import { AdminCheckHistoryPages } from "@/app/admin/admin-check-history-pages";
import { AdminNav, formatDateTime } from "@/app/admin/admin-components";
import { AdminRetryButton } from "@/app/admin/admin-retry-button";
import { AdminSystemRegister } from "@/app/admin/admin-system-register";
import {
  buildHealthRows,
  buildSystemCheckRows,
  type SystemCheckTableRow,
} from "@/app/admin/admin-system-data";
import { PageHeader, PageShell } from "@/components/premium";
import { getAdminOperationsSnapshot } from "@/lib/admin";
import { getAdminSystemCheckHistory, getLatestAdminSystemChecks } from "@/lib/admin-system-checks";
export const dynamic = "force-dynamic";
export default async function AdminSystemChecksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedPage = Array.isArray(query.checkPage) ? query.checkPage[0] : query.checkPage;
  const [operations, history, latest] = await Promise.all([
    getAdminOperationsSnapshot(),
    getAdminSystemCheckHistory(requestedPage),
    getLatestAdminSystemChecks(),
  ]);
  const savedChecks = latest?.metadataJson?.liveChecks;
  const liveChecks = Array.isArray(savedChecks)
    ? savedChecks.filter(
        (check) =>
          check &&
          typeof check === "object" &&
          "id" in check &&
          "state" in check &&
          "detail" in check,
      )
    : [];
  const rows: SystemCheckTableRow[] = buildSystemCheckRows(operations);
  for (const check of liveChecks)
    rows.push({
      id: `live-${String(check.id)}`,
      label: String(check.label ?? check.id),
      detail: String(check.detail),
      area: "Read-only probes",
      status:
        check.state === "passed"
          ? "Probe passed"
          : check.state === "failed"
            ? "Probe failed"
            : "Unavailable",
      state:
        check.state === "passed" ? "quiet" : check.state === "failed" ? "failure" : "unverified",
      lastCheck: String(check.checkedAt),
      evidence: `${String(check.durationMs)} ms · saved endpoint response`,
      impact: String(check.detail),
    });
  const health = buildHealthRows(operations);
  const failures = rows.filter((r) => r.state === "failure");
  const unknown = rows.filter((r) => r.state === "unverified");
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <AdminNav active="/admin/system-checks" />
        <PageHeader
          title="System health console"
          description="Review recorded operational evidence and see which services still need live verification."
        />
        <p className="text-sm text-muted-foreground">
          Snapshot loaded: {formatDateTime(new Date())}. This timestamp describes the database
          snapshot, not a live provider check.
        </p>
        <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
          <div>
            <dt>Checks with recorded failures</dt>
            <dd className="text-2xl font-semibold">{failures.length}</dd>
          </div>
          <div>
            <dt>Unverified checks</dt>
            <dd className="text-2xl font-semibold">{unknown.length}</dd>
          </div>
          <div>
            <dt>Overall evidence</dt>
            <dd className="font-semibold">
              {failures.length ? "Recorded failures need review" : "Live health remains unverified"}
            </dd>
          </div>
        </dl>
        <AdminRetryButton />
        <section className="grid gap-3 rounded-xl border p-4" aria-label="Read-only live probes">
          <h2 className="text-xl font-semibold">Read-only live probes</h2>
          <p className="text-sm">
            Latest saved probe run
            {latest ? `: ${formatDateTime(latest.createdAt)}` : " unavailable"}. Results describe
            that moment and the exact endpoint checked; they are not continuous monitoring or full
            service health.
          </p>
          {!liveChecks.length ? (
            <p>No read-only probe results yet. Refresh recorded checks to run configured probes.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {liveChecks.map((check, index) => (
                <li key={index} className="rounded-lg border p-3">
                  <h3 className="font-semibold">{String(check.label ?? check.id)}</h3>
                  <p className="font-medium">
                    {check.state === "passed"
                      ? "Probe passed"
                      : check.state === "failed"
                        ? "Probe failed"
                        : "Unavailable"}
                  </p>
                  <p className="mt-2 text-sm">{String(check.detail)}</p>
                  <p className="mt-2 text-xs">
                    Checked: {String(check.checkedAt)} ·{" "}
                    <span data-probe-latency className="whitespace-nowrap">
                      {String(check.durationMs)} ms
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="grid gap-3" aria-label="Service summary">
          <h2 className="text-xl font-semibold">Service summary</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {health.map((r) => (
              <article key={r.id} className="rounded-xl border p-4">
                <h3 className="font-semibold">{r.label}</h3>
                <p className="mt-1 font-medium">{r.status}</p>
                <p className="mt-2 text-sm text-muted-foreground">{r.impact}</p>
                <p className="mt-2 text-xs">Evidence: {r.lastCheck}</p>
              </article>
            ))}
          </div>
        </section>
        <AdminSystemRegister rows={rows} />
        <section
          id="check-history"
          aria-label="Recorded check history"
          className="grid gap-3 rounded-xl border p-4"
        >
          <h2 className="text-xl font-semibold">Recorded check history</h2>
          <p className="text-sm">
            {history.total.toLocaleString("en-GB")} recorded-check snapshots, newest first. Each
            entry preserves its own counts; a later refresh does not erase an earlier failure. Live
            transactional provider checks are not performed. Read-only probe outcomes are retained
            with each new snapshot.
          </p>
          {!history.records.length ? (
            <p>
              No recorded-check snapshots yet. Refresh recorded checks to save the first dated
              result.
            </p>
          ) : (
            <ol className="grid gap-3">
              {history.records.map((record) => (
                <li key={record.id}>
                  <details className="rounded-lg border p-4">
                    <summary className="min-h-11 cursor-pointer break-words font-medium">
                      Stored-record check · {formatDateTime(record.createdAt)}
                      <span className="block text-sm font-normal">
                        {record.actorEmail ?? record.actorUserId}
                      </span>
                    </summary>
                    <dl className="mt-3 grid gap-3 text-sm">
                      <div>
                        <dt>Record ID</dt>
                        <dd className="break-all">{record.id}</dd>
                      </div>
                      <div>
                        <dt>Actor ID</dt>
                        <dd className="break-all">{record.actorUserId ?? "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Recorded timestamp</dt>
                        <dd>{record.createdAt.toISOString()}</dd>
                      </div>
                      <div>
                        <dt>Source and saved result</dt>
                        <dd className="whitespace-pre-wrap break-all">
                          {JSON.stringify(record.metadataJson, null, 2)}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </li>
              ))}
            </ol>
          )}
          <AdminCheckHistoryPages page={history.page} pages={history.pages} />
        </section>
      </div>
    </PageShell>
  );
}
