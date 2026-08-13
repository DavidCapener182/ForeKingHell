"use client";

import { useState } from "react";
import { MoreHorizontal, UserPlus } from "lucide-react";

import {
  cancelInvitationAction,
  createInvitationAction,
  removeMembershipAction,
} from "@/app/settings/actions";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collaborationRoles } from "@/lib/collaboration";

export function SettingsInvitationDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">
          <UserPlus aria-hidden />
          Invite collaborator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a collaborator</DialogTitle>
          <DialogDescription>
            Create role-scoped access for a coach, viewer or editor. The invitation remains pending
            until the recipient accepts it.
          </DialogDescription>
        </DialogHeader>
        <form action={createInvitationAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-invite-email">Invite email</Label>
            <Input
              id="settings-invite-email"
              name="invitedEmail"
              type="email"
              placeholder="coach@example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-invite-role">Role</Label>
            <Select name="role" defaultValue="viewer">
              <SelectTrigger id="settings-invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {collaborationRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit">Create invite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsAccessRowAction({
  targetId,
  targetType,
  party,
}: {
  targetId: string;
  targetType: "invitation" | "membership";
  party: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isInvitation = targetType === "invitation";
  const action = isInvitation ? cancelInvitationAction : removeMembershipAction;
  const fieldName = isInvitation ? "invitationId" : "membershipId";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${party}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Access actions</DropdownMenuLabel>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            {isInvitation ? "Cancel invitation" : "Remove access"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isInvitation ? "Cancel this invitation?" : "Remove this collaborator?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isInvitation
                ? `${party} will no longer be able to accept this invitation.`
                : `${party} will immediately lose role-scoped access to this account.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep access</AlertDialogCancel>
            <form action={action}>
              <input type="hidden" name={fieldName} value={targetId} />
              <AlertDialogAction type="submit" variant="destructive">
                {isInvitation ? "Cancel invitation" : "Remove access"}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
