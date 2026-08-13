"use client";

import { useState } from "react";
import { CheckCircle2, MoreHorizontal, Search } from "lucide-react";

import { resolveModerationEventAction, resolveSocialReportAction } from "@/app/admin/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

export function ModerationRowActions({
  record,
}: {
  record: {
    kind: "report" | "event";
    id: string;
    label: string;
    status: string;
    targetType: string;
    targetId: string;
    details: string;
    createdLabel: string;
  };
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const isOpen = record.status === "open";
  const action =
    record.kind === "report" ? resolveSocialReportAction : resolveModerationEventAction;
  const fieldName = record.kind === "report" ? "reportId" : "eventId";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${record.label}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Moderation actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>
            <Search className="size-4" /> Review detail
          </DropdownMenuItem>
          {isOpen ? (
            <DropdownMenuItem onSelect={() => setResolveOpen(true)}>
              <CheckCircle2 className="size-4" /> Resolve record
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{record.label}</SheetTitle>
            <SheetDescription>Recorded moderation evidence and current status.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 text-sm">
            <Badge className="w-fit" variant={isOpen ? "secondary" : "outline"}>
              {titleCase(record.status)}
            </Badge>
            <Detail label="Type" value={titleCase(record.kind)} />
            <Detail label="Target" value={`${record.targetType} · ${record.targetId}`} />
            <Detail label="Created" value={record.createdLabel} />
            <Detail label="Evidence" value={record.details} />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve {record.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes the moderation record and writes an admin audit entry. It does not delete
              the underlying user content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep open</AlertDialogCancel>
            <form action={action}>
              <input type="hidden" name={fieldName} value={record.id} />
              <AlertDialogAction type="submit">Resolve record</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/45 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
