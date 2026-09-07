"use client";
import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { joinChallengeAction, leaveChallengeAction } from "@/app/challenges/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function ChallengeMembershipDialog({
  challengeId,
  challengeTitle,
  leave = false,
  disabled = false,
}: {
  challengeId: string;
  challengeTitle: string;
  leave?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const ready = useClientReady();
  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
      title={`${leave ? "Leave" : "Join"} ${challengeTitle}?`}
      description={
        leave
          ? "Your board entry and result will be removed. Your imported shot data stays saved. Rejoining is possible only while this challenge is open."
          : "Only qualifying imports inside this challenge window count. Joining alone does not create a scored result or grant access to your account data."
      }
      trigger={
        <Button
          variant={leave ? "outline" : "default"}
          className="min-h-11"
          disabled={!ready || disabled}
        >
          {leave ? "Leave challenge" : "Join challenge"}
        </Button>
      }
      footer={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            {leave ? "Keep entry" : "Cancel"}
          </Button>
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError("");
              const data = new FormData();
              data.set("challengeId", challengeId);
              start(async () => {
                try {
                  await (leave ? leaveChallengeAction : joinChallengeAction)(data);
                } catch (error) {
                  unstable_rethrow(error);
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not update your entry. Try again.",
                  );
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Saving…" : leave ? "Confirm leave" : "Confirm entry"}
          </Button>
        </div>
      }
    >
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive p-3">
          {error}
        </p>
      ) : (
        <p className="text-sm">
          {leave
            ? "Keep entry closes this without changing your participation."
            : "Cancel closes this without joining."}
        </p>
      )}
    </ResponsiveDetailPanel>
  );
}
