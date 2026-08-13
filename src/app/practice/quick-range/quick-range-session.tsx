"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  Moon,
  NotebookPen,
  Sun,
  Target,
  Upload,
} from "lucide-react";

import { DataWarning } from "@/components/app/evidence-status";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RangeState = "ready" | "active" | "finished";

const blocks = [
  {
    title: "Calibrate",
    shots: 5,
    intent: "Start at playing speed and find the normal strike and carry window.",
    stop: "Pause if the setup or conditions change enough to make the sample incomparable.",
  },
  {
    title: "Build the pattern",
    shots: 10,
    intent: "Repeat one target and one shot intention. Do not chase the longest ball.",
    stop: "Reset after two rushed swings; quality matters more than finishing quickly.",
  },
  {
    title: "Pressure set",
    shots: 5,
    intent: "Use the same routine and target with one chance per ball.",
    stop: "Finish the set without adding unplanned technical changes.",
  },
];

export function QuickRangeSession({ focus }: { focus: string }) {
  const [state, setState] = useState<RangeState>("ready");
  const [activeBlock, setActiveBlock] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [shotCount, setShotCount] = useState(0);
  const [club, setClub] = useState("Driver");
  const [notes, setNotes] = useState("");
  const [labels, setLabels] = useState<Record<string, number>>({});
  const [outdoor, setOutdoor] = useState(true);
  const [wakeLocked, setWakeLocked] = useState(false);

  useEffect(() => {
    if (state !== "active") return;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    if (outdoor) root.dataset.theme = "outdoor";
    return () => {
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, [outdoor]);

  const elapsed = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds]);
  const current = blocks[activeBlock];

  function advance() {
    if (activeBlock < blocks.length - 1) {
      setActiveBlock((value) => value + 1);
      return;
    }
    setState("finished");
  }

  function mark(label: string) {
    setShotCount((value) => value + 1);
    setLabels((value) => ({ ...value, [label]: (value[label] ?? 0) + 1 }));
  }

  async function toggleWakeLock() {
    if (wakeLocked) {
      setWakeLocked(false);
      return;
    }
    const wakeLock = "wakeLock" in navigator ? navigator.wakeLock : null;
    if (!wakeLock) return;
    try {
      const lock = await wakeLock.request("screen");
      setWakeLocked(true);
      lock.addEventListener("release", () => setWakeLocked(false), { once: true });
    } catch {
      setWakeLocked(false);
    }
  }

  return (
    <PageShell>
      <QuickRangeMobile
        focus={focus}
        state={state}
        activeBlock={activeBlock}
        current={current}
        elapsed={elapsed}
        shotCount={shotCount}
        club={club}
        onClubChange={setClub}
        notes={notes}
        onNotesChange={setNotes}
        labels={labels}
        outdoor={outdoor}
        toggleOutdoor={() => setOutdoor((value) => !value)}
        wakeLocked={wakeLocked}
        toggleWakeLock={toggleWakeLock}
        start={() => setState("active")}
        advance={advance}
        mark={mark}
      />

      <div className="hidden lg:contents" data-quick-range-desktop>
        <PageHeader
          eyebrow={
            <StatusPill
              tone={state === "active" ? "green" : state === "finished" ? "sky" : "amber"}
            >
              {state === "active"
                ? "Session live"
                : state === "finished"
                  ? "Guidance complete"
                  : "Quick Range"}
            </StatusPill>
          }
          title={focus}
          description="A short, focused range guide. ForeKingHell scores the outcome from imported launch-monitor shots, never from manual ticks."
          actions={
            <Button asChild variant="outline" className="min-h-11 rounded-xl">
              <Link href="/practice">
                <ArrowLeft className="size-4" aria-hidden />
                Practice
              </Link>
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3">
          <label className="grid min-w-40 gap-1 text-sm font-semibold">
            Club
            <Select value={club} onValueChange={setClub}>
              <SelectTrigger className="min-h-12 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "Driver",
                  "3 Wood",
                  "Hybrid",
                  "5 Iron",
                  "7 Iron",
                  "9 Iron",
                  "Pitching Wedge",
                  "Gap Wedge",
                  "Sand Wedge",
                ].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              onClick={() => setOutdoor((value) => !value)}
              aria-pressed={outdoor}
            >
              {outdoor ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
              {outdoor ? "Outdoor mode" : "Range Night"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              onClick={toggleWakeLock}
              aria-pressed={wakeLocked}
            >
              <Sun className="size-4" aria-hidden />
              {wakeLocked ? "Screen awake" : "Keep screen awake"}
            </Button>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <Card className="premium-card overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {state === "finished"
                      ? "Next: import the evidence"
                      : `Block ${activeBlock + 1} of ${blocks.length}`}
                  </p>
                  <CardTitle className="mt-1 text-2xl">
                    {state === "finished" ? "Session guide finished" : current.title}
                  </CardTitle>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold tabular-nums">
                  <Clock3 className="size-4 text-primary" aria-hidden />
                  {elapsed}
                </span>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 pt-5">
              {state === "finished" ? (
                <div className="grid gap-4">
                  <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-950">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                    <div>
                      <p className="font-semibold">The planned blocks are complete</p>
                      <p className="mt-1 text-sm leading-6">
                        No result has been claimed yet. Import the session so shot rows can prove
                        the pattern, score and plan-versus-actual result.
                      </p>
                    </div>
                  </div>
                  <Button asChild className="premium-action min-h-12 rounded-xl">
                    <Link href="/import">
                      <Upload className="size-4" aria-hidden />
                      Import this session
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {Object.entries(labels).map(([label, count]) => (
                      <div key={label} className="rounded-xl bg-secondary/55 p-3 text-center">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-semibold">{count}</p>
                      </div>
                    ))}
                  </div>
                  {notes ? (
                    <div className="rounded-xl border p-3 text-sm">
                      <p className="font-semibold">Range note</p>
                      <p className="mt-1 text-muted-foreground">{notes}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <RangeDetail icon={Target} label="Intent" detail={current.intent} />
                    <RangeDetail
                      icon={Gauge}
                      label="Planned evidence"
                      detail={`${current.shots} measured shots. ${current.stop}`}
                    />
                  </div>
                  {state === "ready" ? (
                    <Button
                      type="button"
                      onClick={() => setState("active")}
                      className="premium-action min-h-12 rounded-xl"
                    >
                      Start guided session
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  ) : (
                    <div className="grid gap-4">
                      <div className="rounded-2xl border bg-background p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{club}</p>
                          <p className="text-lg font-semibold tabular-nums">
                            Shot {shotCount + 1} of 20
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Context labels only. Imported Rapsodo rows replace these labels when the
                          session is matched.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {["Good", "Left", "Right", "Short", "Long"].map((label) => (
                            <Button
                              key={label}
                              type="button"
                              variant={label === "Good" ? "default" : "outline"}
                              className="min-h-14 text-base"
                              onClick={() => mark(label)}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <label className="grid gap-2 text-sm font-semibold">
                        <span className="flex items-center gap-2">
                          <NotebookPen className="size-4" aria-hidden />
                          Add note
                        </span>
                        <textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={2}
                          maxLength={500}
                          className="rounded-xl border bg-background p-3"
                          placeholder="Target, feel, conditions or equipment context"
                        />
                      </label>
                      <Button
                        type="button"
                        onClick={advance}
                        className="premium-action min-h-12 rounded-xl"
                      >
                        {activeBlock === blocks.length - 1 ? "Finish session" : "Next block"}
                        <ArrowRight className="size-4" aria-hidden />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <aside className="grid content-start gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Session plan
              </p>
              <ol className="mt-3 grid gap-2">
                {blocks.map((block, index) => (
                  <li
                    key={block.title}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm",
                      index === activeBlock && state !== "finished"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary/50 text-muted-foreground",
                    )}
                  >
                    <span>
                      <span className="mr-2 font-semibold">{index + 1}.</span>
                      {block.title}
                    </span>
                    <span className="font-semibold">{block.shots} shots</span>
                  </li>
                ))}
              </ol>
            </div>
            <DataWarning
              title="Guidance is not a score"
              detail="Moving through blocks records no performance result. Completion, effectiveness and Plan vs Actual come from the imported shot rows."
            />
          </aside>
        </section>
      </div>
    </PageShell>
  );
}

function QuickRangeMobile({
  focus,
  state,
  activeBlock,
  current,
  elapsed,
  shotCount,
  club,
  onClubChange,
  notes,
  onNotesChange,
  labels,
  outdoor,
  toggleOutdoor,
  wakeLocked,
  toggleWakeLock,
  start,
  advance,
  mark,
}: {
  focus: string;
  state: RangeState;
  activeBlock: number;
  current: (typeof blocks)[number];
  elapsed: string;
  shotCount: number;
  club: string;
  onClubChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  labels: Record<string, number>;
  outdoor: boolean;
  toggleOutdoor: () => void;
  wakeLocked: boolean;
  toggleWakeLock: () => Promise<void>;
  start: () => void;
  advance: () => void;
  mark: (label: string) => void;
}) {
  const finished = state === "finished";
  const active = state === "active";

  return (
    <MobileAppShell className="gap-4">
      <span data-quick-range-mobile className="sr-only" aria-hidden />
      <MobileTopBar title="Quick Range" />

      <section className="grid gap-3" aria-labelledby="quick-range-current-task">
        <IOSSectionHeader
          title={<span id="quick-range-current-task">Current task</span>}
          description={
            finished
              ? "Guidance is complete; imported shot rows still decide the result."
              : "The block, target and next action stay in the first view."
          }
        />
        <IOSGroupedList label="Quick Range current task">
          <IOSListRow
            label={focus}
            value={finished ? "Complete" : club}
            detail={
              finished
                ? "Import the measured session before judging effectiveness."
                : current.intent
            }
            icon={Target}
            status={
              <IOSInlineStatus
                label={active ? "Session live" : finished ? "Evidence needed" : "Ready to start"}
                tone={active ? "positive" : finished ? "attention" : "info"}
              />
            }
          />
          <IOSMetricRow
            label={finished ? "Guided shots" : `Block ${activeBlock + 1} of ${blocks.length}`}
            value={finished ? integerLabel(shotCount) : current.title}
            detail={finished ? "Context labels only" : `${current.shots} measured shots planned`}
          />
          <IOSMetricRow
            label="Elapsed"
            value={elapsed}
            detail={active ? `Shot ${shotCount + 1} of 20` : "Timer starts with the guided session"}
          />
        </IOSGroupedList>

        {finished ? (
          <Button asChild className="min-h-12 w-full rounded-xl" data-primary-action>
            <Link href="/import">
              <Upload className="size-4" aria-hidden />
              Import this session
            </Link>
          </Button>
        ) : active ? (
          <div className="grid gap-3">
            <div
              className="grid grid-cols-2 gap-2"
              aria-label="Quick Range context labels"
              role="group"
            >
              {[
                ["Good", "col-span-2"],
                ["Left", ""],
                ["Right", ""],
                ["Short", ""],
                ["Long", ""],
              ].map(([label, className]) => (
                <Button
                  key={label}
                  type="button"
                  variant={label === "Good" ? "default" : "outline"}
                  className={cn("min-h-14 rounded-xl text-base", className)}
                  onClick={() => mark(label)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="px-1 text-[13px] leading-5 text-muted-foreground">
              These taps preserve context only. Imported launch-monitor rows replace them for
              completion and effectiveness.
            </p>
            <Button
              type="button"
              onClick={advance}
              className="min-h-12 w-full rounded-xl"
              data-primary-action
            >
              {activeBlock === blocks.length - 1 ? "Finish session" : "Next block"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={start}
            className="min-h-12 w-full rounded-xl"
            data-primary-action
          >
            Start guided session
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        )}
      </section>

      {finished && Object.keys(labels).length > 0 ? (
        <section className="grid gap-3" aria-labelledby="quick-range-context-summary">
          <IOSSectionHeader
            title={<span id="quick-range-context-summary">Context summary</span>}
            description="Manual labels are shown as notes, never as scored evidence."
          />
          <IOSGroupedList label="Quick Range context label counts">
            {Object.entries(labels).map(([label, count]) => (
              <IOSMetricRow key={label} label={label} value={integerLabel(count)} />
            ))}
          </IOSGroupedList>
        </section>
      ) : null}

      <section className="grid gap-3" aria-labelledby="quick-range-supporting-controls">
        <IOSSectionHeader
          title={<span id="quick-range-supporting-controls">Session controls</span>}
          description="Setup, plan and methodology stay available without delaying the task."
        />
        <IOSDisclosureGroup
          label="Quick Range supporting controls"
          items={[
            {
              value: "setup",
              title: "Club and display",
              summary: club,
              description: `${outdoor ? "Outdoor" : "Range Night"} · ${wakeLocked ? "Screen awake" : "Auto-lock normal"}`,
              content: (
                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-[13px] font-medium text-foreground">
                    Club
                    <Select value={club} onValueChange={onClubChange}>
                      <SelectTrigger className="min-h-11 w-full text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "Driver",
                          "3 Wood",
                          "Hybrid",
                          "5 Iron",
                          "7 Iron",
                          "9 Iron",
                          "Pitching Wedge",
                          "Gap Wedge",
                          "Sand Wedge",
                        ].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 justify-start rounded-xl"
                    onClick={toggleOutdoor}
                    aria-pressed={outdoor}
                  >
                    {outdoor ? (
                      <Sun className="size-4" aria-hidden />
                    ) : (
                      <Moon className="size-4" aria-hidden />
                    )}
                    {outdoor ? "Outdoor mode" : "Range Night"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 justify-start rounded-xl"
                    onClick={() => void toggleWakeLock()}
                    aria-pressed={wakeLocked}
                  >
                    <Sun className="size-4" aria-hidden />
                    {wakeLocked ? "Screen awake" : "Keep screen awake"}
                  </Button>
                </div>
              ),
            },
            {
              value: "plan",
              title: "Three-block plan",
              summary: "20 shots",
              description: "Calibrate, build the pattern, then add pressure",
              content: (
                <IOSGroupedList label="Quick Range session plan" className="bg-card">
                  {blocks.map((block, index) => (
                    <IOSListRow
                      key={block.title}
                      label={`${index + 1}. ${block.title}`}
                      value={`${block.shots} shots`}
                      detail={block.intent}
                      status={
                        index === activeBlock && !finished ? (
                          <IOSInlineStatus label="Current block" tone="info" />
                        ) : undefined
                      }
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
            ...(active || notes
              ? [
                  {
                    value: "note",
                    title: "Range note",
                    summary: notes ? "Added" : "Optional",
                    description: "Target, feel, conditions or equipment context",
                    content: (
                      <label className="grid gap-2 text-[13px] font-medium text-foreground">
                        Note
                        <textarea
                          value={notes}
                          onChange={(event) => onNotesChange(event.target.value)}
                          rows={3}
                          maxLength={500}
                          className="min-h-24 rounded-xl border border-input bg-background p-3 text-base"
                          placeholder="Target, feel, conditions or equipment context"
                        />
                      </label>
                    ),
                  },
                ]
              : []),
            {
              value: "method",
              title: "How results are scored",
              summary: "Imported shots",
              description: "Guidance and manual labels do not claim performance",
              content: (
                <DataWarning
                  title="Guidance is not a score"
                  detail="Moving through blocks records no performance result. Completion, effectiveness and Plan vs Actual come from the imported shot rows."
                />
              ),
            },
          ]}
        />
      </section>
    </MobileAppShell>
  );
}

function integerLabel(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function RangeDetail({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Target;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-secondary/55 p-4">
      <Icon className="size-5 text-primary" aria-hidden />
      <p className="mt-3 font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
