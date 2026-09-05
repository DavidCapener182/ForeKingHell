"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Flag, Search } from "lucide-react";

import type { RoundsWorkspaceRound } from "@/app/rounds/rounds-workspace";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { comparableScoringRounds, roundHistoryScore } from "@/lib/round-history-evidence";
import { MobileFilterSheet } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RoundFilter = "all" | "real" | "simulator" | "scorecard-only" | "shot-linked";

const filters: Array<{ label: string; value: RoundFilter }> = [
  { label: "All rounds", value: "all" },
  { label: "Real", value: "real" },
  { label: "Simulator", value: "simulator" },
  { label: "Scorecard only", value: "scorecard-only" },
  { label: "Shot-linked", value: "shot-linked" },
];

export function RoundsMobileList({ rounds }: { rounds: RoundsWorkspaceRound[] }) {
  const [activeFilter, setActiveFilter] = useState<RoundFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const filteredRounds = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return rounds.filter((round) => {
      const searchableText = [round.courseName, round.fileName, round.typeLabel, round.dateLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return filterRound(round, activeFilter) && (!query || searchableText.includes(query));
    });
  }, [activeFilter, rounds, searchTerm]);
  const recentRounds = filteredRounds.slice(0, 10);
  const olderRounds = filteredRounds.slice(10);
  const activeLabel =
    filters.find((filter) => filter.value === activeFilter)?.label ?? "All rounds";

  function roundRows(items: RoundsWorkspaceRound[]) {
    return items.map((round) => {
      const score = roundHistoryScore(round.scorecardHoles, round.roundStatus);
      return (
        <Link
          key={round.id}
          href={`/rounds/${round.id}`}
          className="mobile-round-history-row focus-aaa"
        >
          <div className="min-w-0">
            <h3 className="mobile-type-headline break-words">{roundTitle(round)}</h3>
            <p className="mobile-type-footnote mt-1 text-muted-foreground">
              {round.dateLabel} · {round.type === "real_round" ? "Course" : "Simulator"}
            </p>
            <p className="mobile-type-footnote text-muted-foreground">
              {round.teeName ?? "Tee not set"} ·{" "}
              {score.complete
                ? `${round.scorecardHoles.length} holes`
                : `${score.scoredHoles} of ${round.scorecardHoles.length} scored`}
            </p>
          </div>
          <div className="text-right tabular-nums">
            <p className="mobile-type-title1">{score.totalScore ?? "—"}</p>
            <p className="mobile-type-callout text-muted-foreground">{round.toParLabel}</p>
          </div>
          <div className="col-span-2 min-w-0">
            <p className="mobile-type-callout">{round.mainVerdict}</p>
            <p
              className={`mobile-type-footnote mt-1 ${round.handicapImpactTone === "positive" ? "text-primary" : "text-muted-foreground"}`}
            >
              {round.handicapImpactLabel}
            </p>
          </div>
          <ChevronRight
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </Link>
      );
    });
  }

  return (
    <section className="grid gap-3" aria-labelledby="mobile-round-history">
      <MobileSegmentedControl
        ariaLabel="Round type"
        value={activeFilter === "real" || activeFilter === "simulator" ? activeFilter : "all"}
        options={[
          { label: "All", value: "all" },
          { label: "Real", value: "real" },
          { label: "Simulator", value: "simulator" },
        ]}
        onValueChange={(value) => setActiveFilter(value as RoundFilter)}
      />

      <MobileRoundScoringTrend rounds={filteredRounds} />

      <MobileFilterSheet
        label="Search and data filters"
        activeCount={(searchTerm.trim() ? 1 : 0) + (activeFilter.includes("-") ? 1 : 0)}
      >
        <div className="grid gap-4 pb-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Search course or date
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search rounds"
                className="min-h-11 pl-9"
                enterKeyHint="search"
              />
            </span>
          </label>
          <div className="grid gap-2" role="group" aria-label="Round data filter">
            {filters
              .filter(
                (filter) => filter.value === "scorecard-only" || filter.value === "shot-linked",
              )
              .map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={activeFilter === filter.value ? "default" : "outline"}
                  className="min-h-11 justify-start rounded-xl"
                  aria-pressed={activeFilter === filter.value}
                  onClick={() =>
                    setActiveFilter((current) => (current === filter.value ? "all" : filter.value))
                  }
                >
                  {filter.label}
                </Button>
              ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-xl"
            onClick={() => {
              setActiveFilter("all");
              setSearchTerm("");
            }}
          >
            Clear filters
          </Button>
        </div>
      </MobileFilterSheet>

      <IOSSectionHeader
        title={<span id="mobile-round-history">Recent rounds</span>}
        description={`${filteredRounds.length} ${activeLabel.toLowerCase()}${searchTerm.trim() ? ` matching “${searchTerm.trim()}”` : ""}`}
      />
      <IOSGroupedList label="Recent round history">
        {recentRounds.length > 0 ? (
          roundRows(recentRounds)
        ) : (
          <IOSListRow
            label="No rounds match this view"
            detail="Search another course, clear the filters, or add a round."
            href="/rounds/new"
            icon={Flag}
          />
        )}
      </IOSGroupedList>

      {olderRounds.length > 0 ? (
        <IOSDisclosureGroup
          label="Older round history"
          items={[
            {
              value: "older-rounds",
              title: "Older rounds",
              summary: `${olderRounds.length}`,
              description: "Continue through the archive",
              contentClassName: "px-0 pb-0 pt-0",
              content: (
                <IOSGroupedList label="Older round rows" className="border-0">
                  {roundRows(olderRounds)}
                </IOSGroupedList>
              ),
            },
          ]}
        />
      ) : null}
    </section>
  );
}

