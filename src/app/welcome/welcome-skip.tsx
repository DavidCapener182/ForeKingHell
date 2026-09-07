"use client";
import { useActionState } from "react";
import { dismissWelcomeStateAction } from "@/app/welcome/actions";
import { Button } from "@/components/ui/button";
export function WelcomeSkip() {
  const [state, action, pending] = useActionState(dismissWelcomeStateAction, {});
  return (
    <form action={action} className="grid gap-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving your choice…" : "Skip setup for now"}
      </Button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
