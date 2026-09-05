"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createManualSpeedSessionAction } from "./actions";
import type { SpeedDevelopmentSummary } from "@/lib/speed-development";
import { MobileSection, MobileMetric } from "@/components/app/mobile-screen";
import { useMobileActivity, activityHaptic } from "@/components/app/use-mobile-activity";
import { Button } from "@/components/ui/button";
import { useFormStatus } from "react-dom";

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
  const [active, setActive] = useState(false);
  const [block, setBlock] = useState(0);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [speed, setSpeed] = useState("");
  const [readings, setReadings] = useState<Array<{ value: number; warmup: boolean }>>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [pb, setPb] = useState<number | null>(null);
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
        } else if (draft && draft.planTitle === plan.title && Array.isArray(draft.readings)) {
          setReadings(
            draft.readings.filter(
              (item: { value: number; warmup: boolean }) =>
                Number.isFinite(item.value) &&
                item.value >= 20 &&
                item.value <= 180 &&
                typeof item.warmup === "boolean",
            ),
          );
          setBlock(Math.max(0, Math.min(plan.blocks.length - 1, Number(draft.block) || 0)));
          setNote(typeof draft.note === "string" ? draft.note : "");
        }
      } catch {
        /* Unavailable storage leaves the measured readings on screen. */
      }
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [draftKey, saved, personalBestMph, plan.title, plan.blocks.length]);
  useEffect(() => {
    if (!hydrated || !readings.length) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ planTitle: plan.title, block, readings, note, personalBestMph }),
      );
    } catch {
      queueMicrotask(() => setError("Storage unavailable. Keep this page open until you save."));
    }
  }, [draftKey, hydrated, block, readings, note, personalBestMph, plan.title]);
  const current = plan.blocks[block];
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const elapsed = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const rest = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  function addReading() {
    const value = Number(speed);
    if (!Number.isFinite(value) || value < 20 || value > 180) {
      setError("Enter a measured speed from 20 to 180 mph.");
      return;
    }
    activityHaptic();
    setReadings((items) => [
      ...items,
      { value, warmup: current.key === "warmup" || plan.mode !== "speed" },
    ]);
    setSpeed("");
    setError("");
    setNow(Date.now());
    setRestUntil(Date.now() + 45_000);
  }
  return (
    <div data-speed-session-active={active ? "true" : "false"}>
      <MobileSection title="Today's speed session">
        {pb != null ? (
          <p role="status" className="rounded-xl bg-primary/10 p-4 font-semibold text-primary">
            Personal best · {pb.toFixed(1)} mph. Check ball transfer before using it on the course.
          </p>
        ) : null}
        <h3 className="mobile-type-title3">{plan.title}</h3>
        <p className="text-sm text-muted-foreground">
          {plan.durationMinutes} min · {plan.blocks.length} blocks
        </p>
        {!active ? (
          <Button
            className="min-h-12"
            disabled={!hydrated}
            onClick={() => {
              setActive(true);
              setStarted(Date.now());
              setNow(Date.now());
            }}
          >
            {readings.length ? "Resume session" : "Start session"}
          </Button>
        ) : (
          <div className="grid gap-4 rounded-xl bg-card p-4">
            <Button variant="ghost" className="justify-self-start" onClick={() => setActive(false)}>
              Pause session
            </Button>
            <p className="text-sm text-muted-foreground">
              Block {block + 1} of {plan.blocks.length} · {Math.floor(elapsed / 60)}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            <h3 className="mobile-type-title2">{current.label}</h3>
            <p className="font-semibold">
              {current.reps ? `${current.reps} swings` : `${current.balls ?? "Measured"} balls`} ·{" "}
              {current.target}
            </p>
            <p>{current.instruction}</p>
            {current.balls ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Import the ball session to assess playable strike and transfer.
                </p>
                <Button asChild variant="outline">
                  <Link href="/import">Import ball evidence</Link>
                </Button>
              </>
            ) : (
              <>
                <label className="grid gap-2 text-sm font-semibold">
                  Measured speed (mph)
                  <input
                    className="min-h-16 w-full rounded-xl border bg-background px-4 text-3xl tabular-nums"
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
                {rest > 0 ? (
                  <MobileMetric
                    value={rest}
                    unit="sec"
                    label="rest timer"
                    detail="Extend the rest whenever you need it."
                  />
                ) : null}
              </>
            )}
            <p className="text-sm text-muted-foreground">
              Stop if you feel pain or lose your normal strike. A faster reading alone does not
              prove better golf.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!block}
                onClick={() => setBlock((index) => Math.max(0, index - 1))}
              >
                Previous
              </Button>
              <Button
                onClick={() =>
                  block < plan.blocks.length - 1 ? setBlock((index) => index + 1) : setActive(false)
                }
              >
                {block < plan.blocks.length - 1 ? "Next block" : "Finish activity"}
              </Button>
            </div>
          </div>
        )}
        {readings.length ? (
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
        ) : null}
      </MobileSection>
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
