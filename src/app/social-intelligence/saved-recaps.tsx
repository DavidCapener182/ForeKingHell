"use client";
import { useClientReady } from "@/hooks/use-client-ready";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
export type SavedRecap = {
  id: string;
  summaryType: string;
  visibility: string;
  headline: string;
  body: string;
  model: string;
  createdAt: string;
  evidenceJson: Record<string, unknown>;
};
export type RecapEvidence = {
  id: string;
  headline: string;
  proofUrl: string | null;
  createdAt: string;
};
const date = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});
export function SavedRecaps({
  summaries,
  evidence,
}: {
  summaries: SavedRecap[];
  evidence: RecapEvidence[];
}) {
  const ready = useClientReady();
  const [selected, setSelected] = useState<SavedRecap | null>(null);
  const ids = (summary: SavedRecap) =>
    Array.isArray(summary.evidenceJson.feedItemIds)
      ? summary.evidenceJson.feedItemIds.filter((id): id is string => typeof id === "string")
      : [];
  return (
    <section className="grid gap-3" aria-label="Saved recaps">
      <h2 className="text-xl font-semibold">Saved recaps</h2>
      <p className="text-sm text-muted-foreground">
        Your 20 most recent saved recaps. Opening one does not regenerate or publish it.
      </p>
      {!summaries.length ? (
        <p className="rounded-xl border border-dashed p-4">No recaps generated yet.</p>
      ) : (
        summaries.map((summary) => (
          <article key={summary.id} className="grid min-w-0 gap-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{summary.summaryType.replaceAll("_", " ")}</Badge>
              <Badge variant="outline">{summary.visibility}</Badge>
            </div>
            <h3 className="break-words font-semibold">{summary.headline}</h3>
            <p className="text-sm text-muted-foreground">
              <time dateTime={summary.createdAt}>
                {date.format(new Date(summary.createdAt))} UK
              </time>{" "}
              · {ids(summary).length} source activities
            </p>
            <Button
              disabled={!ready}
              variant="outline"
              className="min-h-11 justify-self-start"
              onClick={() => setSelected(summary)}
              aria-label={`Read recap: ${summary.headline}`}
            >
              Read recap and evidence
            </Button>
          </article>
        ))
      )}
      <ResponsiveDetailPanel
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.headline ?? "Saved recap"}
        description="Original saved text and its stored evidence references."
      >
        {selected ? (
          <div className="grid gap-4">
            <p className="whitespace-pre-wrap break-words leading-7">{selected.body}</p>
            <p className="text-sm">Saved visibility: {selected.visibility}</p>
            <p className="text-sm text-muted-foreground">
              Generated with {selected.model} · {date.format(new Date(selected.createdAt))} UK
            </p>
            <h3 className="font-semibold">Source activities</h3>
            {ids(selected).length ? (
              ids(selected).map((id) => {
                const source = evidence.find((item) => item.id === id);
                return (
                  <article key={id} className="grid gap-2 rounded-lg border p-3">
                    <p className="break-words">
                      {source?.headline ?? "Source activity unavailable"}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">Activity ID: {id}</p>
                    {source ? (
                      <time className="text-sm" dateTime={source.createdAt}>
                        {date.format(new Date(source.createdAt))} UK
                      </time>
                    ) : null}
                    {source?.proofUrl?.startsWith("/") && !source.proofUrl.startsWith("//") ? (
                      <Button disabled={!ready} asChild variant="outline">
                        <a href={source.proofUrl}>Open original activity</a>
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No original activity link available.
                      </p>
                    )}
                  </article>
                );
              })
            ) : (
              <p>No source references were stored with this recap.</p>
            )}
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
