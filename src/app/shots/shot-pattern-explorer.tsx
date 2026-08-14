"use client";

import { useState } from "react";
import { Crosshair, Filter, Layers3 } from "lucide-react";

import { StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <Card
      className="grid gap-4 p-4"
      aria-labelledby="pattern-explorer-title"
      data-shot-pattern-explorer
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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
          <Select
            value={groupBy}
            onValueChange={(value) => {
              setGroupBy(value as ShotPatternGrouping);
              setSelected(null);
            }}
          >
            <SelectTrigger className="min-h-11 min-w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupings.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      {clusters.length ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4" aria-label="Shot clusters">
          {clusters.map((cluster) => (
            <Button
              key={cluster.key}
              type="button"
              variant="outline"
              onClick={() => setSelected(cluster.key === selected ? null : cluster.key)}
              aria-expanded={cluster.key === selected}
              className="h-auto min-h-28 flex-col items-stretch justify-start whitespace-normal p-4 text-left hover:border-primary"
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
            </Button>
          ))}
        </div>
      ) : (
        <Alert>
          <Crosshair aria-hidden="true" />
          <AlertTitle>No matching shot clusters</AlertTitle>
          <AlertDescription>No matching measured shots to cluster.</AlertDescription>
        </Alert>
      )}
      {active ? (
        <div id="pattern-cluster-detail" className="rounded-xl border bg-background p-4">
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
            <Table className="min-w-[42rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>Carry</TableHead>
                  <TableHead>Finish</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.shots.map((shot) => (
                  <TableRow key={shot.id}>
                    <TableCell>{shot.date}</TableCell>
                    <TableCell className="font-semibold">{shot.club}</TableCell>
                    <TableCell>{shot.carry}</TableCell>
                    <TableCell>{shot.finish}</TableCell>
                    <TableCell>{shot.start}</TableCell>
                    <TableCell>{shot.evidence}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <Crosshair className="mt-0.5 size-4 shrink-0" aria-hidden />
        Automatic labels describe repeated geometry in the selected cluster. They do not diagnose
        swing mechanics and low-sample clusters remain provisional.
      </p>
    </Card>
  );
}
