"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, MoreHorizontal, UserMinus, UserRound } from "lucide-react";

import { blockUserAction, removeFriendAction } from "@/app/friends/actions";
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

export function FriendActionMenu({
  userId,
  username,
  displayName,
}: {
  userId: string;
  username: string;
  displayName: string;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Manage ${displayName}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Friend actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/profile/${username}`} prefetch={false}>
              <UserRound className="size-4" /> View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRemoveOpen(true)}>
            <UserMinus className="size-4" /> Remove friend
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setBlockOpen(true)}>
            <Ban className="size-4" /> Block user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer appear in friend-scoped feeds, records, or leaderboards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep friend</AlertDialogCancel>
            <form action={removeFriendAction}>
              <input type="hidden" name="friendUserId" value={userId} />
              <AlertDialogAction type="submit" variant="destructive">
                Remove friend
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also removes the friendship and hides friend-scoped profile and feed activity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={blockUserAction} data-friend-block-form>
              <input type="hidden" name="blockedUserId" value={userId} />
              <AlertDialogAction type="submit" variant="destructive">
                Block user
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
