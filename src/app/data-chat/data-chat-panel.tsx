"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Copy,
  Download,
  ChevronDown,
  FileText,
  Loader2,
  MessageCircle,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { trackPlausibleEvent } from "@/lib/analytics";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { DataTableFrame } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type SavedDataChatAnswer = {
  id: string;
  question: string;
  answer: string;
  confidence: DataChatResponse["confidence"];
  citations: DataChatCitation[];
  generatedAt: string;
};

type ReportShareStatus = "idle" | "copied" | "exported" | "shared" | "failed";

const savedAnswersStorageKey = "fkh:data-chat-saved-answers";

const starterQuestions = [
  "What should I practise next?",
  "Which club is least reliable?",
  "Give me a 20-ball drill from my data",
  "What changed in my recent rounds?",
];

const savedAnswerColumns: DesktopWorkbenchColumn[] = [
  { id: "question", label: "Question", locked: true },
  { id: "answer", label: "Answer" },
  { id: "confidence", label: "Confidence" },
  { id: "citations", label: "Citations" },
  { id: "saved", label: "Saved" },
  { id: "action", label: "Action" },
];

const savedAnswerSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "High-confidence answers",
    href: "/data-chat#saved-data-chat-answers",
    detail: "Keep question, answer, confidence and citations visible for report drafting.",
  },
  {
    title: "Practice-plan source",
    href: "/data-chat?prompt=Build%20a%20practice%20plan#data-chat-composer",
    detail: "Start from saved advice before turning it into a coach or practice plan.",
  },
  {
    title: "Cited evidence",
    href: "/data-chat#saved-data-chat-answers",
    detail: "Review citation counts before reusing an answer in a shareable report.",
  },
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
}: {
  monthlyRemaining: number;
  questionId?: string;
  initialQuestion?: string;
}) {
  const generatedId = useId();
  const inputId = questionId ?? `data-chat-question-${generatedId}`;
  const loadedQuestion = initialQuestion?.trim().slice(0, 800) ?? "";
  const [question, setQuestion] = useState(loadedQuestion);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [savedAnswers, setSavedAnswers] = useState<SavedDataChatAnswer[]>([]);
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

  function saveAssistantTurn(
    turn: Extract<ChatTurn, { role: "assistant" }>,
    sourceQuestion: string,
  ) {
    const saved: SavedDataChatAnswer = {
      id: `saved-${Date.now()}`,
      question: sourceQuestion,
      answer: turn.content,
      confidence: turn.confidence,
      citations: turn.citations.slice(0, 4),
      generatedAt: new Date().toISOString(),
    };
    const next = [
      saved,
      ...savedAnswers.filter(
        (answer) => answer.answer !== turn.content || answer.question !== sourceQuestion,
      ),
    ].slice(0, 8);

    setSavedAnswers(next);
    window.localStorage.setItem(savedAnswersStorageKey, JSON.stringify(next));
  }

  function removeSavedAnswer(answerId: string) {
    const next = savedAnswers.filter((answer) => answer.id !== answerId);
    setSavedAnswers(next);
    window.localStorage.setItem(savedAnswersStorageKey, JSON.stringify(next));
  }

  const latestAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
  const remainingCredits =
    latestAssistant?.role === "assistant" ? latestAssistant.creditsRemaining : monthlyRemaining;

  return (
    <div className="grid min-w-0 gap-4" data-data-chat-ready={isReady ? "true" : "false"}>
      <Command
        className="border bg-card shadow-sm"
        aria-label="Suggested Data Chat questions"
        data-data-chat-starters
      >
        <CommandList className="max-h-none">
          <CommandGroup
            heading="Suggested questions"
            className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-2 [&_[cmdk-group-items]]:gap-1 xl:[&_[cmdk-group-items]]:grid-cols-4"
          >
            {starterQuestions.map((starter) => (
              <CommandItem
                key={starter}
                value={starter}
                disabled={!isReady || isPending}
                onSelect={() => void submitQuestion(starter)}
                className="items-start whitespace-normal"
              >
                <Sparkles className="mt-0.5 size-4 text-primary" aria-hidden />
                <span>{starter}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>

      {loadedQuestion ? (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-surface)] px-3 py-3 text-sm leading-6 text-[var(--status-success-foreground)]"
          data-initial-data-chat-prompt
          role="status"
        >
          <span className="flex min-w-0 items-start gap-2">
            <Sparkles className="mt-1 size-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              <span className="font-semibold">Workspace prompt loaded.</span>{" "}
              <span className="opacity-75">Review it, then ask Data Chat when you are ready.</span>
            </span>
          </span>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 bg-card"
            disabled={!isReady || isPending}
            onClick={() => void submitQuestion(loadedQuestion)}
          >
            <MessageCircle className="size-4" />
            Ask this prompt
          </Button>
        </div>
      ) : null}

      <ScrollArea
        className="h-[32rem] min-h-[22rem] rounded-lg border bg-card"
        aria-label="Data Chat conversation"
        aria-live="polite"
        data-data-chat-conversation
      >
        <div className="grid min-h-[22rem] content-start gap-3 p-4">
          {turns.length > 0 ? (
            turns.map((turn, index) => {
              if (turn.role === "user") {
                return (
                  <div key={turn.id} className="flex justify-end">
                    <div className="max-w-[min(38rem,88%)] rounded-lg bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground shadow-sm">
                      {turn.content}
                    </div>
                  </div>
                );
              }

              const sourceQuestion =
                [...turns.slice(0, index)]
                  .reverse()
                  .find((previousTurn) => previousTurn.role === "user")?.content ??
                "Saved Data Chat answer";
              const isSaved = savedAnswers.some(
                (answer) => answer.answer === turn.content && answer.question === sourceQuestion,
              );

              return (
                <AssistantTurn
                  key={turn.id}
                  turn={turn}
                  sourceQuestion={sourceQuestion}
                  onAskFollowUp={(followUp) => void submitQuestion(followUp)}
                  onSave={saveAssistantTurn}
                  saved={isSaved}
                  disabled={!isReady || isPending}
                />
              );
            })
          ) : (
            <AppEmptyState
              icon={<MessageCircle className="size-5" />}
              title="Ask from your golf data"
              description="Stock yardages, shots, rounds, speed work, practice, challenges and achievements."
              primaryAction={
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isReady || isPending}
                  onClick={() => void submitQuestion(starterQuestions[0])}
                >
                  <Sparkles className="size-4" />
                  Ask what to practise next
                </Button>
              }
              className="min-h-56 border-0 bg-transparent"
            />
          )}
          {isPending ? (
            <div className="grid max-w-[min(42rem,92%)] gap-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {error ? (
        <Alert variant="destructive">
          <MessageCircle className="size-4" aria-hidden />
          <AlertTitle>Data Chat could not answer</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        id="data-chat-composer"
        className="grid scroll-mt-28 gap-3"
        onSubmit={onSubmit}
        data-data-chat-composer
      >
        <label className="sr-only" htmlFor={inputId}>
          Question
        </label>
        <InputGroup className="min-h-28 items-stretch bg-card shadow-sm">
          <InputGroupTextarea
            id={inputId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Which part of my game is costing me most right now?"
            className="min-h-20 resize-y px-3 pt-3 text-base"
            maxLength={800}
            disabled={!isReady}
            data-page-search
          />
          <InputGroupAddon align="block-end" className="justify-between border-t px-2.5 pt-2">
            <span className="text-xs text-muted-foreground">
              {remainingCredits.toLocaleString("en-GB")} AI credits left this month
            </span>
            <Button type="submit" size="sm" disabled={!isReady || isPending || !question.trim()}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              Ask data chat
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </form>

      <PerformanceReportBuilder
        latestAssistant={latestAssistant?.role === "assistant" ? latestAssistant : null}
        savedAnswers={savedAnswers}
        disabled={!isReady}
      />

      <SavedAnswersWorkbench
        answers={savedAnswers}
        onReuseQuestion={setQuestion}
        onRemoveAnswer={removeSavedAnswer}
      />
    </div>
  );
}

function PerformanceReportBuilder({
  latestAssistant,
  savedAnswers,
  disabled,
}: {
  latestAssistant: Extract<ChatTurn, { role: "assistant" }> | null;
  savedAnswers: SavedDataChatAnswer[];
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(() =>
    buildPerformanceReportDraft(latestAssistant, savedAnswers),
  );
  const [shareStatus, setShareStatus] = useState<ReportShareStatus>("idle");

  function regenerateDraft() {
    setDraft(buildPerformanceReportDraft(latestAssistant, savedAnswers));
    setShareStatus("idle");
  }

  function exportDraft() {
    const blob = new Blob([draft], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lm-world-tour-performance-report.md";
    anchor.click();
    window.URL.revokeObjectURL(url);
    setShareStatus("exported");
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
  }

  async function shareDraft() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "LM World Tour performance report",
          text: draft,
        });
        setShareStatus("shared");
        return;
      }

      await navigator.clipboard.writeText(draft);
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
  }

  return (
    <Card aria-labelledby="performance-report-builder-title" data-performance-report-builder>
      <CardHeader className="flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle
            id="performance-report-builder-title"
            className="flex items-center gap-2 text-base"
          >
            <FileText className="size-4 text-primary" aria-hidden />
            Performance report draft
          </CardTitle>
          <CardDescription>Cited weekly review draft.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={regenerateDraft}
          >
            <Sparkles className="size-4" />
            Generate draft
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={exportDraft}
          >
            <Download className="size-4" />
            Export .md
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void copyDraft()}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void shareDraft()}
          >
            <Share2 className="size-4" />
            Share
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3">
        <Textarea
          aria-label="Editable performance report preview"
          className="min-h-72 resize-y bg-background font-mono text-sm leading-6"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setShareStatus("idle");
          }}
          disabled={disabled}
          data-performance-report-preview
        />

        <p
          className="min-h-5 text-xs font-medium text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {reportShareStatusText(shareStatus)}
        </p>
      </CardContent>
    </Card>
  );
}

