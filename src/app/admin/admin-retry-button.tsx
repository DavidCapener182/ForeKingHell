"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runAdminSystemSnapshotAction } from "@/app/admin/admin-system-check-actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function AdminRetryButton() {
  const ready = useClientReady();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  return (
    <div className="grid gap-2">
      <Button
        variant="outline"
        disabled={!ready || pending}
        className="justify-self-start"
        onClick={() => {
          setOpen(true);
          setError(undefined);
        }}
      >
        Refresh recorded checks
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title="Refresh recorded checks"
        description="Read current operational database records and save a dated snapshot in the administrative history. Also run configured read-only database, auth-settings and storage-metadata probes. This does not retry imports, charge payments or make AI requests."
      >
        <div className="grid gap-4">
          <p className="text-sm">
            Each probe reports its own result and timestamp. Sign-in, uploads, user access policies
            and AI generation are not exercised. Recorded failure counts remain separate.
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel refresh
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError(undefined);
              setMessage(undefined);
              start(async () => {
                try {
                  const result = await runAdminSystemSnapshotAction();
                  if (!result.ok) {
                    setError(result.error ?? "Recorded checks could not be refreshed.");
                    return;
                  }
                  setMessage(
                    result.message ??
                      "Check results saved. Open their diagnostics for the exact scope.",
                  );
                  setOpen(false);
                  router.refresh();
                } catch {
                  setError("The refresh could not be confirmed. Try again.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Reading recorded checks…" : "Confirm recorded-check refresh"}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </div>
  );
}
