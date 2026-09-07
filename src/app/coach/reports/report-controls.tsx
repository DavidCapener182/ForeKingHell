"use client";
import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { revokeCoachReportWithStateAction } from "./actions";
export function CopyReportLink({ url }: { url: string }) {
  const [status, setStatus] = useState("");
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setStatus("Report link copied.");
          } catch {
            setStatus("Copy unavailable. Select and copy the link field above.");
          }
        }}
      >
        Copy report link
      </Button>
      <p role="status" className="text-sm">
        {status}
      </p>
    </div>
  );
}
export function ReportHistoryDetail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" type="button">
          Report details and actions
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Saved report scope and access controls.</SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 gap-4 overflow-y-auto px-4">{children}</div>
        <SheetClose asChild>
          <Button variant="outline" className="m-4 mt-auto min-h-11">
            Close report details
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
export function RevokeReport({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline">
          Revoke report link
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="z-[100]" overlayClassName="z-[90]">
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            Anyone using this link will lose access to this frozen report. Other reports remain
            available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <AlertDialogCancel disabled={pending}>Keep report active</AlertDialogCancel>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const data = new FormData();
                  data.set("shareLinkId", id);
                  const result = await revokeCoachReportWithStateAction(data);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                } catch {
                  setError(
                    "Could not confirm revocation. Check the current report status and try again.",
                  );
                }
              })
            }
          >
            {pending ? "Revoking…" : "Confirm revocation"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
