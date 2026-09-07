"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import styles from "@/app/course-records/course-record-board.module.css";
type RecordRow = {
  id: string;
  recordId: string;
  courseName: string;
  categoryName: string;
  scoreLabel: string;
  rank: number | null;
  calculatedAt: string;
  verificationStatus: string;
  verificationTier: string;
  status: string;
};
const date = (v: string) =>
  new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export function ProfileRecordList({ records }: { records: RecordRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("date");
  const [selected, setSelected] = useState<RecordRow>();
  const rows = records
    .filter((r) =>
      `${r.courseName} ${r.categoryName} ${r.verificationStatus} ${r.verificationTier} ${r.status}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "course"
        ? a.courseName.localeCompare(b.courseName)
        : sort === "rank"
          ? (a.rank ?? Infinity) - (b.rank ?? Infinity)
          : b.calculatedAt.localeCompare(a.calculatedAt),
    );
  return (
    <div className="grid min-w-0 gap-3">
      <p className="text-sm text-muted-foreground">
        Public all-time records from the latest 24 calculated results, grouped by course and
        category. Rank and verification are separate.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Search profile records
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3"
          />
        </label>
        <label className="grid gap-2 text-sm">
          Order profile records
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3"
          >
            <option value="date">Latest calculation</option>
            <option value="course">Course A–Z</option>
            <option value="rank">Rank, lowest first</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <p role="status">
          {records.length ? "No records match your search." : "No personal course records yet."}
        </p>
      ) : (
        <>
          <div className={styles.desktop}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Profile course records with stored verification and calculation date
                </caption>
                <thead>
                  <tr>
                    {[
                      "Course and category",
                      "Result / rank",
                      "Verification",
                      "Calculated",
                      "Details",
                    ].map((h) => (
                      <th key={h} className="p-3" scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <th scope="row" className="p-3 font-medium">
                        {r.courseName}
                        <span className="block font-normal">{r.categoryName}</span>
                      </th>
                      <td className="p-3 text-right tabular-nums">
                        {r.scoreLabel}
                        <span className="block">Rank {r.rank ?? "unavailable"}</span>
                      </td>
                      <td className="p-3">
                        {r.verificationStatus} / {r.verificationTier}
                        <span className="block">{r.status}</span>
                      </td>
                      <td className="p-3">{date(r.calculatedAt)}</td>
                      <td className="p-3">
                        <Button variant="outline" onClick={() => setSelected(r)}>
                          Inspect {r.courseName}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={styles.mobile}>
            {rows.map((r) => (
              <article key={r.id} className="mb-3 grid gap-2 rounded-xl border p-3">
                <h3 className="break-words font-semibold">{r.courseName}</h3>
                <p>
                  {r.categoryName} · {r.scoreLabel}
                </p>
                <p className="text-sm">
                  Rank {r.rank ?? "unavailable"} · {r.verificationStatus}
                </p>
                <Button variant="outline" onClick={() => setSelected(r)}>
                  Inspect {r.courseName}
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
      <ResponsiveDetailPanel
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
        title={selected?.courseName ?? "Record details"}
        description="Original calculated result and saved verification."
      >
        {selected ? (
          <div className="grid gap-4">
            <dl className="grid gap-3">
              {Object.entries({
                Category: selected.categoryName,
                Result: selected.scoreLabel,
                Rank: selected.rank ?? "Unavailable",
                Verification: selected.verificationStatus,
                Tier: selected.verificationTier,
                Status: selected.status,
                Calculated: date(selected.calculatedAt),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <Button asChild>
              <Link href={`/course-records/${selected.recordId}`} prefetch={false}>
                Open original record and proof
              </Link>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </div>
  );
}
