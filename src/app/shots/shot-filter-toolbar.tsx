"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, X } from "lucide-react";

import { DataToolbar } from "@/components/app/data-toolbar";
import { ResponsiveFilterPanel } from "@/components/app/responsive-filter-panel";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ShotFilterState = {
  q: string;
  club: string;
  sessionId: string;
  category: string;
  from: string;
  to: string;
  sort: string;
  dir: "asc" | "desc";
  group: "none" | "club" | "session";
};

export function ShotFilterToolbar({
  initial,
  clubs,
  sessions,
  categories,
  sortOptions,
  resultLabel,
}: {
  initial: ShotFilterState;
  clubs: Array<{ value: string; label: string }>;
  sessions: Array<{ value: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
  sortOptions: Array<{ value: string; label: string }>;
  resultLabel: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [filterOpen, setFilterOpen] = useState(false);

  const setFilter = <Key extends keyof ShotFilterState>(key: Key, value: ShotFilterState[Key]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () =>
    setFilters({
      q: "",
      club: "",
      sessionId: "",
      category: "",
      from: "",
      to: "",
      sort: "recent",
      dir: "desc",
      group: "none",
    });
  const activeFilters = [
    filters.club
      ? {
          id: "club",
          label: clubs.find((item) => item.value === filters.club)?.label ?? filters.club,
          onRemove: () => setFilter("club", ""),
        }
      : null,
    filters.sessionId
      ? {
          id: "session",
          label: sessions.find((item) => item.value === filters.sessionId)?.label ?? "Session",
          onRemove: () => setFilter("sessionId", ""),
        }
      : null,
    filters.category
      ? {
          id: "category",
          label:
            categories.find((item) => item.value === filters.category)?.label ?? filters.category,
          onRemove: () => setFilter("category", ""),
        }
      : null,
    filters.from
      ? { id: "from", label: `From ${filters.from}`, onRemove: () => setFilter("from", "") }
      : null,
    filters.to
      ? { id: "to", label: `To ${filters.to}`, onRemove: () => setFilter("to", "") }
      : null,
    filters.group !== "none"
      ? {
          id: "group",
          label: `Grouped by ${filters.group}`,
          onRemove: () => setFilter("group", "none"),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  function apply() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (
        value &&
        !(key === "sort" && value === "recent") &&
        !(key === "dir" && value === "desc") &&
        !(key === "group" && value === "none")
      ) {
        params.set(key, value);
      }
    });
    router.push(params.size ? `/shots?${params.toString()}` : "/shots");
    setFilterOpen(false);
  }

  return (
    <DataToolbar
      query={filters.q}
      onQueryChange={(value) => setFilter("q", value)}
      searchLabel="Search file or course"
      resultLabel={resultLabel}
      activeFilters={activeFilters}
      onClearFilters={clearFilters}
      filters={
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Select
            value={filters.club || "__all"}
            onValueChange={(value) => setFilter("club", value === "__all" ? "" : value)}
          >
            <SelectTrigger className="w-44" aria-label="Club filter">
              <SelectValue placeholder="All clubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All clubs</SelectItem>
              {clubs.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.group}
            onValueChange={(value) => setFilter("group", value as ShotFilterState["group"])}
          >
            <SelectTrigger className="w-44" aria-label="Group shots by">
              <SelectValue placeholder="No grouping" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="club">Group by club</SelectItem>
              <SelectItem value="session">Group by session</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.sessionId || "__all"}
            onValueChange={(value) => setFilter("sessionId", value === "__all" ? "" : value)}
          >
            <SelectTrigger className="w-52" aria-label="Session filter">
              <SelectValue placeholder="All sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All sessions</SelectItem>
              {sessions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ResponsiveFilterPanel
            open={filterOpen}
            onOpenChange={setFilterOpen}
            activeCount={activeFilters.length}
            onClear={clearFilters}
            title="Shot filters"
            description="Narrow the archive by category, date and sort order."
            applyAction={
              <Button type="button" onClick={apply}>
                Apply filters
              </Button>
            }
          >
            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select
                value={filters.category || "__all"}
                onValueChange={(value) => setFilter("category", value === "__all" ? "" : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All categories</SelectItem>
                  {categories.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateControl
                label="From"
                value={filters.from}
                onChange={(value) => setFilter("from", value)}
              />
              <DateControl
                label="To"
                value={filters.to}
                onChange={(value) => setFilter("to", value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Sort by</FieldLabel>
                <Select value={filters.sort} onValueChange={(value) => setFilter("sort", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Order</FieldLabel>
                <Select
                  value={filters.dir}
                  onValueChange={(value) => setFilter("dir", value as "asc" | "desc")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">High to low</SelectItem>
                    <SelectItem value="asc">Low to high</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </ResponsiveFilterPanel>
        </div>
      }
      actions={
        <>
          <Button type="button" onClick={apply}>
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearFilters();
              router.push("/shots");
            }}
          >
            Reset
          </Button>
        </>
      }
    />
  );
}

function DateControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = parseIsoDate(value);
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start font-normal">
            <CalendarDays className="size-4" aria-hidden />
            {selected
              ? selected.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Any date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onChange(date ? toIsoDate(date) : "")}
            captionLayout="dropdown"
          />
          {selected ? (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => onChange("")}
              >
                <X className="size-4" aria-hidden />
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
