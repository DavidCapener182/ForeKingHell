"use client";

import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export function DataToolbar({
  query,
  onQueryChange,
  searchLabel = "Search",
  resultLabel,
  filters,
  activeFilters = [],
  onClearFilters,
  actions,
  className,
}: {
  query?: string;
  onQueryChange?: (value: string) => void;
  searchLabel?: string;
  resultLabel?: React.ReactNode;
  filters?: React.ReactNode;
  activeFilters?: { id: string; label: string; onRemove?: () => void }[];
  onClearFilters?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("grid gap-2 rounded-xl border bg-card p-3", className)}
      data-data-toolbar
    >
      <div className="flex flex-wrap items-center gap-2">
        {typeof query === "string" && onQueryChange ? (
          <InputGroup className="h-10 min-w-52 flex-1 sm:max-w-md">
            <InputGroupAddon>
              <Search className="size-4" aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
            />
            {query ? (
              <InputGroupAddon align="inline-end">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onQueryChange("")}
                >
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Clear search</span>
                </Button>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        ) : null}
        {filters}
        {resultLabel ? <p className="text-xs text-muted-foreground">{resultLabel}</p> : null}
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      {activeFilters.length ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {activeFilters.map((filter) => (
            <Badge key={filter.id} variant="secondary" className="gap-1">
              {filter.label}
              {filter.onRemove ? (
                <button
                  type="button"
                  onClick={filter.onRemove}
                  className="focus-aaa rounded-sm outline-none"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              ) : null}
            </Badge>
          ))}
          {onClearFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
