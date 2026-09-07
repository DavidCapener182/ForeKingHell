"use client";

import { ShotFilterToolbar, type ShotFilterState } from "./shot-filter-toolbar";
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
  shotId?: string;
};
type Option = { value: string; label: string };
/** Compatibility entry point; desktop and phone now share every query key. */
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
  return (
    <ShotFilterToolbar
      key={JSON.stringify(filters)}
      initial={{
        ...filters,
        from: filters.from ?? "",
        to: filters.to ?? "",
        trust: filters.trust as ShotFilterState["trust"],
        dir: filters.dir as ShotFilterState["dir"],
        group: (filters.group ?? "none") as ShotFilterState["group"],
      }}
      clubs={clubs}
      sessions={sessions}
      categories={categories}
      resultLabel="Filter measured shots"
    />
  );
}
