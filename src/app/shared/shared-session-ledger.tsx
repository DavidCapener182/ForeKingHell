"use client";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { useClientReady } from "@/hooks/use-client-ready";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import styles from "@/app/course-records/course-record-board.module.css";
type Row = {
  id: string;
  date: string;
  type: string;
  courseName: string | null;
  fileName: string | null;
  holesPlayed: number;
  totalScore: number | null;
};
const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );
export function SharedSessionLedger({ rows, total }: { rows: Row[]; total: number }) {
  const ready = useClientReady();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get("sharedQuery") ?? "";
  const ascending = params.get("sharedOrder") === "asc";
  const update = (key: string, value: string) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const setQuery = (value: string) => update("sharedQuery", value);
  const setAscending = (value: boolean) => update("sharedOrder", value ? "asc" : "");
  const [selected, setSelected] = useState<Row | null>(null);
  const shown = useMemo(
    () =>
      rows
        .filter((row) =>
          `${row.type} ${row.courseName ?? ""} ${row.fileName ?? ""} ${date(row.date)}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => (ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))),
    [rows, query, ascending],
  );
  const label = (row: Row) => row.courseName ?? row.fileName ?? "Untitled session";
  return (
    <section
      id="shared-session-ledger"
      data-workbench-scope="shared-sessions"
      className="grid min-w-0 gap-3"
      aria-labelledby="shared-sessions-heading"
    >
      <h2 id="shared-sessions-heading" className="text-xl font-semibold">
        Recent sessions
      </h2>
      <p className="text-sm text-muted-foreground">
        Latest {rows.length} of {total} recorded sessions. Search and ordering apply to this loaded
        list. A score appears only when every recorded scorecard hole has a score; a partial card is
        not a complete round.
      </p>
      <DesktopWorkbenchControls
        viewKey={`shared-sessions:${pathname}`}
        scope="shared-sessions"
        currentViewLabel="Shared recent sessions"
        resultLabel={`${shown.length} matching loaded sessions`}
        exportFileName="shared-sessions-filtered.csv"
        columns={[
          { id: "session", label: "Session", locked: true },
          { id: "date", label: "Date" },
          { id: "type", label: "Type" },
          { id: "source", label: "Source file" },
          { id: "score", label: "Scorecard total", locked: true },
          { id: "holes", label: "Recorded holes", locked: true },
          { id: "details", label: "Details", locked: true },
        ]}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          Search recent sessions
          <Input
            disabled={!ready}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Course, file, type or date"
          />
        </label>
        <Button disabled={!ready} variant="outline" onClick={() => setAscending(!ascending)}>
          Date: {ascending ? "oldest first" : "newest first"}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {shown.length} matching sessions
      </p>
      {shown.length === 0 ? (
        <p className="rounded-xl border p-5">
          {rows.length ? "No sessions match this search." : "No shared sessions yet."}
        </p>
      ) : (
        <>
          <div
            className={styles.desktop}
            role="region"
            aria-label="Shared session table"
            tabIndex={0}
          >
            <table
              className="w-full text-left text-sm"
              data-workbench-export-table="shared-sessions"
            >
              <caption className="sr-only">
                Read-only shared sessions: date, type, course, source file, recorded scorecard total
                and holes.
              </caption>
              <thead>
                <tr>
                  <th scope="col" data-column="session">
                    Session
                  </th>
                  <th
                    scope="col"
                    data-column="date"
                    aria-sort={ascending ? "ascending" : "descending"}
                  >
                    Date
                  </th>
                  <th scope="col" data-column="type">
                    Type
                  </th>
                  <th scope="col" data-column="source">
                    Source file
                  </th>
                  <th scope="col" data-column="score" className="text-right">
                    Scorecard total
                  </th>
                  <th scope="col" data-column="holes" className="text-right">
                    Recorded holes
                  </th>
                  <th scope="col" data-column="details">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" data-column="session">
                      {label(row)}
                    </th>
                    <td data-column="date">{date(row.date)}</td>
                    <td data-column="type">{row.type}</td>
                    <td data-column="source">{row.fileName ?? "Not recorded"}</td>
                    <td data-column="score" className="text-right tabular-nums">
                      {row.totalScore ?? "Incomplete / unavailable"}
                    </td>
                    <td data-column="holes" className="text-right tabular-nums">
                      {row.holesPlayed}
                    </td>
                    <td data-column="details">
                      <Button
                        variant="outline"
                        disabled={!ready}
                        onClick={() => setSelected(row)}
                        aria-label={`Details for ${label(row)} on ${date(row.date)}`}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mobile}>
            {shown.map((row) => (
              <Button
                key={row.id}
                variant="outline"
                className="h-auto min-h-14 justify-between whitespace-normal p-4 text-left"
                disabled={!ready}
                onClick={() => setSelected(row)}
              >
                <span className="min-w-0 break-words">
                  <span className="block">{label(row)}</span>
                  <span className="block text-xs font-normal">
                    <span data-column="date">{date(row.date)} </span>
                    <span data-column="type">{row.type}</span>
                  </span>
                  <span data-column="source" className="block text-xs font-normal">
                    {row.fileName ?? "Source file not recorded"}
                  </span>
                </span>
                <span className="ml-3 shrink-0">Details</span>
              </Button>
            ))}
          </div>
        </>
      )}
      <ResponsiveDetailPanel
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Shared session details"
        description="Permitted read-only session information."
      >
        {selected ? (
          <dl className="grid gap-4">
            {Object.entries({
              Date: date(selected.date),
              Type: selected.type,
              Course: selected.courseName ?? "Not recorded",
              "Source file": selected.fileName ?? "Not recorded",
              "Scorecard total": selected.totalScore ?? "Incomplete / unavailable",
              "Recorded holes": selected.holesPlayed,
            }).map(([key, value]) => (
              <div key={key}>
                <dt className="text-sm text-muted-foreground">{key}</dt>
                <dd className="break-words font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
