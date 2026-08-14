"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Moon, Sun, Target, Upload } from "lucide-react";

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
import { Button } from "@/components/ui/button";
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
  },
  {
    title: "Build the pattern",
    shots: 10,
    intent: "Repeat one target and one shot intention. Do not chase the longest ball.",
  },
  {
    title: "Pressure set",
    shots: 5,
    intent: "Use the same routine and target with one chance per ball.",
  },
];

export function QuickRangeCompanionSession({ focus }: { focus: string }) {
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
            onClick={() => setState("active")}
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
                    <Select value={club} onValueChange={setClub}>
                      <SelectTrigger className="min-h-11 w-full text-base">
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
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 justify-start rounded-xl"
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
                        <Textarea
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
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

function integerLabel(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
