"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MobileMetric, MobileLargeTitle } from "@/components/app/mobile-screen";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";

export type MobileRoundHole = {
  holeNumber: number;
  par: number;
  yards: number;
  score: number | null;
  putts: number | null;
  penalties: number | null;
  fairwayHit: boolean | null;
  gir: boolean | null;
  notes?: string | null;
};
type Hole = MobileRoundHole;
type Envelope = { id: string; hole: Hole; version: string };
export type SavedRound = {
  finished?: boolean;
  completedSynced?: boolean;
  completion?: { id: string; version: string };
  context?: { sessionId: string; course: string; tee: string | null; courseId: string | null };
  version: string;
  holes: Hole[];
  index: number;
  dirty: number[];
  inFlight: Envelope | null;
};

/** Serialises writes, keeps the same operation ID after uncertain responses, and never silently rebases a conflict. */
export function MobileLiveRound({
  accountId,
  sessionId,
  course,
  tee,
  courseId,
  holes: initialHoles,
  recordVersion,
}: {
  accountId: string;
  sessionId: string;
  course: string;
  tee: string | null;
  courseId: string | null;
  holes: Hole[];
  recordVersion: string;
}) {
  const router = useRouter();
  const storageKey = `fkh:live-round:${accountId}:${sessionId}`;
  const [state, setState] = useState<SavedRound>({
    context: { sessionId, course, tee, courseId },
    version: recordVersion,
    holes: initialHoles,
    index: Math.max(
      0,
      initialHoles.findIndex((hole) => hole.score === null),
    ),
    dirty: [],
    inFlight: null,
  });
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Saved");
  const [finished, setFinished] = useState(false);
  const busy = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const publish = useCallback(
    (next: SavedRound) => {
      stateRef.current = next;
      setState(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        setStatus("Device storage unavailable. Keep this screen open until synced.");
      }
    },
    [storageKey],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as SavedRound | null;
        if (
          saved &&
          typeof saved.version === "string" &&
          Array.isArray(saved.holes) &&
          saved.holes.length === initialHoles.length &&
          saved.holes.every((hole, index) => hole.holeNumber === initialHoles[index]?.holeNumber) &&
          Array.isArray(saved.dirty)
        ) {
          if (saved.dirty.length || saved.inFlight || saved.finished) {
            stateRef.current = saved;
            setState(saved);
            setFinished(saved.finished ?? false);
            setStatus(saved.completedSynced ? "Saved" : "Saved on this phone; sync pending");
          } else {
            const restored = {
              ...stateRef.current,
              index: Math.max(0, Math.min(saved.index, initialHoles.length - 1)),
            };
            stateRef.current = restored;
            setState(restored);
          }
        }
      } catch {
        setStatus("Could not restore the phone copy. Showing the saved scorecard.");
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialHoles, storageKey]);
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>("[data-app-surface='companion']");
    if (shell) shell.dataset.mobileFlow = finished ? "standard" : "immersive";
    return () => {
      if (shell) delete shell.dataset.mobileFlow;
    };
  }, [finished]);
  const sync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    async function syncCompletion() {
      const finishedRound = stateRef.current;
      if (!finishedRound.finished && !finishedRound.completion) return true;
      if (!finishedRound.completedSynced || finishedRound.completion) {
        const operation = finishedRound.completion ?? {
          id: crypto.randomUUID(),
          version: finishedRound.version,
        };
        if (!finishedRound.completion) publish({ ...finishedRound, completion: operation });
        const response = await fetch("/api/offline/round-edits", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fkh-offline-owner": accountId,
            "x-fkh-offline-operation": operation.id,
          },
          body: JSON.stringify({
            editKind: "round-complete",
            fields: [
              ["sessionId", sessionId],
              ["expectedUpdatedAt", operation.version],
            ],
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.recordVersion) {
          setStatus(result.message ?? "Round completion is waiting to sync.");
          return false;
        }
        publish({
          ...stateRef.current,
          version: result.recordVersion,
          completion: undefined,
          completedSynced: true,
        });
      }
      return true;
    }
    try {
      if (stateRef.current.completion && !(await syncCompletion())) return;
      while (stateRef.current.inFlight || stateRef.current.dirty.length) {
        let saved = stateRef.current;
        const number = saved.dirty[0];
        const envelope = saved.inFlight ?? {
          id: crypto.randomUUID(),
          hole: saved.holes.find((hole) => hole.holeNumber === number)!,
          version: saved.version,
        };
        if (!saved.inFlight) publish({ ...saved, inFlight: envelope });
        setStatus("Saving…");
        const fields: Array<[string, string]> = [
          ["sessionId", sessionId],
          ["expectedUpdatedAt", envelope.version],
          ...["holeNumber", "score", "putts", "penalties", "fairwayHit", "gir", "notes"].map(
            (key) => [key, String(envelope.hole[key as keyof Hole] ?? "")] as [string, string],
          ),
        ];
        const response = await fetch("/api/offline/round-edits", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fkh-offline-owner": accountId,
            "x-fkh-offline-operation": envelope.id,
          },
          body: JSON.stringify({ editKind: "round-hole", fields }),
        });
        const result = (await response.json()) as {
          recordVersion?: string;
          message?: string;
          code?: string;
        };
        if (!response.ok) {
          setStatus(
            result.code === "offline_edit_conflict"
              ? "This round changed elsewhere. Your phone edits are kept; review before retrying."
              : (result.message ?? "Could not sync. Your edits remain on this phone."),
          );
          return;
        }
        if (!result.recordVersion) throw new Error("Missing save confirmation");
        saved = stateRef.current;
        const latest = saved.holes.find((hole) => hole.holeNumber === envelope.hole.holeNumber);
        publish({
          ...saved,
          version: result.recordVersion,
          inFlight: null,
          dirty:
            JSON.stringify(latest) === JSON.stringify(envelope.hole)
              ? saved.dirty.filter((item) => item !== envelope.hole.holeNumber)
              : saved.dirty,
        });
      }
      if (!(await syncCompletion())) return;
      setStatus("Saved");
    } catch {
      setStatus("Saved on this phone; waiting to sync");
    } finally {
      busy.current = false;
    }
  }, [accountId, publish, sessionId]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void sync(), 650);
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", online);
    };
  }, [state.holes, state.finished, ready, sync]);
  const hole = state.holes[state.index];
  if (!hole) return null;
  function edit(patch: Partial<Hole>) {
    const saved = stateRef.current;
    publish({
      ...saved,
      holes: saved.holes.map((item) =>
        item.holeNumber === hole.holeNumber ? { ...item, ...patch } : item,
      ),
      dirty: [...new Set([...saved.dirty, hole.holeNumber])],
    });
    setStatus("Saved on this phone; sync pending");
  }
  function move(delta: number) {
    publish({
      ...stateRef.current,
      index: Math.max(0, Math.min(state.holes.length - 1, state.index + delta)),
    });
  }
  function finishRound() {
    if (state.holes.some((hole) => hole.score == null)) {
      setStatus(
        "Score every hole before finishing. You can keep a partial round by returning to Play.",
      );
      return;
    }
    publish({ ...stateRef.current, finished: true, completedSynced: false });
    setFinished(true);
  }
  const scored = state.holes.filter((item) => item.score !== null);
  const total = scored.reduce((sum, item) => sum + (item.score ?? 0), 0);
  const toPar = total - scored.reduce((sum, item) => sum + item.par, 0);
  return (
    <section className="grid gap-5" data-mobile-live-round>
      <div className="flex items-center justify-between gap-3">
        <Link href="/play" className="flex min-h-11 items-center text-primary">
          Back to Play
        </Link>
        <Link href="/quick-bag" className="flex min-h-11 items-center text-primary">
          Quick Bag
        </Link>
      </div>
      <p className="truncate text-sm text-muted-foreground">
        {course}
        {tee ? ` · ${tee}` : ""}
      </p>
      {finished ? (
        <>
          <MobileLargeTitle
            title="Round recorded"
            detail={`${scored.length} of ${state.holes.length} holes scored`}
          />
          <MobileMetric
            value={total}
            label="strokes"
            detail={`${toPar > 0 ? "+" : ""}${toPar} to par`}
          />
          <Button
            disabled={!state.completedSynced || state.dirty.length > 0 || Boolean(state.inFlight)}
            onClick={() => {
              void sync().then(() => router.refresh());
            }}
          >
            Review round
          </Button>
          <Button
            variant="ghost"
            disabled={Boolean(state.completion)}
            onClick={() => {
              publish({ ...stateRef.current, finished: false });
              setFinished(false);
            }}
          >
            Back to scoring
          </Button>
        </>
      ) : (
        <div
          className="grid gap-5"
          style={{ touchAction: "pan-y" }}
          onTouchStart={(event) => {
            const point = event.touches[0];
            touch.current = { x: point.clientX, y: point.clientY };
          }}
          onTouchEnd={(event) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const point = event.changedTouches[0];
            const dx = point.clientX - start.x;
            const dy = point.clientY - start.y;
            if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
          }}
        >
          <MobileLargeTitle
            title={`Hole ${hole.holeNumber}`}
            detail={`Par ${hole.par}${hole.yards ? ` · ${hole.yards} yd` : ""}`}
          />
          <Counter
            label="Score"
            value={hole.score}
            first={hole.par}
            min={1}
            max={30}
            disabled={!ready}
            onChange={(score) => edit({ score })}
          />
          <Counter
            label="Putts"
            value={hole.putts}
            first={1}
            min={0}
            max={20}
            disabled={!ready}
            onChange={(putts) => edit({ putts })}
          />
          <MobileSegmentedControl
            ariaLabel="Penalties"
            value={hole.penalties === null ? "" : String(hole.penalties)}
            options={[
              { value: "0", label: "None" },
              { value: "1", label: "+1" },
              { value: "2", label: "+2" },
            ]}
            onValueChange={(value) => edit({ penalties: Number(value) })}
          />
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-primary">
              Fairway, green and notes
            </summary>
            <div className="grid gap-3">
              {(["fairwayHit", "gir"] as const).map((key) => (
                <MobileSegmentedControl
                  key={key}
                  ariaLabel={key === "gir" ? "Green in regulation" : "Fairway"}
                  value={String(hole[key])}
                  options={[
                    { value: "null", label: "Not recorded" },
                    { value: "true", label: "Hit" },
                    { value: "false", label: "Missed" },
                  ]}
                  onValueChange={(value) =>
                    edit({ [key]: value === "null" ? null : value === "true" })
                  }
                />
              ))}
              <label className="grid gap-2 text-sm">
                Hole note
                <textarea
                  className="min-h-24 rounded-xl border bg-card p-3 text-base"
                  value={hole.notes ?? ""}
                  maxLength={500}
                  onChange={(event) => edit({ notes: event.target.value })}
                />
              </label>
            </div>
          </details>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={!state.index} onClick={() => move(-1)}>
              Previous hole
            </Button>
            <Button
              onClick={() => (state.index === state.holes.length - 1 ? finishRound() : move(1))}
            >
              {state.index === state.holes.length - 1 ? "Finish round" : "Next hole"}
            </Button>
          </div>
          {courseId ? (
            <Link
              href={`/courses/strategy?courseId=${courseId}&hole=${hole.holeNumber}`}
              className="flex min-h-11 items-center text-primary"
            >
              Hole strategy
            </Link>
          ) : null}
          <p className="text-center text-sm tabular-nums">
            {total} strokes · {toPar > 0 ? "+" : ""}
            {toPar} through {scored.length}
          </p>
        </div>
      )}
      <p role="status" className="text-center text-sm text-muted-foreground">
        {status}
      </p>
      {status !== "Saved" && status !== "Saving…" ? (
        <Button variant="ghost" onClick={() => void sync()}>
          Retry sync
        </Button>
      ) : null}
    </section>
  );
}
function Counter({
  label,
  value,
  first,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  first: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-sm font-semibold">{label}</p>
      <div className="grid grid-cols-[4rem_1fr_4rem] items-center gap-4">
        <Button
          variant="outline"
          className="min-h-16 text-3xl"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={disabled || value === null || value <= min}
          onClick={() => onChange(Math.max(min, (value ?? first) - 1))}
        >
          −
        </Button>
        <span className="text-center text-5xl font-semibold tabular-nums">{value ?? "—"}</span>
        <Button
          variant="outline"
          className="min-h-16 text-3xl"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={disabled || (value !== null && value >= max)}
          onClick={() => onChange(value === null ? first : Math.min(max, value + 1))}
        >
          +
        </Button>
      </div>
      {value !== null ? (
        <Button variant="ghost" className="justify-self-center" onClick={() => onChange(null)}>
          Clear {label.toLowerCase()}
        </Button>
      ) : null}
    </div>
  );
}
