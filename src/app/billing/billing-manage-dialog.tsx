"use client";
import { useRef, useState, useTransition } from "react";
import { openCustomerPortalFormAction } from "@/app/billing/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function BillingManageDialog({ disabled = false }: { disabled?: boolean }) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  return (
    <>
      <Button disabled={disabled || !ready} onClick={() => setOpen(true)}>
        Manage plan
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title="Manage your plan"
        description="Review payment details, available plan changes and cancellation in the secure billing portal."
      >
        <div className="grid gap-4">
          <p>
            No subscription change is made here. The portal shows the effective date and renewal
            consequences before you confirm a change.
          </p>
          <p>
            Invoices and receipts, when available, are provided by your billing account in the
            portal.
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Stay here
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError(undefined);
              start(async () => {
                try {
                  const result = await openCustomerPortalFormAction({ ok: false }, new FormData());
                  if (!result.ok || !result.url) {
                    setError(result.error ?? "Plan management could not open. Try again.");
                    return;
                  }
                  window.location.assign(result.url);
                } catch {
                  setError("Plan management could not open. Your current access is unchanged.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Opening portal…" : "Open customer portal"}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
