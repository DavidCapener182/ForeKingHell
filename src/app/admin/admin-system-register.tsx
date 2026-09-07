"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
import layout from "@/app/course-records/course-record-board.module.css";
export type SystemRow = {
  id: string;
  label: string;
  detail: string;
  area: string;
  status: string;
  state: string;
  lastCheck: string;
  evidence: string;
  impact: string;
  href?: string;
  action?: string;
};
export function AdminSystemRegister({ rows }: { rows: SystemRow[] }) {
  const ready = useClientReady();
  const params = useSearchParams();
  const query = params.get("healthQuery") ?? "";
  const state = params.get("healthState") ?? "all";
  const order = params.get("healthOrder") === "name" ? "name" : "priority";
  const update = (key: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const setQuery = (value: string) => update("healthQuery", value);
  const setState = (value: string) => update("healthState", value);
  const setOrder = (value: string) => update("healthOrder", value);
  const [selected, setSelected] = useState<string | null>(null);
  const row = rows.find((r) => r.id === selected);
  const priority: Record<string, number> = { failure: 0, attention: 1, unverified: 2, quiet: 3 };
  const shown = rows
    .filter(
      (r) =>
        (state === "all" || r.state === state) &&
        `${r.label} ${r.area} ${r.detail}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      order === "priority"
        ? priority[a.state] - priority[b.state] || a.label.localeCompare(b.label)
        : a.label.localeCompare(b.label),
    );
  return (
    <section
      data-workbench-scope="admin-system-health"
      id="health-register"
      aria-label="Health register"
      className="grid min-w-0 gap-3"
    >
      <h2 className="text-xl font-semibold">Health register</h2>
      <DesktopWorkbenchControls
        viewKey="admin-system-health"
        scope="admin-system-health"
        currentViewLabel="Health register"
        resultLabel={`${shown.length} matching checks`}
        exportFileName="admin-system-health-filtered.csv"
        columns={[
          { id: "check", label: "Check", locked: true },
          { id: "result", label: "Result", locked: true },
          { id: "evidence", label: "Evidence" },
          { id: "lastCheck", label: "Last check" },
          { id: "diagnostics", label: "Diagnostics", locked: true },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <label className="grid min-w-0 flex-1 basis-full gap-1 text-sm sm:basis-auto">
          Search checks
          <Input disabled={!ready} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Result
          <select
            disabled={!ready}
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            <option value="all">All results</option>
            <option value="failure">Recorded failures</option>
            <option value="attention">Needs attention</option>
            <option value="unverified">Unknown / unverified</option>
            <option value="quiet">No failures recorded</option>
          </select>
        </label>
        <Button
          disabled={!ready}
          variant="outline"
          className="self-end"
          onClick={() => setOrder(order === "priority" ? "name" : "priority")}
        >
          Order: {order}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {shown.length} of {rows.length} checks
      </p>
      {!shown.length ? (
        <p>No checks match this view.</p>
      ) : (
        <>
          <div className={layout.desktop}>
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Health register table"
              tabIndex={0}
            >
              <table
                data-workbench-export-table="admin-system-health"
                className="w-full text-left text-sm"
              >
                <caption className="sr-only">
                  Current operational evidence ordered by {order}; no live service health is
                  inferred.
                </caption>
                <thead>
                  <tr>
                    <th
                      data-column="check"
                      scope="col"
                      aria-sort={order === "name" ? "ascending" : undefined}
                    >
                      Check
                    </th>
                    <th
                      data-column="result"
                      scope="col"
                      aria-sort={order === "priority" ? "ascending" : undefined}
                    >
                      Result
                    </th>
                    <th data-column="evidence" scope="col">
                      Evidence
                    </th>
                    <th data-column="lastCheck" scope="col">
                      Last check
                    </th>
                    <th data-column="diagnostics" scope="col">
                      Diagnostics
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="border-t">
                      <th data-column="check" scope="row" className="py-3 pr-3">
                        {r.label}
                        <span className="block text-xs font-normal">{r.area}</span>
                      </th>
                      <td data-column="result">{r.status}</td>
                      <td data-column="evidence">{r.evidence}</td>
                      <td data-column="lastCheck">{r.lastCheck}</td>
                      <td data-column="diagnostics">
                        <Button
                          disabled={!ready}
                          variant="outline"
                          onClick={() => setSelected(r.id)}
                          aria-label={`Inspect ${r.label}`}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={layout.mobile}>
            {shown.map((r) => (
              <Button
                key={r.id}
                disabled={!ready}
                variant="outline"
                onClick={() => setSelected(r.id)}
                aria-label={`Inspect ${r.label}`}
                className="h-auto min-h-14 whitespace-normal justify-between p-4 text-left"
              >
                <span className="min-w-0">
                  {r.label}
                  <span className="block text-xs font-normal">
                    {r.status} <span data-column="lastCheck">· {r.lastCheck}</span>
                  </span>
                </span>
                <span className="ml-2 shrink-0">Inspect</span>
              </Button>
            ))}
          </div>
        </>
      )}
      <ResponsiveDetailPanel
        open={Boolean(row)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={row?.label ?? "Check diagnostics"}
        description={row?.status}
      >
        {row ? (
          <div className="grid gap-4">
            <dl className="grid gap-3">
              {Object.entries({
                "Check ID": row.id,
                Area: row.area,
                Result: row.status,
                Detail: row.detail,
                Evidence: row.evidence,
                "Last check": row.lastCheck,
                Impact: row.impact,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">{key}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {row.href ? (
              <Button asChild>
                <Link href={row.href} prefetch={false}>
                  {row.action ?? "Inspect source"}
                </Link>
              </Button>
            ) : (
              <p className="text-sm">No live diagnostic action is connected for this check.</p>
            )}
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
