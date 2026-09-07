"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
export function FeedFilterControls({
  activeFilter,
  filters,
  exportHref,
  exportFileName,
  exportItemCount,
  query = "",
  from = "",
  to = "",
}: {
  activeFilter: string;
  filters: Array<{ key: string; label: string }>;
  exportHref: string;
  exportFileName: string;
  exportItemCount: number;
  query?: string;
  from?: string;
  to?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ filter: activeFilter, from, to });
  const ready = useClientReady();
  const count = Number(activeFilter !== "following") + Number(!!from) + Number(!!to);
  return (
    <section className="grid min-w-0 gap-3 rounded-xl border bg-card p-3" aria-label="Feed filters">
      <form className="flex min-w-0 flex-wrap gap-2" action="/feed">
        <input type="hidden" name="filter" value={activeFilter} />
        {from ? <input type="hidden" name="from" value={from} /> : null}
        {to ? <input type="hidden" name="to" value={to} /> : null}
        <Label className="min-w-0 flex-1">
          Search loaded activity
          <Input name="q" defaultValue={query} placeholder="Golfer, update or result" />
        </Label>
        <Button type="submit" disabled={!ready} className="self-end">
          Search
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={!ready}
          onClick={() => {
            setDraft({ filter: activeFilter, from, to });
            setOpen(true);
          }}
        >
          Filters ({count})
        </Button>
        <p className="text-sm">
          {exportItemCount} {exportItemCount === 1 ? "activity" : "activities"} ·{" "}
          {filters.find((f) => f.key === activeFilter)?.label ?? activeFilter}
        </p>
        {from || to ? (
          <p className="text-sm">
            {from || "Earliest loaded"} to {to || "Latest loaded"} · UTC dates
          </p>
        ) : null}
        {count || query ? (
          <Button asChild variant="outline">
            <Link href="/feed">Clear all</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={exportHref} download={exportFileName}>
            Export {exportItemCount} as CSV
          </a>
        </Button>
      </div>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title="Filter clubhouse activity"
        description="Filters apply to the activity already available to your account. Results remain newest first."
      >
        <form action="/feed" className="grid gap-4">
          <input type="hidden" name="q" value={query} />
          <Label>
            Activity scope
            <select
              name="filter"
              className="min-h-11 w-full rounded-lg border bg-background px-3"
              value={draft.filter}
              onChange={(e) => setDraft({ ...draft, filter: e.target.value })}
            >
              {filters.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </Label>
          <Label>
            From (UTC)
            <Input
              type="date"
              name="from"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </Label>
          <Label>
            To (UTC)
            <Input
              type="date"
              name="to"
              min={draft.from || undefined}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft({ filter: "following", from: "", to: "" })}
            >
              Reset
            </Button>
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      </ResponsiveDetailPanel>
    </section>
  );
}
