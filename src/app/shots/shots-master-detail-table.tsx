"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, GitCompareArrows } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ShotMasterDetailRow = {
  id: string;
  shotAtLabel: string;
  fileNameLabel: string;
  shotNumberLabel: string;
  holeLabel: string;
  clubLabel: string;
  clubTypeLabel: string;
  clubType: string;
  carryLabel: string;
  totalLabel: string;
  sideLabel: string;
  launchLabel: string;
  ballSpeedLabel: string;
  clubSpeedLabel: string;
  launchDirectionLabel: string;
  apexLabel: string;
  attackLabel: string;
  pathLabel: string;
  faceLabel: string;
  descentLabel: string;
  smashLabel: string;
  estimateLabel: string;
  sideTone: "green" | "amber" | "red" | "slate";
};

export type ShotTableSort = {
  metric: "shot" | "carry" | "total" | "side" | "launch" | "ballSpeed";
  label: string;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
};

export function ShotsMasterDetailTable({
  shots,
  sorts,
}: {
  shots: ShotMasterDetailRow[];
  sorts: ShotTableSort[];
}) {
  const [selectedId, setSelectedId] = useState(shots[0]?.id ?? "");
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const selectedShot = useMemo(
    () => shots.find((shot) => shot.id === selectedId) ?? shots[0] ?? null,
    [selectedId, shots],
  );

  function selectRowAt(index: number) {
    const nextShot = shots[index];

    if (!nextShot) {
      return;
    }

    setSelectedId(nextShot.id);
    rowRefs.current[index]?.focus();
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectRowAt(Math.min(shots.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectRowAt(Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      selectRowAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectRowAt(shots.length - 1);
    }
  }

  return (
    <div className="hidden gap-4 sm:grid 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div
        id="main-table"
        tabIndex={-1}
        data-main-table-target="true"
        aria-label="Shot explorer table"
        className="apple-panel-strong min-w-0 overflow-hidden scroll-mt-28 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ScrollArea className="w-full">
          <Table
            className="min-w-[980px]"
            data-workbench-export-table="shots"
            aria-describedby="shots-table-summary"
          >
            <TableCaption id="shots-table-summary">
              Current shot explorer page with the active filters and visible table columns. Select a
              row to update the desktop shot detail panel.
            </TableCaption>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead data-column="date" className="sticky left-0 z-20 bg-white">
                  Date
                </TableHead>
                <TableHead data-column="file">File</TableHead>
                <SortableShotHead sort={sorts.find((item) => item.metric === "shot")} />
                <TableHead data-column="hole">Hole</TableHead>
                <TableHead data-column="club">Club</TableHead>
                <SortableShotHead sort={sorts.find((item) => item.metric === "carry")} />
                <SortableShotHead sort={sorts.find((item) => item.metric === "total")} />
                <SortableShotHead sort={sorts.find((item) => item.metric === "side")} />
                <SortableShotHead sort={sorts.find((item) => item.metric === "launch")} />
                <SortableShotHead sort={sorts.find((item) => item.metric === "ballSpeed")} />
                <TableHead data-column="advanced">Advanced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shots.map((shot, index) => {
                const selected = shot.id === selectedShot?.id;

                return (
                  <TableRow
                    key={shot.id}
                    ref={(node) => {
                      rowRefs.current[index] = node;
                    }}
                    tabIndex={0}
                    aria-label={`${shot.clubLabel} shot ${shot.shotNumberLabel} on ${shot.shotAtLabel}`}
                    aria-selected={selected}
                    data-selected-shot={selected ? "true" : undefined}
                    onClick={() => setSelectedId(shot.id)}
                    onFocus={() => setSelectedId(shot.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, index)}
                    className={cn(
                      "focus-aaa cursor-pointer border-b outline-none last:border-b-0",
                      selected && "bg-emerald-50/70",
                    )}
                  >
                    <TableCell
                      data-column="date"
                      className={cn("sticky left-0 z-10 bg-white", selected && "bg-emerald-50")}
                    >
                      {shot.shotAtLabel}
                    </TableCell>
                    <TableCell data-column="file" className="max-w-48 truncate">
                      {shot.fileNameLabel}
                    </TableCell>
                    <TableCell data-column="shot" className="text-right">
                      {shot.shotNumberLabel}
                    </TableCell>
                    <TableCell data-column="hole">{shot.holeLabel}</TableCell>
                    <TableCell data-column="club" className="font-medium">
                      <div className="max-w-48">
                        <p className="truncate">{shot.clubLabel}</p>
                        {shot.clubLabel !== shot.clubTypeLabel ? (
                          <p className="truncate text-xs font-normal text-muted-foreground">
                            {shot.clubTypeLabel}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell data-column="carry" className="text-right">
                      {shot.carryLabel}
                    </TableCell>
                    <TableCell data-column="total" className="text-right">
                      {shot.totalLabel}
                    </TableCell>
                    <TableCell data-column="side" className="text-right">
                      {shot.sideLabel}
                    </TableCell>
                    <TableCell data-column="launch" className="text-right">
                      {shot.launchLabel}
                    </TableCell>
                    <TableCell data-column="ballSpeed" className="text-right">
                      {shot.ballSpeedLabel}
                    </TableCell>
                    <TableCell data-column="advanced">
                      <span className="text-xs font-semibold text-emerald-700">Select</span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {shots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    No shots match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <SelectedShotDetail shot={selectedShot} />
    </div>
  );
}

function SortableShotHead({ sort }: { sort: ShotTableSort | undefined }) {
  if (!sort) {
    return null;
  }

  const nextDir = sort.active && sort.dir === "desc" ? "low to high" : "high to low";
  const Icon = sort.active ? (sort.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <TableHead
      data-column={sort.metric}
      className="text-right"
      aria-sort={sort.active ? sortAriaValue(sort.dir) : "none"}
    >
      <Link
        href={sort.href}
        className="inline-flex w-full items-center justify-end gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Sort by ${sort.label}, ${nextDir}`}
        prefetch={false}
      >
        {sort.label}
        <Icon className={cn("size-3.5", sort.active ? "text-emerald-700" : "opacity-45")} />
      </Link>
    </TableHead>
  );
}

function sortAriaValue(dir: "asc" | "desc") {
  return dir === "desc" ? "descending" : "ascending";
}

function SelectedShotDetail({ shot }: { shot: ShotMasterDetailRow | null }) {
  return (
    <aside
      role="region"
      aria-label="Selected shot detail"
      className="premium-command-surface grid min-w-0 gap-4 rounded-lg border border-emerald-950/10 p-4 2xl:sticky 2xl:top-20 2xl:self-start"
    >
      {shot ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Selected shot
              </p>
              <h2 className="mt-2 truncate text-2xl font-semibold tracking-normal text-foreground">
                {shot.clubLabel}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {shot.shotAtLabel} - shot {shot.shotNumberLabel}
              </p>
            </div>
            <Badge variant="outline">{shot.holeLabel}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ShotDetailMetric label="Carry" value={shot.carryLabel} />
            <ShotDetailMetric label="Total" value={shot.totalLabel} />
            <ShotDetailMetric label="Side" value={shot.sideLabel} tone={shot.sideTone} />
          </div>

          <dl className="grid gap-2 text-sm">
            <ShotDetailPair label="File" value={shot.fileNameLabel} />
            <ShotDetailPair label="Launch" value={shot.launchLabel} />
            <ShotDetailPair label="Ball speed" value={shot.ballSpeedLabel} />
            <ShotDetailPair label="Club speed" value={shot.clubSpeedLabel} />
            <ShotDetailPair label="Direction" value={shot.launchDirectionLabel} />
            <ShotDetailPair label="Apex" value={shot.apexLabel} />
            <ShotDetailPair label="Attack" value={shot.attackLabel} />
            <ShotDetailPair label="Path" value={shot.pathLabel} />
            <ShotDetailPair label="Face" value={shot.faceLabel} />
            <ShotDetailPair label="Descent" value={shot.descentLabel} />
            <ShotDetailPair label="Smash" value={shot.smashLabel} />
            <ShotDetailPair label="Estimate" value={shot.estimateLabel} />
          </dl>

          <div className="grid gap-2">
            <Button asChild variant="outline" className="justify-between">
              <Link href={`/shots?club=${encodeURIComponent(shot.clubType)}`} prefetch={false}>
                Filter this club
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              className="justify-between bg-emerald-800 text-white hover:bg-emerald-900"
            >
              <Link href="/compare" prefetch={false}>
                Compare session
                <GitCompareArrows className="size-4" />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-white/70 p-4 text-sm text-muted-foreground">
          Select a visible shot row to inspect launch, delivery and strike evidence.
        </div>
      )}
    </aside>
  );
}

function ShotDetailMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: ShotMasterDetailRow["sideTone"];
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white/80 p-2 text-center",
        tone === "green" && "border-emerald-200 bg-emerald-50",
        tone === "amber" && "border-amber-200 bg-amber-50",
        tone === "red" && "border-rose-200 bg-rose-50",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ShotDetailPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-2 rounded-lg border border-border bg-white/70 px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
