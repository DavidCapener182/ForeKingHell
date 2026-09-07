"use client";
import { useState } from "react";
import Link from "next/link";
import { UntitledTextField } from "@/components/untitled-ui/form-controls";
import { Button } from "@/components/ui/button";
export function EquipmentRecords({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ id: string; title: string; fields: Array<[string, string]>; href?: string }>;
}) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((row) =>
    `${row.title} ${row.fields.flat().join(" ")}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <details className="rounded-xl border p-3">
      <summary className="min-h-11 cursor-pointer font-semibold">
        Search {label} · {rows.length} records
      </summary>
      <div className="grid gap-3">
        <UntitledTextField
          label={`Search ${label}`}
          name={`search-${label}`}
          value={query}
          onValueChange={setQuery}
        />
        <p className="text-sm text-muted-foreground">{filtered.length} matching records</p>
        {filtered.map((row) => (
          <details key={row.id} className="rounded-lg border p-3">
            <summary className="min-h-11 cursor-pointer font-medium">{row.title}</summary>
            <dl className="grid gap-2">
              {row.fields.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 text-sm"
                >
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {row.href && (
              <Link href={row.href} className="mt-2 flex min-h-11 items-center text-primary">
                Full club evidence
              </Link>
            )}
          </details>
        ))}
        {!filtered.length && (
          <p>
            No matching records.{" "}
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </p>
        )}
      </div>
    </details>
  );
}
