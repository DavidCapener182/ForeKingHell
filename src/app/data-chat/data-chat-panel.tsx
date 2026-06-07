"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { Loader2, MessageCircle, Sparkles } from "lucide-react";

import { trackPlausibleEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type DataChatCitation = {
  id: string;
  label: string;
  detail: string;
  href: string | null;
};

type DataChatResponse = {
  answer: string;
  tips: string[];
  drills: string[];
  followUpQuestions: string[];
  confidence: "low" | "medium" | "high";
  citations: DataChatCitation[];
  generatedAt: string;
  creditsCharged: number;
  creditsRemaining: number;
  message?: string;
};

type ChatTurn =
  | {
      id: string;
      role: "user";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      tips: string[];
      drills: string[];
      followUpQuestions: string[];
      confidence: DataChatResponse["confidence"];
      citations: DataChatCitation[];
      creditsCharged: number;
      creditsRemaining: number;
    };

const starterQuestions = [
  "What should I practise next?",
  "Which club is least reliable?",
  "Give me a 20-ball drill from my data",
  "What changed in my recent rounds?",
];

export function DataChatPanel({
  monthlyRemaining,
  questionId,
}: {
  monthlyRemaining: number;
  questionId?: string;
}) {
  const generatedId = useId();
  const inputId = questionId ?? `data-chat-question-${generatedId}`;
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setIsReady(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, []);

  async function submitQuestion(nextQuestion = question) {
    const message = nextQuestion.trim();

    if (!message || isPending) {
      return;
    }

    setIsPending(true);
    setError(null);
    setQuestion("");
    setTurns((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
      },
    ]);

    try {
      const result = await fetch("/api/ai/data-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await result.json().catch(() => null)) as DataChatResponse | null;

      if (!result.ok || !payload?.answer) {
        setError(payload?.message ?? "Could not answer that data question.");
        return;
      }

      setTurns((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.answer,
          tips: payload.tips,
          drills: payload.drills,
          followUpQuestions: payload.followUpQuestions,
          confidence: payload.confidence,
          citations: payload.citations,
          creditsCharged: payload.creditsCharged,
          creditsRemaining: payload.creditsRemaining,
        },
      ]);
      trackPlausibleEvent("AI Data Chat Generated", {
        props: {
          citationCount: payload.citations.length,
          confidence: payload.confidence,
        },
      });
    } finally {
      setIsPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion();
  }

  const latestAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
  const remainingCredits =
    latestAssistant?.role === "assistant" ? latestAssistant.creditsRemaining : monthlyRemaining;

  return (
    <div className="grid min-w-0 gap-4" data-data-chat-ready={isReady ? "true" : "false"}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {starterQuestions.map((starter) => (
          <Button
            key={starter}
            type="button"
            variant="outline"
            className="h-auto min-h-11 justify-start whitespace-normal px-3 py-2 text-left leading-5"
            disabled={!isReady || isPending}
            onClick={() => void submitQuestion(starter)}
          >
            <Sparkles className="size-4" />
            {starter}
          </Button>
        ))}
      </div>

      <div className="grid min-h-[22rem] gap-3 rounded-lg border border-slate-200 bg-white/85 p-3 sm:p-4">
        {turns.length > 0 ? (
          <div className="grid content-start gap-3">
            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[min(38rem,88%)] rounded-lg bg-emerald-700 px-3 py-2 text-sm leading-6 text-white shadow-sm">
                    {turn.content}
                  </div>
                </div>
              ) : (
                <AssistantTurn
                  key={turn.id}
                  turn={turn}
                  onAskFollowUp={(followUp) => void submitQuestion(followUp)}
                  disabled={!isReady || isPending}
                />
              ),
            )}
          </div>
        ) : (
          <div className="grid place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
            <div>
              <MessageCircle className="mx-auto size-8 text-emerald-700" />
              <p className="mt-3 text-sm font-medium text-slate-900">Ask from your golf data</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Stock yardages, shots, rounds, speed work, practice, challenges and achievements.
              </p>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <form className="grid gap-3" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm font-medium" htmlFor={inputId}>
          Question
          <Textarea
            id={inputId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Which part of my game is costing me most right now?"
            className="min-h-24 resize-y bg-white"
            maxLength={800}
            disabled={!isReady}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {remainingCredits.toLocaleString("en-GB")} AI credits left this month
          </p>
          <Button type="submit" disabled={!isReady || isPending || !question.trim()}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageCircle className="size-4" />
            )}
            Ask data chat
          </Button>
        </div>
      </form>
    </div>
  );
}

function AssistantTurn({
  turn,
  onAskFollowUp,
  disabled,
}: {
  turn: Extract<ChatTurn, { role: "assistant" }>;
  onAskFollowUp: (question: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="max-w-[min(46rem,94%)] rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm leading-6 text-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium capitalize text-emerald-900 ring-1 ring-emerald-200">
          {turn.confidence} confidence
        </span>
        <span className="text-xs text-muted-foreground">{turn.creditsCharged} credit charged</span>
      </div>
      <p className="mt-3">{turn.content}</p>

      {turn.tips.length > 0 || turn.drills.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {turn.tips.length > 0 ? (
            <ResponseList title="Tips" items={turn.tips.slice(0, 4)} />
          ) : null}
          {turn.drills.length > 0 ? (
            <ResponseList title="Drills" items={turn.drills.slice(0, 3)} />
          ) : null}
        </div>
      ) : null}

      {turn.citations.length > 0 ? (
        <div className="mt-4 border-t border-emerald-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Cited data
          </p>
          <div className="mt-2 grid gap-2">
            {turn.citations.slice(0, 6).map((citation) =>
              citation.href ? (
                <Link
                  key={citation.id}
                  href={citation.href}
                  prefetch={false}
                  className="rounded-lg bg-white px-3 py-2 hover:bg-emerald-50"
                >
                  <span className="font-medium">{citation.label}</span>
                  <span className="block text-muted-foreground">{citation.detail}</span>
                </Link>
              ) : (
                <div key={citation.id} className="rounded-lg bg-white px-3 py-2">
                  <span className="font-medium">{citation.label}</span>
                  <span className="block text-muted-foreground">{citation.detail}</span>
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      {turn.followUpQuestions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {turn.followUpQuestions.slice(0, 3).map((followUp) => (
            <button
              key={followUp}
              type="button"
              disabled={disabled}
              onClick={() => onAskFollowUp(followUp)}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
            >
              {followUp}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResponseList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-100">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
