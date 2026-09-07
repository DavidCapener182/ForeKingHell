"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { correctShotClubAction } from "@/app/(app)/shots/actions";
import { Button } from "@/components/ui/button";

type Option = { value: string; label: string };

export function ClubCorrection({
  shotId,
  clubs,
  onComplete,
}: {
  shotId: string;
  clubs: Option[];
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [clubId, setClubId] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function correct(value: string) {
    startTransition(async () => {
      try {
        const result = await correctShotClubAction(shotId, value);
        // A refresh retry can be a no-op. Keep the original club available for Undo.
        setUndoId((previous) =>
          result.previousClubId === value ? previous : result.previousClubId,
        );
        setMessage(
          result.warning
            ? `Club updated. ${result.warning}`
            : "Club updated. Both clubs’ trusted distances have been recalculated.",
        );
        onComplete?.();
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not update the club. Try again.",
        );
      }
    });
  }
  return (
    <details className="mobile-shot-filters block">
      <summary className="flex min-h-11 items-center font-medium text-primary">
        Correct club
      </summary>
      <div className="grid gap-3 py-2">
        <p className="text-sm text-muted-foreground">
          Moves this shot’s evidence to the selected club. Raw measurements stay intact. You can
          change it back.
        </p>
        <label>
          Club
          <span className="mobile-shot-select-wrap">
            <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
              <option value="">Choose from your bag</option>
              {clubs.map((club) => (
                <option key={club.value} value={club.value}>
                  {club.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </span>
        </label>
        <Button disabled={pending || !clubId} onClick={() => correct(clubId)}>
          {pending ? "Updating…" : "Update club"}
        </Button>
        {undoId ? (
          <Button disabled={pending} variant="outline" onClick={() => correct(undoId)}>
            Undo club change
          </Button>
        ) : null}
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </details>
  );
}
