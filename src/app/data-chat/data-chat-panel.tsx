"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";

import { trackPlausibleEvent } from "@/lib/analytics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

type AssistantChatTurn = Extract<ChatTurn, { role: "assistant" }>;

type SavedDataChatAnswer = {
  id: string;
  question: string;
  answer: string;
  confidence: DataChatResponse["confidence"];
  citations: DataChatCitation[];
  generatedAt: string;
};

const savedAnswersStorageKey = "fkh:data-chat-saved-answers";

const starterQuestions = [
  "What should I practise?",
  "Which club is least reliable?",
  "What changed recently?",
  "Why did my scoring improve?",
  "Build a 30-minute practice session.",
];

const savedAnswerDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function DataChatPanel({
  monthlyRemaining,
  questionId,
  initialQuestion,
  suggestions = starterQuestions,
  embedded = false,
}: {
  monthlyRemaining: number;
  questionId?: string;
  initialQuestion?: string;
  suggestionStyle?: "commands";
  suggestions?: string[];
  embedded?: boolean;
}) {
  const generatedId = useId();
  const inputId = questionId ?? `data-chat-question-${generatedId}`;
  const loadedQuestion = initialQuestion?.trim().slice(0, 800) ?? "";
  const evidencePanelRef = useRef<HTMLElement>(null);
  const [question, setQuestion] = useState(loadedQuestion);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [savedAnswers, setSavedAnswers] = useState<SavedDataChatAnswer[]>([]);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      setIsReady(true);
      setSavedAnswers(readSavedAnswers());
    }, 0);
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
      setActiveCitationId(payload.citations[0]?.id ?? null);
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

  function startNewConversation() {
    setTurns([]);
    setQuestion("");
    setError(null);
    setActiveCitationId(null);
  }

  function selectCitation(citation: DataChatCitation) {
    setActiveCitationId(citation.id);
    window.requestAnimationFrame(() => {
      evidencePanelRef.current?.focus({ preventScroll: true });
    });
  }

  function saveAssistantTurn(turn: AssistantChatTurn, sourceQuestion: string) {
    const saved: SavedDataChatAnswer = {
      id: `saved-${Date.now()}`,
      question: sourceQuestion,
      answer: turn.content,
      confidence: turn.confidence,
      citations: turn.citations.slice(0, 6),
      generatedAt: new Date().toISOString(),
    };
    const next = [
      saved,
      ...savedAnswers.filter(
        (answer) => answer.answer !== turn.content || answer.question !== sourceQuestion,
      ),
    ].slice(0, 12);

    setSavedAnswers(next);
    window.localStorage.setItem(savedAnswersStorageKey, JSON.stringify(next));
  }

  function removeSavedAnswer(answerId: string) {
    const next = savedAnswers.filter((answer) => answer.id !== answerId);
    setSavedAnswers(next);
    window.localStorage.setItem(savedAnswersStorageKey, JSON.stringify(next));
  }

  const latestAssistant = findLatestAssistant(turns);
  const conversationCitations = collectConversationCitations(turns);
  const activeCitation =
    conversationCitations.find((citation) => citation.id === activeCitationId) ??
    conversationCitations[0] ??
    null;
  const remainingCredits = latestAssistant?.creditsRemaining ?? monthlyRemaining;

  return (
    <div
      className={cn(
        "grid min-h-[42rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border bg-card shadow-[0_18px_60px_-42px_hsl(var(--foreground)/0.35)]",
        embedded ? "h-[min(72dvh,58rem)]" : "h-[calc(100dvh-5.5rem)]",
      )}
      data-data-chat-ready={isReady ? "true" : "false"}
    >
      <DataChatHeader
        latestAssistant={latestAssistant}
        evidenceCount={conversationCitations.length}
        savedCount={savedAnswers.length}
        onNewConversation={startNewConversation}
        savedAnswers={savedAnswers}
        onReuseQuestion={setQuestion}
        onRemoveAnswer={removeSavedAnswer}
      />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0">
        <ResizablePanel defaultSize="67" minSize="65" maxSize="70">
          <div className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] bg-background/45">
            <ScrollArea
              className="min-h-0"
              aria-label="Data Chat conversation"
              aria-live="polite"
              data-data-chat-conversation
            >
              <div className="mx-auto grid min-h-full w-full content-start gap-10 px-6 py-10 xl:px-10">
                {turns.length > 0 ? (
                  turns.map((turn, index) => {
                    if (turn.role === "user") {
                      return <UserTurn key={turn.id} content={turn.content} />;
                    }

                    const sourceQuestion = findSourceQuestion(turns, index);
                    const isSaved = savedAnswers.some(
                      (answer) =>
                        answer.answer === turn.content && answer.question === sourceQuestion,
                    );

                    return (
                      <AssistantTurn
                        key={turn.id}
                        turn={turn}
                        sourceQuestion={sourceQuestion}
                        onAskFollowUp={(followUp) => void submitQuestion(followUp)}
                        onSelectCitation={selectCitation}
                        onSave={saveAssistantTurn}
                        saved={isSaved}
                        disabled={!isReady || isPending}
                        activeCitationId={activeCitationId}
                      />
                    );
                  })
                ) : (
                  <DataChatEmptyState
                    disabled={!isReady || isPending}
                    questions={suggestions}
                    onSubmit={(starter) => void submitQuestion(starter)}
                  />
                )}

                {isPending ? <AnalystThinking /> : null}
              </div>
            </ScrollArea>

            <div className="relative z-10 border-t bg-card/95 px-5 py-4 shadow-[0_-18px_45px_-35px_hsl(var(--foreground)/0.55)] backdrop-blur-xl xl:px-8">
              {loadedQuestion && turns.length === 0 ? (
                <div
                  className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-primary/7 px-3 py-2 text-xs text-foreground"
                  data-initial-data-chat-prompt
                  role="status"
                >
                  <span className="truncate">
                    <span className="font-medium">Prompt ready:</span> {loadedQuestion}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    disabled={!isReady || isPending}
                    onClick={() => void submitQuestion(loadedQuestion)}
                  >
                    Ask now
                  </Button>
                </div>
              ) : null}

              {error ? (
                <Alert variant="destructive" className="mb-3">
                  <CircleDot className="size-4" aria-hidden />
                  <AlertTitle>Data Chat could not answer</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <form
                id="data-chat-composer"
                className="scroll-mt-28"
                onSubmit={onSubmit}
                data-data-chat-composer
              >
                <label className="sr-only" htmlFor={inputId}>
                  Ask about your golf data
                </label>
                <InputGroup className="min-h-32 items-stretch rounded-xl border-border bg-background shadow-sm focus-within:border-primary/45">
                  <InputGroupTextarea
                    id={inputId}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask a question about your game…"
                    className="min-h-20 resize-none px-4 pt-4 text-[0.95rem] leading-6"
                    maxLength={800}
                    disabled={!isReady}
                    data-page-search
                  />
                  <InputGroupAddon
                    align="block-end"
                    className="justify-between border-t border-border/70 px-3 pt-2"
                  >
                    <span className="text-[11px] text-muted-foreground">
                      {remainingCredits.toLocaleString("en-GB")} credits remaining
                    </span>
                    <Button
                      type="submit"
                      size="lg"
                      className="rounded-lg px-4"
                      disabled={!isReady || isPending || !question.trim()}
                    >
                      <span
                        className="t-icon-swap"
                        data-state={isPending ? "b" : "a"}
                        aria-hidden="true"
                      >
                        <span className="t-icon" data-icon="a">
                          <Send className="size-4" />
                        </span>
                        <span className="t-icon" data-icon="b">
                          <Loader2
                            className={cn(
                              "size-4 motion-reduce:animate-none",
                              isPending && "animate-spin",
                            )}
                          />
                        </span>
                      </span>
                      Ask analyst
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </form>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="33" minSize="30" maxSize="35">
          <EvidenceContextPanel
            ref={evidencePanelRef}
            citations={conversationCitations}
            activeCitation={activeCitation}
            confidence={latestAssistant?.confidence ?? null}
            onSelectCitation={selectCitation}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function DataChatHeader({
  latestAssistant,
  evidenceCount,
  savedCount,
  onNewConversation,
  savedAnswers,
  onReuseQuestion,
  onRemoveAnswer,
}: {
  latestAssistant: AssistantChatTurn | null;
  evidenceCount: number;
  savedCount: number;
  onNewConversation: () => void;
  savedAnswers: SavedDataChatAnswer[];
  onReuseQuestion: (question: string) => void;
  onRemoveAnswer: (answerId: string) => void;
}) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b px-5 py-3 xl:px-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 id="data-chat-heading" className="text-lg font-semibold tracking-tight">
            Data Chat
          </h1>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            {evidenceCount > 0
              ? `${evidenceCount} cited source${evidenceCount === 1 ? "" : "s"}`
              : "Evidence available"}
            <span aria-hidden>·</span>
            {latestAssistant
              ? `${capitalize(latestAssistant.confidence)} confidence`
              : "Confidence pending"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <SavedAnswersHistory
          answers={savedAnswers}
          count={savedCount}
          onReuseQuestion={onReuseQuestion}
          onRemoveAnswer={onRemoveAnswer}
        />
        <Button type="button" variant="outline" onClick={onNewConversation}>
          <MessageSquarePlus className="size-4" />
          <span className="hidden xl:inline">New conversation</span>
          <span className="xl:hidden">New</span>
        </Button>
      </div>
    </header>
  );
}

function DataChatEmptyState({
  disabled,
  questions,
  onSubmit,
}: {
  disabled: boolean;
  questions: string[];
  onSubmit: (question: string) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-[48rem] content-center py-4" data-data-chat-empty>
      <div className="mb-8">
        <span className="mb-5 grid size-10 place-items-center rounded-full border bg-card text-primary shadow-sm">
          <Sparkles className="size-[1.125rem]" aria-hidden />
        </span>
        <h2 className="text-3xl font-semibold tracking-[-0.035em] text-balance">
          What do you want to understand?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Ask for a diagnosis, a change over time, or the next practice decision. The answer will
          separate what the data supports from what it cannot prove yet.
        </p>
      </div>

      <Command
        className="rounded-none border-y bg-transparent p-0"
        aria-label="Suggested Data Chat questions"
        data-data-chat-starters
      >
        <CommandList className="max-h-none p-0">
          <CommandGroup
            heading="Suggested questions"
            className="p-0 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:pb-3"
          >
            {questions.map((starter, index) => (
              <CommandItem
                key={starter}
                value={starter}
                disabled={disabled}
                onSelect={() => onSubmit(starter)}
                className="min-h-12 rounded-none border-t border-border/65 px-0 data-[selected=true]:bg-transparent data-[selected=true]:text-primary first:border-t-0"
              >
                <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-medium">{starter}</span>
                <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-data-[selected=true]/command-item:translate-x-1 group-data-[selected=true]/command-item:text-primary" />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

function UserTurn({ content }: { content: string }) {
  return (
    <div className="flex justify-end" data-chat-role="user">
      <div className="max-w-[min(34rem,78%)] rounded-2xl rounded-br-md bg-muted px-4 py-3 text-sm leading-6 text-foreground">
        {content}
      </div>
    </div>
  );
}

function AnalystThinking() {
  return (
    <div
      className="grid max-w-[46rem] gap-3"
      role="status"
      aria-label="Analyst is reviewing your evidence"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
        <span className="t-shimmer" data-text="Reviewing your evidence">
          Reviewing your evidence
        </span>
      </div>
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}

function AssistantTurn({
  turn,
  sourceQuestion,
  onAskFollowUp,
  onSelectCitation,
  onSave,
  saved,
  disabled,
  activeCitationId,
}: {
  turn: AssistantChatTurn;
  sourceQuestion: string;
  onAskFollowUp: (question: string) => void;
  onSelectCitation: (citation: DataChatCitation) => void;
  onSave: (turn: AssistantChatTurn, sourceQuestion: string) => void;
  saved: boolean;
  disabled: boolean;
  activeCitationId: string | null;
}) {
  const drillItems = [...turn.tips, ...turn.drills].slice(0, 6);

  return (
    <article className="max-w-[50rem]" data-chat-role="assistant">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Golf analyst</span>
        <span className="text-xs capitalize text-muted-foreground">
          {turn.confidence} confidence
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          disabled={disabled && !saved}
          onClick={() => onSave(turn, sourceQuestion)}
        >
          <span className="t-icon-swap" data-state={saved ? "b" : "a"} aria-hidden="true">
            <span className="t-icon" data-icon="a">
              <BookmarkPlus className="size-3.5" />
            </span>
            <span className="t-icon" data-icon="b">
              <Check className="size-3.5" />
            </span>
          </span>
          <span
            key={saved ? "saved" : "save"}
            className="t-text-state"
            data-motion-ready={saved ? "true" : "false"}
          >
            {saved ? "Saved" : "Save"}
          </span>
        </Button>
      </div>

      <AnalystSection number="01" title="Answer">
        <p className="text-[0.95rem] leading-7 text-foreground">{turn.content}</p>
      </AnalystSection>

      <AnalystSection number="02" title="Evidence">
        {turn.citations.length > 0 ? (
          <div className="grid gap-1.5">
            {turn.citations.slice(0, 6).map((citation, index) => (
              <button
                key={citation.id}
                type="button"
                onClick={() => onSelectCitation(citation)}
                aria-label={`Open evidence: ${citation.label}`}
                aria-pressed={activeCitationId === citation.id}
                className={cn(
                  "group flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  activeCitationId === citation.id
                    ? "border-primary/30 bg-primary/7"
                    : "border-border/70 bg-card hover:border-primary/25 hover:bg-muted/45",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground">[{index + 1}]</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{citation.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {citation.detail}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            No saved record directly supports this part of the answer. Treat it as low-confidence
            guidance.
          </p>
        )}
      </AnalystSection>

      <AnalystSection number="03" title="Drills">
        {drillItems.length > 0 ? (
          <ol className="grid gap-3">
            {drillItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[9px] text-muted-foreground">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            No drill is justified by the available evidence yet. Ask for a practice session when you
            want one built.
          </p>
        )}
      </AnalystSection>

      <AnalystSection number="04" title="Next question" last>
        {turn.followUpQuestions.length > 0 ? (
          <div className="divide-y rounded-lg border bg-card">
            {turn.followUpQuestions.slice(0, 3).map((followUp) => (
              <button
                key={followUp}
                type="button"
                disabled={disabled}
                onClick={() => onAskFollowUp(followUp)}
                className="group flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium outline-none transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/55 focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">{followUp}</span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onAskFollowUp("What should I practise next based on this answer?")}
          >
            Turn this into a practice decision
            <ArrowRight className="size-4" />
          </Button>
        )}
      </AnalystSection>
    </article>
  );
}

function AnalystSection({
  number,
  title,
  children,
  last = false,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cn("grid grid-cols-[3.25rem_minmax(0,1fr)]", !last && "pb-8")}>
      <div className="relative font-mono text-[10px] text-muted-foreground">
        {number}
        {!last ? (
          <span className="absolute top-6 bottom-0 left-2 w-px bg-border" aria-hidden />
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </h3>
        {children}
      </div>
    </section>
  );
}

const EvidenceContextPanel = function EvidenceContextPanel({
  ref,
  citations,
  activeCitation,
  confidence,
  onSelectCitation,
}: {
  ref: React.Ref<HTMLElement>;
  citations: DataChatCitation[];
  activeCitation: DataChatCitation | null;
  confidence: DataChatResponse["confidence"] | null;
  onSelectCitation: (citation: DataChatCitation) => void;
}) {
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label="Evidence context"
      className="h-full min-h-0 min-w-0 overflow-y-auto bg-muted/18 outline-none"
      data-evidence-context-panel
    >
      <div className="border-b px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Evidence context
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {citations.length > 0
              ? `${citations.length} source${citations.length === 1 ? "" : "s"} in this answer`
              : "Ready for your question"}
          </p>
          {confidence ? (
            <Badge variant="outline" className="capitalize">
              {confidence}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 p-5">
        {activeCitation ? (
          <section data-active-evidence>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Selected evidence
            </p>
            <div className="mt-3 rounded-xl border border-primary/25 bg-card p-4 shadow-sm">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-4" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold leading-5">{activeCitation.label}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {activeCitation.detail}
              </p>
              {activeCitation.href ? (
                <Button asChild variant="outline" className="mt-4 w-full justify-between">
                  <Link href={activeCitation.href} prefetch={false}>
                    Open source record
                    <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              ) : (
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                  This source has no separate record view.
                </p>
              )}
            </div>
          </section>
        ) : (
          <section>
            <span className="grid size-9 place-items-center rounded-xl border bg-card text-primary shadow-sm">
              <Database className="size-4" aria-hidden />
            </span>
            <h2 className="mt-4 text-base font-semibold">Evidence appears here</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ask a question and cited shots, rounds, bag or practice records will stay beside the
              conversation while you read the answer.
            </p>
          </section>
        )}

        {citations.length > 1 ? (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              All cited sources
            </p>
            <div className="mt-3 divide-y border-y">
              {citations.map((citation, index) => (
                <button
                  key={citation.id}
                  type="button"
                  onClick={() => onSelectCitation(citation)}
                  className="group flex w-full items-start gap-3 py-3 text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
                  aria-current={activeCitation?.id === citation.id ? "true" : undefined}
                >
                  <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-5">{citation.label}</span>
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {citation.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-dashed p-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Target className="size-3.5 text-primary" aria-hidden />
            How confidence works
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Confidence reflects the coverage and consistency of the records behind an answer—not how
            certain the wording sounds.
          </p>
        </section>
      </div>
    </aside>
  );
};

function SavedAnswersHistory({
  answers,
  count,
  onReuseQuestion,
  onRemoveAnswer,
}: {
  answers: SavedDataChatAnswer[];
  count: number;
  onReuseQuestion: (question: string) => void;
  onRemoveAnswer: (answerId: string) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" aria-label={`Saved answers, ${count}`}>
          <History className="size-4" />
          <span className="hidden xl:inline">Saved</span>
          {count > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-muted px-1 text-[10px]">
              {count}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(31rem,94vw)] sm:max-w-[31rem]">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Saved answers</SheetTitle>
          <SheetDescription>
            Useful analyses kept on this device. They stay out of the conversation until you need
            them.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          {answers.length > 0 ? (
            <div className="divide-y">
              {answers.map((answer) => (
                <article key={answer.id} className="py-5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <Clock3 className="size-3" aria-hidden />
                    {formatSavedAnswerDate(answer.generatedAt)}
                    <span aria-hidden>·</span>
                    <span className="capitalize">{answer.confidence} confidence</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-5">{answer.question}</h3>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">
                    {answer.answer}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {answer.citations.length} cited record
                    {answer.citations.length === 1 ? "" : "s"}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <SheetClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onReuseQuestion(answer.question)}
                      >
                        Reuse question
                      </Button>
                    </SheetClose>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onRemoveAnswer(answer.id)}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center text-center">
              <div>
                <BookmarkPlus className="mx-auto size-5 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm font-medium">No saved answers yet</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Save a useful analyst answer and it will appear here.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function findLatestAssistant(turns: ChatTurn[]) {
  return ([...turns].reverse().find((turn) => turn.role === "assistant") ??
    null) as AssistantChatTurn | null;
}

function collectConversationCitations(turns: ChatTurn[]) {
  const seen = new Set<string>();

  return [...turns]
    .reverse()
    .flatMap((turn) => (turn.role === "assistant" ? turn.citations : []))
    .filter((citation) => {
      if (seen.has(citation.id)) return false;
      seen.add(citation.id);
      return true;
    });
}

function findSourceQuestion(turns: ChatTurn[], assistantIndex: number) {
  return (
    [...turns.slice(0, assistantIndex)].reverse().find((turn) => turn.role === "user")?.content ??
    "Saved Data Chat answer"
  );
}

function readSavedAnswers() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedAnswersStorageKey) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedDataChatAnswer[]).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function formatSavedAnswerDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return savedAnswerDateFormatter.format(date);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
