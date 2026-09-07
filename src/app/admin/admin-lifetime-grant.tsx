"use client";
import { useRef, useState, useTransition } from "react";
import { resolveAdminGrantTargetAction } from "@/app/admin/actions";
import { AdminOperationForm } from "@/app/admin/admin-operation-form";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
export function AdminLifetimeGrant() {
  const ready = useClientReady();
  const [target, setTarget] = useState<{ id: string; displayName: string; email: string } | null>(
    null,
  );
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  return (
    <section className="grid gap-3 rounded-xl border p-4">
      <h2 className="text-xl font-semibold">Grant lifetime Full</h2>
      <p className="text-sm">
        Find the existing account first, then review permanent access for that named account.
      </p>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy.current) return;
          busy.current = true;
          setError(undefined);
          const data = new FormData(event.currentTarget);
          start(async () => {
            try {
              const result = await resolveAdminGrantTargetAction(data);
              if (!result.ok || !result.target) {
                setError(result.error ?? "The account could not be found.");
                return;
              }
              setTarget(result.target);
            } catch {
              setError("The account could not be checked. Try again.");
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          Account email
          <Input type="email" name="email" required disabled={!ready || pending} />
        </label>
        <Button disabled={!ready || pending}>
          {pending ? "Finding account…" : "Find account"}
        </Button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
      <ResponsiveDetailPanel
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={target ? `Lifetime Full for ${target.displayName}` : "Lifetime Full review"}
        description="Permanent access for the resolved account. This does not charge a payment method or cancel an existing subscription."
      >
        {target ? (
          <div className="grid gap-4" key={target.id}>
            <dl className="grid gap-3">
              <div>
                <dt>Account</dt>
                <dd className="break-words font-semibold">{target.displayName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="break-all">{target.email}</dd>
              </div>
              <div>
                <dt>Account ID</dt>
                <dd className="break-all">{target.id}</dd>
              </div>
            </dl>
            <AdminOperationForm
              operation="grant-lifetime"
              title="Grant lifetime full"
              description="Create permanent full-plan entitlements and a recorded administrative grant for this exact account."
            >
              <input type="hidden" name="email" value={target.email} />
              <input type="hidden" name="userId" value={target.id} />
            </AdminOperationForm>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
