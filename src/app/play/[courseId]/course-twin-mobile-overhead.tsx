"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type {
  CourseTwinManifest,
  CourseTwinReplayDocument,
  CourseTwinReplayShot,
} from "@/lib/course-twin-contract";
import { overheadProjection, overheadReplayPosition } from "@/lib/course-twin-overhead";
import styles from "./course-twin-overhead.module.css";

export function CourseTwinMobileOverhead({
  manifest,
  replay,
  readOnly = false,
  initialMode,
  initialHoleNumber,
  onEnable3d,
}: {
  manifest: CourseTwinManifest;
  replay: CourseTwinReplayDocument | null;
  readOnly?: boolean;
  initialMode?: "strategy" | "replay";
  initialHoleNumber?: number;
  onEnable3d: () => void;
}) {
  const query = useSearchParams();
  const requestedHole = Number(query.get("hole") ?? initialHoleNumber);
  const holeIndex = Math.max(
    0,
    manifest.holes.findIndex((h) => h.holeNumber === requestedHole),
  );
  const hole = manifest.holes[holeIndex];
  const defaultMode = initialMode ?? (readOnly && replay ? "replay" : "strategy");
  const mode = (query.get("mode") ?? defaultMode) === "replay" ? "replay" : "strategy";
  const shots = useMemo(
    () => replay?.shots.filter((s) => s.holeNumber === hole?.holeNumber) ?? [],
    [replay, hole?.holeNumber],
  );
  const swipe = useRef<{ x: number; y: number } | null>(null);
  function navigate(nextHole: number, nextMode = mode) {
    const url = new URL(window.location.href);
    url.searchParams.set("hole", String(nextHole));
    url.searchParams.set("mode", nextMode);
    url.searchParams.delete("shot");
    window.history.replaceState(null, "", url);
  }
  if (!hole) return <p className={styles.screen}>No mapped holes are available.</p>;
  return (
    <section className={styles.screen} data-course-twin-mobile-overhead aria-label="2D Course Twin">
      <header className={styles.header}>
        <p>{manifest.course.name}</p>
        <span>2D · Low power</span>
      </header>
      <div
        className={styles.modes}
        data-read-only={readOnly || undefined}
        aria-label="Course Twin mode"
      >
        <button
          aria-pressed={mode === "strategy"}
          onClick={() => navigate(hole.holeNumber, "strategy")}
        >
          Plan
        </button>
        {!readOnly ? (
          <Link href={`/play?courseId=${encodeURIComponent(manifest.course.id)}`} prefetch={false}>
            Play
          </Link>
        ) : null}
        <button
          aria-pressed={mode === "replay"}
          onClick={() => navigate(hole.holeNumber, "replay")}
        >
          Replay
        </button>
      </div>
      <div className={styles.holeHeading}>
        <h1>Hole {hole.holeNumber}</h1>
        <p>
          Par {hole.par} · {hole.yards} yd
        </p>
      </div>
      <div
        onTouchStart={(event) => {
          if (
            event.touches.length !== 1 ||
            (event.target as HTMLElement).closest("button, a, input, select, summary")
          ) {
            swipe.current = null;
            return;
          }
          swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchCancel={() => {
          swipe.current = null;
        }}
        onTouchEnd={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          const next = manifest.holes[holeIndex + (dx < 0 ? 1 : -1)];
          if (next) navigate(next.holeNumber);
        }}
      >
        <HolePlayback
          key={`${hole.holeNumber}:${mode}:${replay?.session.id}`}
          manifest={manifest}
          holeIndex={holeIndex}
          shots={mode === "replay" ? shots : []}
          replay={mode === "replay" ? replay : null}
          replayMode={mode === "replay"}
          initialShotId={query.get("shot")}
        />
      </div>
      {!readOnly ? (
        <div className={styles.links}>
          <Link
            href={`/courses/strategy?courseId=${encodeURIComponent(manifest.course.id)}&hole=${hole.holeNumber}`}
            prefetch={false}
          >
            Club strategy
          </Link>
          <Link href="/quick-bag" prefetch={false}>
            Quick Bag
          </Link>
        </div>
      ) : null}
      <details className={styles.detail}>
        <summary>Map and replay evidence</summary>
        <p>
          {replay && mode === "replay"
            ? replay.disclosure
            : "Mapped course geometry uses the reference tee. Open Club strategy for your trusted bag evidence."}
        </p>
        <p>
          2D uses the saved reconstruction. Terrain-aware 3D simulation can produce different roll
          estimates.
        </p>
        {manifest.quality.warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
        {manifest.attribution.map((source) => (
          <p key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>{" "}
            · {source.licence}
          </p>
        ))}
        <button onClick={onEnable3d}>Try balanced 3D</button>
      </details>
      <nav className={styles.navigation} aria-label="Hole navigation">
        <button
          disabled={holeIndex === 0}
          onClick={() => navigate(manifest.holes[holeIndex - 1].holeNumber)}
        >
          <ChevronLeft aria-hidden />
          Previous
        </button>
        <span>
          {holeIndex + 1} / {manifest.holes.length}
        </span>
        <button
          disabled={holeIndex === manifest.holes.length - 1}
          onClick={() => navigate(manifest.holes[holeIndex + 1].holeNumber)}
        >
          Next
          <ChevronRight aria-hidden />
        </button>
      </nav>
    </section>
  );
}

function HolePlayback({
  manifest,
  holeIndex,
  shots,
  replay,
  replayMode,
  initialShotId,
}: {
  manifest: CourseTwinManifest;
  holeIndex: number;
  shots: CourseTwinReplayShot[];
  replay: CourseTwinReplayDocument | null;
  replayMode: boolean;
  initialShotId: string | null;
}) {
  const hole = manifest.holes[holeIndex];
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      shots.findIndex((s) => s.id === initialShotId),
    ),
  );
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const progressRef = useRef(0);
  const updateProgress = useCallback((value: number) => {
    progressRef.current = value;
    setProgress(value);
  }, []);
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);
  const shot = shots[index];
  const project = useMemo(() => overheadProjection(hole, shots), [hole, shots]);
  function selectShot(next: number) {
    if (!shots[next]) return;
    setPlaying(false);
    setIndex(next);
    updateProgress(0);
    const url = new URL(window.location.href);
    url.searchParams.set("shot", shots[next].id);
    window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    if (!playing || reduced || !shot) return;
    let frame = 0;
    let last = performance.now();
    let elapsed = progressRef.current;
    let published = last;
    const tick = (now: number) => {
      elapsed = Math.min(1, elapsed + Math.min(100, now - last) / 4000);
      last = now;
      if (now - published >= 1000 / 30 || elapsed === 1) {
        updateProgress(elapsed);
        published = now;
      }
      if (elapsed === 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (document.hidden) setPlaying(false);
    };
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopForMotionPreference = () => {
      if (motionPreference.matches) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stop);
    motionPreference.addEventListener("change", stopForMotionPreference);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", stop);
      motionPreference.removeEventListener("change", stopForMotionPreference);
    };
  }, [playing, reduced, shot, updateProgress]);
  const map = useMemo(
    () => (
      <g>
        {manifest.features
          .filter(
            (feature) => feature.holeNumber === hole.holeNumber || feature.holeNumber === null,
          )
          .map((feature) => (
            <path
              key={feature.id}
              d={feature.rings
                .map((ring) => `M${ring.map((p) => project(p).join(",")).join("L")}Z`)
                .join(" ")}
              fillRule="evenodd"
              className={styles[feature.type]}
            />
          ))}
        <polyline
          points={hole.centerline.map((p) => project(p).join(",")).join(" ")}
          className={styles.centerline}
        />
        <circle cx={project(hole.tee)[0]} cy={project(hole.tee)[1]} r="4" className={styles.tee} />
        <circle
          cx={project(hole.green)[0]}
          cy={project(hole.green)[1]}
          r="5"
          className={styles.greenMarker}
        />
      </g>
    ),
    [manifest.features, hole, project],
  );
  const ball = shot ? project(overheadReplayPosition(shot, progress)) : null;
  return (
    <>
      <div className={styles.map}>
        <p>
          {replayMode ? "Derived placement · reconstructed flight" : "Mapped hole · reference tee"}
        </p>
        <svg
          viewBox="0 0 320 360"
          role="img"
          aria-label={`Hole ${hole.holeNumber} overhead ${replayMode ? "replay" : "map"}`}
        >
          {map}
          {shots.slice(0, index).map((s) => (
            <polyline
              key={s.id}
              points={[
                s.start,
                s.carryEnd,
                ...(s.rollProvenance === "reconstructed" ? [s.totalEnd] : []),
              ]
                .map((p) => project(p).join(","))
                .join(" ")}
              className={styles.completed}
            />
          ))}
          {shot ? (
            <>
              <polyline
                points={[shot.start, ...shot.trajectory, shot.carryEnd]
                  .map((p) => project(p).join(","))
                  .join(" ")}
                className={styles.flight}
              />
              {shot.rollProvenance === "reconstructed" ? (
                <polyline
                  points={[shot.carryEnd, shot.totalEnd].map((p) => project(p).join(",")).join(" ")}
                  className={styles.roll}
                />
              ) : null}
            </>
          ) : null}
          {ball ? (
            <circle data-replay-ball cx={ball[0]} cy={ball[1]} r="5" className={styles.ball} />
          ) : null}
        </svg>
      </div>
      {replayMode ? (
        shot ? (
          <section className={styles.playback} aria-label="Shot replay">
            <p className={styles.session}>
              {replay?.session.title} ·{" "}
              {replay
                ? new Date(replay.session.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })
                : ""}
            </p>
            <div className={styles.shotHeading} aria-live="polite">
              <div>
                <span>Shot {shot.holeShotNumber ?? index + 1}</span>
                <h2>{shot.clubType}</h2>
              </div>
              {shot.metrics.carryYd.value !== null ? (
                <div className={styles.metric}>
                  <strong>{Math.round(shot.metrics.carryYd.value)}</strong>
                  <span>yd carry · {shot.metrics.carryYd.provenance}</span>
                </div>
              ) : (
                <p>Carry not recorded</p>
              )}
            </div>
            <label className={styles.shotSelect}>
              Shot on this hole
              <span className={styles.selectWrap}>
                <select
                  aria-label="Replay shot"
                  value={index}
                  onChange={(e) => selectShot(Number(e.target.value))}
                >
                  {shots.map((s, i) => (
                    <option key={s.id} value={i}>
                      Shot {s.holeShotNumber ?? i + 1} · {s.clubType}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden />
              </span>
            </label>
            <input
              className={styles.scrubber}
              type="range"
              aria-label="Shot replay position"
              aria-valuetext={`${Math.round(progress * 100)} percent of reconstructed shot`}
              min="0"
              max="100"
              step="1"
              value={Math.round(progress * 100)}
              onChange={(event) => {
                setPlaying(false);
                updateProgress(Number(event.target.value) / 100);
              }}
            />
            <div className={styles.transport}>
              <button
                disabled={index === 0}
                aria-label="Previous shot"
                onClick={() => selectShot(index - 1)}
              >
                <ChevronLeft aria-hidden />
              </button>
              <button
                onClick={() => {
                  if (reduced) {
                    updateProgress(progress === 1 ? 0 : 1);
                    return;
                  }
                  if (progress === 1) updateProgress(0);
                  setPlaying((value) => !value);
                }}
              >
                {reduced ? (
                  progress === 1 ? (
                    "Show start"
                  ) : (
                    "Show result"
                  )
                ) : playing ? (
                  <>
                    <Pause aria-hidden />
                    Pause
                  </>
                ) : (
                  <>
                    <Play aria-hidden />
                    Replay shot
                  </>
                )}
              </button>
              <button
                disabled={index === shots.length - 1}
                aria-label="Next shot"
                onClick={() => selectShot(index + 1)}
              >
                <ChevronRight aria-hidden />
              </button>
            </div>
            <p className={styles.result}>
              {shot.metrics.totalYd.value !== null
                ? `${Math.round(shot.metrics.totalYd.value)} yd total · ${shot.metrics.totalYd.provenance}`
                : "Total not recorded"}
              {shot.metrics.sideCarryYd.value !== null
                ? ` · ${Math.abs(Math.round(shot.metrics.sideCarryYd.value))} yd ${shot.metrics.sideCarryYd.value < 0 ? "left" : "right"}`
                : ""}
            </p>
            {reduced ? (
              <p className={styles.result}>Reduced motion · scrub or show the result.</p>
            ) : null}
          </section>
        ) : (
          <div className={styles.empty}>
            <h2>No measured shots on this hole</h2>
            <p>
              {replay?.shots.length
                ? "Choose another hole to replay this session."
                : "Import a measured round linked to this course to see its shots here."}
            </p>
          </div>
        )
      ) : null}
    </>
  );
}
function subscribeReducedMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
