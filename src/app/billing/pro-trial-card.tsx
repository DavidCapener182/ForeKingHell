"use client";
import { useActionState, useEffect, useState } from "react";
import { startProTrialCheckoutAction } from "./actions";
import { recordProductImpression } from "@/app/product-events";
import { Button } from "@/components/ui/button";

export function ProTrialCard() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    void recordProductImpression("pro_trial_offer_shown", "trial-card").catch(() => {});
  }, []);
  const [state, action, pending] = useActionState(startProTrialCheckoutAction, { ok: false });
  useEffect(() => {
    if (state.ok && state.url) window.location.assign(state.url);
  }, [state]);
  if (dismissed) return null;
  return (
    <section className="rounded-xl border p-4" aria-label="Pro trial">
      <h2 className="font-semibold">Try Pro free for 7 days</h2>
      <p className="my-2 text-sm text-muted-foreground">
        Plan all 18 holes with your measured bag. Card required. £12.99/month after 7 days unless
        you cancel. One trial per account. Cancel anytime in Manage billing.
      </p>
      <form action={action}>
        <Button disabled={pending} type="submit">
          {pending ? "Opening secure checkout…" : "Start my 7-day Pro trial"}
        </Button>
      </form>
      <Button
        variant="ghost"
        type="button"
        disabled={pending}
        onClick={() => {
          setDismissed(true);
          void recordProductImpression("pro_trial_offer_dismissed", "trial-card").catch(() => {});
        }}
      >
        Maybe later
      </Button>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
