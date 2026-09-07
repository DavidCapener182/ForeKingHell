"use client";
import { useState } from "react";
import styles from "@/app/course-records/course-record-board.module.css";
type BagRow = {
  clubId: string;
  label: string;
  carryMedianYd: number | null;
  totalMedianYd: number | null;
  confidenceScore: number | null;
  sampleSize: number;
};
const number = (v: number | null) =>
  v === null ? "Unavailable" : v.toLocaleString("en-GB", { maximumFractionDigits: 1 });
export function PublicProfileBag({ rows }: { rows: BagRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("club");
  const filtered = rows
    .filter((r) => r.label.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === "carry"
        ? (b.carryMedianYd ?? -Infinity) - (a.carryMedianYd ?? -Infinity)
        : a.label.localeCompare(b.label),
    );
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Search visible clubs
          <input
            className="min-h-11 rounded-lg border bg-background px-3"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Order visible clubs
          <select
            className="min-h-11 rounded-lg border bg-background px-3"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="club">Club A–Z</option>
            <option value="carry">Stock carry, highest first</option>
          </select>
        </label>
      </div>
      {!filtered.length ? (
        <p role="status">
          {rows.length
            ? "No visible clubs match your search."
            : "No bag distances shared or available. This is not a zero-distance result."}
        </p>
      ) : (
        <>
          <div className={styles.desktop}>
            <table
              className="w-full text-left text-sm"
              data-workbench-export-table="profile-bag-comparison"
            >
              <caption className="sr-only">
                Permitted stock bag summaries only; no raw shots or session details
              </caption>
              <thead>
                <tr>
                  <th scope="col" data-column="club">
                    Club
                  </th>
                  <th scope="col" data-column="carry">
                    Carry (yd)
                  </th>
                  <th scope="col" data-column="total">
                    Total (yd)
                  </th>
                  <th scope="col" data-column="confidence">
                    Confidence (%)
                  </th>
                  <th scope="col" data-column="shots">
                    Shots
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.clubId}>
                    <th scope="row" data-column="club">
                      {r.label}
                    </th>
                    <td data-column="carry" className="text-right tabular-nums">
                      {number(r.carryMedianYd)}
                    </td>
                    <td data-column="total" className="text-right tabular-nums">
                      {number(r.totalMedianYd)}
                    </td>
                    <td data-column="confidence" className="text-right tabular-nums">
                      {number(r.confidenceScore)}
                    </td>
                    <td data-column="shots" className="text-right tabular-nums">
                      {number(r.sampleSize)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mobile}>
            {filtered.map((r) => (
              <details key={r.clubId} className="rounded-xl border p-3">
                <summary className="min-h-11 cursor-pointer break-words font-medium">
                  {r.label} · {number(r.carryMedianYd)}
                  {r.carryMedianYd !== null ? " yd carry" : ""}
                </summary>
                <dl className="grid gap-3 pt-3">
                  {Object.entries({
                    "Stock carry": `${number(r.carryMedianYd)}${r.carryMedianYd !== null ? " yd" : ""}`,
                    "Stock total": `${number(r.totalMedianYd)}${r.totalMedianYd !== null ? " yd" : ""}`,
                    Confidence: `${number(r.confidenceScore)}${r.confidenceScore !== null ? "%" : ""}`,
                    "Shot sample": number(r.sampleSize),
                  }).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="pt-3 text-sm">
                  Shared stock summary. Raw shots and sessions are not included.
                </p>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
