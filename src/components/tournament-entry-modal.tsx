"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";

import { joinTournamentAction } from "@/app/tournaments/actions";
import { TournamentEntryTerms } from "@/components/tournament-entry-terms";
import { Button } from "@/components/ui/button";

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
  const titleId = useId();
  const termsControlId = useId();

  return (
    <>
      <Button type="button" className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 sm:place-items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Tournament entry</p>
                <h2 id={titleId} className="mt-1 text-2xl font-semibold tracking-normal">
                  Accept terms to enter
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tournamentTitle} · {courseName} · {teeSetName} · {roundCount} round{roundCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close entry terms" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <form action={joinTournamentAction} className="mt-4 grid gap-4">
              <input type="hidden" name="tournamentId" value={tournamentId} />
              <TournamentEntryTerms controlId={termsControlId} />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                  Accept & enter tournament
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
