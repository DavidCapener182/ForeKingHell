"use client";
import { useState } from "react";
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
import {
  DEFAULT_SESSION_HISTORY_FILTERS,
  type SessionHistoryFilters,
  type SessionHistoryFilterPatch,
} from "@/lib/session-history-search-params";
import type { SessionTimelineItem } from "./session-timeline";
import { formatClubType } from "@/lib/club-format";

export function HistoryToolbar({
  sessions,
  filters,
  count,
  onChange,
  onClear,
}: {
  sessions: SessionTimelineItem[];
  filters: SessionHistoryFilters;
  count: number;
  onChange: (patch: SessionHistoryFilterPatch) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const active = [
    filters.type !== "all" ? filters.type : null,
    filters.source !== "all" ? filters.source : null,
    filters.club !== "all" ? formatClubType(filters.club) : null,
    filters.date !== "all"
      ? { today: "Today", week: "This week", earlier: "Earlier" }[filters.date]
      : null,
    filters.search ? `Search: ${filters.search}` : null,
  ].filter(Boolean);
  const fields = (
    value: SessionHistoryFilters,
    change: (patch: SessionHistoryFilterPatch) => void,
  ) => (
    <>
      <UntitledSelect
        label="Session type"
        name="historyType"
        value={value.type}
        onValueChange={(type) => change({ type: type as SessionHistoryFilters["type"] })}
        options={[
          { value: "all", label: "All types" },
          { value: "practice", label: "Practice & simulator" },
          { value: "round", label: "Rounds" },
        ]}
      />
      <UntitledSelect
        label="Source"
        name="historySource"
        value={value.source}
        onValueChange={(source) => change({ source })}
        options={[
          { value: "all", label: "All sources" },
          ...[...new Set(sessions.map((s) => s.sourceLabel))]
            .sort()
            .map((source) => ({ value: source, label: source })),
        ]}
      />
      <UntitledSelect
        label="Club"
        name="historyClub"
        value={value.club}
        onValueChange={(club) => change({ club })}
        options={[
          { value: "all", label: "All clubs" },
          ...[...new Set(sessions.flatMap((s) => s.clubs))]
            .sort()
            .map((club) => ({ value: club, label: formatClubType(club) })),
        ]}
      />
      <UntitledSelect
        label="Period"
        name="historyPeriod"
        value={value.date}
        onValueChange={(date) => change({ date: date as SessionHistoryFilters["date"] })}
        options={[
          { value: "all", label: "Any date" },
          { value: "today", label: "Today" },
          { value: "week", label: "This week" },
          { value: "earlier", label: "Earlier" },
        ]}
      />
    </>
  );
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border bg-card p-3"
      aria-label="Filter session history"
      data-session-toolbar
    >
      <div className="grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <UntitledTextField
          label="Search history"
          name="historySearch"
          type="search"
          placeholder="Session, source or club"
          value={filters.search ?? ""}
          onValueChange={(search) => onChange({ search })}
        />
        <p role="status" className="py-3 text-sm tabular-nums text-muted-foreground">
          {count} of {sessions.length} loaded sessions
        </p>
      </div>
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">{fields(filters, onChange)}</div>
      <div className="lg:hidden">
        <Sheet
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (value) setDraft(filters);
          }}
        >
          <SheetTrigger asChild>
            <Button variant="outline" className="min-h-11 w-full">
              Filters{active.length ? ` · ${active.length} active` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[90dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
            showCloseButton={false}
          >
            <SheetHeader>
              <SheetTitle>Filter history</SheetTitle>
              <SheetDescription>
                Choose a type, source, club and period. Apply keeps them in the page address.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-3 px-4">
              {fields(draft, (patch) => setDraft({ ...draft, ...patch }))}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setDraft({ ...DEFAULT_SESSION_HISTORY_FILTERS, search: filters.search })
                  }
                >
                  Reset
                </Button>
                <Button
                  onClick={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                >
                  Apply filters
                </Button>
              </div>
              <SheetClose asChild>
                <Button variant="ghost" className="min-h-11">
                  Cancel
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      {active.length || filters.sessionId ? (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((label) => (
            <span key={label} className="break-words rounded-md bg-muted px-2 py-1 text-xs">
              {label}
            </span>
          ))}
          <Button variant="ghost" className="min-h-11" onClick={onClear}>
            Clear all
          </Button>
        </div>
      ) : null}
    </section>
  );
}
