"use client";

import Link from "next/link";
import { formatCompanionClubType } from "@/lib/club-format";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Minus, Plus, Play, Upload } from "lucide-react";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { useMobileActivity, activityHaptic } from "@/components/app/use-mobile-activity";
import { MobileAppShell } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import styles from "@/components/app/mobile-companion.module.css";

type Draft = {
  state: "ready" | "active" | "paused" | "finished";
  club: string;
  focus: string;
  balls: number;
  target: string;
  count: number;
  notes: string;
  labels: string[];
  elapsed: number;
};
const clubs = [
  "Driver",
  "3 Wood",
  "5 Wood",
  "Hybrid",
  "5 Iron",
  "6 Iron",
  "7 Iron",
  "8 Iron",
  "9 Iron",
  "Pitching Wedge",
  "Gap Wedge",
  "Sand Wedge",
  "Lob Wedge",
];

export function QuickRangeCompanionSession({
  focus,
  accountId,
  initialClubType,
}: {
  focus: string;
  accountId: string;
  initialClubType?: string;
}) {
  const [draft, setDraft] = useState<Draft>({
    state: "ready",
    club: formatCompanionClubType(initialClubType || "7i"),
    focus,
    balls: 20,
    target: "",
    count: 0,
    notes: "",
    labels: [],
    elapsed: 0,
  });
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(true);
  const key = `fkh:quick-range:${accountId}`;
  const patch = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }));
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
        if (
          value &&
          (!initialClubType || ["active", "paused"].includes(value.state)) &&
          ["ready", "active", "paused", "finished"].includes(value.state) &&
          (clubs.includes(value.club) ||
            /^[1-9] (Iron|Wood|Hybrid)$/.test(value.club) ||
            ["Approach Wedge", "Wedge"].includes(value.club)) &&
          [20, 30, 40, 60].includes(value.balls) &&
          typeof value.notes === "string" &&
          typeof value.focus === "string" &&
          typeof value.target === "string" &&
          Number.isFinite(value.count) &&
          Number.isFinite(value.elapsed) &&
          Array.isArray(value.labels)
        )
          setDraft(value);
      } catch {
        /* A missing or old draft starts with the supplied focus. */
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, initialClubType]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      queueMicrotask(() => setStored(true));
    } catch {
      queueMicrotask(() => setStored(false));
    }
  }, [draft, key, ready]);
  useEffect(() => {
    if (draft.state !== "active") return;
    const timer = window.setInterval(
      () => setDraft((current) => ({ ...current, elapsed: current.elapsed + 1 })),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [draft.state]);
  useMobileActivity(draft.state === "active");
  const active = draft.state === "active";
  const finished = draft.state === "finished";
  function mark(label: string) {
    activityHaptic();
    setDraft((current) => ({
      ...current,
      count: current.count + 1,
      labels: [...current.labels, label],
    }));
  }
  const block =
    draft.count < Math.round(draft.balls / 4)
      ? "Calibrate"
      : draft.count < Math.round((draft.balls * 3) / 4)
        ? "Build the pattern"
        : "Pressure set";
  return (
    <MobileAppShell className="gap-6" data-quick-range-mobile>
      {active ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => patch({ state: "paused" })} className="min-h-11">
            <ChevronLeft aria-hidden className="size-5" /> Pause
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {Math.floor(draft.elapsed / 60)}:{String(draft.elapsed % 60).padStart(2, "0")}
          </span>
        </div>
      ) : (
        <MobileLargeTitle
          title={finished ? "Practice complete" : "Quick Range"}
          detail={finished ? "Your activity is saved on this iPhone." : "One club. One focus."}
        />
      )}
      {!active && !finished ? (
        <>
          <div className={styles.setup}>
            <label>
              Club
              <span className={styles.clubPicker}>
                <select
                  aria-label="Club"
                  value={draft.club}
                  onChange={(e) => patch({ club: e.target.value })}
                >
                  {[...new Set([...clubs, draft.club])].map((club) => (
                    <option key={club}>{club}</option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden />
              </span>
            </label>
            <label>
              Focus
              <Input
                value={draft.focus}
                maxLength={80}
                onChange={(e) => patch({ focus: e.target.value })}
                placeholder="Start line, strike, distance…"
              />
            </label>
            <label>
              Target <span className="text-muted-foreground">Optional</span>
              <Input
                value={draft.target}
                maxLength={80}
                onChange={(e) => patch({ target: e.target.value })}
                placeholder="150 yd flag"
              />
            </label>
          </div>
          <MobileSection title="Balls">
            <MobileSegmentedControl
              ariaLabel="Ball count"
              value={String(draft.balls)}
              onValueChange={(value) => patch({ balls: Number(value) })}
              options={[20, 30, 40, 60].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
            />
          </MobileSection>
          <Button
            disabled={!ready || !draft.focus.trim()}
            onClick={() => patch({ state: "active" })}
            className="min-h-14 rounded-2xl text-lg"
          >
            <Play className="size-5" aria-hidden />
            {draft.count || draft.state === "paused" ? "Resume" : "Start"}
          </Button>
        </>
      ) : active ? (
        <>
          <div className={styles.activityHeading}>
            <p>{block}</p>
            <h1>{draft.focus}</h1>
            <span>
              {draft.club}
              {draft.target ? ` · ${draft.target}` : ""}
            </span>
          </div>
          <p className="text-lg leading-relaxed">
            {block === "Calibrate"
              ? "Start at playing speed. Find your usual strike and carry window."
              : block === "Build the pattern"
                ? "Repeat your target and routine. Keep each swing at a playable speed."
                : "One chance per ball. Step back and reset your routine."}
          </p>
          <div className={styles.activityProgress}>
            <span>
              {draft.count}
              <small> / {draft.balls}</small>
            </span>
            <p>Balls logged</p>
            <progress
              value={Math.min(draft.count, draft.balls)}
              max={draft.balls}
              aria-label="Balls logged"
            />
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Shot context">
            {["Playable", "Left", "Right", "Short", "Long", "Unlabelled"].map((label) => (
              <Button
                variant={label === "Playable" ? "default" : "outline"}
                key={label}
                className="min-h-14 rounded-xl text-base"
                onClick={() => mark(label)}
              >
                {label === "Unlabelled" ? <Plus className="size-4" aria-hidden /> : null}
                {label === "Unlabelled" ? "Log ball" : label}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              disabled={!draft.count}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  count: Math.max(0, current.count - 1),
                  labels: current.labels.slice(0, -1),
                }))
              }
            >
              <Minus className="size-4" aria-hidden />
              Undo ball
            </Button>
            <span className="text-xs text-muted-foreground">Manual context only</span>
          </div>
          <details className={styles.disclosure}>
            <summary>Add note</summary>
            <Textarea
              aria-label="Range note"
              value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              maxLength={500}
            />
          </details>
          <Button
            onClick={() => patch({ state: "finished" })}
            className="min-h-14 rounded-2xl text-base"
          >
            <Check className="size-5" aria-hidden />
            Finish practice
          </Button>
        </>
      ) : (
        <>
          <div className={styles.activityHeading}>
            <h2>{draft.focus}</h2>
            <span>
              {draft.club}
              {draft.target ? ` · ${draft.target}` : ""}
            </span>
          </div>
          <div className={styles.activityProgress}>
            <span>{draft.count}</span>
            <p>Balls logged · {Math.floor(draft.elapsed / 60)} min</p>
          </div>
          <p className="text-muted-foreground">
            Import measured shots to see what changed. Logging activity does not prove improvement.
          </p>
          <Button asChild className="min-h-14 rounded-2xl text-base">
            <Link href="/import">
              <Upload className="size-5" aria-hidden />
              Import measured session
            </Link>
          </Button>
          <MobileSection title="Session note">
            <Textarea
              aria-label="Session note"
              value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              maxLength={500}
              placeholder="What worked? What will you repeat?"
            />
            <p className="text-xs text-muted-foreground" role="status">
              {stored ? "Saved on this iPhone" : "Storage unavailable. Keep this page open."}
            </p>
          </MobileSection>
          <Button asChild variant="outline" className="min-h-12">
            <Link href="/practice">Review later</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => patch({ state: "ready", count: 0, labels: [], elapsed: 0, notes: "" })}
          >
            New Quick Range
          </Button>
        </>
      )}
      {!stored && !finished ? (
        <p role="status" className="text-sm text-destructive">
          Storage unavailable. Keep this page open to retain your session.
        </p>
      ) : null}
    </MobileAppShell>
  );
}
