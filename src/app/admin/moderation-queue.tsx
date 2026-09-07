"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { adminFormAction } from "@/app/admin/actions";
import { AdminOperationForm } from "@/app/admin/admin-operation-form";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
import layout from "@/app/course-records/course-record-board.module.css";
export type ModerationRecord = {
  id: string;
  kind: "report" | "event";
  label: string;
  status: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  actor: string;
  reportedUser: string;
  severity: string;
  created: string;
  resolved: string | null;
  metadata: string;
};
const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
export function ModerationQueue({
  kind,
  rows,
  initialSort = "created",
  initialDir = "desc",
  initialQuery = "",
  initialStatus = "all",
}: {
  kind: "report" | "event";
  rows: ModerationRecord[];
  initialSort?: string;
  initialDir?: string;
  initialQuery?: string;
  initialStatus?: string;
}) {
  const scope = kind === "report" ? "admin-moderation-reports" : "admin-moderation-events";
  const columns: { id: keyof ModerationRecord; label: string; locked?: boolean }[] = [
    { id: "label", label: "Record", locked: true },
    { id: "id", label: "Record ID" },
    { id: "status", label: "Status", locked: true },
    { id: "targetType", label: "Target type" },
    { id: "targetId", label: "Target ID" },
    { id: "reason", label: "Reason" },
    { id: "details", label: "Evidence" },
    { id: "actor", label: kind === "report" ? "Reporter ID" : "Actor ID" },
    { id: "reportedUser", label: "Reported user" },
    { id: "severity", label: "Severity" },
    { id: "created", label: "Created" },
    { id: "resolved", label: "Resolved" },
    { id: "metadata", label: "Metadata" },
  ];
  const display = (row: ModerationRecord, key: keyof ModerationRecord) =>
    key === "created"
      ? date(row.created)
      : key === "resolved"
        ? row.resolved
          ? date(row.resolved)
          : "Not resolved"
        : row[key];
  const ready = useClientReady();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState(initialSort);
  const [direction, setDirection] = useState(initialDir);
  const [filters, setFilters] = useState(false);
  const [draft, setDraft] = useState({ status, sort, direction });
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [review, setReview] = useState<ModerationRecord[] | null>(null);
  const [error, setError] = useState<string>();
  const [receipt, setReceipt] = useState<string>();
  const [pending, start] = useTransition();
  const lock = useRef(false);
  const detail = rows.find((row) => row.id === detailId) ?? null;
  const shown = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            (status === "all" || row.status === status) &&
            `${row.label} ${row.targetId} ${row.reason} ${row.details} ${row.actor}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          const value = (row: ModerationRecord) =>
            sort === "target"
              ? `${row.targetType} ${row.targetId}`
              : sort === "event"
                ? row.label
                : sort === "reason"
                  ? row.reason
                  : sort === "details"
                    ? row.details
                    : sort === "severity"
                      ? String(
                          ({ low: 1, medium: 2, high: 3, critical: 4 } as Record<string, number>)[
                            row.severity
                          ] ?? 0,
                        )
                      : sort === "status"
                        ? row.status
                        : row.created;
          return value(a).localeCompare(value(b)) * (direction === "asc" ? 1 : -1);
        }),
    [rows, status, query, sort, direction],
  );
  function persist(next: { query: string; status: string; sort: string; direction: string }) {
    const url = new URL(window.location.href);
    url.searchParams.set(`${kind}Q`, next.query);
    url.searchParams.set(`${kind}Status`, next.status);
    url.searchParams.set(`${kind}Sort`, next.sort);
    url.searchParams.set(`${kind}Dir`, next.direction);
    window.history.replaceState(null, "", url);
  }
  const chosen = shown.filter((row) => row.status === "open" && selected.includes(row.id));
  const checkbox = (row: ModerationRecord) => (
    <label className="inline-flex min-h-11 min-w-11 items-center gap-2">
      <input
        type="checkbox"
        className="size-5"
        disabled={!ready || row.status !== "open"}
        checked={chosen.some((item) => item.id === row.id)}
        onChange={(e) =>
          setSelected(
            e.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id),
          )
        }
        aria-label={`Select ${kind} ${row.id}`}
      />
      <span className="sr-only">Select {row.label}</span>
    </label>
  );
  return (
    <section
      data-workbench-scope={scope}
      className="grid min-w-0 gap-3 rounded-xl border p-4"
      aria-label={kind === "report" ? "User reports" : "Moderation events"}
    >
      <h2 className="text-xl font-semibold">
        {kind === "report" ? "User reports" : "Moderation events"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Latest {rows.length} records, up to 80.{" "}
        {kind === "report"
          ? "Submitted user reports; allegations are not findings."
          : "Detected moderation events, shown separately from user reports."}{" "}
        Filters and selection apply to these loaded records.
      </p>
      <DesktopWorkbenchControls
        viewKey={scope}
        scope={scope}
        currentViewLabel={kind === "report" ? "User reports" : "Moderation events"}
        resultLabel={`${shown.length} matching loaded records`}
        exportFileName={`${scope}-filtered.csv`}
        columns={[
          { id: "select", label: "Selection", locked: true },
          ...columns,
          { id: "action", label: "Review", locked: true },
        ]}
        localView={{
          state: { query, status, sort, direction },
          restore: (saved) => {
            const next = {
              query: saved.query ?? "",
              status: saved.status ?? "all",
              sort: saved.sort ?? "created",
              direction: saved.direction === "asc" ? "asc" : "desc",
            };
            setQuery(next.query);
            setStatus(next.status);
            setSort(next.sort);
            setDirection(next.direction);
            setSelected([]);
            persist(next);
          },
        }}
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          Search {kind}s
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              persist({ query: e.target.value, status, sort, direction });
              setSelected([]);
            }}
          />
        </label>
        <Button
          variant="outline"
          disabled={!ready}
          onClick={() => {
            setDraft({ status, sort, direction });
            setFilters(true);
          }}
        >
          Filters ({status === "all" ? 0 : 1})
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setQuery("");
            setStatus("all");
            persist({ query: "", status: "all", sort, direction });
            setSelected([]);
          }}
        >
          Clear all
        </Button>
      </div>
      <p role="status" className="text-sm">
        {shown.length} results · {chosen.length} selected
        {status !== "all" ? ` · Status: ${status}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!ready || !shown.some((row) => row.status === "open")}
          onClick={() =>
            setSelected(shown.filter((row) => row.status === "open").map((row) => row.id))
          }
        >
          Select visible open records
        </Button>
        <Button variant="outline" disabled={!chosen.length} onClick={() => setSelected([])}>
          Clear selection
        </Button>
        <Button
          disabled={!ready || !chosen.length}
          onClick={() => {
            setError(undefined);
            setReceipt(undefined);
            setReview(chosen);
          }}
        >
          Review {chosen.length} selected {kind}s
        </Button>
      </div>
      {!shown.length ? (
        <p className="rounded-lg border p-4">No {kind}s match this view.</p>
      ) : (
        <>
          <div
            className={layout.desktop}
            role="region"
            aria-label={`${kind === "report" ? "User reports" : "Moderation events"} table`}
            tabIndex={0}
          >
            <table data-workbench-export-table={scope} className="w-full text-left text-sm">
              <caption className="sr-only">
                Loaded {kind}s ordered by {sort}, {direction}. Only explicitly selected open records
                can be resolved.
              </caption>
              <thead>
                <tr>
                  <th data-column="select" scope="col">
                    Select
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      data-column={column.id}
                      scope="col"
                      aria-sort={
                        column.id === sort
                          ? direction === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {column.label}
                    </th>
                  ))}
                  <th data-column="action" scope="col">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td data-column="select">{checkbox(row)}</td>
                    {columns.map((column) =>
                      column.id === "label" ? (
                        <th key={column.id} data-column={column.id} scope="row">
                          {row.label}
                        </th>
                      ) : (
                        <td
                          key={column.id}
                          data-column={column.id}
                          className="whitespace-pre-wrap break-all"
                        >
                          {display(row, column.id)}
                        </td>
                      ),
                    )}
                    <td data-column="action">
                      <Button
                        variant="outline"
                        disabled={!ready}
                        onClick={() => setDetailId(row.id)}
                        aria-label={`Review ${kind} ${row.id}`}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={layout.mobile}>
            {shown.map((row) => (
              <article key={row.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  {checkbox(row)}
                  <span className="min-w-0 break-words font-medium">{row.label}</span>
                </div>
                {columns
                  .filter((column) => column.id !== "label")
                  .map((column) => (
                    <p
                      key={column.id}
                      data-column={column.id}
                      className="whitespace-pre-wrap break-all text-sm"
                    >
                      {column.label}: {display(row, column.id)}
                    </p>
                  ))}
                <Button
                  variant="outline"
                  disabled={!ready}
                  className="mt-2 w-full"
                  onClick={() => setDetailId(row.id)}
                  aria-label={`Review ${kind} ${row.id}`}
                >
                  Review full {kind}
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
      <ResponsiveDetailPanel
        open={filters}
        onOpenChange={setFilters}
        title={`${kind === "report" ? "Report" : "Event"} filters`}
        description="Changing filters clears the selection so unseen records cannot be included."
      >
        <div className="grid gap-4">
          <label className="grid gap-1">
            Status
            <select
              className="min-h-11 rounded-lg border bg-background px-3"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              <option value="all">All statuses</option>
              {Array.from(new Set(["open", "resolved", ...rows.map((row) => row.status)])).map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label className="grid gap-1">
            Order by
            <select
              className="min-h-11 rounded-lg border bg-background px-3"
              value={draft.sort}
              onChange={(e) => setDraft({ ...draft, sort: e.target.value })}
            >
              {[
                "created",
                "status",
                "reason",
                "target",
                kind === "report" ? "details" : "event",
                ...(kind === "event" ? ["severity"] : []),
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Direction
            <select
              className="min-h-11 rounded-lg border bg-background px-3"
              value={draft.direction}
              onChange={(e) => setDraft({ ...draft, direction: e.target.value })}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => setDraft({ status: "all", sort: "created", direction: "desc" })}
          >
            Reset filters
          </Button>
          <Button
            onClick={() => {
              setStatus(draft.status);
              persist({ query, ...draft });
              setSort(draft.sort);
              setDirection(draft.direction);
              setSelected([]);
              setFilters(false);
            }}
          >
            Apply filters
          </Button>
        </div>
      </ResponsiveDetailPanel>
      <ResponsiveDetailPanel
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        title={detail?.label ?? "Moderation detail"}
        description={`Complete ${kind} evidence and current saved status.`}
      >
        {detail ? (
          <div key={detail.id} className="grid gap-4">
            <dl className="grid gap-3">
              {Object.entries({
                "Record ID": detail.id,
                Kind: detail.kind,
                Status: detail.status,
                "Target type": detail.targetType,
                Target: detail.targetId,
                Reason: detail.reason,
                Evidence: detail.details,
                [kind === "report" ? "Reporter ID" : "Actor ID"]: detail.actor,
                "Reported user": detail.reportedUser,
                Severity: detail.severity,
                Created: date(detail.created),
                Resolved: detail.resolved ? date(detail.resolved) : "Not resolved",
                Metadata: detail.metadata,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">{key}</dt>
                  <dd className="whitespace-pre-wrap break-all">{value}</dd>
                </div>
              ))}
            </dl>
            {detail.status === "open" ? (
              <AdminOperationForm
                operation={kind === "report" ? "resolve-report" : "resolve-event"}
                title={`Resolve ${kind}`}
                description="Close this moderation record and record the decision. The underlying user content is not deleted."
              >
                <input
                  type="hidden"
                  name={kind === "report" ? "reportId" : "eventId"}
                  value={detail.id}
                />
              </AdminOperationForm>
            ) : null}
          </div>
        ) : null}
      </ResponsiveDetailPanel>
      <ResponsiveDetailPanel
        open={review !== null}
        onOpenChange={(open) => {
          if (!pending && !open) setReview(null);
        }}
        title={`Resolve selected ${kind}s`}
        description="Only these reviewed records are submitted. Underlying user content is not deleted."
      >
        <div className="grid gap-4">
          <p>
            {review?.length ?? 0} selected {kind}s
          </p>
          <ol className="grid gap-3">
            {review?.map((row) => (
              <li key={row.id} className="rounded-lg border p-3">
                <p>{row.label}</p>
                <p className="break-all text-sm">Record: {row.id}</p>
                <p className="break-all text-sm">
                  Target: {row.targetType} · {row.targetId}
                </p>
              </li>
            ))}
          </ol>
          {error ? <p role="alert">{error}</p> : null}
          {receipt ? <p role="status">{receipt}</p> : null}
          <Button variant="outline" disabled={pending} onClick={() => setReview(null)}>
            {receipt ? "Review current queue" : "Keep records open"}
          </Button>
          <Button
            disabled={pending || !!receipt}
            onClick={() => {
              if (lock.current || !review) return;
              lock.current = true;
              setError(undefined);
              const reviewedCount = review.length;
              const data = new FormData();
              data.set(
                "operation",
                kind === "report" ? "bulk-resolve-reports" : "bulk-resolve-events",
              );
              for (const row of review)
                data.append(kind === "report" ? "reportId" : "eventId", row.id);
              start(async () => {
                try {
                  const result = await adminFormAction({ ok: false }, data);
                  if (!result.ok || typeof result.resolvedCount !== "number") {
                    setError(
                      result.error ??
                        "The result could not be confirmed. Review the queue before retrying.",
                    );
                    return;
                  }
                  setReceipt(
                    `${result.resolvedCount} of ${reviewedCount} selected ${kind}s resolved.${result.resolvedCount < reviewedCount ? " Other records may have changed already; review the current queue." : ""}`,
                  );
                  setSelected([]);
                  router.refresh();
                } catch {
                  setError("Resolution could not be confirmed. Review the queue and retry.");
                } finally {
                  lock.current = false;
                }
              });
            }}
          >
            {pending ? "Resolving…" : "Confirm selected resolution"}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </section>
  );
}
