"use client";

import Link from "next/link";
import { formatCompanionClubType } from "@/lib/club-format";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Minus, Plus, Play, Upload } from "lucide-react";
import { MobileSection } from "@/components/app/mobile-screen";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { useMobileActivity, activityHaptic } from "@/components/app/use-mobile-activity";
import { PageHeader } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import styles from "@/components/app/mobile-companion.module.css";

import {
  quickRangeClubs as clubs,
  quickRangeLabels,
  parseQuickRangeDraft,
  updateQuickRangeDraft,
  quickRangeElapsed,
  type QuickRangeDraft as Draft,
  type QuickRangeRecord,
} from "./quick-range-draft";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";

export function QuickRangeCompanionSession({
  focus,
  accountId,
  initialClubType,
}: {
  focus: string;
  accountId: string;
  initialClubType?: string;
}) {
  const initialClub = formatCompanionClubType(initialClubType || "7i");
  const [draft, setDraft] = useState<Draft>({
    state: "ready",
    club: initialClub,
    focus,
    balls: 20,
    target: "",
    count: 0,
    notes: "",
    labels: [],
    elapsed: 0,
  });
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [review, setReview] = useState<QuickRangeRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(true);
  const [outdoor, setOutdoor] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  useEffect(() => {
    if (!outdoor) return;
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = "outdoor";
    return () => {
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, [outdoor]);
  const [clockNow, setClockNow] = useState<number | null>(null);
  const key = `fkh:quick-range:${accountId}`;
  const patch = (value: Partial<Draft>) => {
    const now = new Date().toISOString();
    setDraft((current) => updateQuickRangeDraft(current, value, now));
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value = parseQuickRangeDraft(JSON.parse(localStorage.getItem(key) ?? "null"));
        if (value) {
          // An existing account draft wins; starting another activity is explicit.
          setDraft(updateQuickRangeDraft(value, {}, new Date().toISOString()));
        }
      } catch {
        /* A missing or old draft starts with the supplied focus. */
      }
      setClockNow(Date.now());
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
    const tick = () => setClockNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    const visible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", tick);
    };
  }, [draft.state]);
  useMobileActivity(draft.state === "active" && keepAwake);
  const active = draft.state === "active";
  const finished = draft.state === "finished";
  const elapsed = quickRangeElapsed(draft, clockNow ?? Date.parse(draft.runningSince ?? ""));
  function mark(label: string) {
    activityHaptic();
    setDraft((current) => ({
      ...current,
      count: current.count + 1,
      labels: [...current.labels, label],
    }));
  }
  const inferredBlock =
    draft.count < Math.round(draft.balls / 4)
      ? 0
      : draft.count < Math.round((draft.balls * 3) / 4)
        ? 1
        : 2;
  const blockIndex = draft.blockIndex ?? inferredBlock;
  const blockNames = ["Calibrate", "Build the pattern", "Pressure set"];
  const block = blockNames[blockIndex];
  const completed = draft.completedBlocks ?? [];
  function nextBlock() {
    patch({
      completedBlocks: [...new Set([...completed, blockIndex])],
      ...(blockIndex < 2 ? { blockIndex: blockIndex + 1 } : { state: "finished" }),
    });
  }
  return (
    <section
      className="grid min-w-0 gap-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:min-w-0"
      data-quick-range-mobile
    >
      {active ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => patch({ state: "paused" })} className="min-h-11">
            <ChevronLeft aria-hidden className="size-5" /> Pause
          </Button>
          <span
            role="timer"
            aria-label="Active practice time"
            className="tabular-nums text-muted-foreground"
          >
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </div>
      ) : (
        <PageHeader
          title={finished ? "Guidance complete" : "Quick Range"}
          description={
            finished
              ? stored
                ? "Your activity is saved on this device."
                : "Keep this page open to retain your activity."
              : "One club. One focus."
          }
        />
      )}
      <details className="rounded-lg border px-3">
        <summary className="flex min-h-11 cursor-pointer items-center">
          Session options and draft status
        </summary>
        <div className="flex flex-wrap gap-2 pb-3">
          <Button asChild variant="outline">
            <Link href="/practice">Back to Practice</Link>
          </Button>
          <Button variant="outline" aria-pressed={outdoor} onClick={() => setOutdoor(!outdoor)}>
            Outdoor mode
          </Button>
          <Button
            variant="outline"
            aria-pressed={keepAwake}
            onClick={() => setKeepAwake(!keepAwake)}
          >
            Request screen awake
          </Button>
        </div>
        <p className="pb-3 text-sm text-muted-foreground" role="status">
          {!ready
            ? "Loading saved activity…"
            : stored
              ? "Draft saved on this device. Manual activity is not measured performance."
              : "Storage unavailable. Keep this page open."}
        </p>
      </details>
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
                  {[...new Set([...clubs, initialClub, draft.club])].map((club) => (
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
          <details className="rounded-lg border px-3">
            <summary className="flex min-h-11 cursor-pointer items-center">
              Block {blockIndex + 1} of 3 · {block} · View all steps
            </summary>
            <ol aria-label="Guided blocks" className="grid gap-2 sm:grid-cols-3">
              {blockNames.map((name, index) => (
                <li
                  key={name}
                  aria-current={index === blockIndex ? "step" : undefined}
                  className="rounded-lg border p-3"
                >
                  <span className="font-semibold">
                    {index + 1}. {name}
                  </span>
                  <p className="text-sm">
                    {index === blockIndex
                      ? "Current block"
                      : completed.includes(index)
                        ? "Guidance completed"
                        : "Pending"}
                  </p>
                </li>
              ))}
            </ol>
          </details>
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
            {quickRangeLabels.map((label) => (
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={blockIndex === 0}
              onClick={() => patch({ blockIndex: blockIndex - 1 })}
            >
              Previous block
            </Button>
            <Button variant="outline" onClick={() => patch({ state: "paused" })}>
              Pause session
            </Button>
            <Button onClick={nextBlock}>
              {blockIndex === 2 ? "Complete final block" : "Complete block and next"}
            </Button>
          </div>
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
              {stored ? "Saved on this device" : "Storage unavailable. Keep this page open."}
            </p>
          </MobileSection>
          <Button asChild variant="outline" className="min-h-12">
            <Link href="/practice">Review later</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              patch({
                state: "ready",
                count: 0,
                labels: [],
                elapsed: 0,
                notes: "",
                blockIndex: 0,
                completedBlocks: [],
              })
            }
          >
            New Quick Range
          </Button>
        </>
      )}
      {!active && draft.history?.length ? (
        <MobileSection title="Recent Quick Range">
          <MobileGroupedList label="Recent Quick Range activities">
            {draft.history.slice(0, showAllHistory ? 50 : 5).map((item) => (
              <MobileListRow
                key={item.id}
                label={item.focus}
                value={`${item.count} balls`}
                detail={`${item.club} · ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Saved activity"}`}
                onClick={() => setReview(item)}
              />
            ))}
          </MobileGroupedList>
          {draft.history.length > 5 ? (
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => setShowAllHistory(!showAllHistory)}
            >
              {showAllHistory ? "Show recent five" : `Show all ${draft.history.length} activities`}
            </Button>
          ) : null}
          <p className="mobile-type-footnote text-muted-foreground">
            Up to 50 activities saved on this device.
          </p>
        </MobileSection>
      ) : null}
      <Drawer
        open={!!review}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
      >
        <DrawerContent>
          {review ? (
            <>
              <DrawerHeader className="shrink-0 flex-row items-start justify-between gap-3 text-left">
                <div className="grid gap-1">
                  <DrawerTitle>{review.focus}</DrawerTitle>
                  <DrawerDescription>
                    {review.club} · {stored ? "Saved on this device" : "Not saved"}
                  </DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button variant="ghost" className="min-h-11" aria-label="Close activity review">
                    Done
                  </Button>
                </DrawerClose>
              </DrawerHeader>
              <div className={styles.quickRangeReview}>
                <div className={styles.activityProgress}>
                  <span>{review.count}</span>
                  <p>Balls logged · {Math.floor(review.elapsed / 60)} min</p>
                </div>
                {review.target ? <p>Target: {review.target}</p> : null}
                <MobileGroupedList label="Manual ball labels">
                  {quickRangeLabels.map((label) => {
                    const count = review.labels.filter((value) => value === label).length;
                    return count ? <MobileListRow key={label} label={label} value={count} /> : null;
                  })}
                </MobileGroupedList>
                <p className="mobile-type-footnote text-muted-foreground">
                  Manual notes · These are not measured shot results.
                </p>
                {review.notes ? <p className="whitespace-pre-wrap">{review.notes}</p> : null}
                <Button asChild className="min-h-12">
                  <Link href="/import">Import measured session</Link>
                </Button>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
      {!stored && !finished ? (
        <p role="status" className="text-sm text-destructive">
          Storage unavailable. Keep this page open to retain your session.
        </p>
      ) : null}
    </section>
  );
}
