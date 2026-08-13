"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, QrCode } from "lucide-react";

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

export function ProfileShareDialog({
  username,
  profileUrl,
}: {
  username: string;
  profileUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyProfileLink() {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCode className="size-4" /> Share profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share @{username}</DialogTitle>
          <DialogDescription>
            This link opens your current public profile and respects every sharing setting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-xl border bg-background p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/friends/qr/${username}`}
              alt={`QR invite for @${username}`}
              className="mx-auto aspect-square w-full max-w-52"
            />
          </div>
          <code className="break-all rounded-lg bg-muted px-3 py-2 text-xs">{profileUrl}</code>
          <p className="min-h-5 text-xs text-emerald-700" aria-live="polite">
            {copied ? "Profile link copied." : ""}
          </p>
        </div>
        <DialogFooter showCloseButton>
          <Button type="button" onClick={copyProfileLink}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild variant="outline">
            <Link href={profileUrl} prefetch={false}>
              Open public page
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
