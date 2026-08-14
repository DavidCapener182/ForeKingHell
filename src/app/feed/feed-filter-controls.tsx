"use client";

import Link from "next/link";
import { Download, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FeedFilterControl = { key: string; label: string };

export function FeedFilterControls({
  activeFilter,
  filters,
  exportHref,
  exportFileName,
  exportItemCount,
}: {
  activeFilter: string;
  filters: FeedFilterControl[];
  exportHref: string;
  exportFileName: string;
  exportItemCount: number;
}) {
  const primaryValue = activeFilter === "friends" || activeFilter === "pbs" ? activeFilter : "all";
  const activeLabel = filters.find((filter) => filter.key === activeFilter)?.label ?? "All";

  return (
    <Card
      id="feed-filters"
      role="region"
      aria-label="Feed filters"
      className="scroll-mt-28 flex-row flex-wrap items-center justify-between gap-2 p-3 py-3"
      data-feed-filter-controls
    >
      <ButtonGroup aria-label="Primary feed filters" data-feed-filter-buttons>
        {filters.slice(0, 3).map((filter) => {
          const active = filter.key === primaryValue;

          return (
            <Button key={filter.key} asChild size="sm" variant={active ? "secondary" : "outline"}>
              <Link
                href={filter.key === "all" ? "/feed" : `/feed?filter=${filter.key}`}
                prefetch={false}
                aria-current={active ? "page" : undefined}
              >
                {filter.label}
              </Link>
            </Button>
          );
        })}
      </ButtonGroup>
      <div className="flex flex-wrap items-center gap-2" data-feed-view-actions>
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
        <Button asChild variant="outline" size="sm">
          <a
            href={exportHref}
            download={exportFileName}
            aria-label={`Export ${exportItemCount} ${activeLabel.toLowerCase()} feed ${exportItemCount === 1 ? "update" : "updates"} as CSV`}
            data-feed-export-current-view
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        </Button>
      </div>
    </Card>
  );
}
