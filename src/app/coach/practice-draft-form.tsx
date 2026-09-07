"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createCoachPracticeDraftAction } from "./practice-draft-action";
export function CoachPracticeDraftForm({
  clubId,
  fingerprint,
  creationId,
}: {
  clubId: string;
  fingerprint: string;
  creationId: string;
}) {
  const [state, action, pending] = useActionState(createCoachPracticeDraftAction, { error: null });
  return (
    <form action={action} className="grid min-w-0 gap-2">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="fingerprint" value={fingerprint} />
      <input type="hidden" name="creationId" value={creationId} />
      <Button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full whitespace-normal sm:w-fit"
      >
        {pending ? "Saving coaching draft…" : "Save this drill as a practice draft"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
