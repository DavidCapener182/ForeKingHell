"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { groupMembershipFormAction } from "@/app/groups/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function GroupDecision({
  name,
  visibility,
  operation,
  identifier,
}: {
  name: string;
  visibility: string;
  operation: "join" | "code" | "accept" | "decline";
  identifier: string;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const label =
    operation === "decline"
      ? "Decline invitation"
      : operation === "join"
        ? "Join group"
        : "Accept invitation";
  return (
    <>
      <Button
        disabled={!ready || pending}
        variant={operation === "decline" ? "outline" : "default"}
        className="min-h-11"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={`${label}: ${name}`}
        description="Review the named group before confirming your decision."
      >
        <div className="grid gap-4" aria-busy={pending}>
          <p className="break-words font-semibold">{name}</p>
          <p className="text-sm">
            Visibility: {visibility}.{" "}
            {operation === "decline"
              ? "This declines only this invitation. You will not join the group."
              : "This adds you to this group. It does not invite any other members."}
          </p>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                if (busy.current) return;
                busy.current = true;
                setError(undefined);
                start(async () => {
                  try {
                    const data = new FormData();
                    data.set("operation", operation);
                    data.set(
                      operation === "join"
                        ? "groupId"
                        : operation === "code"
                          ? "inviteCode"
                          : "inviteId",
                      identifier,
                    );
                    const result = await groupMembershipFormAction({ ok: false }, data);
                    if (!result.ok) {
                      setError(result.error ?? "Could not update this group. Try again.");
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  } catch {
                    setError("Could not update this group. Try again.");
                  } finally {
                    busy.current = false;
                  }
                });
              }}
            >
              {pending ? "Saving…" : `Confirm: ${label}`}
            </Button>
          </div>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
