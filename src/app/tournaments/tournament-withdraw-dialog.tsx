"use client";

import { withdrawTournamentAction } from "@/app/tournaments/actions";
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

export function TournamentWithdrawDialog({
  tournamentId,
  tournamentTitle,
}: {
  tournamentId: string;
  tournamentTitle: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          Withdraw entry
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw from {tournamentTitle}?</AlertDialogTitle>
          <AlertDialogDescription>
            Your entry will stop appearing in active standings. Submitted rounds and proof are kept
            as event history and are not deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep entry</AlertDialogCancel>
          <form action={withdrawTournamentAction}>
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <AlertDialogAction type="submit">Withdraw</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
