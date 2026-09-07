"use client";
import styles from "./strokes-gained.module.css";
import { useState, useSyncExternalStore, type ReactNode } from "react";
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

export function StrokesGainedFilters({ children, count }: { children: ReactNode; count: number }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" disabled={!ready}>
          Filters ({count})
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Strokes gained filters</SheetTitle>
          <SheetDescription>All summaries, charts and event rows use this scope.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        <SheetClose asChild>
          <Button variant="outline" className="m-4 min-h-11">
            Cancel filters
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
export type EventEvidenceRow = {
  id: string;
  title: string;
  summary: string;
  href: string;
  fields: Array<{ label: string; value: string }>;
};
export function StrokesGainedMobileEvents({ rows }: { rows: EventEvidenceRow[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EventEvidenceRow | null>(null);
  const visible = rows.filter((row) =>
    `${row.title} ${row.summary} ${row.fields.map((field) => field.value).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className={styles.mobile}>
      <Input
        aria-label="Search event evidence"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search round, hole or category…"
      />
      <p role="status" className="text-sm text-muted-foreground">
        {visible.length} matching loaded events
      </p>
      <div className="divide-y rounded-xl border">
        {visible.map((row) => (
          <Button
            key={row.id}
            type="button"
            variant="ghost"
            className="h-auto min-h-16 w-full flex-col items-start whitespace-normal rounded-none p-4 text-left"
            onClick={() => setSelected(row)}
          >
            <span className="font-semibold">{row.title}</span>
            <span className="text-sm font-normal text-muted-foreground">{row.summary}</span>
          </Button>
        ))}
        {!visible.length && (
          <p className="p-4 text-sm">No matching event. Change the search or filters.</p>
        )}
      </div>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected?.title ?? "Event evidence"}</SheetTitle>
            <SheetDescription>
              Recorded contribution and complete calculation inputs. Expected strokes use the
              current built-in baseline; a historical baseline version is not stored with this row.
            </SheetDescription>
          </SheetHeader>
          <dl className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
            {selected?.fields.map((field) => (
              <div key={field.label}>
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="break-words text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-2 border-t p-4">
            <Button asChild>
              <a href={selected?.href}>Open source round</a>
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Close event</Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
