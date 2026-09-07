"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
import layout from "@/app/course-records/course-record-board.module.css";
export type AdminBoard = {
  id: string;
  title: string;
  owner: string;
  template: string;
  status: string;
  visibility: string;
  entries: number;
  attempts: number;
  results: number;
  starts: string;
  ends: string;
  created: string;
};
const boardColumns: { id: keyof AdminBoard; label: string; locked?: boolean }[] = [
  { id: "title", label: "Board", locked: true },
  { id: "id", label: "Board ID" },
  { id: "owner", label: "Owner" },
  { id: "template", label: "Template" },
  { id: "status", label: "State", locked: true },
  { id: "visibility", label: "Visibility" },
  { id: "entries", label: "Entries" },
  { id: "attempts", label: "Attempts" },
  { id: "results", label: "Results" },
  { id: "starts", label: "Starts" },
  { id: "ends", label: "Ends" },
  { id: "created", label: "Created" },
];
export function AdminChallengeBoardRegister({ rows }: { rows: AdminBoard[] }) {
  const ready = useClientReady();
  const params = useSearchParams();
  const query = params.get("board-query") ?? "";
  const status = params.get("board-status") ?? "all";
  const requestedSort = params.get("board-sort") ?? "created";
  const sort = ["created", "title", "owner", "status", "entries", "attempts", "ends"].includes(
    requestedSort,
  )
    ? requestedSort
    : "created";
  const dir = params.get("board-dir") === "asc" ? "asc" : "desc";
  const update = (values: Record<string, string>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) url.searchParams.set(`board-${key}`, value);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const setQuery = (value: string) => update({ query: value });
  const setStatus = (value: string) => update({ status: value });
  const setSort = (value: string) => update({ sort: value });
  const setDir = (value: string) => update({ dir: value });
  const [id, setId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === id);
  const shown = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            (status === "all" || row.status === status) &&
            `${row.title} ${row.owner} ${row.template} ${row.id}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          const compare =
            sort === "entries"
              ? a.entries - b.entries
              : sort === "attempts"
                ? a.attempts - b.attempts
                : String(a[sort as keyof AdminBoard]).localeCompare(
                    String(b[sort as keyof AdminBoard]),
                  );
          return compare * (dir === "asc" ? 1 : -1);
        }),
    [rows, query, status, sort, dir],
  );
  return (
    <section
      data-workbench-scope="admin-challenge-boards"
      id="boards"
      aria-label="Challenge boards"
      className="grid min-w-0 gap-3"
    >
      <h2 className="text-xl font-semibold">Challenge boards</h2>
      <p className="text-sm text-muted-foreground">
        Latest 80 boards at most. Counts include only these loaded boards; filters do not search
        older records.
      </p>
      <DesktopWorkbenchControls
        viewKey="admin-challenge-boards"
        scope="admin-challenge-boards"
        currentViewLabel="Challenge boards"
        resultLabel={`${shown.length} matching loaded boards`}
        exportFileName="admin-challenge-boards-filtered.csv"
        localView={{ state: { query, status, sort, dir }, restore: update }}
        columns={[...boardColumns, { id: "details", label: "Details", locked: true }]}
      />
      <div className="flex flex-wrap gap-3">
        <label className="grid min-w-0 flex-1 basis-full gap-1 text-sm sm:basis-auto">
          Search boards
          <Input disabled={!ready} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          State
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            disabled={!ready}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All states</option>
            {Array.from(new Set(rows.map((r) => r.status))).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Order
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            disabled={!ready}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {Object.entries({
              created: "Created",
              title: "Board",
              owner: "Owner",
              status: "State",
              entries: "Entries",
              attempts: "Attempts",
              ends: "Ends",
            }).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={!ready}
          variant="outline"
          className="self-end"
          onClick={() => setDir(dir === "asc" ? "desc" : "asc")}
        >
          {dir === "asc" ? "Ascending" : "Descending"}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {shown.length} of {rows.length} loaded boards
      </p>
      {!shown.length ? (
        <p className="rounded-xl border p-4">No boards match this view.</p>
      ) : (
        <>
          <div className={layout.desktop}>
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Challenge boards table"
              tabIndex={0}
            >
              <table
                data-workbench-export-table="admin-challenge-boards"
                className="w-full text-left text-sm"
              >
                <caption className="sr-only">
                  Challenge boards ordered by {sort}, {dir}
                </caption>
                <thead>
                  <tr>
                    {boardColumns.map((column) => (
                      <th
                        key={column.id}
                        data-column={column.id}
                        scope="col"
                        className="p-3"
                        aria-sort={
                          column.id === sort
                            ? dir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        {column.label}
                      </th>
                    ))}
                    <th data-column="details" scope="col" className="p-3">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id} className="border-t">
                      {boardColumns.map((column) =>
                        column.id === "title" ? (
                          <th key={column.id} scope="row" data-column={column.id} className="p-3">
                            {row.title}
                          </th>
                        ) : (
                          <td
                            key={column.id}
                            data-column={column.id}
                            className={`p-3 ${typeof row[column.id] === "number" ? "text-right tabular-nums" : ""}`}
                          >
                            {row[column.id]}
                          </td>
                        ),
                      )}
                      <td data-column="details" className="p-3">
                        <Button
                          variant="outline"
                          disabled={!ready}
                          onClick={() => setId(row.id)}
                          aria-label={`Inspect ${row.title}`}
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
            {shown.map((row) => (
              <Button
                key={row.id}
                variant="outline"
                disabled={!ready}
                onClick={() => setId(row.id)}
                aria-label={`Inspect ${row.title}`}
                className="h-auto min-h-14 whitespace-normal p-4 text-left justify-between"
              >
                <span className="min-w-0 break-words">
                  {row.title}
                  {boardColumns
                    .filter((column) => column.id !== "title")
                    .map((column) => (
                      <span
                        key={column.id}
                        data-column={column.id}
                        className="block font-normal text-xs"
                      >
                        {column.label}: {row[column.id]}
                      </span>
                    ))}
                </span>
                <span className="ml-2 shrink-0">Inspect</span>
              </Button>
            ))}
          </div>
        </>
      )}
      <ResponsiveDetailPanel
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setId(null);
        }}
        title={selected?.title ?? "Challenge board"}
        description="Inspect the exact board and its stored participation before opening participant operations."
      >
        {selected ? (
          <div className="grid gap-4">
            <dl className="grid gap-3">
              {Object.entries(selected).map(([key, value]) => (
                <div key={key}>
                  <dt className="capitalize text-sm text-muted-foreground">{key}</dt>
                  <dd className="break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              This administrator register does not change scoring, close boards or publish results.
              Available participant operations retain their own permission checks.
            </p>
            <Button asChild>
              <Link prefetch={false} href={`/challenges/${selected.id}`}>
                Open {selected.title}
              </Link>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
