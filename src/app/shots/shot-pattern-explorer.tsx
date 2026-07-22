"use client";

import { useState } from "react";
import { Crosshair, Filter, Layers3 } from "lucide-react";

import { StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";

import type { ShotPatternCluster, ShotPatternGrouping } from "@/lib/shot-pattern-clusters";

const groupings = [
  ["club", "Club"],
  ["shape", "Shape"],
  ["start", "Start direction"],
  ["finish", "Finish direction"],
  ["strike", "Strike quality"],
  ["session", "Session"],
  ["date", "Date"],
  ["equipment", "Equipment"],
  ["ball", "Ball"],
  ["context", "Indoor / outdoor"],
  ["measurement", "Measured / estimated"],
] as const;

export function ShotPatternExplorer({
  groups,
}: {
  groups: Record<ShotPatternGrouping, ShotPatternCluster[]>;
}) {
  const [groupBy, setGroupBy] = useState<ShotPatternGrouping>("finish");
  const [selected, setSelected] = useState<string | null>(null);
  const clusters = groups[groupBy];
  const active = clusters.find((cluster) => cluster.key === selected) ?? null;

  return (
    <section
      className="grid gap-4 rounded-2xl border bg-card p-4"
      aria-labelledby="pattern-explorer-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Layers3 className="size-4" aria-hidden />
            Advanced shot-pattern explorer
          </p>
          <h2 id="pattern-explorer-title" className="mt-1 text-2xl font-semibold">
            Which shots form the pattern?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Group the current filtered evidence, then open a cluster to inspect every contributing
            shot.
          </p>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Filter className="size-4" aria-hidden />
            Group by
          </span>
          <select
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as ShotPatternGrouping);
              setSelected(null);
            }}
            className="min-h-11 rounded-xl border bg-background px-3"
          >
            {groupings.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {clusters.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {clusters.map((cluster) => (
            <button
              key={cluster.key}
              type="button"
              onClick={() => setSelected(cluster.key === selected ? null : cluster.key)}
              aria-expanded={cluster.key === selected}
              className="rounded-xl border bg-background p-4 text-left hover:border-primary focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{cluster.label}</p>
                <StatusPill tone={cluster.count >= 8 ? "green" : "amber"}>
                  {cluster.count} shots
                </StatusPill>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {cluster.averageCarry === null ? "—" : `${cluster.averageCarry} yd`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{cluster.patternLabel}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          No matching measured shots to cluster.
        </p>
      )}
      {active ? (
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">Contributing shots</p>
              <h3 className="mt-1 text-xl font-semibold">{active.label}</h3>
            </div>
            <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Club</th>
                  <th className="p-2">Carry</th>
                  <th className="p-2">Finish</th>
                  <th className="p-2">Start</th>
                  <th className="p-2">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {active.shots.map((shot) => (
                  <tr key={shot.id} className="border-t">
                    <td className="p-2">{shot.date}</td>
                    <td className="p-2 font-semibold">{shot.club}</td>
                    <td className="p-2">{shot.carry}</td>
                    <td className="p-2">{shot.finish}</td>
                    <td className="p-2">{shot.start}</td>
                    <td className="p-2">{shot.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <Crosshair className="mt-0.5 size-4 shrink-0" aria-hidden />
        Automatic labels describe repeated geometry in the selected cluster. They do not diagnose
        swing mechanics and low-sample clusters remain provisional.
      </p>
    </section>
  );
}
