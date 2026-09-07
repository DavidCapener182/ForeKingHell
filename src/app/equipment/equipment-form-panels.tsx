"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DraftForm } from "@/components/untitled-ui/draft-form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { retireClubWithStateAction } from "./actions";
type Action = (
  data: FormData,
) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
export function EquipmentInlineForm({
  action,
  children,
  submitLabel,
}: {
  action: Action;
  children: ReactNode;
  submitLabel: string;
}) {
  const router = useRouter();
  return (
    <DraftForm
      action={action}
      submitLabel={submitLabel}
      onSuccess={() => router.refresh()}
      gridClassName="grid gap-3"
    >
      {children}
    </DraftForm>
  );
}
export function EquipmentEditSheet({
  action,
  title,
  description,
  submitLabel,
  children,
}: {
  action: Action;
  title: string;
  description: string;
  submitLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11">
          {title}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <DraftForm
            action={action}
            submitLabel={submitLabel}
            onPendingChange={setPending}
            onCancel={() => setOpen(false)}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
            gridClassName="grid gap-3"
          >
            {children}
          </DraftForm>
        </div>
      </SheetContent>
    </Sheet>
  );
}
export function EquipmentRetire({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          Retire
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retire {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {label} from the active bag. Its shots and dated setup history stay
            available. Cancellation makes no change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DraftForm
          action={retireClubWithStateAction}
          submitLabel="Retire club"
          onCancel={() => setOpen(false)}
          onPendingChange={setPending}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          <input type="hidden" name="clubId" value={id} />
        </DraftForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
