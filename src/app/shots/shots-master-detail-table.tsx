"use client";

import Link from "next/link";
import { Fragment, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CheckSquare2,
  CircleGauge,
  ExternalLink,
  FileJson,
  History,
  MoreHorizontal,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  ShotBulkDeleteButton,
  ShotBulkReviewButton,
  ShotDeleteButton,
  ShotReviewButton,
} from "@/app/shots/shot-review-controls";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRestorableShotReviewStatus, type ShotReviewStatus } from "@/lib/shot-review";
import { cn } from "@/lib/utils";

export type ShotMasterDetailRow = {
  id: string;
  sessionId: string;
  shotAtLabel: string;
  fileNameLabel: string;
  shotNumberLabel: string;
  holeLabel: string;
  clubLabel: string;
  clubTypeLabel: string;
  clubType: string;
  shotCategoryLabel: string;
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
  spinRateLabel: string;
  spinAxisLabel: string;
  estimateLabel: string;
  shotShapeLabel: string;
  qualityTagLabel: string;
  reviewStatus: ShotReviewStatus;
  reviewStatusLabel: string;
  reviewReason: string | null;
  reviewConfidenceLabel: string;
  reviewSourceLabel: string;
  reviewedAtLabel: string;
  reviewEvents: Array<{
    id: string;
    previousStatusLabel: string;
    statusLabel: string;
    reason: string;
    confidenceLabel: string;
    sourceLabel: string;
    previousQualityTagLabel: string;
    resultingQualityTagLabel: string;
    createdAtLabel: string;
  }>;
  evidenceStatus: "trusted" | "untrusted";
  evidenceReasons: string[];
  sideTone: "green" | "amber" | "red" | "slate";
  carryYd: number | null;
  sideCarryYd: number | null;
  apexFt: number | null;
  sourceEntries: Array<{ key: string; value: string }>;
  canDeletePermanently: boolean;
};

export type ShotTableSort = {
  metric: "recent" | "shot" | "carry" | "total" | "side" | "launch" | "ballSpeed";
  label: string;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
};

export type ShotMiniDispersionPoint = {
  id: string;
  carryYd: number;
  sideCarryYd: number;
  trusted: boolean;
};

type DetailTab = "overview" | "source" | "history";

