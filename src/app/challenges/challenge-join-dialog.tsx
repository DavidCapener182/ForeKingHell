"use client";

import { joinChallengeAction } from "@/app/challenges/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ChallengeJoinDialog({
  challengeId,
  challengeTitle,
  size = "sm",
}: {
  challengeId: string;
  challengeTitle: string;
  size?: "sm" | "default";
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size={size}>
          Join{size === "default" ? " challenge" : ""}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join {challengeTitle}?</DialogTitle>
          <DialogDescription>
            Qualifying imported shots inside the challenge window will be counted automatically.
            Your exact shot rows remain private.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <form action={joinChallengeAction}>
            <input type="hidden" name="challengeId" value={challengeId} />
            <Button type="submit">Confirm entry</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
