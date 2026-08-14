"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { InsightBlock } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { trackPlausibleEvent } from "@/lib/analytics";
import type { AiCoachGeneratedSummary, AiCoachPayload } from "@/lib/ai-coach-summary";

type AiCoachCardProps = {
  payload: AiCoachPayload;
};

export function AiCoachCard({ payload }: AiCoachCardProps) {
  const [summary, setSummary] = useState<AiCoachGeneratedSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSummaryPending, setIsSummaryPending] = useState(false);

  async function generateSummary() {
    setError(null);
    setIsSummaryPending(true);

    try {
      const response = await fetch("/api/coach/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = (await response.json().catch(() => null)) as {
        summary?: AiCoachGeneratedSummary;
        message?: string;
      } | null;

      if (!response.ok || !data?.summary) {
        setError(data?.message ?? "Could not generate the AI coach note.");
        return;
      }

      setSummary(data.summary);
      trackPlausibleEvent("AI Coach Generated", {
        props: {
          clubCount: payload.clubs.length,
          signalCount: payload.signals.length,
        },
      });
    } finally {
      setIsSummaryPending(false);
    }
  }

  return (
    <div className="space-y-4 px-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm leading-6 text-muted-foreground">
            Generate a plain-English coach note from the current derived analytics. This sends only
            summary metrics, not raw shot rows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateSummary} disabled={isSummaryPending}>
            {isSummaryPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Coach note
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <Sparkles className="size-4" aria-hidden />
          <AlertTitle>Coach note unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {summary ? (
        <div className="grid gap-3">
          <InsightBlock
            label={
              summary.confidence === "high"
                ? "AI coach note"
                : `AI coach note - ${summary.confidence} confidence`
            }
            value={summary.headline}
            detail={summary.coachNote}
            tone={
              summary.confidence === "high"
                ? "green"
                : summary.confidence === "low"
                  ? "amber"
                  : "sky"
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <AiEvidenceTile label="Recommendation" value={summary.recommendation} />
            <AiEvidenceTile label="Evidence" value={summary.evidence} />
            <AiEvidenceTile label="Confidence" value={summary.confidence} />
            <AiEvidenceTile label="Drill" value={summary.drill} />
            <AiEvidenceTile label="Time needed" value={summary.timeNeeded} />
            <AiEvidenceTile label="Retest" value={summary.retest} />
          </div>
          <section className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Practice steps
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-6">
              {summary.practicePlan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{summary.watchOut}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AiEvidenceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}
