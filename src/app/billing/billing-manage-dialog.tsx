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
        <Button disabled={disabled}>
          <CreditCard className="size-4" /> Manage plan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Manage your plan?</AlertDialogTitle>
          <AlertDialogDescription>
            Stripe’s secure portal lets you update payment details, downgrade, or cancel at the end
            of your billing period. No plan changes happen until you confirm them there.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay here</AlertDialogCancel>
          <form action={openCustomerPortalAction}>
            <AlertDialogAction type="submit">Open customer portal</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
