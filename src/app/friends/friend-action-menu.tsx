"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { relationshipFormAction } from "@/app/friends/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClientReady } from "@/hooks/use-client-ready";
export type PeopleDirectoryStatus =
  | "friend"
  | "incoming"
  | "outgoing"
  | "suggested"
  | "search"
  | "blocked";
type Operation = "request" | "accept" | "decline" | "cancel" | "remove" | "block" | "unblock";
const labels: Record<Operation, string> = {
  request: "Send friend request",
  accept: "Accept request",
  decline: "Decline request",
  cancel: "Cancel request",
  remove: "Remove friend",
  block: "Block golfer",
  unblock: "Unblock golfer",
};
const consequences: Record<Operation, string> = {
  request: "This sends a friend request. You become friends only when it is accepted.",
  accept:
    "Accepting adds this golfer to your friends. Friend-scoped visibility follows your existing privacy settings.",
  decline: "This declines the incoming request without blocking the golfer.",
  cancel: "This cancels your pending request. It does not block the golfer.",
  remove: "This removes your friendship and access granted only through that friendship.",
  block:
    "This blocks the golfer and removes the connection and pending requests under your existing privacy rules.",
  unblock: "This removes the block. It does not automatically restore your friendship.",
};
export function PeopleActionMenu({
  userId,
  username,
  displayName,
  status,
  relationship,
  requestId,
}: {
  userId: string;
  username: string;
  displayName: string;
  status: PeopleDirectoryStatus;
  relationship: "self" | "friend" | "incoming" | "outgoing" | "blocked" | "none";
  requestId?: string;
  returnHref: string;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [operation, setOperation] = useState<Operation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const effective = status === "search" || status === "suggested" ? relationship : status;
  const operations: Operation[] =
    effective === "friend"
      ? ["remove", "block"]
      : effective === "incoming"
        ? requestId
          ? ["accept", "decline", "block"]
          : ["block"]
        : effective === "outgoing"
          ? requestId
            ? ["cancel", "block"]
            : ["block"]
          : effective === "blocked"
            ? ["unblock"]
            : effective === "self"
              ? []
              : ["request", "block"];
  function close() {
    if (pending) return;
    setOperation(null);
    setTimeout(() => trigger.current?.focus(), 0);
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            disabled={!ready || pending}
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Actions for ${displayName}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="max-w-64 whitespace-normal break-words">
            {displayName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {effective !== "blocked" ? (
            <DropdownMenuItem asChild>
              <Link href={`/profile/${username}`}>Open profile</Link>
            </DropdownMenuItem>
          ) : null}
          {effective === "friend" ? (
            <DropdownMenuItem asChild>
              <Link href="/groups?tab=mine">Invite to group</Link>
            </DropdownMenuItem>
          ) : null}
          {(effective === "incoming" || effective === "outgoing") && !requestId ? (
            <DropdownMenuItem asChild>
              <Link href={`/friends?tab=${effective === "incoming" ? "incoming" : "sent"}`}>
                Review pending request
              </Link>
            </DropdownMenuItem>
          ) : null}
          {operations.map((value) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => {
                setError(null);
                setOperation(value);
              }}
            >
              {labels[value]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDetailPanel
        open={!!operation}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        title={operation ? `${labels[operation]}: ${displayName}` : "Relationship action"}
        description={operation ? consequences[operation] : ""}
      >
        <div className="grid gap-3 pb-4">
          <p className="break-words text-sm">@{username}</p>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <Button variant="outline" disabled={pending} onClick={close}>
            Keep current state
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (!operation || busy.current) return;
              busy.current = true;
              setError(null);
              const form = new FormData();
              form.set("operation", operation);
              form.set("recipientUserId", userId);
              form.set("friendUserId", userId);
              form.set("blockedUserId", userId);
              if (requestId) form.set("requestId", requestId);
              start(async () => {
                try {
                  const result = await relationshipFormAction({ ok: false }, form);
                  if (!result.ok) {
                    setError(
                      result.error ??
                        "The action could not be confirmed. Your current state is retained.",
                    );
                    return;
                  }
                  setOperation(null);
                  router.refresh();
                } catch {
                  setError(
                    "The action could not be confirmed. Check the current relationship before retrying.",
                  );
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Saving…" : operation ? `Confirm: ${labels[operation]}` : "Confirm"}
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
