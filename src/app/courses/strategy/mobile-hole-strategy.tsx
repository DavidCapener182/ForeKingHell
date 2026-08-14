"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Cuboid, Save, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { HoleStrategy, HoleStrategyMode } from "@/lib/course-strategy";
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
}) {
  const [index, setIndex] = useState(0);
  const [modeId, setModeId] = useState<HoleStrategyMode["id"]>("normal");
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
    try {
      const raw = window.localStorage.getItem(`fkh:round-download:${accountId}:${course.id}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        accountId?: unknown;
        course?: { id?: unknown };
        storedAt?: unknown;
      };
      if (
        saved.accountId !== accountId ||
        saved.course?.id !== course.id ||
        typeof saved.storedAt !== "string"
      ) {
        return;
      }
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
  }, [accountId, course.id]);

  if (!strategy) return null;

  const normalMode =
    strategy.strategyModes.find((mode) => mode.id === "normal") ?? fallbackMode(strategy);
  const mode = strategy.strategyModes.find((item) => item.id === modeId) ?? normalMode;

  const selectHole = (nextIndex: number) => {
    setIndex(nextIndex);
    setModeId("normal");
    document
      .querySelector("[data-mobile-one-hole-strategy]")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      className={styles.mobileBook}
      data-mobile-one-hole-strategy
      aria-label="One-hole digital caddie book"
    >
      <header className={styles.mobileHoleHeader} aria-live="polite">
        <div>
          <span>Hole</span>
          <h2>{strategy.holeNumber}</h2>
        </div>
        <dl>
          <div>
            <dt>Par</dt>
            <dd>{strategy.par}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{strategy.yards} yd</dd>
          </div>
        </dl>
      </header>

      <HoleStrategyVisual strategy={strategy} mode={mode} courseMap={courseMap} compact />

      <section className={styles.mobileRecommended}>
        <span>Recommended play · {mode.label}</span>
        <h3>
          {mode.club} to {mode.target.toLowerCase()}
        </h3>
        <p>{mode.rationale}</p>
      </section>

      <div className={styles.mobileModeSwitcher} aria-label="Strategy mode">
        {(["safe", "normal", "aggressive"] as const).map((id) => {
          const supported = strategy.strategyModes.some((item) => item.id === id);
          return (
            <button
              key={id}
              type="button"
              disabled={!supported}
              data-active={mode.id === id ? "true" : "false"}
              onClick={() => setModeId(id)}
              title={supported ? `${id} strategy` : `${id} strategy needs more evidence`}
            >
              {id[0]!.toUpperCase() + id.slice(1)}
            </button>
          );
        })}
      </div>

      <dl className={styles.mobileStrategyList}>
        <MobileRow label="Club" value={mode.club} />
        <MobileRow label="Target" value={mode.target} />
        <MobileRow label="Carry" value={mode.carryRange} />
        <MobileRow label="Miss" value={strategy.commonMiss} />
        <MobileRow label="Hazard" value={hazardLabel(strategy)} />
        <MobileRow label="Alternative" value={strategy.conservativeAlternative} />
      </dl>

      {courseTwinAvailable ? (
        <Button asChild className={styles.mobileCourseTwin}>
          <Link href={`/play/${course.id}?mode=strategy&hole=${strategy.holeNumber}`}>
            <Cuboid aria-hidden /> Open hole {strategy.holeNumber} in Course Twin
          </Link>
        </Button>
      ) : (
        <Alert>
          <Cuboid aria-hidden />
          <AlertTitle>Course Twin unavailable</AlertTitle>
          <AlertDescription>
            This course has strategy data but no published 3D twin.
          </AlertDescription>
        </Alert>
      )}

      <p className={styles.mobileCaveat}>{strategy.caveat}</p>

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
            {savedCopyIsStale ? " · Refresh before the round." : " · Available without a signal."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="min-h-12 rounded-xl"
        disabled={!hydrated}
        onClick={() => {
          try {
            window.localStorage.setItem(
              `fkh:round-download:${accountId}:${course.id}`,
              JSON.stringify({
                version: 1,
                accountId,
                course,
                tee,
                storedAt: new Date().toISOString(),
                strategy: strategies,
                trustedBag,
                visualFallback: strategies.map(({ holeNumber, par, yards, safeTarget }) => ({
                  holeNumber,
                  par,
                  yards,
                  safeTarget,
                })),
              }),
            );
            setDownloaded(true);
            setSavedAt(new Date());
            setSavedCopyIsStale(false);
          } catch {
            setDownloaded(false);
          }
        }}
      >
        <Save aria-hidden />
        {downloaded ? "Refresh saved caddie book" : "Save caddie book on this device"}
      </Button>
      {downloaded ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-xl"
          onClick={() => {
            window.localStorage.removeItem(`fkh:round-download:${accountId}:${course.id}`);
            setDownloaded(false);
            setSavedAt(null);
            setSavedCopyIsStale(false);
          }}
        >
          <Trash2 aria-hidden /> Clear saved caddie book
        </Button>
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
          {index + 1} / {strategies.length}
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
