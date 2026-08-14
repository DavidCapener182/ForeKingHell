"use client";

import { useMemo, useState } from "react";
import { Flag, Search } from "lucide-react";

import type { RoundsWorkspaceRound } from "@/app/rounds/rounds-workspace";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { SegmentedControl } from "@/components/app/segmented-control";
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
    return items.map((round) => (
      <IOSListRow
        key={round.id}
        label={roundTitle(round)}
        value={round.scoreSummary}
        detail={`${round.dateLabel} · ${round.typeLabel} · ${round.rowDataLabel}`}
        href={`/rounds/${round.id}`}
        icon={Flag}
        status={
          <IOSInlineStatus
            label={round.roundStatus === "in_progress" ? "Resume round" : round.statusLabel}
            tone={
              round.roundStatus === "in_progress"
                ? "attention"
                : round.shotCount > 0
                  ? "positive"
                  : "neutral"
            }
          />
        }
      />
    ));
  }

  return (
    <section className="grid gap-3" aria-labelledby="mobile-round-history">
      <SegmentedControl
        label="Round type"
        value={activeFilter === "real" || activeFilter === "simulator" ? activeFilter : "all"}
        options={[
          { label: "All", value: "all" },
          { label: "Real", value: "real" },
          { label: "Simulator", value: "simulator" },
        ]}
        onChange={(value) => setActiveFilter(value as RoundFilter)}
      />

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
            detail="Clear the filter, import a round, or add a scorecard."
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
