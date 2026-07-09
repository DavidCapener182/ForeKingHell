"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Flag, Search } from "lucide-react";

import {
  DesktopWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench-controls";
import { CourseScorecardSvg, type CourseScorecardSvgHole } from "@/components/course-scorecard-svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  StatusPill,
} from "@/components/premium";
import { PageArtwork } from "@/components/visuals/page-artwork";

export type RoundsWorkspaceRound = {
  id: string;
  courseName: string | null;
  fileName: string | null;
  dateLabel: string;
  dateIso: string;
  type: string;
  typeLabel: string;
  roundStatus: string;
  totalScore: number | null;
  totalPar: number | null;
  totalPutts: number | null;
  handicapDifferential: number | null;
  handicapDifferentialLabel: string;
  scoreSummary: string;
  shotCount: number;
  dataLabel: string;
  rowDataLabel: string;
  statusLabel: string;
  holeResults: string[];
  scorecardHoles: CourseScorecardSvgHole[];
};

type RoundFilter = "all" | "real" | "simulator" | "scorecard-only" | "shot-linked";
type RoundSortMetric = "date" | "score" | "diff" | "putts" | "data";
type RoundSortDirection = "asc" | "desc";

type RoundSortState = {
  metric: RoundSortMetric;
  dir: RoundSortDirection;
};

const integerFormatter = new Intl.NumberFormat("en-GB");

const filters: Array<{ label: string; value: RoundFilter }> = [
  { label: "All rounds", value: "all" },
  { label: "Real", value: "real" },
  { label: "Simulator", value: "simulator" },
  { label: "Scorecard only", value: "scorecard-only" },
  { label: "Shot-linked", value: "shot-linked" },
];

const roundWorkbenchColumns: DesktopWorkbenchColumn[] = [
  { id: "round", label: "Round", locked: true },
  { id: "date", label: "Date" },
  { id: "type", label: "Type" },
  { id: "score", label: "Score" },
  { id: "diff", label: "Diff" },
  { id: "putts", label: "Putts" },
  { id: "data", label: "Data" },
  { id: "actions", label: "Actions", locked: true },
];

const roundSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Scorecard-only cleanup",
    href: "/rounds?filter=scorecard-only",
    detail: "Rounds that need shot data before deeper review.",
  },
  {
    title: "Shot-linked reviews",
    href: "/rounds?filter=shot-linked",
    detail: "Rounds with shot evidence for recap and practice planning.",
  },
  {
    title: "Real rounds only",
    href: "/rounds?filter=real",
    detail: "Keep real-course scoring separate from simulator form.",
  },
];

const roundSortLabels: Record<RoundSortMetric, string> = {
  date: "Date",
  score: "Score",
  diff: "Diff",
  putts: "Putts",
  data: "Data",
};

const roundSortDefaultDirections: Record<RoundSortMetric, RoundSortDirection> = {
  date: "desc",
  score: "asc",
  diff: "asc",
  putts: "asc",
  data: "desc",
};

