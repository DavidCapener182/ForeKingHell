"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
export function FriendInviteDialog({
  username,
  profileUrl,
}: {
  username: string;
  profileUrl: string;
}) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        disabled={!ready}
        onClick={() => {
          setOpen(true);
          setCopied(false);
          setError(null);
        }}
      >
        Invite a friend
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title={`Invite a friend to @${username}`}
        description="This link opens your player profile under its current visibility settings. The other golfer can request a friendship; opening this panel sends nothing."
      >
        <div className="grid gap-4 pb-4">
          {qrFailed ? (
            <p role="status" className="text-sm">
              QR image unavailable. The invitation link still works.
            </p>
          ) : (
            <div className="rounded-xl border bg-card p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/friends/qr/${encodeURIComponent(username)}`}
                alt={`Profile invitation QR code for @${username}`}
                width={192}
                height={192}
                className="mx-auto size-48 max-w-full"
                onError={() => setQrFailed(true)}
              />
            </div>
          )}
          <label className="grid gap-2 text-sm font-medium">
            Invitation link
            <Input readOnly value={profileUrl} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <p className="text-sm text-muted-foreground">
            Copying the link does not add a friend or send an email. Your existing profile
            permissions remain in effect.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {copied ? (
            <p role="status" className="text-sm">
              Invitation link copied.
            </p>
          ) : null}
          <Button
            onClick={async () => {
              setError(null);
              setCopied(false);
              try {
                await navigator.clipboard.writeText(profileUrl);
                setCopied(true);
              } catch {
                setError(
                  "Could not copy automatically. Select and copy the invitation link above.",
                );
              }
            }}
          >
            <Copy className="size-4" />
            Copy invitation link
          </Button>
          <Button asChild variant="outline">
            <Link href={profileUrl}>
              <ExternalLink className="size-4" />
              Open invite page
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
