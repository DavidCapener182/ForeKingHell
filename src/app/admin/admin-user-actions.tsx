"use client";

import { useState } from "react";
import { MoreHorizontal, ShieldOff, UserRound } from "lucide-react";

import { deactivateAdminAccessAction } from "@/app/admin/actions";
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

export function AdminUserActions({
  user,
}: {
  user: {
    id: string;
    displayName: string;
    email: string | null;
    username: string | null;
    activePlan: string;
    sessionCount: number;
    feedCount: number;
    adminRole: string | null;
    adminStatus: string | null;
    createdLabel: string;
  };
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.displayName}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>User actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDetailsOpen(true)}>
            <UserRound className="size-4" /> View details
          </DropdownMenuItem>
          {user.adminRole ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDeactivateOpen(true)}>
              <ShieldOff className="size-4" /> Deactivate admin
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{user.displayName}</SheetTitle>
            <SheetDescription>User identity, access, and observed app activity.</SheetDescription>
          </SheetHeader>
          <dl className="grid gap-3 px-4 text-sm">
            <Detail label="Email" value={user.email ?? "No email"} />
            <Detail label="Username" value={user.username ? `@${user.username}` : "Not set"} />
            <Detail label="Created" value={user.createdLabel} />
            <Detail
              label="Activity"
              value={`${user.sessionCount} sessions · ${user.feedCount} cards`}
            />
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{titleCase(user.activePlan)}</Badge>
              {user.adminRole ? <Badge>{titleCase(user.adminRole)}</Badge> : null}
              {user.adminStatus ? (
                <Badge variant="outline">{titleCase(user.adminStatus)}</Badge>
              ) : null}
            </div>
          </dl>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {user.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes their active admin role and writes an audit entry. Their player account
              and golf data are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep access</AlertDialogCancel>
            <form action={deactivateAdminAccessAction}>
              <input type="hidden" name="userId" value={user.id} />
              <AlertDialogAction type="submit" variant="destructive">
                Deactivate admin
              </AlertDialogAction>
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
