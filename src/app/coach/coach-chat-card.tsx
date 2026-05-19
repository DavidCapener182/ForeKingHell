"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { trackPlausibleEvent } from "@/lib/analytics";
import type { CoachSqlCitation } from "@/lib/coach-sql-context";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

type CoachChatResponse = {
  answer: string;
  citations: CoachSqlCitation[];
  generatedAt: string;
};

export function CoachChatCard({ questionId = "coach-question" }: { questionId?: string }) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<CoachChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setIsReady(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, []);

  async function askCoach() {
    const message = question.trim();

    if (!message || isPending) {
      return;
    }

    setIsPending(true);
    setError(null);

    try {
      const result = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await result.json().catch(() => null)) as
        | (CoachChatResponse & { message?: string })
        | null;

      if (!result.ok || !payload?.answer) {
        setError(payload?.message ?? "Could not answer that coach question.");
        return;
      }

      setResponse(payload);
      trackPlausibleEvent("AI Coach Generated", {
        props: {
          mode: "chat",
          citationCount: payload.citations.length,
        },
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <CardContent className="space-y-4" data-coach-chat-ready={isReady ? "true" : "false"}>
      <div className="grid gap-3">
        <label className="grid gap-2 text-sm font-medium" htmlFor={questionId}>
          Ask from your shot data
          <textarea
            id={questionId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="How can I improve my 7 iron dispersion?"
            className="min-h-24 resize-y rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            maxLength={600}
            disabled={!isReady}
          />
        </label>
        <Button
          type="button"
          onClick={askCoach}
          disabled={!isReady || isPending || !question.trim()}
          className="w-fit"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          Ask coach
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {response ? (
        <div className="apple-panel-strong p-4">
          <p className="text-sm leading-6">{response.answer}</p>
          {response.citations.length > 0 ? (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Cited data
              </p>
              <div className="mt-2 grid gap-2">
                {response.citations.slice(0, 5).map((citation) =>
                  citation.href ? (
                    <Link
                      key={citation.id}
                      href={citation.href}
                      prefetch={false}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-emerald-50"
                    >
                      <span className="font-medium">{citation.label}</span>
                      <span className="block text-muted-foreground">{citation.detail}</span>
                    </Link>
                  ) : (
                    <div key={citation.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium">{citation.label}</span>
                      <span className="block text-muted-foreground">{citation.detail}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </CardContent>
  );
}
