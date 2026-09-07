"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UntitledSelect, UntitledTextField } from "@/components/untitled-ui/form-controls";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ShotEvidenceSheet } from "@/app/shots/shot-evidence-sheet";
import { ShotReviewButton } from "@/app/shots/shot-review-controls";
import type { ShotReviewStatus } from "@/lib/shot-review";
type Row = {
  id: string;
  date: string;
  carry: number | null;
  used: boolean;
  reviewStatus: ShotReviewStatus;
};
export function StockSampleReview({
  label,
  rows,
  clubs,
}: {
  label: string;
  rows: Row[];
  clubs: Array<{ value: string; label: string }>;
}) {
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const router = useRouter();
  const visible = rows.filter(
    (r) =>
      (scope === "all" || (scope === "used" ? r.used : !r.used)) &&
      `${r.date} ${r.id} ${r.carry ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const current = Math.min(page, pages);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11">
          Review stock sample
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl" showCloseButton={false}>
        <SheetHeader className="border-b">
          <SheetTitle>{label} stock sample</SheetTitle>
          <SheetDescription>
            {rows.filter((r) => r.used).length} used from {rows.length} loaded shots. Fixed evidence
            rules choose the sample. Exclude or restore a shot to update the bag; raw measurements
            are preserved.
          </SheetDescription>
        </SheetHeader>
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
          {!visible.length && (
            <p>No matching sample rows. Reset the view to see the loaded sample.</p>
          )}
          <nav aria-label="Stock sample pages" className="flex justify-between gap-3">
            <Button variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </Button>
          </nav>
        </div>
        <div className="border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetClose asChild>
            <Button className="min-h-11 w-full" variant="outline">
              Close sample review
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
