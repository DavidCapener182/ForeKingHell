"use client";
import { useClientReady } from "@/hooks/use-client-ready";

import { useActionState, type ReactNode } from "react";
import { savePostRoundReviewWithStateAction } from "./actions";

export function PostRoundReviewForm({ children }: { children: ReactNode }) {
  const ready = useClientReady();
  const [result, action, pending] = useActionState(savePostRoundReviewWithStateAction, {
    error: null,
  });
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="grid min-w-0 gap-4"
      aria-label="Round review notes"
    >
      <fieldset disabled={!ready || pending} className="grid min-w-0 gap-4">
        {children}
      </fieldset>
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saving review…
        </p>
      ) : null}
      {result.error ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      ) : null}
    </form>
  );
}
