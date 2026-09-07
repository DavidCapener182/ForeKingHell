"use client";
import { useState } from "react";
import Link from "next/link";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
export type BoardCard = {
  id: string;
  title: string;
  result: string;
  href: string;
  personal?: boolean;
  fields: Array<[string, string]>;
};
export function LeaderboardDetailCards({ rows, empty }: { rows: BoardCard[]; empty: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const row = rows.find((item) => item.id === selected);
  return (
    <>
      <div className="grid gap-3">
        {rows.length ? (
          rows.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-4 ${item.personal ? "border-primary bg-primary/5" : ""}`}
            >
              <h3 className="break-words font-semibold">
                {item.title}
                {item.personal ? " · You" : ""}
              </h3>
              <p className="mt-2 text-lg font-semibold">{item.result}</p>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setSelected(item.id)}
              >
                View details<span className="sr-only"> for {item.title}</span>
              </Button>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
      <ResponsiveDetailPanel
        open={!!row}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={row?.title ?? "Standing details"}
        description="Full result and evidence context for this standing."
      >
        {row ? (
          <div className="grid gap-4 pb-4">
            <p className="text-xl font-semibold">{row.result}</p>
            <dl className="grid gap-3">
              {row.fields.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <Button asChild>
              <Link href={row.href}>Open full record</Link>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </>
  );
}
