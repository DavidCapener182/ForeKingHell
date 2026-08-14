"use client";

import Link from "next/link";
import { Check, Download, MoreHorizontal } from "lucide-react";

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
  const activeLabel = filters.find((filter) => filter.key === activeFilter)?.label ?? "Following";

  return (
    <Card
      id="feed-filters"
      role="region"
      aria-label="Feed filters"
      className="scroll-mt-28 flex-row items-center gap-2 overflow-x-auto p-2 py-2 shadow-none"
      data-feed-filter-controls
    >
      <ButtonGroup aria-label="Clubhouse feed filters" data-feed-filter-buttons>
        {filters.map((filter) => {
          const active = filter.key === activeFilter;

          return (
            <Button key={filter.key} asChild size="sm" variant={active ? "secondary" : "ghost"}>
              <Link
                href={filter.key === "following" ? "/feed" : `/feed?filter=${filter.key}`}
                prefetch={false}
                aria-current={active ? "page" : undefined}
              >
                {active ? <Check className="size-3.5" aria-hidden /> : null}
                {filter.label}
              </Link>
            </Button>
          );
        })}
      </ButtonGroup>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0">
            <MoreHorizontal className="size-4" />
            More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{activeLabel} activity</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a
              href={exportHref}
              download={exportFileName}
              aria-label={`Export ${exportItemCount} ${activeLabel.toLowerCase()} ${exportItemCount === 1 ? "activity" : "activities"} as CSV`}
              data-feed-export-current-view
            >
              <Download className="size-4" aria-hidden />
              Export CSV
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
