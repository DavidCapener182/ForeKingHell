"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ChevronRight, Flag, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
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
  type: string;
  typeLabel: string;
  roundStatus: string;
  totalScore: number | null;
  totalPar: number | null;
  totalPutts: number | null;
  handicapDifferentialLabel: string;
  scoreSummary: string;
  shotCount: number;
  dataLabel: string;
  rowDataLabel: string;
  statusLabel: string;
  holeResults: string[];
};

type RoundFilter = "all" | "real" | "simulator" | "scorecard-only" | "shot-linked";

const integerFormatter = new Intl.NumberFormat("en-GB");

const filters: Array<{ label: string; value: RoundFilter }> = [
  { label: "All rounds", value: "all" },
  { label: "Real", value: "real" },
  { label: "Simulator", value: "simulator" },
  { label: "Scorecard only", value: "scorecard-only" },
  { label: "Shot-linked", value: "shot-linked" },
];

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

  const filteredRounds = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return rounds.filter((round) => {
      const matchesFilter = filterRound(round, activeFilter);
      const searchableText = [
        round.courseName,
        round.fileName,
        round.typeLabel,
        round.dateLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!query || searchableText.includes(query));
    });
  }, [activeFilter, rounds, searchTerm]);

  const selectedRound =
    filteredRounds.find((round) => round.id === selectedRoundId) ??
    filteredRounds[0] ??
    null;

  return (
    <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
          </CardHeader>
          <CardContent className="min-w-0 space-y-3 overflow-hidden px-3 sm:px-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1">
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
                  placeholder="Search course..."
                  className="pl-8"
                />
              </label>
            </div>

            <DataTableFrame
              mobile={
                <MobileDataList>
                  {filteredRounds.length > 0 ? (
                    filteredRounds.map((round) => (
                      <RoundMobileCard
                        key={round.id}
                        round={round}
                        selected={round.id === selectedRound?.id}
                        onSelect={() => setSelectedRoundId(round.id)}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                    <TableHead className="text-right">Putts</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRounds.map((round) => (
                    <TableRow
                      key={round.id}
                      aria-selected={round.id === selectedRound?.id}
                      className="cursor-pointer border-l-4 border-l-transparent aria-selected:border-l-emerald-600 aria-selected:bg-emerald-50/45"
                      data-state={round.id === selectedRound?.id ? "selected" : undefined}
                      onClick={() => setSelectedRoundId(round.id)}
                    >
                      <TableCell className="max-w-[18rem] font-medium">
                        <span className="block truncate">{roundTitle(round)}</span>
                      </TableCell>
                      <TableCell>{round.dateLabel}</TableCell>
                      <TableCell>
                        <Badge variant={round.type === "real_round" ? "default" : "secondary"}>
                          {round.typeLabel}
                        </Badge>
                        {round.roundStatus === "in_progress" ? (
                          <Badge variant="outline" className="ml-2">
                            Resume
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">{formatInteger(round.totalScore)}</TableCell>
                      <TableCell className="text-right">{round.handicapDifferentialLabel}</TableCell>
                      <TableCell className="text-right">{formatInteger(round.totalPutts)}</TableCell>
                      <TableCell className="text-right">
                        <DataBadge round={round} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/rounds/${round.id}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {round.shotCount > 0 ? "Review" : "Add data"}
                            <ChevronRight className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRounds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No rounds match this filter.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </DataTableFrame>
          </CardContent>
        </Card>

        {children}
      </div>

      <SelectedRoundCard round={selectedRound} />
    </section>
  );
}

function SelectedRoundCard({ round }: { round: RoundsWorkspaceRound | null }) {
  return (
    <Card className="premium-card min-w-0 scroll-mt-28 xl:sticky xl:top-5 xl:self-start">
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
            />

            <div className="apple-panel-strong p-4">
              <p className="text-sm leading-5 text-muted-foreground">
                {round.dateLabel} · {round.typeLabel}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">
                {roundTitle(round)}
              </h2>
              <p className="mt-2 text-3xl font-semibold tracking-normal">
                {round.scoreSummary}
              </p>
            </div>

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
                <div className="flex gap-1.5 overflow-x-auto pb-1">
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
  round,
  selected,
}: {
  onSelect: () => void;
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
          sizes="100vw"
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
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function DataBadge({ round }: { round: RoundsWorkspaceRound }) {
  return (
    <Badge variant={round.shotCount > 0 ? "secondary" : "outline"}>
      {round.rowDataLabel}
    </Badge>
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

function roundTitle(round: RoundsWorkspaceRound) {
  return round.courseName ?? round.fileName ?? "Untitled round";
}

function formatInteger(value: number | null) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}
