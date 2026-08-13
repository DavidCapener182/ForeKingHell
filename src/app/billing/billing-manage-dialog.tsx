"use client";

import { CreditCard } from "lucide-react";

import { openCustomerPortalAction } from "@/app/billing/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function BillingManageDialog({ disabled = false }: { disabled?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <CreditCard className="size-4" /> Change or cancel plan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Open secure plan management?</AlertDialogTitle>
          <AlertDialogDescription>
            Stripe’s customer portal is where you can downgrade, cancel at period end, or update
            payment details. No plan changes happen until you confirm them there.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current plan</AlertDialogCancel>
          <form action={openCustomerPortalAction}>
            <AlertDialogAction type="submit">Open customer portal</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
