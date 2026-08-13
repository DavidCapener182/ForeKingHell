"use client";

import { useState } from "react";
import { MoreHorizontal, ReceiptText } from "lucide-react";

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

export function AdminBillingActions({
  subscription,
}: {
  subscription: {
    displayName: string;
    email: string | null;
    plan: string;
    status: string;
    renewal: string;
    created: string;
    cancels: boolean;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Billing actions for ${subscription.displayName}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Subscription actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <ReceiptText className="size-4" /> View details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{subscription.displayName}</SheetTitle>
            <SheetDescription>{subscription.email ?? "No billing email recorded"}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{titleCase(subscription.plan)}</Badge>
              <Badge variant="outline">{titleCase(subscription.status)}</Badge>
            </div>
            <Detail label="Renewal" value={subscription.renewal} />
            <Detail
              label="Cancellation"
              value={subscription.cancels ? "Cancels at period end" : "Continues"}
            />
            <Detail label="Created" value={subscription.created} />
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
