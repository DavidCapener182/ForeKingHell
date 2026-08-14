"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, MoreHorizontal, UserMinus, UserPlus, UserRound, UsersRound, X } from "lucide-react";

import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
  sendFriendRequestAction,
  unblockUserAction,
} from "@/app/friends/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PeopleDirectoryStatus =
  | "friend"
  | "incoming"
  | "outgoing"
  | "suggested"
  | "search"
  | "blocked";

type Confirmation = "decline" | "cancel" | "remove" | null;

export function PeopleActionMenu({
  userId,
  username,
  displayName,
  status,
  relationship,
  requestId,
  returnHref,
}: {
  userId: string;
  username: string;
  displayName: string;
  status: PeopleDirectoryStatus;
  relationship: "self" | "friend" | "incoming" | "outgoing" | "blocked" | "none";
  requestId?: string;
  returnHref: string;
}) {
  const directActionRef = useRef<HTMLFormElement>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const effectiveStatus = status === "search" ? relationship : status;
  const directAction = getDirectAction(effectiveStatus, requestId);
  const confirmationCopy = getConfirmationCopy(confirmation, displayName);

  return (
    <>
      {directAction ? (
        <form ref={directActionRef} action={directAction.action} className="hidden">
          <input type="hidden" name={directAction.field} value={directAction.value} />
          <input type="hidden" name="next" value={returnHref} />
        </form>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${displayName}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{menuLabel(effectiveStatus)}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {effectiveStatus !== "blocked" ? (
            <DropdownMenuItem asChild>
              <Link href={`/profile/${username}`} prefetch={false}>
                <UserRound className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
          ) : null}

          {effectiveStatus === "friend" ? (
            <>
              <DropdownMenuItem asChild>
                <Link href="/groups?tab=mine" prefetch={false}>
                  <UsersRound className="size-4" /> Invite to group
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmation("remove")}>
                <UserMinus className="size-4" /> Remove
              </DropdownMenuItem>
            </>
          ) : null}

          {effectiveStatus === "incoming" && requestId ? (
            <>
              <DropdownMenuItem onSelect={() => directActionRef.current?.requestSubmit()}>
                <Check className="size-4" /> Accept
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmation("decline")}>
                <X className="size-4" /> Decline
              </DropdownMenuItem>
            </>
          ) : null}

          {effectiveStatus === "incoming" && !requestId ? (
            <DropdownMenuItem asChild>
              <Link href="/friends?tab=incoming" prefetch={false}>
                <Check className="size-4" /> Review request
              </Link>
            </DropdownMenuItem>
          ) : null}

          {effectiveStatus === "outgoing" && requestId ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmation("cancel")}>
              <X className="size-4" /> Cancel request
            </DropdownMenuItem>
          ) : null}

          {effectiveStatus === "outgoing" && !requestId ? (
            <DropdownMenuItem asChild>
              <Link href="/friends?tab=sent" prefetch={false}>
                <UserRound className="size-4" /> View sent request
              </Link>
            </DropdownMenuItem>
          ) : null}

          {(effectiveStatus === "suggested" || effectiveStatus === "none") && directAction ? (
            <DropdownMenuItem onSelect={() => directActionRef.current?.requestSubmit()}>
              <UserPlus className="size-4" /> Add friend
            </DropdownMenuItem>
          ) : null}

          {effectiveStatus === "blocked" && directAction ? (
            <DropdownMenuItem onSelect={() => directActionRef.current?.requestSubmit()}>
              <Check className="size-4" /> Unblock
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmationCopy ? (
        <AlertDialog open onOpenChange={(open) => !open && setConfirmation(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmationCopy.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmationCopy.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={confirmationCopy.action}>
                <input type="hidden" name={confirmationCopy.field} value={confirmationCopy.value} />
                <input type="hidden" name="next" value={returnHref} />
                <AlertDialogAction type="submit" variant="destructive">
                  {confirmationCopy.actionLabel}
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );

  function getDirectAction(currentStatus: string, currentRequestId: string | undefined) {
    if (currentStatus === "incoming" && currentRequestId) {
      return { action: acceptFriendRequestAction, field: "requestId", value: currentRequestId };
    }
    if (currentStatus === "blocked") {
      return { action: unblockUserAction, field: "blockedUserId", value: userId };
    }
    if (currentStatus === "suggested" || currentStatus === "none") {
      return { action: sendFriendRequestAction, field: "recipientUserId", value: userId };
    }
    return null;
  }

  function getConfirmationCopy(current: Confirmation, name: string) {
    if (current === "decline" && requestId) {
      return {
        title: `Decline ${name}'s request?`,
        description: "This removes the incoming request without blocking the golfer.",
        actionLabel: "Decline",
        action: declineFriendRequestAction,
        field: "requestId",
        value: requestId,
      };
    }
    if (current === "cancel" && requestId) {
      return {
        title: `Cancel request to ${name}?`,
        description: "You can send another friend request later.",
        actionLabel: "Cancel request",
        action: cancelFriendRequestAction,
        field: "requestId",
        value: requestId,
      };
    }
    if (current === "remove") {
      return {
        title: `Remove ${name}?`,
        description: "They will no longer appear in friend-scoped feeds, records, or leaderboards.",
        actionLabel: "Remove friend",
        action: removeFriendAction,
        field: "friendUserId",
        value: userId,
      };
    }
    return null;
  }
}

function menuLabel(status: string) {
  if (status === "incoming") return "Incoming request";
  if (status === "outgoing") return "Sent request";
  if (status === "blocked") return "Blocked golfer";
  if (status === "friend") return "Friend actions";
  return "Golfer actions";
}