function SavedAnswersWorkbench({
  answers,
  onReuseQuestion,
  onRemoveAnswer,
}: {
  answers: SavedDataChatAnswer[];
  onReuseQuestion: (question: string) => void;
  onRemoveAnswer: (answerId: string) => void;
}) {
  return (
    <Card
      id="saved-data-chat-answers"
      aria-label="Saved Data Chat answers"
      data-workbench-scope="data-chat-saved-answers"
    >
      <CardHeader>
        <SavedAnswersHeader count={answers.length} />
      </CardHeader>
      <CardContent>
        <DesktopTableWorkbenchControls
          viewKey="data-chat-saved-answers"
          scope="data-chat-saved-answers"
          currentViewLabel="Saved Data Chat answers"
          resultLabel={`${answers.length}/8 saved`}
          columns={savedAnswerColumns}
          suggestedViews={savedAnswerSuggestedViews}
          exportTableId="data-chat-saved-answers"
          exportFileName="lm-world-tour-data-chat-saved-answers.csv"
          className="mb-3"
        />

        <DataTableFrame mainTable mainTableLabel="Saved Data Chat answers table" stickyFirstColumn>
          <Table
            data-workbench-export-table="data-chat-saved-answers"
            aria-describedby="saved-data-chat-answers-summary"
          >
            <TableCaption id="saved-data-chat-answers-summary" className="sr-only">
              Saved Data Chat answers table showing question, answer, confidence, cited records,
              saved date and reuse or remove actions.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow>
                <TableHead
                  data-column="question"
                  className="sticky left-0 z-20 min-w-72 bg-card shadow-[1px_0_0_hsl(var(--border))]"
                >
                  Question
                </TableHead>
                <TableHead data-column="answer">Answer</TableHead>
                <TableHead data-column="confidence">Confidence</TableHead>
                <TableHead data-column="citations">Citations</TableHead>
                <TableHead data-column="saved">Saved</TableHead>
                <TableHead data-column="action" className="text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {answers.length > 0 ? (
                answers.map((answer) => (
                  <TableRow key={answer.id} tabIndex={0} className="focus-aaa outline-none">
                    <TableCell
                      data-column="question"
                      className="sticky left-0 z-10 min-w-72 bg-card font-medium shadow-[1px_0_0_hsl(var(--border))]"
                    >
                      <span className="block max-w-80 truncate">{answer.question}</span>
                    </TableCell>
                    <TableCell data-column="answer" className="min-w-96">
                      <span className="line-clamp-2">{answer.answer}</span>
                    </TableCell>
                    <TableCell data-column="confidence" className="capitalize">
                      {answer.confidence}
                    </TableCell>
                    <TableCell data-column="citations">{citationSummary(answer)}</TableCell>
                    <TableCell data-column="saved">
                      {formatSavedAnswerDate(answer.generatedAt)}
                    </TableCell>
                    <TableCell data-column="action" className="min-w-56 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onReuseQuestion(answer.question)}
                        >
                          Reuse
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onRemoveAnswer(answer.id)}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={savedAnswerColumns.length} className="h-24 text-center">
                    Save an answer after Data Chat responds. Saved items stay on this browser for
                    report drafts, coach notes and follow-up practice plans.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      </CardContent>
    </Card>
  );
}

function SavedAnswersHeader({ count }: { count: number }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <CardTitle className="text-base">Saved answers</CardTitle>
        <CardDescription className="mt-1">
          Keep useful explanations and reuse their questions on this device.
        </CardDescription>
      </div>
      <Badge variant="secondary">{count}/8</Badge>
    </div>
  );
}

