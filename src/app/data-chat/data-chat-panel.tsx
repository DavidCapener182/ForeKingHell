"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
} from "@/components/app/ios-mobile";
import { trackPlausibleEvent } from "@/lib/analytics";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame } from "@/components/premium";
import { Button } from "@/components/ui/button";
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
    href: "/data-chat?prompt=Build%20a%20practice%20plan#from-my-data",
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
  savedAnswerWorkbench = false,
}: {
  monthlyRemaining: number;
  questionId?: string;
  initialQuestion?: string;
  savedAnswerWorkbench?: boolean;
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
    <div className="grid min-w-0 gap-3 lg:gap-4" data-data-chat-ready={isReady ? "true" : "false"}>
      <div
        className="order-1 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-4"
        aria-label="Suggested Data Chat questions"
      >
        {starterQuestions.map((starter) => (
          <Button
            key={starter}
            type="button"
            variant="outline"
            className="h-auto min-h-11 min-w-[13rem] shrink-0 justify-start whitespace-normal rounded-full px-4 py-2 text-left leading-5 lg:min-w-0 lg:rounded-md"
            disabled={!isReady || isPending}
            onClick={() => void submitQuestion(starter)}
          >
            <Sparkles className="size-4" />
            {starter}
          </Button>
        ))}
      </div>

      {loadedQuestion ? (
        <div
          className="order-2 flex flex-col gap-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-surface)] px-3 py-3 text-sm leading-6 text-[var(--status-success-foreground)] sm:flex-row sm:items-center sm:justify-between"
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

      <div
        className="order-4 grid max-h-[46dvh] min-h-48 gap-3 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-3 lg:order-none lg:max-h-none lg:min-h-[22rem] lg:overflow-visible lg:rounded-lg lg:p-4"
        aria-label="Data Chat conversation"
        aria-live="polite"
      >
        {turns.length > 0 ? (
          <div className="grid content-start gap-3">
            {turns.map((turn, index) => {
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
            })}
          </div>
        ) : (
          <div className="grid place-items-center rounded-lg border border-dashed border-border bg-muted p-6 text-center">
            <div>
              <MessageCircle className="mx-auto size-8 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">Ask from your golf data</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Stock yardages, shots, rounds, speed work, practice, challenges and achievements.
              </p>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div className="order-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] px-4 py-3 text-sm text-[var(--status-warning-foreground)] lg:order-none">
          {error}
        </div>
      ) : null}

      <form
        className="order-3 sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 grid gap-2 rounded-xl border border-border bg-background/95 p-2 shadow-sm backdrop-blur-lg lg:static lg:order-none lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
        onSubmit={onSubmit}
        data-data-chat-composer
      >
        <label className="grid gap-2 text-sm font-medium" htmlFor={inputId}>
          Question
          <Textarea
            id={inputId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Which part of my game is costing me most right now?"
            className="min-h-14 resize-y bg-card text-base lg:min-h-24"
            maxLength={800}
            disabled={!isReady}
            data-page-search
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {remainingCredits.toLocaleString("en-GB")} AI credits left this month
          </p>
          <Button
            type="submit"
            className="min-h-11"
            disabled={!isReady || isPending || !question.trim()}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageCircle className="size-4" />
            )}
            Ask data chat
          </Button>
        </div>
      </form>

      {savedAnswerWorkbench ? (
        <PerformanceReportBuilder
          latestAssistant={latestAssistant?.role === "assistant" ? latestAssistant : null}
          savedAnswers={savedAnswers}
          disabled={!isReady}
        />
      ) : null}

      {savedAnswerWorkbench ? (
        <SavedAnswersWorkbench
          answers={savedAnswers}
          onReuseQuestion={setQuestion}
          onRemoveAnswer={removeSavedAnswer}
        />
      ) : (
        <div className="order-5 lg:order-none">
          <IOSDisclosureGroup
            label="Saved Data Chat answers"
            items={[
              {
                value: "saved-answers",
                title: "Saved answers",
                summary: `${savedAnswers.length}/8`,
                description: "Reuse useful explanations on this device",
                content: (
                  <SavedAnswerCards
                    answers={savedAnswers}
                    onReuseQuestion={setQuestion}
                    onRemoveAnswer={removeSavedAnswer}
                    embedded
                  />
                ),
              },
            ]}
          />
        </div>
      )}
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
    <section
      aria-labelledby="performance-report-builder-title"
      className="hidden gap-3 rounded-lg border border-emerald-200 bg-emerald-50/45 p-3 lg:grid"
      data-performance-report-builder
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p
            id="performance-report-builder-title"
            className="flex items-center gap-2 text-sm font-semibold text-emerald-950"
          >
            <FileText className="size-4" aria-hidden />
            Performance report draft
          </p>
          <p className="mt-1 text-sm leading-5 text-emerald-950/75">Cited weekly review draft.</p>
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
      </div>

      <Textarea
        aria-label="Editable performance report preview"
        className="min-h-72 resize-y bg-white font-mono text-sm leading-6"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setShareStatus("idle");
        }}
        disabled={disabled}
        data-performance-report-preview
      />

      <p
        className="min-h-5 text-xs font-medium text-emerald-950/75"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {reportShareStatusText(shareStatus)}
      </p>
    </section>
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
    <section
      id="saved-data-chat-answers"
      aria-label="Saved Data Chat answers"
      data-workbench-scope="data-chat-saved-answers"
      className="rounded-lg border border-slate-200 bg-white/82 p-3"
    >
      <SavedAnswersHeader count={answers.length} />

      <DesktopTableWorkbenchControls
        viewKey="data-chat-saved-answers"
        scope="data-chat-saved-answers"
        currentViewLabel="Saved Data Chat answers"
        resultLabel={`${answers.length}/8 saved`}
        columns={savedAnswerColumns}
        suggestedViews={savedAnswerSuggestedViews}
        exportTableId="data-chat-saved-answers"
        exportFileName="lm-world-tour-data-chat-saved-answers.csv"
        className="my-3"
      />

      <DataTableFrame mainTable mainTableLabel="Saved Data Chat answers table" stickyFirstColumn>
        <Table
          data-workbench-export-table="data-chat-saved-answers"
          aria-describedby="saved-data-chat-answers-summary"
        >
          <TableCaption id="saved-data-chat-answers-summary" className="sr-only">
            Saved Data Chat answers table showing question, answer, confidence, cited records, saved
            date and reuse or remove actions.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="question"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                    className="sticky left-0 z-10 min-w-72 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                        className="text-red-700 hover:text-red-800"
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
    </section>
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

