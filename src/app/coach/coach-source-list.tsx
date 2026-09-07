"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
type Row = {
  id: string;
  name: string | null;
  course: string | null;
  date: string;
  source: string;
  type: string;
};
export function CoachSourceList({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  if (!rows.length)
    return (
      <p>
        No source sessions match this filter. Choose another source or import a measured session.
      </p>
    );
  return (
    <>
      <ul className="divide-y rounded-lg border">
        {rows.map((row) => (
          <li key={row.id}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(row)}
              className="h-auto min-h-14 w-full justify-start whitespace-normal p-4 text-left"
            >
              <span className="grid min-w-0 gap-1">
                <span>{row.course ?? row.name ?? "Saved session"}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {new Date(row.date).toLocaleDateString("en-GB")} · {row.source} ·{" "}
                  {row.type.replaceAll("_", " ")}
                </span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected?.course ?? selected?.name ?? "Source session"}</SheetTitle>
            <SheetDescription>
              Inspect the saved source without losing the coaching context.
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="grid min-h-0 gap-4 overflow-y-auto p-4">
              <dl className="grid gap-2 break-words">
                <dt>Date</dt>
                <dd>{new Date(selected.date).toLocaleString("en-GB")}</dd>
                <dt>Source</dt>
                <dd>{selected.source}</dd>
                <dt>Session type</dt>
                <dd>{selected.type.replaceAll("_", " ")}</dd>
                <dt>Original file</dt>
                <dd>{selected.name ?? "Not recorded"}</dd>
                <dt>Record ID</dt>
                <dd>{selected.id}</dd>
              </dl>
              <Button asChild>
                <Link
                  href={
                    selected.type === "real_round"
                      ? `/rounds/${selected.id}`
                      : `/sessions/${selected.id}`
                  }
                >
                  Open full session evidence
                </Link>
              </Button>
            </div>
          ) : null}
          <SheetClose asChild>
            <Button variant="outline" className="mx-4 mb-4 mt-auto min-h-11">
              Close source
            </Button>
          </SheetClose>
        </SheetContent>
      </Sheet>
    </>
  );
}
