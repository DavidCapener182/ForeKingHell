"use client";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
import { updateRecordViewQuery } from "@/app/course-records/record-view-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
import styles from "@/app/course-records/course-record-board.module.css";
export type CourseCategoryRow = {
  id: string;
  name: string;
  description: string;
  scope: string;
  period: string;
  tee: string;
  format: string;
  proofRequired: string;
  leader: string;
  result: string;
  proof: string;
  personal: string;
  friend: string;
};
const categoryColumns = [
  { id: "category", label: "Category", locked: true },
  { id: "scope", label: "Scope and period", locked: true },
  { id: "leader", label: "Verified leader" },
  { id: "result", label: "Result and proof", locked: true },
  { id: "personal", label: "Your verified best" },
  { id: "friend", label: "Friend to beat" },
  { id: "action", label: "Action", locked: true },
];
export function CourseCategoryList({ records }: { records: CourseCategoryRow[] }) {
  const ready = useClientReady();
  const params = useSearchParams();
  const pathname = usePathname();
  const query = params.get("categoryQuery") ?? "";
  const descending = params.get("categorySort") === "descending";
  const setQuery = (value: string) => updateRecordViewQuery({ categoryQuery: value });
  const visible = useMemo(
    () =>
      records
        .filter((row) =>
          `${row.name} ${row.description}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => (descending ? -1 : 1) * a.name.localeCompare(b.name)),
    [records, query, descending],
  );
  return (
    <section
      className="grid gap-3"
      aria-label="Course categories"
      data-workbench-scope="course-categories"
    >
      <DesktopWorkbenchControls
        viewKey={`course-categories:${pathname}`}
        scope="course-categories"
        currentViewLabel="Course categories"
        resultLabel={`${visible.length} filtered categories`}
        columns={categoryColumns}
        exportFileName="course-categories-filtered.csv"
      />
      <fieldset disabled={!ready} className="flex flex-wrap items-end gap-3">
        <legend className="sr-only">Filter record categories</legend>
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">
          Search categories
          <Input
            type="search"
            aria-label="Search categories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11"
          />
        </label>
        <Button
          className="min-h-11"
          variant="outline"
          onClick={() => updateRecordViewQuery({ categorySort: descending ? "" : "descending" })}
        >
          Category {descending ? "Z–A" : "A–Z"}
        </Button>
      </fieldset>
      <p role="status" className="text-sm text-muted-foreground">
        {visible.length} of {records.length} categories in this course and scope.
      </p>
      {!visible.length ? (
        <div className="rounded-xl border border-dashed p-4">
          <p>
            {records.length
              ? "No categories match your search."
              : "No boards match this scope yet."}
          </p>
          {query ? (
            <Button variant="outline" className="mt-2 min-h-11" onClick={() => setQuery("")}>
              Clear category search
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            className={styles.desktop}
            role="region"
            aria-label="Course category table"
            tabIndex={0}
          >
            <table
              data-workbench-export-table="course-categories"
              className="w-full text-left text-sm"
            >
              <caption className="sr-only">
                Records restricted to the selected course. Each category preserves its own units,
                scope, period and proof requirements.
              </caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={descending ? "descending" : "ascending"}>
                    Category
                  </th>
                  <th scope="col">Scope and period</th>
                  <th data-column="leader" scope="col">
                    Verified leader
                  </th>
                  <th scope="col">Result and proof</th>
                  <th data-column="personal" scope="col">
                    Your verified best
                  </th>
                  <th data-column="friend" scope="col">
                    Friend to beat
                  </th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <p className="font-semibold">{row.name}</p>
                      <p className="mt-1 font-normal text-muted-foreground">{row.description}</p>
                    </th>
                    <td>
                      <p>
                        {row.scope} · {row.period}
                      </p>
                      <p>
                        {row.tee} · {row.format}
                      </p>
                      <p>Required: {row.proofRequired}</p>
                    </td>
                    <td data-column="leader">{row.leader}</td>
                    <td>
                      <p className="font-semibold">{row.result}</p>
                      <p>{row.proof}</p>
                    </td>
                    <td data-column="personal">{row.personal}</td>
                    <td data-column="friend">{row.friend}</td>
                    <td>
                      <RecordAction id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mobile}>
            {visible.map((row) => (
              <article key={row.id} className="rounded-xl border bg-card p-4">
                <h2 className="break-words text-lg font-semibold">{row.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
                <p className="mt-3 font-medium">{row.result}</p>
                <p data-column="leader" className="text-sm">
                  {row.leader}
                </p>
                <details className="my-2">
                  <summary className="min-h-11 cursor-pointer content-center font-semibold">
                    Scope, proof and personal results
                  </summary>
                  <dl className="grid gap-2 text-sm">
                    {[
                      ["Scope", row.scope],
                      ["Period", row.period],
                      ["Tee", row.tee],
                      ["Record type", row.format],
                      ["Required proof", row.proofRequired],
                      ["Result proof", row.proof],
                      ["Your verified best", row.personal],
                      ["Friend to beat", row.friend],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        data-column={
                          label === "Your verified best"
                            ? "personal"
                            : label === "Friend to beat"
                              ? "friend"
                              : undefined
                        }
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="break-words font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <RecordAction id={row.id} />
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function RecordAction({ id }: { id: string }) {
  return (
    <Button asChild className="min-h-11">
      <Link href={`/course-records/${id}#submit-record`}>Check eligibility and submit</Link>
    </Button>
  );
}
