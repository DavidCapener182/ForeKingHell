"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import type { ShotReviewStatus } from "@/lib/shot-review";
export type Row = {
  id: string;
  date: string;
  carry: number | null;
  used: boolean;
  reviewStatus: ShotReviewStatus;
};
const StockSampleReviewBody = dynamic(
  () => import("./stock-sample-review-body").then((module) => module.StockSampleReviewBody),
  {
    loading: () => (
      <p role="status" className="p-4">
        Loading stock sample…
      </p>
    ),
  },
);
export function StockSampleReview({
  label,
  rows,
  clubs,
}: {
  label: string;
  rows: Row[];
  clubs: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  // Keep the view state in the persistent trigger shell when the drawer closes.
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
        {open ? (
          <StockSampleReviewBody
            label={label}
            rows={rows}
            clubs={clubs}
            scope={scope}
            setScope={setScope}
            search={search}
            setSearch={setSearch}
            page={page}
            setPage={setPage}
          />
        ) : null}
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