function filterRound(round: RoundsWorkspaceRound, filter: RoundFilter) {
  if (filter === "all") return true;
  if (filter === "real") return round.type === "real_round";
  if (filter === "simulator") return round.type !== "real_round";
  if (filter === "scorecard-only") return round.shotCount === 0;
  return round.shotCount > 0;
}

function roundTitle(round: RoundsWorkspaceRound) {
  return round.courseName ?? round.fileName ?? "Untitled round";
}

function MobileRoundScoringTrend({ rounds }: { rounds: RoundsWorkspaceRound[] }) {
  const latest = rounds.find(
    (round) =>
      [9, 18].includes(round.scorecardHoles.length) &&
      roundHistoryScore(round.scorecardHoles, round.roundStatus).complete,
  );
  const points = latest
    ? comparableScoringRounds(
        rounds,
        latest.type === "real_round" ? "course" : "simulator",
        latest.scorecardHoles.length,
      )
    : [];
  const values = points.map(
    (round) => roundHistoryScore(round.scorecardHoles, round.roundStatus).toPar!,
  );
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, minimum + 4);
  const change = values.length >= 2 ? values[values.length - 1] - values[0] : null;
  const format = (value: number) => (value === 0 ? "E" : value > 0 ? `+${value}` : String(value));
  return (
    <section className="mobile-section" aria-label="Scoring trend" data-scoring-trend>
      <div>
        <p className="mobile-type-footnote text-muted-foreground">Scoring trend</p>
        <h2 className="mobile-type-title2 mt-1">
          {change === null
            ? latest
              ? "Your first scoring point"
              : "Your scoring story starts here"
            : change === 0
              ? "Holding steady"
              : `${Math.abs(change)} shots ${change < 0 ? "better" : "higher"}`}
        </h2>
        <p className="mobile-type-footnote mt-1 text-muted-foreground">
          {latest
            ? `${latest.scorecardHoles.length}-hole ${latest.type === "real_round" ? "course" : "simulator"} rounds · score to par`
            : "Complete a 9- or 18-hole scorecard to see your trend."}
        </p>
      </div>
      {points.length ? (
        <>
          <div className="mobile-round-trend" aria-label="Recent comparable scores">
            {points.map((round, index) => (
              <Link
                key={round.id}
                href={`/rounds/${round.id}`}
                className="focus-aaa mobile-round-trend-point"
                aria-label={`${round.dateLabel}, ${roundTitle(round)}, ${format(values[index])} to par`}
              >
                <span className="mobile-type-caption tabular-nums">{format(values[index])}</span>
                <span
                  aria-hidden
                  className="mobile-round-trend-bar"
                  style={{
                    height: `${20 + ((values[index] - minimum) / (maximum - minimum)) * 40}px`,
                  }}
                />
                <span className="mobile-type-caption text-muted-foreground">{index + 1}</span>
              </Link>
            ))}
          </div>
          <p className="mobile-type-caption text-muted-foreground">
            {points.length > 1
              ? `${points[0].dateLabel} – ${points.at(-1)!.dateLabel}. Lower is better.`
              : latest?.dateLabel}
          </p>
        </>
      ) : null}
    </section>
  );
}
