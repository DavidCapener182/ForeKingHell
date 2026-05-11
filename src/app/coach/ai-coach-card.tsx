"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { InsightBlock } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import type {
  AiCoachGeneratedSummary,
  AiCoachPayload,
} from "@/lib/ai-coach-summary";

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
      const data = (await response.json().catch(() => null)) as
        | { summary?: AiCoachGeneratedSummary; message?: string }
        | null;

      if (!response.ok || !data?.summary) {
        setError(data?.message ?? "Could not generate the AI coach note.");
        return;
      }

      setSummary(data.summary);
    } finally {
      setIsSummaryPending(false);
    }
  }

  return (
    <CardContent className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm leading-6 text-muted-foreground">
            Generate a plain-English coach note from the current derived analytics. This sends only
            summary metrics, not raw shot rows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateSummary} disabled={isSummaryPending}>
            {isSummaryPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Coach note
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_0.85fr]">
          <InsightBlock
            label={summary.confidence === "high" ? "AI coach note" : `AI coach note - ${summary.confidence} confidence`}
            value={summary.headline}
            detail={summary.coachNote}
            tone={summary.confidence === "high" ? "green" : summary.confidence === "low" ? "amber" : "sky"}
          />
          <div className="rounded-xl border bg-[#f9fafb] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Practice steps
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-6">
              {summary.practicePlan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
              {summary.watchOut}
            </p>
          </div>
        </div>
      ) : null}
    </CardContent>
  );
}
