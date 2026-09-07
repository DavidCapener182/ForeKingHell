"use client";
import { useClientReady } from "@/hooks/use-client-ready";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import responsive from "@/app/course-records/course-record-board.module.css";
export type SafetyRecord = {
  id: string;
  source: string;
  severity: string;
  status: string;
  reason: string;
  target: string;
  detail: string;
  createdAt: string;
};
const columns = [
  ["source", "Source"],
  ["severity", "Severity"],
  ["status", "Status"],
  ["reason", "Reason"],
  ["target", "Target"],
  ["detail", "Detail"],
  ["createdAt", "Created"],
] as const;
const date = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});
export function SafetyRecords({ rows }: { rows: SafetyRecord[] }) {
  const ready = useClientReady();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<keyof SafetyRecord>("createdAt");
  const [ascending, setAscending] = useState(false);
  const [selected, setSelected] = useState<SafetyRecord | null>(null);
  const visible = rows
    .filter((row) => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => String(a[sort]).localeCompare(String(b[sort])) * (ascending ? 1 : -1));
  const value = (row: SafetyRecord, key: keyof SafetyRecord) =>
    key === "createdAt" ? date.format(new Date(row.createdAt)) + " UK" : row[key];
  return (
    <div className="grid min-w-0 gap-4">
      <Label className="grid gap-2">
        Search your safety records
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Status, reason or content ID"
        />
      </Label>
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-sm">
          {visible.length} of {rows.length} loaded records
        </p>
        <Label className="grid gap-2">
          Sort records
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            value={sort}
            onChange={(e) => setSort(e.target.value as keyof SafetyRecord)}
          >
            {columns.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Label>
        <Button disabled={!ready} variant="outline" onClick={() => setAscending(!ascending)}>
          {ascending ? "Ascending" : "Descending"}
        </Button>
        {query ? (
          <Button disabled={!ready} variant="outline" onClick={() => setQuery("")}>
            Clear search
          </Button>
        ) : null}
      </div>
      <div className={responsive.desktop}>
        <div
          role="region"
          aria-label="Safety record table"
          tabIndex={0}
          className="overflow-x-auto rounded-xl border"
        >
          <table className="w-full text-left text-sm" data-workbench-export-table="social-safety">
            <caption className="sr-only">
              Reports and moderation events visible to this account
            </caption>
            <thead>
              <tr>
                {columns.map(([id, label]) => (
                  <th
                    key={id}
                    data-column={id === "createdAt" ? "created" : id}
                    scope="col"
                    aria-sort={sort === id ? (ascending ? "ascending" : "descending") : "none"}
                    className="border-b p-3"
                  >
                    <Button
                      disabled={!ready}
                      variant="ghost"
                      onClick={() => {
                        if (sort === id) setAscending(!ascending);
                        else {
                          setSort(id);
                          setAscending(true);
                        }
                      }}
                    >
                      {label}
                    </Button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  {columns.map(([id]) => (
                    <td key={id} data-column={id === "createdAt" ? "created" : id} className="p-3">
                      <span
                        className={
                          id === "target"
                            ? "break-all font-mono text-xs"
                            : "whitespace-pre-wrap break-words"
                        }
                      >
                        {value(row, id)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={responsive.mobile}>
        <div className="grid gap-3">
          {visible.map((row) => (
            <article key={row.id} className="grid gap-2 rounded-xl border p-4">
              <h3 className="font-semibold">
                {row.source} · {row.status}
              </h3>
              <p>{row.severity}</p>
              <p className="break-words">{row.reason}</p>
              <Button
                disabled={!ready}
                variant="outline"
                onClick={() => setSelected(row)}
                aria-label={`Inspect ${row.source}: ${row.target}`}
              >
                Inspect full record
              </Button>
            </article>
          ))}
        </div>
      </div>
      {!visible.length ? (
        <p role="status">
          {query
            ? "No safety records match this search."
            : "No reports or moderation events visible to this account."}
        </p>
      ) : null}
      <ResponsiveDetailPanel
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.source ?? "Safety record"}
        description="The recorded status and details; reporting does not itself remove content."
      >
        {selected ? (
          <dl className="grid gap-4">
            {columns.map(([id, label]) => (
              <div key={id}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap break-words">{value(selected, id)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </ResponsiveDetailPanel>
    </div>
  );
}
