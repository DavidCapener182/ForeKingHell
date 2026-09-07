"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
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
export function AdminChallengeBoardRegister({ rows }: { rows: AdminBoard[] }) {
  const ready = useClientReady();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState("desc");
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
    <section id="boards" aria-label="Challenge boards" className="grid min-w-0 gap-3">
      <h2 className="text-xl font-semibold">Challenge boards</h2>
      <p className="text-sm text-muted-foreground">
        Latest 80 boards at most. Counts include only these loaded boards; filters do not search
        older records.
      </p>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Challenge boards ordered by {sort}, {dir}
                </caption>
                <thead>
                  <tr>
                    {[
                      "Board",
                      "Owner",
                      "State",
                      "Entries",
                      "Attempts",
                      "Results",
                      "Ends",
                      "Details",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="p-3"
                        aria-sort={
                          (
                            {
                              Board: "title",
                              Owner: "owner",
                              State: "status",
                              Entries: "entries",
                              Attempts: "attempts",
                              Ends: "ends",
                            } as Record<string, string>
                          )[h] === sort
                            ? dir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id} className="border-t">
                      <th scope="row" className="p-3">
                        {row.title}
                        <span className="block font-normal text-muted-foreground">
                          {row.template}
                        </span>
                      </th>
                      <td className="p-3">{row.owner}</td>
                      <td className="p-3">
                        {row.status} · {row.visibility}
                      </td>
                      {[row.entries, row.attempts, row.results].map((v, i) => (
                        <td key={i} className="p-3 text-right tabular-nums">
                          {v}
                        </td>
                      ))}
                      <td className="p-3">{row.ends}</td>
                      <td className="p-3">
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
                  <span className="block font-normal text-xs">
                    {row.status} · {row.entries} entries · {row.attempts} attempts
                  </span>
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
