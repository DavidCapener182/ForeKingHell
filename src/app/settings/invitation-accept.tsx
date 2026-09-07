"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitationFormAction } from "@/app/settings/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function InvitationAccept({
  token,
  owner,
  recipient,
  role,
}: {
  token: string;
  owner: string;
  recipient: string;
  role: string;
}) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const router = useRouter();
  return (
    <>
      <Button disabled={!ready} onClick={() => setOpen(true)}>
        Review acceptance
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title={`Accept access from ${owner}`}
        description="Accept only the role and account shown here. Your own account data stays separate."
      >
        <div className="grid gap-4">
          <p className="break-words">Recipient: {recipient}</p>
          <p>Role: {role}</p>
          <p className="text-sm">
            {role === "editor"
              ? "This role can read and edit supported shared-account data."
              : "This role can read supported shared-account data and cannot edit it."}
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError(undefined);
              const data = new FormData();
              data.set("token", token);
              start(async () => {
                try {
                  const result = await acceptInvitationFormAction({ ok: false }, data);
                  if (!result.ok) {
                    setError(result.error ?? "Invitation could not be accepted.");
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                } catch {
                  setError(
                    "Acceptance could not be confirmed. Check the invitation and try again.",
                  );
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Accepting…" : "Confirm acceptance"}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
