"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, MoreHorizontal, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function AdminChallengeActions({
  challenge,
}: {
  challenge: {
    id: string;
    title: string;
    templateName: string;
    status: string;
    visibility: string;
    owner: string;
    participation: string;
    endsLabel: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${challenge.title}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Challenge actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Search className="size-4" /> Inspect board
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/challenges/${challenge.id}`}>
              <ExternalLink className="size-4" /> Open participant view
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{challenge.title}</SheetTitle>
            <SheetDescription>{challenge.templateName}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{titleCase(challenge.status)}</Badge>
              <Badge variant="outline">{titleCase(challenge.visibility)}</Badge>
            </div>
            <Detail label="Owner" value={challenge.owner} />
            <Detail label="Participation" value={challenge.participation} />
            <Detail label="Ends" value={challenge.endsLabel} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/45 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