function SavedAnswerCards({
  answers,
  onReuseQuestion,
  onRemoveAnswer,
  embedded = false,
}: {
  answers: SavedDataChatAnswer[];
  onReuseQuestion: (question: string) => void;
  onRemoveAnswer: (answerId: string) => void;
  embedded?: boolean;
}) {
  return (
    <section
      aria-label="Saved Data Chat answers"
      className={embedded ? "min-w-0" : "rounded-lg border border-border bg-card p-3"}
    >
      <SavedAnswersHeader count={answers.length} />

      {answers.length > 0 ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {answers.map((answer) => (
            <article
              key={answer.id}
              className="grid gap-2 rounded-lg border border-border bg-secondary/45 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {answer.question}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {answer.answer}
                  </p>
                </div>
                <button
                  type="button"
                  className="focus-aaa grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-card hover:text-destructive"
                  aria-label="Remove saved answer"
                  onClick={() => onRemoveAnswer(answer.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium capitalize text-foreground ring-1 ring-border">
                  {answer.confidence} confidence
                </span>
                <span className="text-xs text-muted-foreground">{citationSummary(answer)}</span>
                <button
                  type="button"
                  className="focus-aaa min-h-11 rounded-full bg-card px-3 py-2 text-xs font-medium text-primary outline-none ring-1 ring-border hover:bg-secondary"
                  onClick={() => onReuseQuestion(answer.question)}
                >
                  Reuse question
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-secondary/45 px-3 py-4 text-sm leading-6 text-muted-foreground">
          Save an answer after Data Chat responds. Saved items stay on this browser and are useful
          for report drafts, coach notes and follow-up practice plans.
        </div>
      )}
    </section>
  );
}

function SavedAnswersHeader({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">Saved answers</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Keep useful explanations and reuse their questions on this device.
        </p>
      </div>
      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
        {count}/8
      </span>
    </div>
  );
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
  return (
    <div className="max-w-[min(46rem,96%)] rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm leading-6 text-foreground lg:rounded-lg">
      <div className="flex flex-wrap items-center gap-2">
        <IOSInlineStatus
          label={`${turn.confidence} confidence`}
          tone={assistantConfidenceTone(turn.confidence)}
          className="capitalize"
        />
        <span className="text-xs text-muted-foreground">{turn.creditsCharged} credit charged</span>
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

      <AssistantEvidenceDisclosures turn={turn} />

      {turn.tips.length > 0 || turn.drills.length > 0 ? (
        <div className="mt-4 hidden gap-3 lg:grid lg:grid-cols-2">
          {turn.tips.length > 0 ? (
            <ResponseList title="Tips" items={turn.tips.slice(0, 4)} />
          ) : null}
          {turn.drills.length > 0 ? (
            <ResponseList title="Drills" items={turn.drills.slice(0, 3)} />
          ) : null}
        </div>
      ) : null}

      {turn.citations.length > 0 ? (
        <div className="mt-4 hidden border-t border-border pt-3 lg:block">
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
                  className="rounded-lg bg-card px-3 py-2 hover:bg-secondary"
                >
                  <span className="font-medium">{citation.label}</span>
                  <span className="block text-muted-foreground">{citation.detail}</span>
                </Link>
              ) : (
                <div key={citation.id} className="rounded-lg bg-card px-3 py-2">
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
              className="focus-aaa min-h-11 rounded-full bg-card px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border outline-none"
            >
              {followUp}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssistantEvidenceDisclosures({
  turn,
}: {
  turn: Extract<ChatTurn, { role: "assistant" }>;
}) {
  const items = [
    ...(turn.tips.length > 0 || turn.drills.length > 0
      ? [
          {
            value: "actions",
            title: "Tips and drills",
            summary: `${turn.tips.length + turn.drills.length}`,
            description: "Practical actions from this answer",
            content: (
              <div className="grid gap-3">
                {turn.tips.length > 0 ? (
                  <ResponseList title="Tips" items={turn.tips.slice(0, 4)} />
                ) : null}
                {turn.drills.length > 0 ? (
                  <ResponseList title="Drills" items={turn.drills.slice(0, 3)} />
                ) : null}
              </div>
            ),
          },
        ]
      : []),
    ...(turn.citations.length > 0
      ? [
          {
            value: "citations",
            title: "Cited data",
            summary: `${turn.citations.length}`,
            description: "Records supporting the conclusion",
            content: (
              <IOSGroupedList label="Data Chat citations" className="bg-card">
                {turn.citations.slice(0, 6).map((citation) => (
                  <IOSListRow
                    key={citation.id}
                    label={citation.label}
                    detail={citation.detail}
                    href={citation.href ?? undefined}
                    icon={FileText}
                  />
                ))}
              </IOSGroupedList>
            ),
          },
        ]
      : []),
  ];

  return items.length > 0 ? (
    <IOSDisclosureGroup
      label="Supporting Data Chat evidence"
      items={items}
      className="mt-4 lg:hidden"
    />
  ) : null;
}

function assistantConfidenceTone(
  confidence: DataChatResponse["confidence"],
): "positive" | "info" | "attention" {
  if (confidence === "high") return "positive";
  if (confidence === "medium") return "info";
  return "attention";
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
    <div className="rounded-lg bg-card p-3 ring-1 ring-border">
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
