"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

type WhatIfGroup = {
  clubLabel: string;
  mainMiss: string;
  potentialGain: number;
};

export function WhatIfClient({
  estimate,
  confidenceScore,
  groups,
}: {
  estimate: number | null;
  confidenceScore: number;
  groups: WhatIfGroup[];
}) {
  const [values, setValues] = useState(() => groups.map(() => 15));
  const predicted = useMemo(() => {
    if (estimate === null) return null;
    const gain = groups.reduce(
      (total, group, index) => total + group.potentialGain * ((values[index] ?? 0) / 100),
      0,
    );
    return Math.max(0, estimate - gain);
  }, [estimate, groups, values]);
  const displayPredicted = useAnimatedNumber(predicted);
  const shotsSaved =
    estimate === null || displayPredicted === null
      ? null
      : Math.max(0, (estimate - displayPredicted) * 4);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900 dark:text-emerald-300">
            What if?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Model likely upside from the biggest leaks.
          </p>
        </div>
        <SlidersHorizontal className="size-5 text-emerald-700" />
      </div>
      <div className="mt-4 grid gap-4">
        {groups.map((group, index) => (
          <label key={`${group.clubLabel}-${group.mainMiss}`} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">
                {group.clubLabel} {group.mainMiss.toLowerCase()}
              </span>
              <span className="font-mono text-muted-foreground">{values[index]}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={5}
              value={values[index] ?? 0}
              onChange={(event) => {
                const next = [...values];
                next[index] = Number(event.target.value);
                setValues(next);
              }}
              className="accent-[#0B7A3B]"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-muted/55 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current</p>
          <p className="mt-1 text-2xl font-semibold">
            {estimate === null ? "--" : estimate.toFixed(1)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg p-3",
            predicted !== null ? "bg-emerald-50 dark:bg-emerald-950/35" : "bg-muted/55",
          )}
        >
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Projected</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800 transition-colors duration-300 motion-reduce:transition-none dark:text-emerald-200">
            {displayPredicted === null ? "--" : displayPredicted.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-background p-3 ring-1 ring-border">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Four rounds</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800 dark:text-emerald-200">
            {shotsSaved === null ? "--" : `${Math.round(shotsSaved)} shots`}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Confidence</span>
          <span>{confidenceScore}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#0B7A3B] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${confidenceScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function useAnimatedNumber(value: number | null) {
  const [displayValue, setDisplayValue] = useState(value);
  const displayRef = useRef(value);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    displayRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (value === null) {
      return;
    }

    if (reducedMotion) {
      return;
    }

    let frame = 0;
    const start = displayRef.current ?? value;
    const startedAt = performance.now();
    const durationMs = 280;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + (value - start) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return value === null ? null : reducedMotion ? value : displayValue;
}
