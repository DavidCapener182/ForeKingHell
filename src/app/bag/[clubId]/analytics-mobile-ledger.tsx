"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UntitledTextField } from "@/components/untitled-ui/form-controls";
import styles from "./analytics-ledger.module.css";
export function AnalyticsMobileLedger({
  rows,
}: {
  rows: Array<{ id: string; label: string; detail: string }>;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = rows.filter((row) =>
    `${row.label} ${row.detail} ${row.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  const current = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  return (
    <div className={styles.mobile}>
      <UntitledTextField
        name="analyticsEvidenceSearch"
        label="Find a shot in this club"
        value={search}
        onValueChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
      />
      <p className="text-sm text-muted-foreground">
        {filtered.length} matching shots. Select a row, then open Full evidence above for every
        original field.
      </p>
      {filtered.slice(current * 20, (current + 1) * 20).map((row) => (
        <Button
          key={row.id}
          variant="outline"
          data-analytics-shot-id={row.id}
          className="h-auto min-h-11 w-full flex-col items-start whitespace-normal py-3 text-left"
        >
          <span>{row.label}</span>
          <span className="text-sm font-normal text-muted-foreground">{row.detail}</span>
        </Button>
      ))}
      {!filtered.length && (
        <p role="status">
          No matching shots.{" "}
          <Button variant="outline" onClick={() => setSearch("")}>
            Clear search
          </Button>
        </p>
      )}
      {filtered.length > 20 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span>
            Page {current + 1} of {Math.ceil(filtered.length / 20)}
          </span>
          <Button
            variant="outline"
            disabled={(current + 1) * 20 >= filtered.length}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
