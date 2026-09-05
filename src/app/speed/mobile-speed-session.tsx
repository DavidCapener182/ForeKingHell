"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createManualSpeedSessionAction } from "./actions";
import type { SpeedDevelopmentSummary } from "@/lib/speed-development";
import { MobileMetric } from "@/components/app/mobile-screen";
import { useMobileActivity, activityHaptic } from "@/components/app/use-mobile-activity";
import { Button } from "@/components/ui/button";
import { useFormStatus } from "react-dom";
import { mobileSpeedBlocks, restoreMobileSpeedBlock } from "@/lib/mobile-speed-plan";
import {
  speedElapsedMs,
  speedFatigueStop,
  speedBlockRecoverySeconds,
  type MobileSpeedReading,
} from "@/lib/mobile-speed-progress";

export function MobileSpeedSession({
  plan,
  clubId,
  accountId,
  saved = false,
  personalBestMph,
}: {
  plan: SpeedDevelopmentSummary["plan"];
  clubId?: string;
  accountId: string;
  saved?: boolean;
  personalBestMph: number | null;
}) {
  const blocks = useMemo(() => mobileSpeedBlocks(plan), [plan]);
  const [active, setActive] = useState(false);
  const [block, setBlock] = useState(0);
  const [started, setStarted] = useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = useState(0);
  const [now, setNow] = useState(0);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [speed, setSpeed] = useState("");
  const [readings, setReadings] = useState<MobileSpeedReading[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [pb, setPb] = useState<number | null>(null);
  const [recordingNew, setRecordingNew] = useState(false);
  const finishSpeedRef = useRef<HTMLButtonElement>(null);
  const draftKey = `fkh:speed-session:${accountId}`;
  useMobileActivity(active);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null");
        if (saved) {
          if (
            draft &&
            personalBestMph != null &&
            (draft.personalBestMph == null || personalBestMph > draft.personalBestMph)
          )
            setPb(personalBestMph);
          localStorage.removeItem(draftKey);
          setReadings([]);
          setActive(false);
          setStarted(null);
          setAccumulatedMs(0);
          setRestUntil(null);
          setNote("");
          setBlock(0);
          setRecordingNew(false);
        } else if (draft?.planTitle === plan.title && Array.isArray(draft.readings)) {
          setReadings(
            draft.readings.filter(
              (item: { value: number; warmup: boolean }) =>
                Number.isFinite(item.value) &&
                item.value >= 20 &&
                item.value <= 180 &&
                typeof item.warmup === "boolean",
            ),
          );
          setBlock(restoreMobileSpeedBlock(plan, draft));
          setNote(typeof draft.note === "string" ? draft.note : "");
          setAccumulatedMs(
            typeof draft.elapsedMs === "number" && Number.isFinite(draft.elapsedMs)
              ? Math.max(0, draft.elapsedMs)
              : 0,
          );
          setRestUntil(
            typeof draft.restUntil === "number" && Number.isFinite(draft.restUntil)
              ? draft.restUntil
              : null,
          );
          setNow(Date.now());
        }
      } catch {
        /* Unavailable storage leaves the measured readings on screen. */
      }
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [draftKey, saved, personalBestMph, plan]);
  useEffect(() => {
    if (!hydrated || (saved && !recordingNew)) return;
    if (!readings.length && !active && accumulatedMs === 0) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          planTitle: plan.title,
          version: 2,
          blockKey: (blocks[block] ?? blocks[0]).key,
          block,
          readings,
          note,
          personalBestMph,
          elapsedMs: speedElapsedMs(accumulatedMs, started, now),
          restUntil,
        }),
      );
    } catch {
      queueMicrotask(() => setError("Storage unavailable. Keep this page open until you save."));
    }
  }, [
    draftKey,
    hydrated,
    saved,
    recordingNew,
    active,
    block,
    readings,
    note,
    personalBestMph,
    plan.title,
    blocks,
    accumulatedMs,
    started,
    now,
    restUntil,
  ]);
  const current = blocks[block] ?? blocks[0];
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const elapsed = Math.floor(speedElapsedMs(accumulatedMs, started, now) / 1000);
  const rest = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  const blockReadings = readings.filter((item) => item.blockKey === current.key);
  const fatigueStop = speedFatigueStop(readings);
  const stopMaximumWork = fatigueStop && plan.mode === "speed" && !current.warmup && !current.balls;
  useEffect(() => {
    if (active && stopMaximumWork) finishSpeedRef.current?.focus({ preventScroll: true });
  }, [active, stopMaximumWork]);
  useEffect(() => {
    if (active) window.scrollTo({ top: 0, behavior: "instant" });
  }, [active, block]);
  function pause() {
    setAccumulatedMs(speedElapsedMs(accumulatedMs, started, Date.now()));
    setStarted(null);
    setActive(false);
  }
  function moveBlock(index: number) {
    const next = Math.max(0, Math.min(blocks.length - 1, index));
    setBlock(next);
    const recovery = speedBlockRecoverySeconds(blocks[next].key);
    if (next > block && recovery)
      setRestUntil(Math.max(restUntil ?? 0, Date.now() + recovery * 1000));
    setNow(Date.now());
  }
  function addReading() {
    const value = Number(speed);
    if (!Number.isFinite(value) || value < 20 || value > 180) {
      setError("Enter a measured speed from 20 to 180 mph.");
      return;
    }
    activityHaptic();
    setReadings((items) => [...items, { value, warmup: current.warmup, blockKey: current.key }]);
    setSpeed("");
    setError("");
    setNow(Date.now());
    setRestUntil(Date.now() + 45_000);
  }
  return (
    <div data-speed-session-active={active ? "true" : "false"}>
      <section className="mobile-section" aria-label="Speed session">
        {pb != null && !active ? (
          <p role="status" className="rounded-xl bg-primary/10 p-4 font-semibold text-primary">
            Personal best · {pb.toFixed(1)} mph. Check ball transfer before using it on the course.
          </p>
        ) : null}
        {!active ? (
          <header className="grid gap-1">
            <h2 className="mobile-type-title3">{plan.title}</h2>
            <p className="mobile-type-footnote text-muted-foreground">
              {plan.durationMinutes} min · {blocks.length} stages
            </p>
          </header>
        ) : null}
        {!active ? (
          <details>
            <summary className="flex min-h-11 items-center text-primary">Session stages</summary>
            <ol className="divide-y">
              {blocks.map((item) => (
                <li key={item.key} className="py-3">
                  <p className="mobile-type-headline">{item.label}</p>
                  <p className="mobile-type-footnote text-muted-foreground">
                    {item.reps ? `${item.reps} swings` : `${item.balls} balls`} · {item.target}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
        {!active ? (
          <Button
            className="min-h-12"
            disabled={!hydrated}
            onClick={() => {
              setRecordingNew(true);
              const url = new URL(window.location.href);
              url.searchParams.delete("speed_saved");
              window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
              setActive(true);
              setStarted(Date.now());
              setNow(Date.now());
            }}
          >
            {readings.length || accumulatedMs > 0 ? "Resume session" : "Start session"}
          </Button>
        ) : (
          <div className="grid gap-4">
            <Button variant="ghost" className="justify-self-start" onClick={pause}>
              Pause session
            </Button>
            <p className="text-sm text-muted-foreground">
              Stage {block + 1} of {blocks.length} · {Math.floor(elapsed / 60)}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            <h1 className="mobile-type-title1">{current.label}</h1>
            <p className="mobile-type-footnote text-muted-foreground">
              Driver ·{" "}
              {current.key === "finish"
                ? "Normal course swings"
                : current.warmup
                  ? "Preparation and control"
                  : current.balls
                    ? "Measured ball transfer"
                    : "Maximum-speed readings"}
            </p>
            {!stopMaximumWork ? (
              <>
                <p className="font-semibold">
                  {current.reps ? `${current.reps} swings` : `${current.balls ?? "Measured"} balls`}{" "}
                  · {current.target}
                </p>
                <p>{current.instruction}</p>
              </>
            ) : null}
            {blockReadings.length ? (
              <p className="text-sm tabular-nums text-muted-foreground">
                {blockReadings.length}
                {current.reps ? ` of ${current.reps}` : ""} readings · latest{" "}
                {blockReadings.at(-1)?.value.toFixed(1)} mph
              </p>
            ) : null}
            {stopMaximumWork ? (
              <p role="status" className="rounded-xl bg-muted p-3 text-sm">
                Two readings are at least 4% below today’s peak. Finish maximum-speed work for
                today; do not chase another peak.
              </p>
            ) : null}
            {stopMaximumWork ? (
              <Button ref={finishSpeedRef} className="min-h-12" onClick={pause}>
                Finish speed work
              </Button>
            ) : null}
            {current.key === "finish" ? null : current.balls ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Import the ball session to assess playable strike and transfer.
                </p>
                <Button asChild variant="outline">
                  <Link href="/import">Import ball evidence</Link>
                </Button>
              </>
            ) : (
              <details
                open={!stopMaximumWork}
                className={stopMaximumWork ? "border-t pt-2" : "contents"}
              >
                <summary
                  className={
                    stopMaximumWork
                      ? "flex min-h-11 cursor-pointer items-center text-primary"
                      : "hidden"
                  }
                >
                  Log another measured reading
                </summary>
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm font-semibold">
                    Measured speed (mph)
                    <input
                      data-mobile-metric-input
                      className="w-full border px-4 tabular-nums"
                      inputMode="decimal"
                      type="number"
                      min="20"
                      max="180"
                      step="0.1"
                      value={speed}
                      onChange={(e) => setSpeed(e.target.value)}
                    />
                  </label>
                  {error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <Button className="min-h-12" onClick={addReading}>
                    Record speed
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    45 seconds between recorded swings. Take longer when needed.
                  </p>
                </div>
              </details>
            )}
            {rest > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <MobileMetric
                  value={rest}
                  unit="sec"
                  label="rest timer"
                  detail={
                    current.key === "speed-2"
                      ? "Allow 60–90 seconds before this block."
                      : "Recover before the next swing."
                  }
                />
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setRestUntil(Math.max(restUntil ?? 0, Date.now()) + 30_000)}
                >
                  +30 sec rest
                </Button>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Stop if you feel pain or lose your normal strike. A faster reading alone does not
              prove better golf.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!block} onClick={() => moveBlock(block - 1)}>
                Previous
              </Button>
              <Button
                variant={stopMaximumWork ? "outline" : "default"}
                onClick={() => (block < blocks.length - 1 ? moveBlock(block + 1) : pause())}
              >
                {block < blocks.length - 1 ? "Next block" : "Finish activity"}
              </Button>
            </div>
          </div>
        )}
        {readings.length ? (
          <details open={!active} className="border-t pt-2">
            <summary className="flex min-h-11 cursor-pointer items-center text-primary">
              Readings and note · {readings.length}
            </summary>
            <form action={createManualSpeedSessionAction} className="grid gap-3">
              <input type="hidden" name="clubId" value={clubId ?? ""} />
              <input type="hidden" name="implementKind" value="club" />
              <input
                type="hidden"
                name="warmupReadings"
                value={readings
                  .filter((item) => item.warmup)
                  .map((item) => item.value)
                  .join("\n")}
              />
              <input
                type="hidden"
                name="speedReadings"
                value={readings
                  .filter((item) => !item.warmup)
                  .map((item) => item.value)
                  .join("\n")}
              />
              <p className="text-sm tabular-nums">
                {readings.length} readings · latest {readings.at(-1)?.value} mph
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReadings((items) => items.slice(0, -1))}
              >
                Undo last reading
              </Button>
              <label className="grid gap-1 text-sm">
                Session note
                <textarea
                  name="notes"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-20 rounded-xl border bg-card p-3 text-base"
                  placeholder="Strike, energy or anything to remember"
                />
              </label>
              <SaveSpeedButton />
            </form>
          </details>
        ) : null}
      </section>
    </div>
  );
}
function SaveSpeedButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-h-12" disabled={pending}>
      {pending ? "Saving…" : "Save measured speeds"}
    </Button>
  );
}
