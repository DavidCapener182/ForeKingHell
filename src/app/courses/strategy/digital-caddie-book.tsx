"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Cuboid, Flag, ShieldCheck, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HoleStrategy, HoleStrategyMode } from "@/lib/course-strategy";
import type { CourseStrategyMap } from "@/lib/course-strategy-map";

import styles from "./course-strategy-book.module.css";
import { HoleStrategyVisual } from "./hole-strategy-visual";

export function DigitalCaddieBook({
  strategies,
  course,
  teeName,
  courseTwinAvailable,
  courseMap,
}: {
  strategies: HoleStrategy[];
  course: { id: string; name: string };
  teeName?: string | null;
  courseTwinAvailable: boolean;
  courseMap?: CourseStrategyMap | null;
}) {
  const [index, setIndex] = useState(0);
  const [modeId, setModeId] = useState<HoleStrategyMode["id"]>("normal");
  const strategy = strategies[index];
  if (!strategy) return null;

  const normalMode = modeFor(strategy, "normal") ?? fallbackMode(strategy);
  const mode = modeFor(strategy, modeId) ?? normalMode;
  const aggressiveSupported = Boolean(modeFor(strategy, "aggressive"));

  return (
    <section className={styles.book} data-digital-caddie-book>
      <header className={styles.bookHeader}>
        <div>
          <p>Digital caddie book</p>
          <h1>{course.name}</h1>
          <span>
            {teeName ?? "Selected tees"} · {strategies.length} mapped holes · Personal bag model
          </span>
        </div>
        <div className={styles.bookHeaderActions}>
          <Button asChild variant="outline">
            <Link href="/rounds/new">
              <Flag aria-hidden /> Prepare round
            </Link>
          </Button>
          {courseTwinAvailable ? (
            <Button asChild className={styles.courseTwinButton}>
              <Link href={`/play/${course.id}?mode=strategy&hole=${strategy.holeNumber}`}>
                <Cuboid aria-hidden /> Open Course Twin
              </Link>
            </Button>
          ) : (
            <Button disabled className={styles.courseTwinButton}>
              <Cuboid aria-hidden /> Course Twin unavailable
            </Button>
          )}
        </div>
      </header>

      <div className={styles.desktopZones}>
        <nav className={styles.holeNavigator} aria-label="Hole navigator">
          <div className={styles.zoneLabel}>
            <span>Hole navigator</span>
            <strong>{strategies.length}</strong>
          </div>
          <div className={styles.holeGrid}>
            {strategies.map((hole, holeIndex) => (
              <button
                key={hole.holeNumber}
                type="button"
                data-active={holeIndex === index ? "true" : "false"}
                onClick={() => {
                  setIndex(holeIndex);
                  setModeId("normal");
                }}
                aria-label={`Hole ${hole.holeNumber}, par ${hole.par}, ${hole.yards} yards`}
                aria-current={holeIndex === index ? "true" : undefined}
              >
                <span>{hole.holeNumber}</span>
                <small>
                  P{hole.par} · {hole.yards}
                </small>
                <ChevronRight aria-hidden />
              </button>
            ))}
          </div>
          <div className={styles.navigatorNote}>
            <ShieldCheck aria-hidden />
            <p>
              <strong>{strategy.confidence} confidence</strong>
              Historical measured shots, not a live caddie instruction.
            </p>
          </div>
        </nav>

        <main className={styles.mapZone}>
          <div className={styles.zoneHeading}>
            <div>
              <span>Hole {strategy.holeNumber}</span>
              <strong>
                Par {strategy.par} · {strategy.yards} yd
              </strong>
            </div>
            <span className={styles.modeReadout}>{mode.label} line</span>
          </div>
          <HoleStrategyVisual strategy={strategy} mode={mode} courseMap={courseMap} />
        </main>

        <aside className={styles.strategyPanel} aria-label="Strategy panel">
          <div className={styles.zoneLabel}>
            <span>Strategy panel</span>
            <Target aria-hidden />
          </div>
          <div className={styles.modeSwitcher} aria-label="Strategy mode">
            {(["safe", "normal", "aggressive"] as const).map((id) => {
              const supported = Boolean(modeFor(strategy, id));
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!supported}
                  data-active={mode.id === id ? "true" : "false"}
                  onClick={() => setModeId(id)}
                  title={
                    supported
                      ? `${id} strategy`
                      : id === "aggressive"
                        ? "Needs a trusted longer club and mapped hazard evidence"
                        : "No measured option supports this mode"
                  }
                >
                  {id[0]!.toUpperCase() + id.slice(1)}
                </button>
              );
            })}
          </div>
          {!aggressiveSupported ? (
            <p className={styles.modeEvidence}>
              Aggressive needs a trusted longer club and mapped hazard evidence.
            </p>
          ) : null}

          <section className={styles.recommendedPlay}>
            <p>Recommended play</p>
            <h2>{mode.club}</h2>
            <span>
              Aim {mode.target.toLowerCase()} and leave{" "}
              {mode.expectedLeave.replace(" after the first shot", "")}.
            </span>
          </section>

          <dl className={styles.strategyDetails}>
            <StrategyRow label="Tee club" value={mode.club} />
            <StrategyRow label="Safe target" value={mode.target} />
            <StrategyRow label="Carry" value={mode.carryRange} />
            <StrategyRow label="Dispersion" value={dispersionLabel(strategy)} />
            <StrategyRow label="Hazards" value={hazardLabel(strategy)} />
            <StrategyRow label="Common miss" value={strategy.commonMiss} />
            <StrategyRow label="Conservative" value={strategy.conservativeAlternative} />
            <StrategyRow label="Ideal leave" value={mode.expectedLeave} />
            <StrategyRow label="Confidence" value={`${strategy.confidence} · measured`} />
          </dl>

          <p className={styles.rationale}>{mode.rationale}</p>
          <p className={styles.caveat}>{strategy.caveat}</p>
        </aside>
      </div>
    </section>
  );
}

function StrategyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function modeFor(strategy: HoleStrategy, id: HoleStrategyMode["id"]) {
  return strategy.strategyModes.find((mode) => mode.id === id) ?? null;
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

export function dispersionLabel(strategy: HoleStrategy) {
  if (strategy.dispersionLeftYd === null || strategy.dispersionRightYd === null) {
    return "Not enough measured shots";
  }
  return `${strategy.dispersionLeftYd} yd L · ${strategy.dispersionRightYd} yd R`;
}

export function hazardLabel(strategy: HoleStrategy) {
  if (!strategy.hazards.length) return "No mapped evidence · confirm live";
  return `${strategy.hazards.join(" · ")} · distance not mapped`;
}
