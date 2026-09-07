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
  scope,
  title,
  description,
  rows,
  initialSort = "created",
  initialDir = "desc",
}: {
  scope: "admin-billing-subscriptions" | "admin-billing-entitlements";
  title: string;
  description: string;
  rows: AdminBillingRecord[];
  initialSort?: string;
  initialDir?: string;
}) {
  const ready = useClientReady();
  const params = useSearchParams();
  const query = params.get(`${scope}-query`) ?? "";
  const sort = params.get(`${scope}-sort`) ?? initialSort;
  const direction = params.get(`${scope}-direction`) ?? initialDir;
  const update = (values: Record<string, string>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values))
      url.searchParams.set(`${scope}-${key}`, value);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const setQuery = (value: string) => update({ query: value });
  const setSort = (value: string) => update({ sort: value });
  const setDirection = (value: string) => update({ direction: value });
  const fields = Array.from(new Set(rows.flatMap((row) => Object.keys(row.fields))));
  const fieldColumn = (field: string) => `field-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
    <section data-workbench-scope={scope} className="grid min-w-0 gap-3" aria-label={title}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <DesktopWorkbenchControls
        viewKey={scope}
        scope={scope}
        currentViewLabel={title}
        resultLabel={`${shown.length} matching loaded records`}
        exportFileName={`${scope}-filtered.csv`}
        localView={{ state: { query, sort, direction }, restore: update }}
        columns={[
          { id: "account", label: "Account", locked: true },
          { id: "email", label: "Email" },
          { id: "state", label: "Saved state", locked: true },
          { id: "date", label: "Recorded date" },
          { id: "record-id", label: "Record ID" },
          { id: "account-id", label: "Account ID" },
          ...fields.map((field) => ({ id: fieldColumn(field), label: field })),
          { id: "details", label: "Details", locked: true },
        ]}
      />
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
          <div className={layout.desktop} role="region" aria-label={`${title} table`} tabIndex={0}>
            <table data-workbench-export-table={scope} className="w-full text-left text-sm">
              <caption className="sr-only">
                {title}, ordered by {sort}, {direction}; all secondary fields are available in
                details.
              </caption>
              <thead>
                <tr>
                  <th data-column="account" scope="col">
                    Account
                  </th>
                  <th data-column="email" scope="col">
                    Email
                  </th>
                  <th data-column="state" scope="col">
                    Saved state
                  </th>
                  <th
                    data-column="date"
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
                  <th data-column="record-id" scope="col">
                    Record ID
                  </th>
                  <th data-column="account-id" scope="col">
                    Account ID
                  </th>
                  {fields.map((field) => (
                    <th key={field} data-column={fieldColumn(field)} scope="col">
                      {field}
                    </th>
                  ))}
                  <th data-column="details" scope="col">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <th data-column="account" scope="row">
                      {row.title}
                    </th>
                    <td data-column="email" className="break-all">
                      {row.email ?? "Not recorded"}
                    </td>
                    <td data-column="state">{row.summary}</td>
                    <td data-column="date">{row.date}</td>
                    <td data-column="record-id">{row.id}</td>
                    <td data-column="account-id">{row.userId}</td>
                    {fields.map((field) => (
                      <td
                        key={field}
                        data-column={fieldColumn(field)}
                        className="whitespace-pre-wrap"
                      >
                        {row.fields[field] ?? "Not recorded"}
                      </td>
                    ))}
                    <td data-column="details">
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
                    {row.summary} <span data-column="date">· {row.date}</span>
                  </span>
                  <span data-column="email" className="block text-xs font-normal">
                    {row.email ?? "Not recorded"}
                  </span>
                  {fields.map((field) => (
                    <span
                      key={field}
                      data-column={fieldColumn(field)}
                      className="block text-xs font-normal"
                    >
                      {field}: {row.fields[field] ?? "Not recorded"}
                    </span>
                  ))}
                  <span data-column="record-id" className="block text-xs font-normal">
                    Record ID: {row.id}
                  </span>
                  <span data-column="account-id" className="block text-xs font-normal">
                    Account ID: {row.userId}
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