export function ShotsMasterDetailTable({
  shots,
  sorts,
  groupBy = "none",
  dispersionClubLabel,
  dispersionShots = [],
}: {
  shots: ShotMasterDetailRow[];
  sorts: ShotTableSort[];
  groupBy?: "none" | "club" | "session";
  dispersionClubLabel?: string;
  dispersionShots?: ShotMiniDispersionPoint[];
}) {
  const [selectedId, setSelectedId] = useState(shots[0]?.id ?? "");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(true);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const selectedShot = useMemo(
    () => shots.find((shot) => shot.id === selectedId) ?? shots[0] ?? null,
    [selectedId, shots],
  );
  const allVisibleSelected = shots.length > 0 && selectedRows.length === shots.length;
  const restrictedDeleteCount = shots.filter(
    (shot) => selectedRows.includes(shot.id) && !shot.canDeletePermanently,
  ).length;

  function toggleSelected(id: string) {
    setSelectedRows((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function openDetail(shot: ShotMasterDetailRow, tab: DetailTab = "overview") {
    setSelectedId(shot.id);
    setDetailTab(tab);
    setDetailOpen(true);
  }

  function selectRowAt(index: number) {
    const nextShot = shots[index];
    if (!nextShot) return;
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
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const shot = shots[index];
      if (shot) openDetail(shot);
    }
  }

  return (
    <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 content-start gap-3">
        {dispersionClubLabel && dispersionShots.length > 0 ? (
          <ShotMiniDispersion clubLabel={dispersionClubLabel} shots={dispersionShots} />
        ) : null}

        {selectedRows.length > 0 ? (
          <ShotBulkToolbar
            shotIds={selectedRows}
            selectedCount={selectedRows.length}
            restrictedDeleteCount={restrictedDeleteCount}
            onInspect={() => {
              const shot = shots.find((item) => item.id === selectedRows[0]);
              if (shot) openDetail(shot);
            }}
            onClear={() => setSelectedRows([])}
          />
        ) : null}

        <div
          id="main-table"
          tabIndex={-1}
          data-main-table-target="true"
          aria-label="Shot explorer table"
          className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm scroll-mt-28 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="max-h-[calc(100dvh-17rem)] min-h-[34rem] overflow-auto overscroll-contain">
            <Table
              className="min-w-[1100px] border-separate border-spacing-0"
              data-workbench-scope="shots"
              data-workbench-export-table="shots"
              aria-describedby="shots-table-summary"
            >
              <TableCaption id="shots-table-summary" className="sr-only">
                Current shot explorer page with active filters and visible columns. Arrow keys move
                through rows; Enter opens the selected shot.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:border-b [&_th]:bg-muted/95 [&_th]:backdrop-blur">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 z-40 w-10 bg-muted/95">
                    <Checkbox
                      checked={
                        allVisibleSelected
                          ? true
                          : selectedRows.length > 0
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={() =>
                        setSelectedRows(allVisibleSelected ? [] : shots.map((shot) => shot.id))
                      }
                      aria-label="Select all visible shots"
                    />
                  </TableHead>
                  <TableHead
                    data-column="club"
                    className="sticky left-10 z-40 min-w-48 bg-muted/95 shadow-[1px_0_0_hsl(var(--border))]"
                  >
                    Club
                  </TableHead>
                  <SortableShotHead sort={sorts.find((item) => item.metric === "carry")} />
                  <SortableShotHead sort={sorts.find((item) => item.metric === "total")} />
                  <SortableShotHead sort={sorts.find((item) => item.metric === "side")} />
                  <SortableShotHead sort={sorts.find((item) => item.metric === "ballSpeed")} />
                  <SortableShotHead sort={sorts.find((item) => item.metric === "launch")} />
                  <TableHead data-column="trust">Evidence</TableHead>
                  <TableHead data-column="type">Shot type</TableHead>
                  <SortableShotHead sort={sorts.find((item) => item.metric === "shot")} />
                  <TableHead data-column="file">Session</TableHead>
                  <SortableShotHead sort={sorts.find((item) => item.metric === "recent")} />
                  <TableHead data-column="advanced" className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shots.map((shot, index) => {
                  const selected = shot.id === selectedShot?.id;
                  const groupLabel = shotGroupLabel(shot, groupBy);
                  const previousGroupLabel =
                    index > 0 ? shotGroupLabel(shots[index - 1], groupBy) : null;
                  const beginsGroup = groupBy !== "none" && groupLabel !== previousGroupLabel;

                  return (
                    <Fragment key={shot.id}>
                      {beginsGroup ? (
                        <TableRow
                          data-shot-group={groupBy}
                          className="bg-muted/60 hover:bg-muted/60"
                        >
                          <TableCell
                            colSpan={13}
                            className="border-b py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                          >
                            {groupBy === "club" ? "Club" : "Session"} · {groupLabel}
                          </TableCell>
                        </TableRow>
                      ) : null}
                      <TableRow
                        ref={(node) => {
                          rowRefs.current[index] = node;
                        }}
                        tabIndex={0}
                        aria-label={`${shot.clubLabel} shot ${shot.shotNumberLabel} on ${shot.shotAtLabel}`}
                        aria-selected={selected}
                        data-selected-shot={selected ? "true" : undefined}
                        onClick={() => openDetail(shot)}
                        onFocus={() => setSelectedId(shot.id)}
                        onKeyDown={(event) => handleRowKeyDown(event, index)}
                        className={cn(
                          "focus-aaa cursor-pointer outline-none odd:bg-muted/10 hover:bg-muted/45",
                          selected && "bg-primary/8 hover:bg-primary/10",
                        )}
                      >
                        <TableCell
                          className={cn(
                            "sticky left-0 z-10 w-10 bg-card",
                            index % 2 === 0 && "bg-muted/10",
                            selected && "bg-primary/8",
                          )}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedRows.includes(shot.id)}
                            onCheckedChange={() => toggleSelected(shot.id)}
                            aria-label={`Select ${shot.clubLabel} shot ${shot.shotNumberLabel}`}
                          />
                        </TableCell>
                        <TableCell
                          data-column="club"
                          className={cn(
                            "sticky left-10 z-10 bg-card font-semibold shadow-[1px_0_0_hsl(var(--border))]",
                            index % 2 === 0 && "bg-muted/10",
                            selected && "bg-primary/8",
                          )}
                        >
                          <div className="max-w-48">
                            <p className="truncate">{shot.clubLabel}</p>
                            <p className="truncate text-[11px] font-normal text-muted-foreground">
                              {shot.shotShapeLabel}
                            </p>
                          </div>
                        </TableCell>
                        <NumberCell column="carry" value={shot.carryLabel} unit="yd" />
                        <NumberCell column="total" value={shot.totalLabel} unit="yd" />
                        <NumberCell
                          column="side"
                          value={shot.sideLabel}
                          unit="yd"
                          tone={shot.sideTone}
                        />
                        <NumberCell column="ballSpeed" value={shot.ballSpeedLabel} unit="mph" />
                        <NumberCell column="launch" value={shot.launchLabel} unit="°" />
                        <TableCell data-column="trust">
                          <EvidenceBadge status={shot.evidenceStatus} />
                        </TableCell>
                        <TableCell data-column="type" className="text-xs text-muted-foreground">
                          {shot.shotCategoryLabel}
                        </TableCell>
                        <TableCell data-column="shot" className="text-right tabular-nums">
                          {shot.shotNumberLabel}
                        </TableCell>
                        <TableCell data-column="file" className="max-w-48 truncate text-xs">
                          {shot.fileNameLabel}
                        </TableCell>
                        <TableCell
                          data-column="date"
                          className="whitespace-nowrap text-xs tabular-nums"
                        >
                          {shot.shotAtLabel}
                        </TableCell>
                        <TableCell
                          data-column="advanced"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${shot.clubLabel} shot ${shot.shotNumberLabel}`}
                              >
                                <MoreHorizontal className="size-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Shot actions</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => openDetail(shot)}>
                                <ExternalLink className="size-4" />
                                Open
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openDetail(shot, "history")}>
                                <PencilLine className="size-4" />
                                Correct
                              </DropdownMenuItem>
                              <ShotReviewButton
                                shotId={shot.id}
                                reviewStatus={shot.reviewStatus}
                                trigger={
                                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                                    {isRestorableShotReviewStatus(shot.reviewStatus) ? (
                                      <RotateCcw className="size-4" />
                                    ) : (
                                      <Ban className="size-4" />
                                    )}
                                    {shotReviewMenuLabel(shot)}
                                  </DropdownMenuItem>
                                }
                              />
                              <DropdownMenuItem onSelect={() => openDetail(shot, "source")}>
                                <FileJson className="size-4" />
                                View source
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => openDetail(shot, "history")}>
                                <History className="size-4" />
                                Review history
                              </DropdownMenuItem>
                              {shot.canDeletePermanently ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <ShotDeleteButton
                                    shotId={shot.id}
                                    trigger={
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={(event) => event.preventDefault()}
                                      >
                                        <Trash2 className="size-4" />
                                        Delete permanently
                                      </DropdownMenuItem>
                                    }
                                    onComplete={() => {
                                      setSelectedRows((current) =>
                                        current.filter((id) => id !== shot.id),
                                      );
                                    }}
                                  />
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
                {shots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="p-4">
                      <AppEmptyState
                        title="No shots match these filters"
                        description="Clear the active filters or inspect another measured session."
                        primaryAction={
                          <Button asChild size="sm">
                            <Link href="/shots">Clear filters</Link>
                          </Button>
                        }
                        secondaryAction={
                          <Button asChild size="sm" variant="outline">
                            <Link href="/import">Import session</Link>
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <ResponsiveDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={
          selectedShot
            ? `${selectedShot.clubLabel} · shot ${selectedShot.shotNumberLabel}`
            : "Shot detail"
        }
        description={
          selectedShot
            ? `${selectedShot.shotAtLabel} · ${selectedShot.fileNameLabel}`
            : "Select a visible row to inspect its evidence."
        }
        inlineAtDesktop
        className="lg:sticky lg:top-[9.5rem] lg:max-h-[calc(100dvh-11rem)] lg:self-start lg:overflow-hidden"
        contentClassName="p-0 lg:overflow-y-auto"
      >
        <SelectedShotDetail
          shot={selectedShot}
          tab={detailTab}
          onTabChange={setDetailTab}
          onDeleteComplete={(shotId) => {
            setSelectedRows((current) => current.filter((id) => id !== shotId));
          }}
        />
      </ResponsiveDetailPanel>
    </div>
  );
}

export function ShotBulkToolbar({
  shotIds,
  selectedCount,
  restrictedDeleteCount = 0,
  onClear,
  onInspect,
}: {
  shotIds: string[];
  selectedCount: number;
  restrictedDeleteCount?: number;
  onClear: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Selected shot actions"
      className="sticky top-32 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-background/95 p-3 shadow-md backdrop-blur"
      data-shot-bulk-toolbar
    >
      <div className="flex items-center gap-2">
        <CheckSquare2 className="size-4 text-primary" aria-hidden />
        <span className="font-semibold">Selected shots</span>
        <Badge variant="secondary">{selectedCount}</Badge>
      </div>
      <div className="grid justify-items-end gap-1.5">
        <ButtonGroup aria-label="Selected shot actions">
          <Button type="button" size="sm" variant="outline" onClick={onInspect}>
            Inspect first
          </Button>
          <ShotBulkReviewButton shotIds={shotIds} onComplete={onClear} />
          <ShotBulkDeleteButton
            shotIds={shotIds}
            restrictedDeleteCount={restrictedDeleteCount}
            onComplete={onClear}
          />
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </ButtonGroup>
        {restrictedDeleteCount > 0 ? (
          <p className="max-w-xl text-right text-xs text-muted-foreground" role="status">
            {restrictedDeleteCount} course-managed {restrictedDeleteCount === 1 ? "shot" : "shots"}{" "}
            cannot be permanently deleted here. Use Exclude selected, or manage them in the round or
            course workflow.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ShotMiniDispersion({
  clubLabel,
  shots,
}: {
  clubLabel: string;
  shots: ShotMiniDispersionPoint[];
}) {
  const carries = shots.map((shot) => shot.carryYd).sort((a, b) => a - b);
  const sides = shots.map((shot) => shot.sideCarryYd);
  const carryMin = Math.min(...carries);
  const carryMax = Math.max(...carries);
  const sideExtent = Math.max(10, ...sides.map((value) => Math.abs(value)));
  const carryRange = Math.max(10, carryMax - carryMin);
  const medianCarry = carries[Math.floor(carries.length / 2)] ?? 0;
  const x = (side: number) => 260 + (side / sideExtent) * 230;
  const y = (carry: number) => 118 - ((carry - carryMin) / carryRange) * 92;

  return (
    <section
      className="grid min-w-0 gap-3 overflow-hidden rounded-xl border bg-card px-4 py-3 shadow-sm xl:grid-cols-[14rem_minmax(0,1fr)_14rem] xl:items-center"
      aria-label={`${clubLabel} filtered dispersion`}
      data-shot-mini-dispersion
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
          One-club view
        </p>
        <h2 className="mt-1 font-semibold">{clubLabel} dispersion</h2>
        <p className="mt-1 text-xs text-muted-foreground">Latest {shots.length} matching shots</p>
      </div>
      <svg
        viewBox="0 0 520 140"
        className="h-28 w-full"
        role="img"
        aria-label="Compact carry and lateral dispersion plot"
      >
        <rect x="0" y="0" width="520" height="140" rx="12" className="fill-muted/35" />
        <line x1="260" x2="260" y1="14" y2="124" className="stroke-border" strokeDasharray="4 5" />
        <line x1="24" x2="496" y1="118" y2="118" className="stroke-border" />
        <text x="24" y="134" className="fill-muted-foreground text-[9px]">
          LEFT
        </text>
        <text x="469" y="134" className="fill-muted-foreground text-[9px]">
          RIGHT
        </text>
        {shots.map((shot) => (
          <circle
            key={shot.id}
            cx={x(shot.sideCarryYd)}
            cy={y(shot.carryYd)}
            r={shot.trusted ? 4.5 : 3.5}
            className={shot.trusted ? "fill-primary" : "fill-muted-foreground/45"}
            stroke="hsl(var(--background))"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
        <MiniStat label="Median carry" value={`${medianCarry.toFixed(1)} yd`} />
        <MiniStat
          label="Lateral span"
          value={`${(Math.max(...sides) - Math.min(...sides)).toFixed(1)} yd`}
        />
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function NumberCell({
  column,
  value,
  unit,
  tone = "slate",
}: {
  column: string;
  value: string;
  unit: string;
  tone?: ShotMasterDetailRow["sideTone"];
}) {
  return (
    <TableCell
      data-column={column}
      className={cn(
        "text-right font-medium tabular-nums",
        tone === "green" && "text-primary",
        tone === "red" && "text-destructive",
      )}
    >
      {value}
      {value !== "--" ? (
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span>
      ) : null}
    </TableCell>
  );
}

function EvidenceBadge({ status }: { status: ShotMasterDetailRow["evidenceStatus"] }) {
  return (
    <Badge
      variant={status === "trusted" ? "secondary" : "outline"}
      className="gap-1.5 whitespace-nowrap"
    >
      {status === "trusted" ? (
        <ShieldCheck className="size-3" aria-hidden />
      ) : (
        <ShieldAlert className="size-3" aria-hidden />
      )}
      {status === "trusted" ? "Trusted" : "Review"}
    </Badge>
  );
}

function shotGroupLabel(
  shot: ShotMasterDetailRow | undefined,
  groupBy: "none" | "club" | "session",
) {
  if (!shot) return "";
  if (groupBy === "club") return shot.clubLabel;
  if (groupBy === "session") return shot.fileNameLabel;
  return "";
}

function SortableShotHead({ sort }: { sort: ShotTableSort | undefined }) {
  if (!sort) return null;
  const nextDir = sort.active && sort.dir === "desc" ? "low to high" : "high to low";
  const Icon = sort.active ? (sort.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <TableHead
      data-column={sort.metric === "recent" ? "date" : sort.metric}
      className="text-right"
      aria-sort={sort.active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
    >
      <Link
        href={sort.href}
        className="inline-flex w-full items-center justify-end gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Sort by ${sort.label}, ${nextDir}`}
        prefetch={false}
      >
        {sort.label}
        <Icon className={cn("size-3.5", sort.active ? "text-primary" : "opacity-40")} />
      </Link>
    </TableHead>
  );
}

export function SelectedShotDetail({
  shot,
  tab = "overview",
  onTabChange,
  compact = false,
  onDeleteComplete,
  showActions = true,
}: {
  shot: ShotMasterDetailRow | null;
  tab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
  compact?: boolean;
  onDeleteComplete?: (shotId: string) => void;
  showActions?: boolean;
}) {
  if (!shot) {
    return (
      <p className="m-4 rounded-lg border border-dashed bg-muted/35 p-4 text-sm text-muted-foreground">
        Select a visible shot row to inspect launch numbers and source evidence.
      </p>
    );
  }

  return (
    <section
      role="region"
      aria-label="Selected shot detail"
      className={cn("min-w-0", compact && "text-sm")}
    >
      {showActions ? (
        <div
          className="sticky top-0 z-20 grid gap-2 border-b bg-background/95 p-3 backdrop-blur"
          data-shot-action-bar
        >
          <div className={cn("grid gap-2", shot.canDeletePermanently && "grid-cols-2")}>
            <ShotReviewButton
              shotId={shot.id}
              reviewStatus={shot.reviewStatus}
              trigger={
                <Button type="button" variant="outline" className="justify-between">
                  {shotReviewDetailLabel(shot)}
                  {isRestorableShotReviewStatus(shot.reviewStatus) ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                </Button>
              }
            />
            {shot.canDeletePermanently ? (
              <ShotDeleteButton shotId={shot.id} onComplete={() => onDeleteComplete?.(shot.id)} />
            ) : null}
          </div>
          {!shot.canDeletePermanently ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Course-managed shots can be excluded from stats here. Permanent deletion stays in the
              round or course workflow so score and hole evidence remain consistent.
            </p>
          ) : null}
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={(value) => onTabChange?.(value as DetailTab)}>
        <TabsList variant="line" className="mx-4 mt-3 grid w-auto grid-cols-3">
          <TabsTrigger value="overview">Flight</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Evidence status
              </p>
              <div className="mt-1.5">
                <EvidenceBadge status={shot.evidenceStatus} />
              </div>
            </div>
            <Badge variant="outline">{shot.shotCategoryLabel}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <DetailMetric label="Carry" value={`${shot.carryLabel} yd`} />
            <DetailMetric label="Total" value={`${shot.totalLabel} yd`} />
            <DetailMetric label="Side" value={`${shot.sideLabel} yd`} tone={shot.sideTone} />
          </div>

          <BallFlightVisual shot={shot} />

          <DetailSection title="Key launch numbers" icon={CircleGauge}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <DetailPair label="Ball speed" value={`${shot.ballSpeedLabel} mph`} />
              <DetailPair label="Club speed" value={`${shot.clubSpeedLabel} mph`} />
              <DetailPair label="Launch" value={`${shot.launchLabel}°`} />
              <DetailPair label="Direction" value={`${shot.launchDirectionLabel}°`} />
              <DetailPair label="Apex" value={`${shot.apexLabel} ft`} />
              <DetailPair label="Spin" value={`${shot.spinRateLabel} rpm`} />
              <DetailPair label="Attack" value={`${shot.attackLabel}°`} />
              <DetailPair label="Path" value={`${shot.pathLabel}°`} />
              <DetailPair label="Face" value={`${shot.faceLabel}°`} />
              <DetailPair label="Smash" value={shot.smashLabel} />
            </dl>
          </DetailSection>

          <DetailSection
            title="Evidence read"
            icon={shot.evidenceStatus === "trusted" ? ShieldCheck : ShieldAlert}
          >
            <p className="text-sm leading-6 text-muted-foreground">
              {shot.evidenceStatus === "trusted"
                ? "This row is eligible for trusted bag and record calculations."
                : "This row remains visible in raw analysis but is not eligible for trusted calculations."}
            </p>
            {shot.evidenceReasons.length > 0 ? (
              <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                {shot.evidenceReasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            ) : null}
          </DetailSection>
        </TabsContent>

        <TabsContent value="source" className="grid gap-4 p-4">
          <DetailSection title="Source record" icon={FileJson}>
            <dl className="grid gap-2">
              <DetailPair label="Session" value={shot.fileNameLabel} wide />
              <DetailPair label="Shot number" value={shot.shotNumberLabel} wide />
              <DetailPair label="Estimate" value={shot.estimateLabel} wide />
            </dl>
            <div className="mt-3 max-h-[26rem] overflow-auto rounded-lg border bg-muted/20">
              {shot.sourceEntries.length > 0 ? (
                <dl className="divide-y">
                  {shot.sourceEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 px-3 py-2 text-xs"
                    >
                      <dt className="break-words font-medium text-muted-foreground">{entry.key}</dt>
                      <dd className="break-words text-right font-mono text-[11px]">
                        {entry.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="p-3 text-sm text-muted-foreground">
                  No raw source fields were retained for this row.
                </p>
              )}
            </div>
          </DetailSection>
        </TabsContent>

        <TabsContent value="history" className="grid gap-4 p-4">
          <DetailSection title="Correction history" icon={History}>
            <div className="grid gap-3">
              <div className="rounded-lg border bg-muted/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Current review</p>
                  <Badge variant="secondary">{shot.reviewStatusLabel}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <DetailPair label="Reason" value={shot.reviewReason ?? "No review reason"} wide />
                  <DetailPair label="Confidence" value={shot.reviewConfidenceLabel} wide />
                  <DetailPair label="Source" value={shot.reviewSourceLabel} wide />
                  <DetailPair label="Reviewed" value={shot.reviewedAtLabel} wide />
                  <DetailPair label="Compatibility flag" value={shot.qualityTagLabel} wide />
                </dl>
              </div>
              <HistoryRow
                title="Source imported"
                detail="Original provider fields remain available in Source."
              />
              {shot.reviewEvents.map((event) => (
                <HistoryRow
                  key={event.id}
                  title={`${event.statusLabel} · ${event.createdAtLabel}`}
                  detail={`${event.reason} · ${event.confidenceLabel} confidence · ${event.sourceLabel} · quality flag ${event.previousQualityTagLabel} → ${event.resultingQualityTagLabel}`}
                />
              ))}
              {shot.reviewEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No later correction event is recorded for this shot.
                </p>
              ) : null}
            </div>
          </DetailSection>
          {showActions ? (
            <div className="grid gap-2">
              <Button asChild variant="outline" className="justify-between">
                <Link href={`/sessions/${shot.sessionId}`} prefetch={false}>
                  Open Session Review
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                Use Session Review for full context before changing club mapping or launch data.
              </p>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function shotReviewMenuLabel(shot: ShotMasterDetailRow) {
  if (shot.reviewStatus === "suggested_exclusion") return "Keep";
  if (isRestorableShotReviewStatus(shot.reviewStatus)) return "Restore";
  return "Exclude from stats";
}

function shotReviewDetailLabel(shot: ShotMasterDetailRow) {
  if (shot.reviewStatus === "suggested_exclusion") return "Keep shot";
  if (isRestorableShotReviewStatus(shot.reviewStatus)) return "Restore shot";
  return "Exclude from stats";
}

function BallFlightVisual({ shot }: { shot: ShotMasterDetailRow }) {
  const endX = 168 + Math.max(-42, Math.min(42, shot.sideCarryYd ?? 0));
  const peakY = 70 - Math.max(8, Math.min(46, (shot.apexFt ?? 45) / 2));

  return (
    <div className="overflow-hidden rounded-xl border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">Ball flight</p>
          <p className="text-[11px] text-muted-foreground">
            {shot.shotShapeLabel} · {shot.apexLabel} ft apex
          </p>
        </div>
        <Badge variant="outline">Trajectory</Badge>
      </div>
      <svg
        viewBox="0 0 340 112"
        className="mt-2 h-24 w-full"
        role="img"
        aria-label={`${shot.shotShapeLabel} trajectory`}
      >
        <line x1="18" x2="322" y1="92" y2="92" className="stroke-border" />
        <line x1="170" x2="170" y1="14" y2="96" className="stroke-border" strokeDasharray="3 5" />
        <path
          d={`M 24 92 Q 105 ${peakY} ${endX} 88`}
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={endX} cy="88" r="5" className="fill-primary" />
      </svg>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CircleGauge;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailMetric({
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
        "rounded-lg border bg-muted/30 px-2 py-2 text-center",
        tone === "green" && "border-primary/30 bg-primary/8",
        tone === "red" && "border-destructive/30 bg-destructive/8",
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DetailPair({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        wide && "grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b py-2 last:border-b-0",
      )}
    >
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 truncate font-semibold tabular-nums", wide && "mt-0 text-right")}>
        {value}
      </dd>
    </div>
  );
}

function HistoryRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid grid-cols-[0.6rem_minmax(0,1fr)] gap-3">
      <span className="mt-1.5 size-2 rounded-full bg-primary" aria-hidden />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
