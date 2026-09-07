"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
import layout from "@/app/course-records/course-record-board.module.css";
export type AdminBillingRecord = {
  id: string;
  title: string;
  email: string | null;
  userId: string;
  date: string;
  summary: string;
  fields: Record<string, string>;
};
export function AdminBillingLedger({
  title,
  description,
  rows,
  initialSort = "created",
  initialDir = "desc",
}: {
  title: string;
  description: string;
  rows: AdminBillingRecord[];
  initialSort?: string;
  initialDir?: string;
}) {
  const ready = useClientReady();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort);
  const [direction, setDirection] = useState(initialDir);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const shown = useMemo(
    () =>
      rows
        .filter((row) =>
          `${row.title} ${row.email ?? ""} ${row.userId} ${row.summary} ${Object.values(row.fields).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          const value = (row: AdminBillingRecord) =>
            sort === "user"
              ? row.title
              : sort === "plan"
                ? (row.fields.Plan ?? row.summary)
                : sort === "status"
                  ? (row.fields.Status ?? row.summary)
                  : sort === "renews"
                    ? (row.fields["Period end"] ?? "")
                    : row.date;
          return value(a).localeCompare(value(b)) * (direction === "asc" ? 1 : -1);
        }),
    [rows, query, sort, direction],
  );
  return (
    <section className="grid min-w-0 gap-3" aria-label={title}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap gap-3">
        <label className="grid min-w-0 flex-1 basis-full gap-1 text-sm sm:basis-auto">
          Search {title.toLowerCase()}
          <Input disabled={!ready} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Order
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            disabled={!ready}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="created">Recorded date</option>
            <option value="user">Account</option>
            <option value="plan">Plan / allowance</option>
            <option value="status">Status / source</option>
            <option value="renews">Period end</option>
          </select>
        </label>
        <Button
          variant="outline"
          disabled={!ready}
          className="self-end"
          onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
        >
          {direction === "asc" ? "Ascending" : "Descending"}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {shown.length} of {rows.length} loaded records
      </p>
      {!shown.length ? (
        <p className="rounded-xl border p-4">No records match this view.</p>
      ) : (
        <>
          <div className={layout.desktop}>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                {title}, ordered by {sort}, {direction}; all secondary fields are available in
                details.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Email</th>
                  <th scope="col">Saved state</th>
                  <th
                    scope="col"
                    aria-sort={
                      sort === "created"
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    Recorded date
                  </th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.title}</th>
                    <td className="break-all">{row.email ?? "Not recorded"}</td>
                    <td>{row.summary}</td>
                    <td>{row.date}</td>
                    <td>
                      <Button
                        variant="outline"
                        disabled={!ready}
                        onClick={() => setSelectedId(row.id)}
                        aria-label={`Details for ${title} ${row.id}`}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={layout.mobile}>
            {shown.map((row) => (
              <Button
                key={row.id}
                variant="outline"
                disabled={!ready}
                className="h-auto min-h-14 justify-between whitespace-normal p-4 text-left"
                onClick={() => setSelectedId(row.id)}
                aria-label={`Details for ${title} ${row.id}`}
              >
                <span className="min-w-0 break-words">
                  {row.title}
                  <span className="block text-xs font-normal">
                    {row.summary} · {row.date}
                  </span>
                </span>
                <span className="ml-2 shrink-0">Details</span>
              </Button>
            ))}
          </div>
        </>
      )}
      <ResponsiveDetailPanel
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected?.title ?? "Billing record"}
        description="Saved administrative billing data; this view does not contact the payment provider."
      >
        {selected ? (
          <div className="grid gap-4">
            <dl className="grid gap-3">
              {Object.entries({
                "Record ID": selected.id,
                "Account ID": selected.userId,
                Email: selected.email ?? "Not recorded",
                ...selected.fields,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">{key}</dt>
                  <dd className="whitespace-pre-wrap break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="outline">
              <Link
                href={`/admin/users?q=${encodeURIComponent(selected.email ?? selected.title)}`}
                prefetch={false}
              >
                Review account access
              </Link>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
