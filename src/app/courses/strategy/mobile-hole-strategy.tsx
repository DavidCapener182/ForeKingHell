"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Cuboid, Save, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { HoleStrategy, HoleStrategyMode } from "@/lib/course-strategy";
import {
  caddieBookKey,
  createCaddieBookSnapshot,
  readCaddieBookSnapshot,
} from "@/lib/caddie-book-snapshot";
import type { CourseStrategyMap } from "@/lib/course-strategy-map";

import styles from "./course-strategy-book.module.css";
import { HoleStrategyVisual } from "./hole-strategy-visual";

export function MobileHoleStrategy({
  strategies,
  course,
  accountId,
  trustedBag = [],
  tee = null,
  courseTwinAvailable = false,
  courseMap = null,
  offline = false,
  savedSelection,
  onSelectionChange,
  onQuickBag,
}: {
  strategies: HoleStrategy[];
  course: { id: string; name: string };
  accountId: string;
  trustedBag?: Array<{
    clubId: string;
    clubType: string;
    label: string;
    carryYd: number;
    minCarryYd: number;
    maxCarryYd: number;
    confidence: number;
    sampleSize: number;
  }>;
  tee?: { id: string; name: string; yards: number | null } | null;
  courseTwinAvailable?: boolean;
  courseMap?: CourseStrategyMap | null;
  offline?: boolean;
  savedSelection?: { hole: number; mode: HoleStrategyMode["id"] };
  onSelectionChange?: (hole: number, mode: HoleStrategyMode["id"]) => void;
  onQuickBag?: () => void;
}) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const params = useSearchParams();
  const index = Math.max(
    0,
    strategies.findIndex(
      (hole) => hole.holeNumber === Number(offline ? savedSelection?.hole : params.get("hole")),
    ),
  );
  const requestedMode = offline ? savedSelection?.mode : params.get("option");
  const modeId =
    requestedMode === "safe" || requestedMode === "aggressive" ? requestedMode : "normal";
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savedCopyIsStale, setSavedCopyIsStale] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const strategy = strategies[index];

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (offline) return;
    try {
      const raw = window.localStorage.getItem(`fkh:round-download:${accountId}:${course.id}`);
      if (!raw) return;
      const saved = readCaddieBookSnapshot(raw, accountId);
      if (!saved || saved.course.id !== course.id || (saved.tee?.id ?? null) !== (tee?.id ?? null))
        return;
      const date = new Date(saved.storedAt);
      if (Number.isNaN(date.getTime())) return;
      const timer = window.setTimeout(() => {
        setDownloaded(true);
        setSavedAt(date);
        setSavedCopyIsStale(Date.now() - date.getTime() > 24 * 60 * 60 * 1_000);
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      // Local storage is an optional poor-connection aid.
    }
  }, [accountId, course.id, tee?.id, offline]);

  if (!strategy) return null;

  const availableModes = strategy.strategyModes.filter(
    (item) => item.evidence && item.evidence.sampleSize >= 5,
  );
  const normalMode = availableModes.find((item) => item.id === "normal") ?? fallbackMode(strategy);
  const mode = availableModes.find((item) => item.id === modeId) ?? normalMode;
  const evidence = mode.evidence;
  const setSelection = (hole: number, option: HoleStrategyMode["id"]) => {
    const url = new URL(window.location.href);
    url.searchParams.set("courseId", course.id);
    if (tee) url.searchParams.set("teeSetId", tee.id);
    url.searchParams.set("hole", String(hole));
    url.searchParams.set("option", option);
    window.history.replaceState(null, "", url);
    onSelectionChange?.(hole, option);
  };
  const selectHole = (nextIndex: number) => {
    const nextHole = strategies[nextIndex];
    if (!nextHole) return;
    setSelection(nextHole.holeNumber, "normal");
    document
      .querySelector("[data-mobile-one-hole-strategy]")
      ?.scrollIntoView({ behavior: "auto", block: "start" });
  };

  return (
    <section
      className={styles.mobileBook}
      data-offline={offline ? "true" : undefined}
      data-mobile-one-hole-strategy
      aria-label="One-hole digital caddie book"
      style={{ touchAction: "pan-y" }}
      onTouchStart={(event) => {
        if (
          event.touches.length !== 1 ||
          (event.target as HTMLElement).closest("button, a, input, summary")
        ) {
          swipeStart.current = null;
          return;
        }
        const point = event.touches[0];
        swipeStart.current = { x: point.clientX, y: point.clientY };
      }}
      onTouchCancel={() => {
        swipeStart.current = null;
      }}
      onTouchEnd={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start) return;
        const point = event.changedTouches[0];
        const dx = point.clientX - start.x;
        const dy = point.clientY - start.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5)
          selectHole(Math.max(0, Math.min(strategies.length - 1, index + (dx < 0 ? 1 : -1))));
      }}
    >
      <header className={styles.mobileHoleHeader} aria-live="polite">
        <h1>Hole {strategy.holeNumber}</h1>
        <p>
          Par {strategy.par} · <span>{strategy.yards} yd</span>
        </p>
      </header>
      <HoleStrategyVisual strategy={strategy} mode={mode} courseMap={courseMap} compact />
      <section className={styles.mobileDecision} aria-label="Hole decision">
        <div className={styles.mobileModeSwitcher} aria-label="Strategy mode">
          {(["safe", "normal", "aggressive"] as const).map((id) => (
            <button
              key={id}
              type="button"
              disabled={!availableModes.some((item) => item.id === id)}
              data-active={mode.id === id ? "true" : "false"}
              aria-pressed={mode.id === id}
              onClick={() => setSelection(strategy.holeNumber, id)}
            >
              {id[0]!.toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.mobileRecommended} aria-live="polite">
          <p>Recommended play · {mode.label}</p>
          <div className={styles.mobileClubCarry}>
            <h3>{mode.club}</h3>
            {evidence ? (
              <div>
                <strong>{Math.round(evidence.carryYd)}</strong>
                <span>yd carry</span>
              </div>
            ) : null}
          </div>
          <p className={styles.mobileTarget}>{mode.target}</p>
          <p>{mode.rationale}</p>
        </div>
        <details className={styles.mobileEvidence}>
          <summary>Club evidence and course detail</summary>
          <dl className={styles.mobileStrategyList}>
            <MobileRow
              label="Carry range"
              value={
                evidence
                  ? `${mode.carryRange}${evidence.carryRangeMeasured ? " · measured" : " · estimated"}`
                  : "Not available"
              }
            />
            <MobileRow
              label="Lateral range"
              value={
                evidence?.leftYd != null && evidence?.rightYd != null
                  ? `${Math.round(evidence.leftYd)} yd left · ${Math.round(evidence.rightYd)} yd right`
                  : "Not measured"
              }
            />
            <MobileRow
              label="Evidence"
              value={
                evidence
                  ? `${evidence.sampleSize} shots · ${evidence.confidence.toLowerCase()} confidence`
                  : "Add a measured session"
              }
            />
            <MobileRow label="Leave" value={mode.expectedLeave} />
            <MobileRow label="Hazards" value={hazardLabel(strategy)} />
          </dl>
          <p className={styles.mobileCaveat}>
            Target placement is indicative. The map uses the course reference tee;{" "}
            {tee?.name ?? "selected tee"} yardages do not establish its exact position. Confirm
            wind, lie and live hazards before playing.
          </p>
          <p className={styles.mobileCaveat}>
            Unavailable options need more club evidence. Safe describes a shorter club option, not a
            guarantee of avoiding hazards.
          </p>
          {courseMap?.attribution ? (
            <p className={styles.mobileCaveat}>{courseMap.attribution}</p>
          ) : null}
        </details>
        <div className={styles.mobileLinks}>
          {!offline && courseTwinAvailable ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/play/${course.id}?mode=strategy&hole=${strategy.holeNumber}`}>
                <Cuboid aria-hidden />
                Course Twin
              </Link>
            </Button>
          ) : null}
          {offline ? (
            onQuickBag ? (
              <Button variant="outline" className="min-h-11" onClick={onQuickBag}>
                Quick Bag
              </Button>
            ) : null
          ) : (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/quick-bag">Quick Bag</Link>
            </Button>
          )}
        </div>
      </section>
      {!offline ? (
        <details className={styles.mobileEvidence}>
          <summary>Save for the course</summary>
          {savedAt ? (
            <Alert>
              <Save aria-hidden />
              <AlertTitle>
                {savedCopyIsStale ? "Saved copy may be stale" : "Saved on this device"}
              </AlertTitle>
              <AlertDescription>
                {savedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {savedCopyIsStale
                  ? " · Refresh before the round."
                  : " · Club evidence and hole maps saved."}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-xl"
            disabled={!hydrated}
            onClick={() => {
              setSaveError(null);
              try {
                const snapshot = createCaddieBookSnapshot({
                  accountId,
                  course,
                  tee,
                  strategy: strategies,
                  trustedBag,
                  courseMap,
                  selectedHole: strategy.holeNumber,
                  selectedMode: mode.id,
                });
                const raw = JSON.stringify(snapshot);
                if (!readCaddieBookSnapshot(raw, accountId))
                  throw new Error("Book could not be validated");
                window.localStorage.setItem(caddieBookKey(accountId, course.id), raw);
                setDownloaded(true);
                setSavedAt(new Date());
                setSavedCopyIsStale(false);
              } catch {
                setSaveError("Could not save on this device. Free some storage and try again.");
                setDownloaded(false);
              }
            }}
          >
            <Save aria-hidden />
            {downloaded ? "Refresh saved caddie book" : "Save caddie book on this device"}
          </Button>
          {downloaded ? (
            <Button asChild variant="outline" className="min-h-11">
              <a
                href={`/offline?view=caddie&courseId=${course.id}${tee ? `&teeSetId=${tee.id}` : ""}`}
              >
                Open saved caddie book
              </a>
            </Button>
          ) : null}
          {downloaded ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-xl"
              onClick={() => {
                try {
                  window.localStorage.removeItem(`fkh:round-download:${accountId}:${course.id}`);
                } catch {
                  setSaveError("Could not clear the saved copy. Try again.");
                  return;
                }
                setDownloaded(false);
                setSavedAt(null);
                setSavedCopyIsStale(false);
              }}
            >
              <Trash2 aria-hidden /> Clear saved caddie book
            </Button>
          ) : null}

          {saveError ? (
            <p role="alert" className={styles.mobileCaveat}>
              {saveError}
            </p>
          ) : null}
        </details>
      ) : null}
      <nav className={styles.mobileFixedControls} aria-label="Hole navigation">
        <button
          type="button"
          disabled={!hydrated || index === 0}
          onClick={() => selectHole(index - 1)}
          aria-label="Previous hole"
        >
          <ChevronLeft aria-hidden /> Previous
        </button>
        <span>
          {strategy.holeNumber} / {strategies.length}
        </span>
        <button
          type="button"
          disabled={!hydrated || index === strategies.length - 1}
          onClick={() => selectHole(index + 1)}
          aria-label="Next hole"
        >
          <ChevronRight aria-hidden /> Next
        </button>
      </nav>
    </section>
  );
}

function MobileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function hazardLabel(strategy: HoleStrategy) {
  if (!strategy.hazards.length) return "No mapped evidence · confirm live";
  return `${strategy.hazards.join(" · ")} · distance not mapped`;
}

function fallbackMode(strategy: HoleStrategy): HoleStrategyMode {
  return {
    id: "normal",
    label: "Normal",
    club: strategy.recommendedClub,
    carryRange: strategy.expectedCarryRange,
    target: strategy.safeTarget,
    expectedLeave: strategy.expectedLeave,
    rationale: "Add trusted measured club ranges before relying on this hole plan.",
  };
}