function buildPerformanceReportDraft(
  latestAssistant: Extract<ChatTurn, { role: "assistant" }> | null,
  savedAnswers: SavedDataChatAnswer[],
) {
  const primaryAnswer = latestAssistant?.content ?? savedAnswers[0]?.answer ?? "";
  const citations = latestAssistant?.citations.length
    ? latestAssistant.citations
    : savedAnswers.flatMap((answer) => answer.citations).slice(0, 6);
  const savedHighlights = savedAnswers.slice(0, 3);
  const caveat =
    "Needs a cited Data Chat answer before this section can be filled without guessing.";

  return [
    "# LM World Tour Performance Report",
    "",
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    "",
    "## This week's summary",
    primaryAnswer || caveat,
    "",
    "## Best improvement",
    latestAssistant || savedHighlights.length > 0
      ? "Use the cited answers below; edit this line only when the evidence names a clear improvement."
      : caveat,
    "",
    "## Biggest weakness",
    latestAssistant || savedHighlights.length > 0
      ? "Use the cited answers below; edit this line only when the evidence names a clear weakness."
      : caveat,
    "",
    "## Club to practise",
    latestAssistant || savedHighlights.length > 0
      ? "Use visible club evidence from the answer or saved insights before naming a club."
      : caveat,
    "",
    "## Round-readiness score",
    "Leave blank unless the visible answer includes enough bag, recent-practice and round evidence to support a score.",
    "",
    "## Recommended practice plan",
    latestAssistant || savedHighlights.length > 0
      ? "Convert the cited action into a time-boxed practice block. Keep low-confidence areas explicit."
      : caveat,
    "",
    "## Evidence to cite",
    ...reportCitationLines(citations),
    "",
    "## Saved answer highlights",
    ...reportSavedAnswerLines(savedHighlights),
  ].join("\n");
}

