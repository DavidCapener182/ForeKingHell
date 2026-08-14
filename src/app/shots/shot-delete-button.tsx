"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { deleteShotAction } from "@/app/(app)/shots/actions";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ShotDeleteButton({ shotId }: { shotId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function deleteShot() {
    startTransition(async () => {
      setError(null);

      try {
        await deleteShotAction(shotId);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not delete this shot.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" className="justify-between">
            Delete shot
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shot?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the shot from your tracker. Current stats, maps and analysis
              will recalculate without it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep shot</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={deleteShot}>
              {isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              {isPending ? "Deleting…" : "Delete shot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="text-sm font-medium text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
