"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";

import { joinTournamentAction } from "@/app/tournaments/actions";
import { TournamentEntryTerms } from "@/components/tournament-entry-terms";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type TournamentEntryModalProps = {
  tournamentId: string;
  tournamentTitle: string;
  courseName: string;
  teeSetName: string;
  roundCount: number;
  triggerLabel?: string;
};

export function TournamentEntryModal({
  tournamentId,
  tournamentTitle,
  courseName,
  teeSetName,
  roundCount,
  triggerLabel = "Enter tournament",
}: TournamentEntryModalProps) {
  const [open, setOpen] = useState(false);
  const termsControlId = useId();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" className="min-h-11 w-full rounded-lg">
          {triggerLabel}
        </Button>
      </DrawerTrigger>

      <DrawerContent className="mx-auto w-full overflow-hidden sm:max-w-xl sm:border-x">
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <DrawerHeader className="relative pr-16 text-left">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Tournament entry
            </p>
            <DrawerTitle className="mt-1 text-2xl font-semibold tracking-normal">
              Accept terms to enter
            </DrawerTitle>
            <DrawerDescription className="mt-2 leading-5">
              {tournamentTitle} · {courseName} · {teeSetName} · {roundCount} round
              {roundCount === 1 ? "" : "s"}
            </DrawerDescription>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 size-11"
                aria-label="Close entry terms"
              >
                <X className="size-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <form action={joinTournamentAction} className="grid gap-4">
            <div className="px-4">
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <TournamentEntryTerms controlId={termsControlId} />
            </div>
            <DrawerFooter className="sticky bottom-0 border-t border-border bg-popover/95 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:grid sm:grid-cols-[1fr_auto]">
              <DrawerClose asChild>
                <Button type="button" variant="outline" className="min-h-11">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" className="min-h-11 rounded-lg">
                Accept & enter tournament
              </Button>
            </DrawerFooter>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
