"use client";

import Link from "next/link";
import { Copy, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Item } from "@/components/ui/item";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FriendInviteDialog({
  username,
  profileUrl,
}: {
  username: string;
  profileUrl: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCode className="size-4" /> Invite a friend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share your player profile</DialogTitle>
          <DialogDescription>
            The QR code and link open your real public profile so another golfer can send a request.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Item variant="outline" className="block p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/friends/qr/${username}`}
              alt={`QR invite for @${username}`}
              className="mx-auto aspect-square w-full max-w-48"
            />
          </Item>
          <code className="break-all rounded-lg bg-muted px-3 py-2 text-xs">{profileUrl}</code>
        </div>
        <DialogFooter showCloseButton>
          <Button asChild variant="outline">
            <Link href={profileUrl} prefetch={false}>
              <Copy className="size-4" /> Open invite page
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
