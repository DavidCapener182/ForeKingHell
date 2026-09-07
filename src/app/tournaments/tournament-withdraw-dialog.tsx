"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawTournamentFormAction } from "@/app/tournaments/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function TournamentWithdrawDialog({
  tournamentId,
  tournamentTitle,
}: {
  tournamentId: string;
  tournamentTitle: string;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  return (
    <>
      <Button variant="outline" disabled={!ready} onClick={() => setOpen(true)}>
        Withdraw entry
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title={`Withdraw from ${tournamentTitle}?`}
        description="Your entry will stop appearing in active standings. Submitted rounds and proof are kept as event history and are not deleted."
      >
        <div className="grid gap-3 p-4">
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Keep entry
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError(null);
              const data = new FormData();
              data.set("tournamentId", tournamentId);
              start(async () => {
                try {
                  const result = await withdrawTournamentFormAction({ ok: false }, data);
                  if (!result.ok) {
                    setError(result.error ?? "Could not withdraw. Your entry is unchanged.");
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                } catch {
                  setError("Withdrawal could not be confirmed. Check your entry before retrying.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Withdrawing…" : "Confirm withdrawal"}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
