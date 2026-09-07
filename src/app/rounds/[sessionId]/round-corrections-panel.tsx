"use client";

import { useState, useTransition, type ReactNode } from "react";
import { LoaderCircle, PencilLine, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { deleteRoundShotAction } from "@/app/rounds/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function RoundCorrectionsPanel({
  shotCount,
  children,
}: {
  shotCount: number;
  children: ReactNode;
}) {
  return (
    <section aria-label="Round correction tools" className="grid min-w-0 gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
        <span className="rounded-lg bg-card p-2 text-primary shadow-sm">
          <PencilLine className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Review your shot labels</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {shotCount} linked shots. Correct the club on one shot below. Your original import stays
            available.
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function RoundShotDeleteButton({
  sessionId,
  shotId,
  shotLabel,
  courseHoleNumber,
}: {
  sessionId: string;
  shotId: string;
  shotLabel: string;
  courseHoleNumber: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (courseHoleNumber === null || courseHoleNumber < 1) {
    return (
      <p
        className="max-w-64 text-xs leading-5 text-muted-foreground"
        data-round-shot-delete-unassigned
      >
        Assign this shot to a hole through the round split or import correction first. Permanent
        delete is unavailable until its scorecard impact can be verified.
      </p>
    );
  }

  function permanentlyDelete() {
    startTransition(async () => {
      setError(null);

      try {
        await deleteRoundShotAction({ sessionId, shotId });
        setOpen(false);
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not permanently delete this round shot.",
        );
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          setOpen(nextOpen);
          if (nextOpen) setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="w-full sm:w-auto"
          data-round-shot-delete-trigger
        >
          <Trash2 className="size-4" aria-hidden />
          Delete shot
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete {shotLabel}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2">
              <span>
                This is a round correction. Deleting the mapped shot removes one recorded stroke
                from hole {courseHoleNumber} where the saved score accounting permits. Valid saved
                putts and penalties stay unchanged.
              </span>
              <span>
                Remaining hole shot numbers, CSV shot counts, distance progress, stock yardages and
                linked practice evidence will recalculate. This cannot be undone.
              </span>
              <span>
                The original import file and raw import rows remain, so reprocessing the import may
                recreate this shot.
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep shot</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={permanentlyDelete}
            data-round-shot-delete-confirm
          >
            {isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
            {isPending ? "Deleting…" : "Permanently delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