export function RoundsWorkspace({
  children,
  rounds,
}: {
  children?: ReactNode;
  rounds: RoundsWorkspaceRound[];
}) {
  const [activeFilter, setActiveFilter] = useState<RoundFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState(rounds[0]?.id ?? null);
  const [sortState, setSortState] = useState<RoundSortState>({ metric: "date", dir: "desc" });
  const [urlStateReady, setUrlStateReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setActiveFilter(parseRoundFilter(params.get("filter")));
      setSearchTerm(params.get("q")?.slice(0, 80) ?? "");
      setUrlStateReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!urlStateReady) {
      return;
    }

    const url = new URL(window.location.href);

    if (activeFilter === "all") {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", activeFilter);
    }

    if (searchTerm.trim()) {
      url.searchParams.set("q", searchTerm.trim());
    } else {
      url.searchParams.delete("q");
    }

    window.history.replaceState(window.history.state, "", url);
  }, [activeFilter, searchTerm, urlStateReady]);

  const filteredRounds = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return rounds.filter((round) => {
      const matchesFilter = filterRound(round, activeFilter);
      const searchableText = [round.courseName, round.fileName, round.typeLabel, round.dateLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!query || searchableText.includes(query));
    });
  }, [activeFilter, rounds, searchTerm]);

  const sortedRounds = useMemo(
    () => sortRounds(filteredRounds, sortState),
    [filteredRounds, sortState],
  );
  const selectedRound =
    sortedRounds.find((round) => round.id === selectedRoundId) ?? sortedRounds[0] ?? null;
  const activeFilterLabel =
    filters.find((filter) => filter.value === activeFilter)?.label ?? "All rounds";
  const currentViewLabel = searchTerm.trim()
    ? `${activeFilterLabel} · ${searchTerm.trim()}`
    : activeFilterLabel;

  return (
    <section className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-4">
        <Card id="history" className="premium-card min-w-0 scroll-mt-28">
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Round history</CardTitle>
                <CardDescription>
                  Search, filter and select a round before reviewing it.
                </CardDescription>
              </div>
              <StatusPill tone="slate">
                {integerFormatter.format(filteredRounds.length)} shown
              </StatusPill>
            </div>
            <DesktopWorkbenchControls
              viewKey="rounds"
              scope="rounds"
              currentViewLabel={currentViewLabel}
              resultLabel={`${integerFormatter.format(filteredRounds.length)} rounds`}
              columns={roundWorkbenchColumns}
              suggestedViews={roundSuggestedViews}
              exportTableId="rounds"
              exportFileName="forekinghell-rounds-view.csv"
            />
          </CardHeader>
          <CardContent className="min-w-0 space-y-3 overflow-hidden px-3 sm:px-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div
                className="flex gap-2 overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                tabIndex={0}
                aria-label="Round filters"
              >
                {filters.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    variant={activeFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              <label className="relative min-w-0 lg:w-72">
                <span className="sr-only">Search course</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search course…"
                  className="pl-8"
                  data-filter-search
                  data-page-search
                />
              </label>
            </div>

            <div className="min-w-0">
              <DataTableFrame
                mainTable
                mainTableLabel="Round history table"
                stickyFirstColumn
                mobile={
                  <MobileDataList>
                    {filteredRounds.length > 0 ? (
                      filteredRounds.map((round, index) => (
                        <RoundMobileCard
                          key={round.id}
                          round={round}
                          selected={round.id === selectedRound?.id}
                          onSelect={() => setSelectedRoundId(round.id)}
                          priority={index === 0}
                        />
                      ))
                    ) : (
                      <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                        No rounds match this filter.
                      </div>
                    )}
                  </MobileDataList>
                }
              >
                <Table
                  data-workbench-scope="rounds"
                  data-workbench-export-table="rounds"
                  aria-describedby="rounds-table-summary"
                >
                  <TableCaption id="rounds-table-summary" className="sr-only">
                    Round history table showing course, date, type, score, differential, putts, data
                    status and actions for the current filter.
                  </TableCaption>
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      <TableHead
                        data-column="round"
                        className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        Round
                      </TableHead>
                      <SortableRoundHead
                        columnId="date"
                        metric="date"
                        sortState={sortState}
                        onSortChange={setSortState}
                      />
                      <TableHead data-column="type">Type</TableHead>
                      <SortableRoundHead
                        columnId="score"
                        metric="score"
                        sortState={sortState}
                        onSortChange={setSortState}
                        align="right"
                      />
                      <SortableRoundHead
                        columnId="diff"
                        metric="diff"
                        sortState={sortState}
                        onSortChange={setSortState}
                        align="right"
                      />
                      <SortableRoundHead
                        columnId="putts"
                        metric="putts"
                        sortState={sortState}
                        onSortChange={setSortState}
                        align="right"
                      />
                      <SortableRoundHead
                        columnId="data"
                        metric="data"
                        sortState={sortState}
                        onSortChange={setSortState}
                        align="right"
                      />
                      <TableHead data-column="actions" className="text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRounds.map((round) => (
                      <TableRow
                        key={round.id}
                        className={
                          round.id === selectedRound?.id
                            ? "focus-aaa cursor-pointer bg-emerald-50/45 outline-none"
                            : "focus-aaa cursor-pointer outline-none"
                        }
                        data-state={round.id === selectedRound?.id ? "selected" : undefined}
                        tabIndex={0}
                        aria-label={`Select ${roundTitle(round)} from ${round.dateLabel}`}
                        onClick={() => setSelectedRoundId(round.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedRoundId(round.id);
                          }
                        }}
                      >
                        <TableCell
                          data-column="round"
                          className={`sticky left-0 z-10 max-w-[18rem] font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)] ${
                            round.id === selectedRound?.id ? "bg-emerald-50" : "bg-white"
                          }`}
                        >
                          <span className="block truncate">{roundTitle(round)}</span>
                        </TableCell>
                        <TableCell data-column="date">{round.dateLabel}</TableCell>
                        <TableCell data-column="type">
                          <Badge variant={round.type === "real_round" ? "default" : "secondary"}>
                            {round.typeLabel}
                          </Badge>
                          {round.roundStatus === "in_progress" ? (
                            <Badge variant="outline" className="ml-2">
                              Resume
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell data-column="score" className="text-right">
                          {formatInteger(round.totalScore)}
                        </TableCell>
                        <TableCell data-column="diff" className="text-right">
                          {round.handicapDifferentialLabel}
                        </TableCell>
                        <TableCell data-column="putts" className="text-right">
                          {formatInteger(round.totalPutts)}
                        </TableCell>
                        <TableCell data-column="data" className="text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <DataBadge round={round} />
                            <span className="text-xs text-muted-foreground">
                              {integerFormatter.format(round.shotCount)} shots
                            </span>
                          </div>
                        </TableCell>
                        <TableCell data-column="actions" className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              variant={round.id === selectedRound?.id ? "secondary" : "ghost"}
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedRoundId(round.id);
                              }}
                            >
                              {round.id === selectedRound?.id ? "Selected" : "Select"}
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                              <Link
                                href={`/rounds/${round.id}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {round.shotCount > 0 ? "Review" : "Add data"}
                                <ChevronRight className="size-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sortedRounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          No rounds match this filter.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </div>
          </CardContent>
        </Card>

        {children}
      </div>

      <SelectedRoundCard round={selectedRound} />
    </section>
  );
}

function SortableRoundHead({
  align = "left",
  columnId,
  metric,
  onSortChange,
  sortState,
}: {
  align?: "left" | "right";
  columnId: string;
  metric: RoundSortMetric;
  onSortChange: (sortState: RoundSortState) => void;
  sortState: RoundSortState;
}) {
  const active = sortState.metric === metric;
  const nextDir: RoundSortDirection = active
    ? sortState.dir === "desc"
      ? "asc"
      : "desc"
    : roundSortDefaultDirections[metric];
  const Icon = active ? (sortState.dir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;
  const label = roundSortLabels[metric];

  return (
    <TableHead
      data-column={columnId}
      className={align === "right" ? "text-right" : undefined}
      aria-sort={active ? sortAriaValue(sortState.dir) : "none"}
    >
      <button
        type="button"
        className={`focus-aaa inline-flex w-full items-center gap-1 rounded-md text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
        aria-label={`Sort rounds by ${label}, ${sortDirectionCopy(nextDir)}`}
        onClick={() => onSortChange({ metric, dir: nextDir })}
      >
        {label}
        <Icon className={`size-3.5 ${active ? "text-emerald-700" : "opacity-45"}`} aria-hidden />
      </button>
    </TableHead>
  );
}

function sortRounds(rounds: RoundsWorkspaceRound[], sortState: RoundSortState) {
  return [...rounds].sort((left, right) => {
    const result = compareRoundValues(left, right, sortState.metric, sortState.dir);

    if (result !== 0) {
      return result;
    }

    return (
      compareRoundValues(left, right, "date", "desc") ||
      roundTitle(left).localeCompare(roundTitle(right))
    );
  });
}

function compareRoundValues(
  left: RoundsWorkspaceRound,
  right: RoundsWorkspaceRound,
  metric: RoundSortMetric,
  dir: RoundSortDirection,
) {
  switch (metric) {
    case "date":
      return compareNullableNumber(Date.parse(left.dateIso), Date.parse(right.dateIso), dir);
    case "score":
      return compareNullableNumber(left.totalScore, right.totalScore, dir);
    case "diff":
      return compareNullableNumber(left.handicapDifferential, right.handicapDifferential, dir);
    case "putts":
      return compareNullableNumber(left.totalPutts, right.totalPutts, dir);
    case "data":
      return compareNullableNumber(left.shotCount, right.shotCount, dir);
  }
}

function compareNullableNumber(left: number | null, right: number | null, dir: RoundSortDirection) {
  const leftValid = typeof left === "number" && Number.isFinite(left);
  const rightValid = typeof right === "number" && Number.isFinite(right);

  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return dir === "asc" ? left - right : right - left;
}

function sortAriaValue(dir: RoundSortDirection) {
  return dir === "desc" ? "descending" : "ascending";
}

function sortDirectionCopy(dir: RoundSortDirection) {
  return dir === "desc" ? "high to low" : "low to high";
}

function SelectedRoundCard({ round }: { round: RoundsWorkspaceRound | null }) {
  return (
    <Card className="premium-card min-w-0 scroll-mt-28 2xl:sticky 2xl:top-5 2xl:self-start">
      <CardHeader>
        <CardTitle>Selected round</CardTitle>
        <CardDescription>
          Review the scorecard and data status for the chosen round.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {round ? (
          <div key={round.id} className="space-y-4">
            <PageArtwork
              variant="fairway"
              alt=""
              crop="random"
              cropKey={round.id}
              className="block h-32 min-h-0 rounded-xl"
              sizes="(min-width: 1280px) 360px, 100vw"
              priority
            />

            <div className="apple-panel-strong p-4">
              <p className="text-sm leading-5 text-muted-foreground">
                {round.dateLabel} · {round.typeLabel}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">{roundTitle(round)}</h2>
              <p className="mt-2 text-3xl font-semibold tracking-normal">{round.scoreSummary}</p>
            </div>

            {round.scorecardHoles.length > 0 ? (
              <CourseScorecardSvg
                courseName={roundTitle(round)}
                holes={round.scorecardHoles}
                playerName="ForeKingHell"
                showPenalties={round.scorecardHoles.some(
                  (hole) => typeof hole.penalties === "number" && hole.penalties > 0,
                )}
                showShotCounts={round.shotCount > 0}
                subtitle={`${round.dateLabel} · ${round.typeLabel}`}
                variant="compact"
              />
            ) : null}

            <div className="grid gap-2">
              <RoundMetric label="Score" value={formatInteger(round.totalScore)} />
              <RoundMetric label="Par" value={formatInteger(round.totalPar)} />
              <RoundMetric label="Putts" value={formatInteger(round.totalPutts)} />
              <RoundMetric label="Differential" value={round.handicapDifferentialLabel} />
              <RoundMetric label="Data" value={round.dataLabel} />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Round status
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusPill tone={round.shotCount > 0 ? "green" : "amber"}>
                  {round.statusLabel}
                </StatusPill>
                {round.roundStatus === "in_progress" ? (
                  <StatusPill tone="amber">Resume scorecard</StatusPill>
                ) : null}
              </div>
            </div>

            {round.holeResults.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Hole result
                </p>
                <div
                  className="flex gap-1.5 overflow-x-auto pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                  aria-label="Selected round hole results"
                >
                  {round.holeResults.map((result, index) => (
                    <span
                      key={`${round.id}-${index}-${result}`}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {result}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Button asChild>
                <Link href={`/rounds/${round.id}`}>
                  <Flag className="size-4" />
                  Review round
                </Link>
              </Button>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Button asChild variant="outline">
                  <Link href="/feed?filter=rounds" prefetch={false}>
                    <Flag className="size-4" />
                    Round feed
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Add or import a round to review scorecard and shot data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RoundMobileCard({
  onSelect,
  priority = false,
  round,
  selected,
}: {
  onSelect: () => void;
  priority?: boolean;
  round: RoundsWorkspaceRound;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      className="block min-w-0 text-left"
      onClick={onSelect}
      aria-pressed={selected}
    >
      <MobileDataCard
        title={roundTitle(round)}
        subtitle={round.dateLabel}
        action={
          <Badge
            variant={round.type === "real_round" ? "default" : "secondary"}
            className="max-w-28 truncate"
          >
            {round.typeLabel}
          </Badge>
        }
        className={selected ? "ring-2 ring-emerald-600/40" : undefined}
      >
        <PageArtwork
          variant="fairway"
          alt=""
          crop="random"
          cropKey={round.id}
          className="block h-20 min-h-0 w-full rounded-xl"
          sizes="calc(100vw - 2rem)"
          priority={priority}
        />
        {round.roundStatus === "in_progress" ? <DataPair label="Status" value="Resume" /> : null}
        <DataPair label="Score" value={formatInteger(round.totalScore)} />
        <DataPair label="Differential" value={round.handicapDifferentialLabel} />
        <DataPair label="Putts" value={formatInteger(round.totalPutts)} />
        <DataPair label="Data" value={round.rowDataLabel} />
      </MobileDataCard>
    </button>
  );
}

function RoundMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#F5F6F4] px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function DataBadge({ round }: { round: RoundsWorkspaceRound }) {
  return (
    <Badge variant={round.shotCount > 0 ? "secondary" : "outline"}>{round.rowDataLabel}</Badge>
  );
}

function filterRound(round: RoundsWorkspaceRound, filter: RoundFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "real") {
    return round.type === "real_round";
  }

  if (filter === "simulator") {
    return round.type !== "real_round";
  }

  if (filter === "scorecard-only") {
    return round.shotCount === 0;
  }

  return round.shotCount > 0;
}

function parseRoundFilter(value: string | null): RoundFilter {
  return filters.some((filter) => filter.value === value) ? (value as RoundFilter) : "all";
}

function roundTitle(round: RoundsWorkspaceRound) {
  return round.courseName ?? round.fileName ?? "Untitled round";
}

function formatInteger(value: number | null) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}
