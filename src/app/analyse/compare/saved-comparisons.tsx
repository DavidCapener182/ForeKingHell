"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { DeleteComparisonButton } from "./delete-comparison-button";
export function SavedComparisons({
  rows,
}: {
  rows: Array<{
    id: string;
    name: string;
    date: string;
    summary: string;
    notes: string;
    href: string;
  }>;
}) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((row) =>
    `${row.name} ${row.summary} ${row.notes}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Saved comparisons ({rows.length})</Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Saved comparisons</SheetTitle>
          <SheetDescription>
            Search the latest {rows.length} saved comparisons (up to 12). Saved notes stay
            unchanged; reopening filters uses current source records.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <Input
            aria-label="Search saved comparisons"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto px-4">
          {filtered.map((row) => (
            <li key={row.id} className="grid gap-2 py-4">
              <h3 className="break-words font-semibold">{row.name}</h3>
              <p className="text-xs text-muted-foreground">{row.date}</p>
              <p className="text-sm">{row.summary}</p>
              {row.notes && <p className="whitespace-pre-wrap break-words text-sm">{row.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={row.href}>Reopen filters</Link>
                </Button>
                <DeleteComparisonButton id={row.id} name={row.name} />
              </div>
            </li>
          ))}
          {!filtered.length && (
            <li className="py-5 text-sm">
              {rows.length ? "No matching saved comparison." : "No saved comparison yet."}
            </li>
          )}
        </ul>
        <SheetClose asChild>
          <Button variant="outline" className="m-4 min-h-11">
            Close saved comparisons
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
