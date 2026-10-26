"use client";

import Link from "next/link";
import { FileText, Gauge, MoreHorizontal, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CoachToolsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="size-4" />
          Coach tools
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/coach/workspace" prefetch={false}>
            <UsersRound className="size-4" />
            Players
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/coach/reports" prefetch={false}>
            <FileText className="size-4" />
            Reports
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/speed" prefetch={false}>
            <Gauge className="size-4" />
            Driver Speed Development
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
