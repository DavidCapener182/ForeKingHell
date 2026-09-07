"use client";
import { useRef, useState, useTransition } from "react";
import { createCheckoutFormAction } from "@/app/billing/actions";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
export function FullPlanCheckout({
  plan,
  availability,
}: {
  plan: { key: string; monthlyPrice: string; yearlyPrice: string };
  availability: { monthly: boolean; yearly: boolean };
}) {
  const ready = useClientReady();
  const [interval, setInterval] = useState("monthly");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const available = interval === "monthly" ? availability.monthly : availability.yearly;
  const price = interval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const period = interval === "monthly" ? "month" : "year";
  return (
    <div className="grid w-full min-w-0 gap-3">
      <label className="grid gap-1 text-sm">
        Full plan billing interval
        <select
          className="min-h-11 rounded-lg border bg-background px-3"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        >
          <option value="monthly">Monthly — {plan.monthlyPrice} / month</option>
          <option value="yearly">Yearly — {plan.yearlyPrice} / year</option>
        </select>
      </label>
      <p className="text-sm">
        Listed price:{" "}
        <strong>
          {price} per {period}
        </strong>
        . Recurs until cancelled. Confirm the final amount and terms at checkout.
      </p>
      {!available ? (
        <p role="status" className="text-sm">
          Checkout for this billing period is currently unavailable. Your existing access is
          unchanged.
        </p>
      ) : null}
      <Button disabled={!ready || !available} onClick={() => setOpen(true)}>
        Review Full plan
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title="Review Full plan"
        description="Opening this review does not start checkout or charge you."
      >
        <div className="grid gap-4">
          <p className="text-lg font-semibold">
            {price} per {period}
          </p>
          <p>
            Recurring Full subscription. You will review the final amount and payment terms on
            Stripe before authorising payment. Your current access changes only after confirmation.
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Keep current plan
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError(undefined);
              const data = new FormData();
              data.set("planKey", plan.key);
              data.set("interval", interval);
              start(async () => {
                try {
                  const result = await createCheckoutFormAction({ ok: false }, data);
                  if (!result.ok || !result.url) {
                    setError(result.error ?? "Checkout could not open. Please try again.");
                    return;
                  }
                  window.location.assign(result.url);
                } catch {
                  setError("Checkout could not be confirmed. Your selection is retained.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Opening checkout…" : "Continue to secure checkout"}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </div>
  );
}
