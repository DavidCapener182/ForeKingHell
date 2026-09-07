"use client";
import { useState } from "react";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
type ShareItem = {
  id: string;
  title: string;
  metricLabel: string;
  metricValue: string;
  context: string;
  footer: string;
  visibility: string;
};
export function AchievementSharePreview({ item }: { item: ShareItem | null }) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-semibold">Share an achievement</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Review the exact fields before downloading your latest available achievement card.
      </p>
      {item ? (
        <Button disabled={!ready} variant="outline" className="mt-3" onClick={() => setOpen(true)}>
          Preview achievement card
        </Button>
      ) : (
        <p className="mt-3 text-sm">No recent achievement card is available in your loaded feed.</p>
      )}
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
        title="Achievement card preview"
        description="Downloading a card does not post it or change your account visibility."
      >
        {item ? (
          <div className="grid gap-4 pb-4">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="break-words text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm">{item.metricLabel}</p>
              <p className="mt-1 break-words text-2xl font-semibold">{item.metricValue}</p>
              <p className="mt-3 break-words">{item.context}</p>
              <p className="mt-3 break-words text-sm text-muted-foreground">{item.footer}</p>
            </div>
            <p className="text-sm">
              Source feed audience: {item.visibility}. The downloaded image includes the title,
              metric label/value, context, verification label and username shown above. Anyone you
              send the file to can read those fields.
            </p>
            {error ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
            {saved ? <p role="status">Download started. Nothing has been posted.</p> : null}
            <Button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(null);
                setSaved(false);
                try {
                  const response = await fetch(`/api/share-cards/feed/${item.id}`);
                  if (
                    !response.ok ||
                    !response.headers.get("content-type")?.includes("image/svg+xml")
                  )
                    throw new Error("Card unavailable. Your feed permission may have changed.");
                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "forekinghell-achievement.svg";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setSaved(true);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not download the card. Try again.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Preparing card…" : "Download this card"}
            </Button>
            <Button disabled={pending} variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
