"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

export type MobileShotFiltersValue = {
  q: string;
  club: string;
  sessionId: string;
  category: string;
  trust: string;
  sort: string;
  dir: string;
  review?: string;
  from?: string;
  to?: string;
  group?: string;
};
type Option = { value: string; label: string };
export function MobileShotFilters({
  filters,
  clubs,
  sessions,
  categories,
}: {
  filters: MobileShotFiltersValue;
  clubs: Option[];
  sessions: Option[];
  categories: Option[];
}) {
  const [open, setOpen] = useState(false);
  const activeCount = [
    filters.club,
    filters.sessionId,
    filters.category,
    filters.review,
    filters.from,
    filters.to,
    filters.trust !== "all" ? filters.trust : "",
  ].filter(Boolean).length;
  const fields = Object.entries(filters).filter(
    ([key, value]) => key !== "q" && key !== "page" && value,
  );
  return (
    <>
      <form
        action="/shots"
        className="mobile-shot-search"
        key={filters.q}
        role="search"
        aria-label="Search measured shots"
      >
        {fields.map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label className="sr-only" htmlFor="mobile-shot-search">
          Search sessions
        </label>
        <input
          id="mobile-shot-search"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Session or course"
          maxLength={120}
        />
        <Button type="submit" variant="ghost" aria-label="Search shots">
          <Search aria-hidden />
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <SlidersHorizontal aria-hidden />
          Filters{activeCount ? ` · ${activeCount}` : ""}
        </Button>
      </form>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="flex-none">
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle>Filter shots</DrawerTitle>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
            <DrawerDescription>Choose the evidence you want to review.</DrawerDescription>
          </DrawerHeader>
          <form action="/shots" className="flex min-h-0 flex-col" key={JSON.stringify(filters)}>
            <input type="hidden" name="q" value={filters.q} />
            {filters.group ? <input type="hidden" name="group" value={filters.group} /> : null}
            <div className="mobile-shot-filter-sheet overflow-y-auto px-4">
              <Filter name="club" label="Club" value={filters.club} options={clubs} />
              <Filter
                name="sessionId"
                label="Session"
                value={filters.sessionId}
                options={sessions}
              />
              <Filter
                name="trust"
                label="Evidence"
                value={filters.trust}
                emptyValue="all"
                options={[
                  { value: "trusted", label: "Trusted" },
                  { value: "untrusted", label: "Untrusted" },
                ]}
              />
              <Filter
                name="category"
                label="Shot type"
                value={filters.category}
                options={categories}
              />
              <Filter
                name="sort"
                label="Sort by"
                value={filters.sort}
                options={[
                  { value: "recent", label: "Date" },
                  { value: "carry", label: "Carry" },
                  { value: "total", label: "Total" },
                  { value: "side", label: "Side" },
                  { value: "ballSpeed", label: "Ball speed" },
                  { value: "clubSpeed", label: "Club speed" },
                  { value: "launch", label: "Launch" },
                  { value: "apex", label: "Apex" },
                  { value: "attack", label: "Attack" },
                  { value: "path", label: "Path" },
                  { value: "face", label: "Face" },
                  { value: "descent", label: "Descent" },
                  { value: "smash", label: "Smash" },
                ]}
                noAll
              />
              <Filter
                name="dir"
                label="Order"
                value={filters.dir}
                options={[
                  { value: "desc", label: "Highest / newest" },
                  { value: "asc", label: "Lowest / oldest" },
                ]}
                noAll
              />
              <Filter
                name="review"
                label="Review state"
                value={filters.review ?? ""}
                options={[
                  { value: "included", label: "Included" },
                  { value: "suggested_exclusion", label: "Suggested exclusions" },
                  { value: "user_excluded", label: "User excluded" },
                  { value: "warm_up", label: "Warm-up" },
                  { value: "calibration", label: "Calibration" },
                  { value: "launch_monitor_error", label: "Sensor anomaly" },
                  { value: "restored", label: "Restored" },
                ]}
              />
              <label>
                From
                <input name="from" type="date" defaultValue={filters.from ?? ""} />
              </label>
              <label>
                To
                <input name="to" type="date" defaultValue={filters.to ?? ""} />
              </label>
            </div>
            <div className="mobile-shot-filter-actions">
              <Button asChild variant="ghost">
                <Link href="/shots">Reset</Link>
              </Button>
              <Button type="submit">Show shots</Button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
function Filter({
  name,
  label,
  value,
  options,
  emptyValue = "",
  noAll = false,
}: {
  name: string;
  label: string;
  value: string;
  options: Option[];
  emptyValue?: string;
  noAll?: boolean;
}) {
  const known = options.some((option) => option.value === value) || value === emptyValue;
  return (
    <label>
      {label}
      <span className="mobile-shot-select-wrap">
        <select name={name} defaultValue={value}>
          {!noAll ? <option value={emptyValue}>All</option> : null}
          {!known && value ? <option value={value}>{value.replaceAll("_", " ")}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </label>
  );
}
