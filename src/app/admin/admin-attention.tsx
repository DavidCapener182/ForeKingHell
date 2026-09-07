"use client";
import Link from "next/link";
import { useState } from "react";
import { useClientReady } from "@/hooks/use-client-ready";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { OperationalBadge, type OperationalStatus } from "@/app/admin/admin-overview-components";
import layout from "@/app/course-records/course-record-board.module.css";
type Row = {
  id: string;
  area: string;
  status: OperationalStatus;
  statusLabel: string;
  evidence: string;
  href: string;
  action: string;
};
const priority = { failure: 0, queue: 1, unverified: 2, "recorded-none": 3 };
export function AdminAttention({ rows }: { rows: Row[] }) {
  const ready = useClientReady();
  const [selected, setSelected] = useState<Row | null>(null);
  const [order, setOrder] = useState<"priority" | "area">("priority");
  const sorted = [...rows].sort((a, b) =>
    order === "priority" ? priority[a.status] - priority[b.status] : a.area.localeCompare(b.area),
  );
  return (
    <div className="grid min-w-0 gap-3 p-3">
      <Button
        variant="outline"
        className="justify-self-start"
        disabled={!ready}
        onClick={() => setOrder(order === "priority" ? "area" : "priority")}
      >
        Order: {order === "priority" ? "priority" : "area"}
      </Button>
      <div className={layout.desktop}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Operational queues and evidence. No live service health is inferred.
          </caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col" aria-sort={order === "priority" ? "ascending" : "none"}>
                Status
              </th>
              <th scope="col">Evidence</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.area}</th>
                <td>
                  <OperationalBadge status={row.status}>{row.statusLabel}</OperationalBadge>
                </td>
                <td>{row.evidence}</td>
                <td>
                  <Button asChild variant="outline">
                    <Link href={row.href} prefetch={false}>
                      {row.action}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={layout.mobile}>
        {sorted.map((row) => (
          <Button
            key={row.id}
            variant="outline"
            className="h-auto min-h-14 justify-between whitespace-normal p-4 text-left"
            disabled={!ready}
            onClick={() => setSelected(row)}
          >
            <span className="min-w-0">
              {row.area}
              <span className="mt-1 block text-xs font-normal">{row.statusLabel}</span>
            </span>
            <span>Details</span>
          </Button>
        ))}
      </div>
      <ResponsiveDetailPanel
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.area ?? "Operational details"}
        description={selected?.statusLabel}
      >
        {selected ? (
          <div className="grid gap-4">
            <p>{selected.evidence}</p>
            <Button asChild>
              <Link href={selected.href} prefetch={false}>
                {selected.action}
              </Link>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </div>
  );
}
