"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useClientReady } from "@/hooks/use-client-ready";
import { X } from "lucide-react";

import { joinTournamentFormAction } from "@/app/tournaments/actions";
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
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const router = useRouter();
  const ready = useClientReady();
  const termsControlId = useId();

  return (
    <Drawer
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <DrawerTrigger asChild>
        <Button type="button" disabled={!ready} className="min-h-11 w-full rounded-lg">
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

          <form
            className="grid gap-4"
            onChange={() => setReview(false)}
            onSubmit={(event) => {
              event.preventDefault();
              if (busy.current) return;
              if (!review) {
                setReview(true);
                return;
              }
              const data = new FormData(event.currentTarget);
              busy.current = true;
              setError(null);
              start(async () => {
                try {
                  const result = await joinTournamentFormAction({ ok: false }, data);
                  if (!result.ok) {
                    setError(
                      result.error ?? "Entry could not be confirmed. Your choices are retained.",
                    );
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                } catch {
                  setError("Entry could not be confirmed. Your choices are retained.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            <fieldset disabled={pending} className="grid min-w-0 gap-4">
              <div className="px-4">
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <TournamentEntryTerms controlId={termsControlId} />
              </div>
              <DrawerFooter className=" border-t border-border bg-popover/95 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:grid sm:grid-cols-[1fr_auto]">
                <DrawerClose asChild>
                  <Button type="button" variant="outline" className="min-h-11">
                    Cancel
                  </Button>
                </DrawerClose>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                {review ? (
                  <p className="text-sm">
                    You are entering {tournamentTitle} for {roundCount} rounds at {courseName},{" "}
                    {teeSetName}, under the terms shown above.
                  </p>
                ) : null}
                <Button type="submit" className="min-h-11 rounded-lg">
                  {pending ? "Entering…" : review ? "Accept & enter tournament" : "Review entry"}
                </Button>
              </DrawerFooter>
            </fieldset>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
