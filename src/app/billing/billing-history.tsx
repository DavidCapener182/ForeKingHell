"use client";
import { useState } from "react";
import {useClientReady} from "@/hooks/use-client-ready";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import styles from "@/app/course-records/course-record-board.module.css";
type Entry = {
  id: string;
  plan: string;
  status: string;
  period: string;
  renewal: string;
  date: string;
};
export function BillingHistory({ rows }: { rows: Entry[] }) {
  const ready=useClientReady();
  const [selected, setSelected] = useState<Entry | null>(null);
  const [ascending, setAscending] = useState(false);
  const sorted = [...rows].sort((a, b) =>
    ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date),
  );
  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="billing-history-title">
      <h2 id="billing-history-title" className="text-xl font-semibold">
        Billing history
      </h2>
      <p className="text-sm text-muted-foreground">
        Latest {rows.length} recorded subscription periods, up to 24. These records do not contain
        invoice amounts or currencies. Use Manage plan for available provider invoices and receipts.
      </p>
      <Button
        variant="outline"
        className="justify-self-start"
        disabled={!ready}
        onClick={() => setAscending(!ascending)}
      >
        Recorded date: {ascending ? "oldest first" : "newest first"}
      </Button>
      {!rows.length ? (
        <p className="rounded-xl border p-4">No subscription history is recorded.</p>
      ) : (
        <>
          <div className={styles.desktop}>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Recorded subscriptions, ordered by recorded date.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Period</th>
                  <th scope="col">Renewal</th>
                  <th scope="col" aria-sort={ascending ? "ascending" : "descending"}>
                    Recorded date
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.plan}</th>
                    <td>{row.status}</td>
                    <td>{row.period}</td>
                    <td>{row.renewal}</td>
                    <td>{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mobile}>
            {sorted.map((row) => (
              <Button
                key={row.id}
                variant="outline"
                className="h-auto min-h-14 justify-between whitespace-normal p-4 text-left"
                disabled={!ready}
                onClick={() => setSelected(row)}
              >
                <span>
                  {row.plan}
                  <span className="block text-xs font-normal">
                    {row.status} · {row.date}
                  </span>
                </span>
                <span>Details</span>
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
        title="Subscription details"
        description="Saved subscription record; this is not a payment receipt."
      >
        {selected ? (
          <dl className="grid gap-4">
            {Object.entries({
              Plan: selected.plan,
              Status: selected.status,
              Period: selected.period,
              Renewal: selected.renewal,
              "Recorded date": selected.date,
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
