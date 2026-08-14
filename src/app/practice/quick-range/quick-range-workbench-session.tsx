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
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

const clubOptions = [
  "Driver",
  "3 Wood",
  "Hybrid",
  "5 Iron",
  "7 Iron",
  "9 Iron",
  "Pitching Wedge",
  "Gap Wedge",
  "Sand Wedge",
];

export function QuickRangeWorkbenchSession({ focus }: { focus: string }) {
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
      <div className="grid gap-4" data-quick-range-desktop>
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

        <Card className="p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="grid min-w-40 gap-1 text-sm font-semibold">
              Club
              <Select value={club} onValueChange={setClub}>
                <SelectTrigger className="min-h-12 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clubOptions.map((value) => (
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
                onClick={() => void toggleWakeLock()}
                aria-pressed={wakeLocked}
              >
                <Sun className="size-4" aria-hidden />
                {wakeLocked ? "Screen awake" : "Keep screen awake"}
              </Button>
            </div>
          </div>
        </Card>

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
                  <Alert className="border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]">
                    <CheckCircle2 aria-hidden />
                    <AlertTitle>The planned blocks are complete</AlertTitle>
                    <AlertDescription className="leading-6 text-[var(--status-success-foreground)]">
                      No result has been claimed yet. Import the session so shot rows can prove the
                      pattern, score and plan-versus-actual result.
                    </AlertDescription>
                  </Alert>
                  <Button asChild className="premium-action min-h-12 rounded-xl">
                    <Link href="/import">
                      <Upload className="size-4" aria-hidden />
                      Import this session
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-5">
                    {Object.entries(labels).map(([label, count]) => (
                      <div key={label} className="bg-muted/35 p-3 text-center">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-semibold">{count}</p>
                      </div>
                    ))}
                  </div>
                  {notes ? (
                    <div className="rounded-lg border border-border bg-muted/25 p-3 text-sm">
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
                      <div className="rounded-lg border border-border bg-muted/25 p-3">
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
                        <Textarea
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
            <Card className="p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Session plan
              </p>
              <ol className="mt-3 grid gap-2">
                {blocks.map((block, index) => (
                  <li
                    key={block.title}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                      index === activeBlock && state !== "finished"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-muted-foreground",
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
            </Card>
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
    <div className="rounded-lg border border-border bg-muted/35 p-4">
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
