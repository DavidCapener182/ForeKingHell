"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
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
  const displayPredicted = predicted;
  const shotsSaved =
    estimate === null || displayPredicted === null
      ? null
      : Math.max(0, (estimate - displayPredicted) * 4);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">What if?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Model likely upside from the biggest leaks.
          </p>
        </div>
        <SlidersHorizontal className="size-5 text-primary" />
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
            <Slider
              aria-label={`${group.clubLabel} ${group.mainMiss} improvement`}
              min={0}
              max={30}
              step={5}
              value={[values[index] ?? 0]}
              onValueChange={([value]) => {
                const next = [...values];
                next[index] = value ?? 0;
                setValues(next);
              }}
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
            predicted !== null ? "bg-[var(--status-success-surface)]" : "bg-muted/55",
          )}
        >
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Projected</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--status-success-foreground)]">
            {displayPredicted === null ? "--" : displayPredicted.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-background p-3 ring-1 ring-border">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Four rounds</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--status-success-foreground)]">
            {shotsSaved === null ? "--" : `${Math.round(shotsSaved)} shots`}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Confidence</span>
          <span>{confidenceScore}%</span>
        </div>
        <Progress value={confidenceScore} aria-label="Model confidence" className="mt-1 h-2" />
      </div>
    </div>
  );
}
