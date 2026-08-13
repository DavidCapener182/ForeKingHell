"use client";

import Link from "next/link";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FeedFilterControl = { key: string; label: string };

export function FeedFilterControls({
  activeFilter,
  filters,
}: {
  activeFilter: string;
  filters: FeedFilterControl[];
}) {
  const primaryValue = activeFilter === "friends" || activeFilter === "pbs" ? activeFilter : "all";
  const activeLabel = filters.find((filter) => filter.key === activeFilter)?.label ?? "All";

  return (
    <section
      id="feed-filters"
      className="scroll-mt-28 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3"
      data-feed-filter-controls
    >
      <Tabs value={primaryValue} data-feed-filter-tabs>
        <TabsList variant="line">
          {filters.slice(0, 3).map((filter) => (
            <TabsTrigger key={filter.key} value={filter.key} asChild>
              <Link
                href={filter.key === "all" ? "/feed" : `/feed?filter=${filter.key}`}
                prefetch={false}
              >
                {filter.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Filter className="size-4" />
            {activeLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>More feed filters</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {filters.slice(3).map((filter) => (
            <DropdownMenuItem key={filter.key} asChild>
              <Link
                href={`/feed?filter=${filter.key}`}
                prefetch={false}
                aria-current={filter.key === activeFilter ? "page" : undefined}
              >
                {filter.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}
