"use client";

import { leaveChallengeAction } from "@/app/challenges/actions";
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

export function ChallengeLeaveDialog({
  challengeId,
  challengeTitle,
}: {
  challengeId: string;
  challengeTitle: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline">
          Leave challenge
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave {challengeTitle}?</AlertDialogTitle>
          <AlertDialogDescription>
            Your entry will be removed from this board. Imported shot data is not deleted, and you
            can join again while the challenge remains available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep entry</AlertDialogCancel>
          <form action={leaveChallengeAction}>
            <input type="hidden" name="challengeId" value={challengeId} />
            <AlertDialogAction type="submit">Leave challenge</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
