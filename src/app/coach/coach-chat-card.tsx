"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

import { trackPlausibleEvent } from "@/lib/analytics";
import type { CoachSqlCitation } from "@/lib/coach-sql-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";

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
    <div className="space-y-4 px-4" data-coach-chat-ready={isReady ? "true" : "false"}>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor={questionId}>
          Ask from your shot data
        </label>
        <InputGroup className="min-h-28 items-stretch bg-card shadow-sm">
          <InputGroupTextarea
            id={questionId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="How can I improve my 7 iron dispersion?"
            className="min-h-20 resize-y px-3 pt-3 text-sm"
            maxLength={600}
            disabled={!isReady}
          />
          <InputGroupAddon align="block-end" className="justify-end border-t px-2 pt-2">
            <Button
              type="button"
              size="sm"
              onClick={askCoach}
              disabled={!isReady || isPending || !question.trim()}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Ask coach
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {error ? (
        <Alert variant="destructive">
          <MessageCircle className="size-4" aria-hidden />
          <AlertTitle>Coach could not answer</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {response ? (
        <section className="rounded-lg border bg-muted/30 p-4" data-coach-chat-answer>
          <p className="text-sm leading-6">{response.answer}</p>
          {response.citations.length > 0 ? (
            <Accordion type="single" collapsible className="mt-4 border-t">
              <AccordionItem value="citations">
                <AccordionTrigger>Cited data ({response.citations.length})</AccordionTrigger>
                <AccordionContent className="grid gap-2">
                  {response.citations.slice(0, 5).map((citation) =>
                    citation.href ? (
                      <Button
                        key={citation.id}
                        asChild
                        variant="outline"
                        className="h-auto justify-start whitespace-normal p-3 text-left"
                      >
                        <Link href={citation.href} prefetch={false}>
                          <span>
                            <span className="block font-medium">{citation.label}</span>
                            <span className="block text-muted-foreground">{citation.detail}</span>
                          </span>
                        </Link>
                      </Button>
                    ) : (
                      <div key={citation.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                        <span className="font-medium">{citation.label}</span>
                        <span className="block text-muted-foreground">{citation.detail}</span>
                      </div>
                    ),
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
