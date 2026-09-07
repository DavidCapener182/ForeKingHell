"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UntitledSelect, UntitledTextField } from "@/components/untitled-ui/form-controls";
import { ShotEvidenceSheet } from "@/app/shots/shot-evidence-sheet";
import { ShotReviewButton } from "@/app/shots/shot-review-controls";
import type { Row } from "./stock-sample-review";
export function StockSampleReviewBody({
  label,
  rows,
  clubs,
  scope,
  setScope,
  search,
  setSearch,
  page,
  setPage,
}: {
  scope: string;
  setScope: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (value: number) => void;
  label: string;
  rows: Row[];
  clubs: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const visible = rows.filter(
    (r) =>
      (scope === "all" || (scope === "used" ? r.used : !r.used)) &&
      `${r.date} ${r.id} ${r.carry ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const current = Math.min(page, pages);
  return (
    <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4">
      <UntitledTextField
        type="search"
        name="stockSearch"
        label="Find date, carry or shot ID"
        value={search}
        onValueChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />
      <UntitledSelect
        name="stockScope"
        label="Sample scope"
        value={scope}
        onValueChange={(v) => {
          setScope(v);
          setPage(1);
        }}
        options={[
          { value: "all", label: "All loaded shots" },
          { value: "used", label: "Used in best stock" },
          { value: "excluded", label: "Not used in best stock" },
        ]}
      />
      <Button
        variant="ghost"
        onClick={() => {
          setSearch("");
          setScope("all");
          setPage(1);
        }}
      >
        Reset sample view
      </Button>
      <p role="status" className="text-sm">
        {visible.length} matching shots · page {current} of {pages}
      </p>
      {visible.slice((current - 1) * 10, current * 10).map((row) => (
        <article key={row.id} className="grid gap-3 rounded-lg border p-3">
          <h3 className="font-medium">
            {row.date} ·{" "}
            {row.carry === null ? "Carry unavailable" : `${row.carry.toFixed(1)} yd carry`}
          </h3>
          <p className="text-sm">
            {row.used ? "Used in best-stock sample" : "Not used in best-stock sample"}
          </p>
          <ShotEvidenceSheet
            shotId={row.id}
            title={`${label} · ${row.date}`}
            clubs={clubs}
            onComplete={() => router.refresh()}
          />
          <ShotReviewButton
            shotId={row.id}
            reviewStatus={row.reviewStatus}
            companion
            onComplete={() => router.refresh()}
          />
        </article>
      ))}
      {!visible.length && <p>No matching sample rows. Reset the view to see the loaded sample.</p>}
      <nav aria-label="Stock sample pages" className="flex justify-between gap-3">
        <Button variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>
          Previous
        </Button>
        <Button variant="outline" disabled={current === pages} onClick={() => setPage(current + 1)}>
          Next
        </Button>
      </nav>
    </div>
  );
}
