"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronsUpDown,
  ListFilter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

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
};

type FilterOption = { value: string; label: string };

export function ShotFilterToolbar({
  initial,
  clubs,
  sessions,
  categories,
  sortOptions,
  resultLabel,
}: {
  initial: ShotFilterState;
  clubs: FilterOption[];
  sessions: FilterOption[];
  categories: FilterOption[];
  sortOptions: FilterOption[];
  resultLabel: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [clubOpen, setClubOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const setFilter = <Key extends keyof ShotFilterState>(key: Key, value: ShotFilterState[Key]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const activeFilters = buildActiveFilters(filters, clubs, sessions, categories);

  function navigate(next: ShotFilterState) {
    setFilters(next);
    const params = filterParams(next);
    router.push(params.size ? `/shots?${params.toString()}` : "/shots");
  }

  function apply(event?: FormEvent) {
    event?.preventDefault();
    navigate(filters);
    setMoreOpen(false);
  }

  function clearFilters() {
    navigate(emptyFilters());
    setMoreOpen(false);
  }

  function removeFilter(id: string) {
    const next = { ...filters };

    if (id === "date") {
      next.from = "";
      next.to = "";
    } else if (id === "sort") {
      next.sort = "recent";
      next.dir = "desc";
    } else if (id in next) {
      (next as Record<string, string>)[id] = id === "trust" ? "all" : id === "group" ? "none" : "";
    }

    navigate(next);
  }

  return (
    <form
      onSubmit={apply}
      className="sticky top-[4.25rem] z-40 grid min-w-0 gap-2 border-y bg-background/96 py-3 shadow-[0_8px_24px_-24px_hsl(var(--foreground))] backdrop-blur supports-[backdrop-filter]:bg-background/88"
      data-shot-filter-toolbar
    >
      <div className="overflow-x-auto overscroll-x-contain pb-1">
        <div
          className="flex min-w-max items-center gap-2 px-0.5"
          role="toolbar"
          aria-label="Shot filters"
        >
          <InputGroup className="h-9 w-64 shrink-0 bg-card">
            <InputGroupAddon>
              <Search className="size-4" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={filters.q}
              onChange={(event) => setFilter("q", event.target.value)}
              placeholder="Search source or course"
              aria-label="Search shots"
            />
            {filters.q ? (
              <InputGroupAddon align="inline-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear search"
                  onClick={() => setFilter("q", "")}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </InputGroupAddon>
            ) : null}
          </InputGroup>

          <ClubCombobox
            open={clubOpen}
            onOpenChange={setClubOpen}
            value={filters.club}
            options={clubs}
            onChange={(value) => setFilter("club", value)}
          />

          <FilterSelect
            label="Session"
            value={filters.sessionId || "__all"}
            onValueChange={(value) => setFilter("sessionId", value === "__all" ? "" : value)}
            options={sessions}
            allLabel="All sessions"
            className="w-44"
          />

          <FilterSelect
            label="Shot type"
            value={filters.category || "__all"}
            onValueChange={(value) => setFilter("category", value === "__all" ? "" : value)}
            options={categories}
            allLabel="All shot types"
            className="w-36"
          />

          <DateRangePopover
            from={filters.from}
            to={filters.to}
            onFromChange={(value) => setFilter("from", value)}
            onToChange={(value) => setFilter("to", value)}
          />

          <Select
            value={filters.trust}
            onValueChange={(value) => setFilter("trust", value as ShotFilterState["trust"])}
          >
            <SelectTrigger className="h-9 w-40 shrink-0 bg-card" aria-label="Evidence status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All evidence</SelectItem>
              <SelectItem value="trusted">Trusted</SelectItem>
              <SelectItem value="untrusted">Untrusted</SelectItem>
            </SelectContent>
          </Select>

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 bg-card">
                <SlidersHorizontal className="size-4" aria-hidden />
                More filters
                {filters.group !== "none" || filters.sort !== "recent" ? (
                  <Badge variant="secondary" className="ml-0.5 px-1.5">
                    {[filters.group !== "none", filters.sort !== "recent"].filter(Boolean).length}
                  </Badge>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md">
              <SheetHeader className="border-b pr-12">
                <SheetTitle>More shot filters</SheetTitle>
                <SheetDescription>
                  Control grouping and default order without crowding the evidence table.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 overflow-y-auto px-4">
                <Field>
                  <FieldLabel>Group rows</FieldLabel>
                  <Select
                    value={filters.group}
                    onValueChange={(value) => setFilter("group", value as ShotFilterState["group"])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No grouping</SelectItem>
                      <SelectItem value="club">Club</SelectItem>
                      <SelectItem value="session">Session</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Default sort</FieldLabel>
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
                  <FieldLabel>Sort direction</FieldLabel>
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
              <SheetFooter className="border-t sm:flex-row">
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  Clear all
                </Button>
                <Button type="button" className="sm:ml-auto" onClick={() => apply()}>
                  Apply filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Button type="submit" size="sm" className="h-9 shrink-0 px-4">
            <ListFilter className="size-4" aria-hidden />
            Apply
          </Button>

          <span className="px-1 text-xs font-medium text-muted-foreground">{resultLabel}</span>
        </div>
      </div>

      {activeFilters.length > 0 ? (
        <div className="flex min-h-7 flex-wrap items-center gap-1.5" aria-label="Active filters">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Active
          </span>
          {activeFilters.map((filter) => (
            <Badge key={filter.id} variant="secondary" className="gap-1 rounded-md pl-2.5 pr-1">
              {filter.label}
              <button
                type="button"
                className="focus-aaa rounded-sm p-0.5 outline-none"
                onClick={() => removeFilter(filter.id)}
                aria-label={`Remove ${filter.label} filter`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function ClubCombobox({
  open,
  onOpenChange,
  value,
  options,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const label = options.find((item) => item.value === value)?.label ?? "All clubs";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Club filter"
          className="h-9 w-36 shrink-0 justify-between bg-card font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find a club…" />
          <CommandList>
            <CommandEmpty>No club found.</CommandEmpty>
            <CommandGroup heading="Club">
              <CommandItem
                value="All clubs"
                data-checked={!value}
                onSelect={() => {
                  onChange("");
                  onOpenChange(false);
                }}
              >
                All clubs
              </CommandItem>
              {options.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.value}`}
                  data-checked={value === item.value}
                  onSelect={() => {
                    onChange(item.value);
                    onOpenChange(false);
                  }}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  allLabel,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-9 shrink-0 bg-card", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">{allLabel}</SelectItem>
        {options.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DateRangePopover({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const label = from || to ? [from || "Any", to || "Today"].join(" – ") : "Any date";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-40 shrink-0 justify-start bg-card font-normal"
          aria-label="Date filter"
        >
          <CalendarDays className="size-4" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="grid gap-4">
          <div>
            <p className="font-semibold">Shot date</p>
            <p className="text-xs text-muted-foreground">
              Use either edge or set a complete range.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>From</FieldLabel>
              <Input
                type="date"
                value={from}
                onChange={(event) => onFromChange(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>To</FieldLabel>
              <Input type="date" value={to} onChange={(event) => onToChange(event.target.value)} />
            </Field>
          </div>
          {from || to ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                onFromChange("");
                onToChange("");
              }}
            >
              <X className="size-4" aria-hidden />
              Clear dates
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function buildActiveFilters(
  filters: ShotFilterState,
  clubs: FilterOption[],
  sessions: FilterOption[],
  categories: FilterOption[],
) {
  return [
    filters.q ? { id: "q", label: `Search: ${filters.q}` } : null,
    filters.club
      ? {
          id: "club",
          label: clubs.find((item) => item.value === filters.club)?.label ?? filters.club,
        }
      : null,
    filters.sessionId
      ? {
          id: "sessionId",
          label: sessions.find((item) => item.value === filters.sessionId)?.label ?? "Session",
        }
      : null,
    filters.category
      ? {
          id: "category",
          label:
            categories.find((item) => item.value === filters.category)?.label ?? filters.category,
        }
      : null,
    filters.from || filters.to
      ? { id: "date", label: `${filters.from || "Any"} – ${filters.to || "Today"}` }
      : null,
    filters.trust !== "all"
      ? { id: "trust", label: filters.trust === "trusted" ? "Trusted" : "Untrusted" }
      : null,
    filters.group !== "none" ? { id: "group", label: `Group: ${filters.group}` } : null,
    filters.sort !== "recent" ? { id: "sort", label: `Sort: ${filters.sort}` } : null,
  ].filter((item): item is { id: string; label: string } => item !== null);
}

function emptyFilters(): ShotFilterState {
  return {
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
  };
}

function filterParams(filters: ShotFilterState) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q.trim().slice(0, 120));
  if (filters.club) params.set("club", filters.club);
  if (filters.sessionId) params.set("sessionId", filters.sessionId);
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.trust !== "all") params.set("trust", filters.trust);
  if (filters.group !== "none") params.set("group", filters.group);
  if (filters.sort !== "recent") {
    params.set("sort", filters.sort);
    if (filters.dir !== "desc") params.set("dir", filters.dir);
  }

  return params;
}
