"use client";

import styles from "./shot-explorer.module.css";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UntitledSelect, UntitledTextField } from "@/components/untitled-ui/form-controls";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

export type ShotFilterState = {
  q: string;
  club: string;
  sessionId: string;
  category: string;
  from: string;
  to: string;
  trust: "all" | "trusted" | "untrusted";
  sort: string;
  dir: "asc" | "desc";
  group: "none" | "club" | "session";
  review?: string;
  shotId?: string;
};
type Option = { value: string; label: string };
const defaults: ShotFilterState = {
  q: "",
  club: "",
  sessionId: "",
  category: "",
  from: "",
  to: "",
  trust: "all",
  sort: "recent",
  dir: "desc",
  group: "none",
  review: "",
  shotId: "",
};
export const shotFilterSortOptions = [
  ["recent", "Date"],
  ["shot", "Shot number"],
  ["carry", "Carry"],
  ["total", "Total"],
  ["side", "Side"],
  ["ballSpeed", "Ball speed"],
  ["clubSpeed", "Club speed"],
  ["launch", "Launch"],
  ["launchDirection", "Launch direction"],
  ["apex", "Apex"],
  ["attack", "Attack"],
  ["path", "Path"],
  ["face", "Face angle"],
  ["descent", "Descent"],
  ["smash", "Smash"],
].map(([value, label]) => ({ value, label }));
const reviews = [
  "included",
  "suggested_exclusion",
  "user_excluded",
  "warm_up",
  "calibration",
  "launch_monitor_error",
  "restored",
].map((value) => ({ value, label: value.replaceAll("_", " ") }));

export function ShotFilterToolbar({
  initial,
  clubs,
  sessions,
  categories,
  sortOptions = shotFilterSortOptions,
  resultLabel,
}: {
  initial: ShotFilterState;
  clubs: Option[];
  sessions: Option[];
  categories: Option[];
  sortOptions?: Option[];
  resultLabel: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [sheetDraft, setSheetDraft] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const active = Object.entries(initial).filter(
    ([key, value]) => value && value !== defaults[key as keyof ShotFilterState],
  );
  function navigate(next: ShotFilterState) {
    const params = new URLSearchParams(window.location.search);
    Object.keys(defaults).forEach((key) => params.delete(key));
    params.delete("page");
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== defaults[key as keyof ShotFilterState])
        params.set(key, key === "q" ? value.trim().slice(0, 120) : value);
    });
    setDraft(next);
    setOpen(false);
    startTransition(() =>
      router.push(`/shots${params.size ? `?${params}` : ""}`, { scroll: false }),
    );
  }
  function fields(
    value: ShotFilterState,
    change: (next: ShotFilterState) => void,
    advanced: boolean,
  ) {
    const select = (key: keyof ShotFilterState, label: string, options: Option[], all?: string) => (
      <UntitledSelect
        key={key}
        label={label}
        name={`shot-${key}`}
        value={value[key] || "__all"}
        onValueChange={(v) => change({ ...value, [key]: v === "__all" ? "" : v })}
        options={[...(all ? [{ value: "__all", label: all }] : []), ...options]}
      />
    );
    return (
      <>
        {select("club", "Club", clubs, "All clubs")}
        {select("sessionId", "Session", sessions, "All sessions")}
        {select("trust", "Evidence", [
          { value: "all", label: "All evidence" },
          { value: "trusted", label: "Trusted" },
          { value: "untrusted", label: "Untrusted" },
        ])}
        {advanced && (
          <>
            {select("category", "Shot type", categories, "All shot types")}
            {select("review", "Review state", reviews, "All review states")}
            {select("sort", "Sort by", sortOptions)}
            {select("dir", "Order", [
              { value: "desc", label: "Highest / newest first" },
              { value: "asc", label: "Lowest / oldest first" },
            ])}
            {select("group", "Group rows", [
              { value: "none", label: "No grouping" },
              { value: "club", label: "Club" },
              { value: "session", label: "Session" },
            ])}
            <label className="grid gap-2 text-sm font-medium">
              From
              <Input
                className="min-h-11"
                type="date"
                value={value.from}
                max={value.to || undefined}
                onChange={(e) => change({ ...value, from: e.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              To
              <Input
                className="min-h-11"
                type="date"
                value={value.to}
                min={value.from || undefined}
                onChange={(e) => change({ ...value, to: e.target.value })}
              />
            </label>
          </>
        )}
      </>
    );
  }
  function label(key: string, value: string) {
    const options =
      key === "club"
        ? clubs
        : key === "sessionId"
          ? sessions
          : key === "category"
            ? categories
            : key === "sort"
              ? sortOptions
              : [];
    return `${({ q: "Search", sessionId: "Session", shotId: "Exact shot", dir: "Order" } as Record<string, string>)[key] ?? key}: ${options.find((o) => o.value === value)?.label ?? value.replaceAll("_", " ")}`;
  }
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border bg-card p-3"
      data-shot-filter-toolbar
      aria-busy={pending}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(draft);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <UntitledTextField
          className="min-w-0 flex-1 basis-48"
          label="Search shots"
          name="shot-q"
          type="search"
          value={draft.q}
          onValueChange={(q) => setDraft({ ...draft, q })}
          placeholder="Source file or course"
        />
        <div className={styles.quickFilters}>
          {fields(draft, setDraft, false)}
        </div>
        <Button className="min-h-11" type="submit" disabled={pending}>
          {pending ? "Applying…" : "Search / apply"}
        </Button>
        <Sheet
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) setSheetDraft(draft);
          }}
        >
          <SheetTrigger asChild>
            <Button type="button" className="min-h-11" variant="outline">
              Filters{active.length ? ` · ${active.length}` : ""}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader className="border-b pr-12">
              <SheetTitle>Filter shots</SheetTitle>
              <SheetDescription>
                Apply a complete evidence scope. Sorting covers every matching shot.
              </SheetDescription>
            </SheetHeader>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(sheetDraft);
              }}
            >
              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                {fields(sheetDraft, setSheetDraft, true)}
              </div>
              <div className="flex flex-wrap gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="button" variant="ghost" onClick={() => setSheetDraft(defaults)}>
                  Reset
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  Apply filters
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium" role="status">
          {pending ? "Updating results…" : resultLabel}
        </p>
        {active.length > 0 && (
          <Button variant="ghost" className="min-h-11" onClick={() => navigate(defaults)}>
            Clear all
          </Button>
        )}
      </div>
      {active.length > 0 && (
        <div aria-label="Active filters" className="flex flex-wrap gap-2">
          {active.map(([key, value]) => (
            <Button
              key={key}
              variant="outline"
              className="h-auto min-h-11 max-w-full whitespace-normal break-words text-left"
              onClick={() =>
                navigate({ ...initial, [key]: defaults[key as keyof ShotFilterState] })
              }
              aria-label={`Remove ${label(key, value)}`}
            >
              {label(key, value)} ×
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
