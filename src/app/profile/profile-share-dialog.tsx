"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
export function ProfileShareDialog({
  username,
  profileUrl,
}: {
  username: string;
  profileUrl: string;
}) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button variant="outline" disabled={!ready} onClick={() => setOpen(true)}>
        Share profile
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title={`Share @${username}`}
        description="This link opens the saved profile. What a visitor sees depends on your saved sharing settings and their relationship to you."
      >
        <div className="grid gap-4">
          <p className="text-sm">
            Preview the saved page before sharing. Unsaved edits are not included.
          </p>
          {failed ? (
            <p role="alert">The QR could not load. You can still copy the exact profile link.</p>
          ) : (
            <div className="rounded-xl border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/friends/qr/${encodeURIComponent(username)}`}
                alt={`QR code linking to @${username}`}
                onError={() => setFailed(true)}
                className="mx-auto aspect-square w-full max-w-52"
              />
            </div>
          )}
          <label className="grid gap-2 text-sm font-medium">
            Exact profile link
            <input
              readOnly
              value={profileUrl}
              className="min-h-11 w-full rounded-lg border bg-background px-3"
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p role="status" className="break-words text-sm">
            {status}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await navigator.clipboard.writeText(profileUrl);
                  setStatus("Profile link copied.");
                } catch {
                  setStatus("Copy was unavailable. Select and copy the profile link above.");
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Copying…" : "Copy link"}
            </Button>
            <Button variant="outline" asChild>
              <Link href={profileUrl} prefetch={false}>
                Preview saved profile
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </ResponsiveDetailPanel>
    </>
  );
}
