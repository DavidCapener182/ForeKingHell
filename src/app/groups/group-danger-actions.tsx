"use client";
import { useClientReady } from "@/hooks/use-client-ready";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { groupDangerFormAction } from "@/app/groups/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
export function GroupDangerActions({
  groupId,
  groupName,
  isOwner,
  isMember,
}: {
  groupId: string;
  groupName: string;
  isOwner: boolean;
  isMember: boolean;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const lock = useRef(false);
  if (!isOwner && !isMember) return null;
  const label = isOwner ? "Delete group" : "Leave group";
  return (
    <>
      <Button
        disabled={!ready}
        variant={isOwner ? "destructive" : "outline"}
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
        title={`${label}: ${groupName}`}
        description={
          isOwner
            ? "Permanently delete this group for every member. This removes its memberships and posts and cannot be undone."
            : "Leave this group. Access available only through membership will end; other members and the group remain."
        }
      >
        <div className="grid gap-4" aria-busy={pending}>
          <p className="break-words font-semibold">{groupName}</p>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              variant="destructive"
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                setError(undefined);
                start(async () => {
                  try {
                    const data = new FormData();
                    data.set("groupId", groupId);
                    data.set("operation", isOwner ? "delete" : "leave");
                    const result = await groupDangerFormAction({ ok: false }, data);
                    if (!result.ok) {
                      setError(result.error ?? "Could not complete this action. Try again.");
                      return;
                    }
                    router.push("/groups?tab=mine");
                    router.refresh();
                  } catch {
                    setError("Could not complete this action. Try again.");
                  } finally {
                    lock.current = false;
                  }
                });
              }}
            >
              {pending ? "Saving…" : isOwner ? "Delete permanently" : "Confirm leave"}
            </Button>
          </div>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
