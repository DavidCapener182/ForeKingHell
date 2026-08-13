"use client";

import { LogOut, Trash2 } from "lucide-react";

import { deleteGroupAction, leaveGroupAction } from "@/app/groups/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  if (!isOwner && !isMember) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={isOwner ? "destructive" : "outline"}>
          {isOwner ? <Trash2 className="size-4" /> : <LogOut className="size-4" />}
          {isOwner ? "Delete group" : "Leave group"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isOwner ? `Delete ${groupName}?` : `Leave ${groupName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isOwner
              ? "This permanently removes the group, memberships, posts, and linked group records. This cannot be undone."
              : "You will lose access to member-only posts, leaderboards, and challenges until you rejoin."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={isOwner ? deleteGroupAction : leaveGroupAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <AlertDialogAction type="submit" variant="destructive">
              {isOwner ? "Delete permanently" : "Leave group"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