function reportCitationLines(citations: DataChatCitation[]) {
  if (citations.length === 0) {
    return ["- No cited records yet."];
  }

  return citations.slice(0, 6).map((citation) => `- ${citation.label}: ${citation.detail}`);
}

function reportSavedAnswerLines(answers: SavedDataChatAnswer[]) {
  if (answers.length === 0) {
    return ["- No saved answers yet."];
  }

  return answers.map(
    (answer) =>
      `- ${answer.question} (${answer.confidence} confidence, ${citationSummary(answer)}): ${answer.answer}`,
  );
}

function reportShareStatusText(status: ReportShareStatus) {
  if (status === "copied") {
    return "Report copied.";
  }

  if (status === "exported") {
    return "Markdown report exported.";
  }

  if (status === "shared") {
    return "Share sheet opened.";
  }

  if (status === "failed") {
    return "Could not share from this browser.";
  }

  return "";
}

function AssistantTurn({
  turn,
  sourceQuestion,
  onAskFollowUp,
  onSave,
  saved,
  disabled,
}: {
  turn: Extract<ChatTurn, { role: "assistant" }>;
  sourceQuestion: string;
  onAskFollowUp: (question: string) => void;
  onSave: (turn: Extract<ChatTurn, { role: "assistant" }>, sourceQuestion: string) => void;
  saved: boolean;
  disabled: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const actionCount = turn.tips.length + turn.drills.length;

  return (
    <Card className="max-w-[min(46rem,96%)] border-primary/15 bg-primary/5 shadow-sm">
      <CardContent className="p-3 text-sm leading-6 text-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {turn.confidence} confidence
          </Badge>
          <span className="text-xs text-muted-foreground">
            {turn.creditsCharged} credit charged
          </span>
          <Button
            type="button"
            variant="outline"
            className="ml-auto min-h-11 bg-card px-3 text-xs"
            disabled={disabled && !saved}
            onClick={() => onSave(turn, sourceQuestion)}
          >
            {saved ? <Check className="size-3.5" /> : <BookmarkPlus className="size-3.5" />}
            {saved ? "Saved" : "Save answer"}
          </Button>
        </div>
        <p className="mt-3">{turn.content}</p>

        {actionCount > 0 ? (
          <Collapsible className="group mt-4 rounded-lg border bg-card">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="h-auto w-full justify-start p-3">
                <Sparkles className="size-4 text-primary" aria-hidden />
                <span className="font-medium">Tips and drills</span>
                <Badge variant="outline" className="ml-auto">
                  {actionCount}
                </Badge>
                <ChevronDown
                  className="size-4 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-3 border-t p-3 md:grid-cols-2">
              {turn.tips.length > 0 ? (
                <ResponseList title="Tips" items={turn.tips.slice(0, 4)} />
              ) : null}
              {turn.drills.length > 0 ? (
                <ResponseList title="Drills" items={turn.drills.slice(0, 3)} />
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {turn.citations.length > 0 ? (
          <div className="mt-4 border-t pt-3">
            <ResponsiveDetailPanel
              open={evidenceOpen}
              onOpenChange={setEvidenceOpen}
              title="Cited data"
              description="Records supporting this answer."
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <FileText className="size-4" />
                  Review {turn.citations.length} cited record
                  {turn.citations.length === 1 ? "" : "s"}
                </Button>
              }
            >
              <div className="grid gap-2">
                {turn.citations.slice(0, 6).map((citation) => (
                  <CitationItem key={citation.id} citation={citation} />
                ))}
              </div>
            </ResponsiveDetailPanel>
          </div>
        ) : null}

        {turn.followUpQuestions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {turn.followUpQuestions.slice(0, 3).map((followUp) => (
              <Button
                key={followUp}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onAskFollowUp(followUp)}
                className="h-auto min-h-10 whitespace-normal text-left"
              >
                {followUp}
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CitationItem({ citation }: { citation: DataChatCitation }) {
  const content = (
    <Item variant="muted" className="items-start transition-colors hover:bg-muted">
      <ItemMedia className="grid size-8 place-items-center rounded-lg bg-background text-primary">
        <FileText className="size-4" aria-hidden />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{citation.label}</ItemTitle>
        <ItemDescription className="whitespace-normal">{citation.detail}</ItemDescription>
      </ItemContent>
    </Item>
  );

  return citation.href ? (
    <Link href={citation.href} prefetch={false} className="focus-aaa rounded-xl outline-none">
      {content}
    </Link>
  ) : (
    content
  );
}

function readSavedAnswers() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedAnswersStorageKey) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedDataChatAnswer[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function citationSummary(answer: SavedDataChatAnswer) {
  const count = answer.citations.length;
  return `${count} cited record${count === 1 ? "" : "s"}`;
}

function formatSavedAnswerDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return savedAnswerDateFormatter.format(date);
}

function ResponseList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="grid content-start gap-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item}>
            <Item variant="muted" size="sm" className="items-start">
              <ItemMedia className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden />
              <ItemContent>
                <ItemDescription className="whitespace-normal text-sm text-foreground">
                  {item}
                </ItemDescription>
              </ItemContent>
            </Item>
          </li>
        ))}
      </ul>
    </div>
  );
}
