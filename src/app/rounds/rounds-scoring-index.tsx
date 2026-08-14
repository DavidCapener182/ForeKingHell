"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import type { RoundsWorkspaceRound } from "@/app/rounds/rounds-workspace";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const integerFormatter = new Intl.NumberFormat("en-GB");

export function RoundsScoringIndex({ rounds }: { rounds: RoundsWorkspaceRound[] }) {
  const [query, setQuery] = useState("");
  const visibleRounds = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rounds;

    return rounds.filter((round) =>
      [round.courseName, round.fileName, round.teeName, round.dateLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, rounds]);

  return (
    <section className="grid min-w-0 gap-4" data-rounds-scoring-index>
      <ScoringTrend rounds={rounds} />

      <section
        className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
        aria-labelledby="round-history-title"
      >
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Round history
            </p>
            <h2 id="round-history-title" className="mt-1 text-xl font-semibold tracking-tight">
              Latest first
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Score, handicap impact and the lesson from every round.
            </p>
          </div>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Search rounds</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search course, tee or date"
              className="h-10 pl-9"
            />
          </label>
        </div>

        <div className="hidden min-w-0 overflow-x-auto md:block">
          <table className="w-full min-w-[920px] text-sm">
            <caption className="sr-only">
              Chronological rounds with date, course, tee, score, score to par, handicap impact and
              main verdict.
            </caption>
            <thead className="bg-muted/45 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Tee</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">To par</th>
                <th className="px-4 py-3">Handicap impact</th>
                <th className="px-4 py-3">Main verdict</th>
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRounds.map((round) => (
                <tr key={round.id} className="group transition-colors hover:bg-muted/35">
                  <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">
                    {round.dateLabel}
                  </td>
                  <td className="max-w-64 px-4 py-3.5 font-semibold">
                    <Link
                      href={`/rounds/${round.id}`}
                      className="focus-aaa block truncate rounded-sm outline-none group-hover:text-primary"
                    >
                      {roundTitle(round)}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{round.teeName ?? "--"}</td>
                  <td className="px-4 py-3.5 text-right text-base font-semibold tabular-nums">
                    {formatInteger(round.totalScore)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                    {round.toParLabel}
                  </td>
                  <td className="px-4 py-3.5">
                    <ImpactBadge round={round} />
                  </td>
                  <td className="max-w-72 px-4 py-3.5 text-muted-foreground">
                    {round.mainVerdict}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/rounds/${round.id}`}
                      className="focus-aaa inline-grid size-9 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground"
                      aria-label={`Review ${roundTitle(round)}`}
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y md:hidden" aria-label="Chronological round list">
          {visibleRounds.map((round) => (
            <Link
              key={round.id}
              href={`/rounds/${round.id}`}
              className="focus-aaa block px-4 py-4 outline-none transition-colors active:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {round.dateLabel} · {round.teeName ?? "Tee not set"}
                  </p>
                  <h3 className="mt-1 truncate text-[17px] font-semibold">{roundTitle(round)}</h3>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-semibold leading-none tabular-nums">
                    {formatInteger(round.totalScore)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-primary tabular-nums">
                    {round.toParLabel}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-muted-foreground">{round.mainVerdict}</p>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <ImpactBadge round={round} />
              </div>
            </Link>
          ))}
        </div>

        {visibleRounds.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No rounds match “{query.trim()}”.
          </div>
        ) : null}
      </section>
    </section>
  );
}

function ScoringTrend({ rounds }: { rounds: RoundsWorkspaceRound[] }) {
  const points = rounds
    .filter((round) => typeof round.toPar === "number")
    .slice(0, 8)
    .reverse();
  const values = points.map((round) => round.toPar as number);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const range = Math.max(maximum - minimum, 4);
  const latest = points.at(-1) ?? null;
  const first = points[0] ?? null;
  const change = latest && first ? (latest.toPar as number) - (first.toPar as number) : null;

  return (
    <section
      className="grid gap-3 rounded-xl border bg-card px-4 py-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      aria-labelledby="scoring-trend-title"
      data-scoring-trend
    >
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Scoring trend
            </p>
            <h2 id="scoring-trend-title" className="mt-1 text-lg font-semibold tracking-tight">
              {trendHeadline(change, points.length)}
            </h2>
          </div>
          {latest ? (
            <p className="shrink-0 text-right">
              <span className="block text-2xl font-semibold tabular-nums">{latest.toParLabel}</span>
              <span className="text-xs text-muted-foreground">latest</span>
            </p>
          ) : null}
        </div>
        <div
          className="mt-3 flex h-16 items-end gap-1.5"
          role="img"
          aria-label={trendAriaLabel(points)}
        >
          {points.length > 0 ? (
            points.map((round) => {
              const normalized = ((round.toPar as number) - minimum) / range;
              const height = 20 + normalized * 44;
              return (
                <span
                  key={round.id}
                  className="group relative min-w-0 flex-1 rounded-t-sm bg-primary/25 transition-colors hover:bg-primary/45"
                  style={{ height: `${height}px` }}
                  title={`${round.dateLabel}: ${round.toParLabel}`}
                >
                  <span className="absolute inset-x-0 top-0 h-1 rounded-full bg-primary" />
                </span>
              );
            })
          ) : (
            <span className="self-center text-sm text-muted-foreground">
              Add completed scorecards to start the trend.
            </span>
          )}
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground sm:max-w-44 sm:text-right">
        {points.length > 0
          ? `Score to par across the latest ${points.length} completed ${points.length === 1 ? "round" : "rounds"}. Lower bars are better.`
          : "Scores appear here once par and a completed total are available."}
      </p>
    </section>
  );
}

function ImpactBadge({ round }: { round: RoundsWorkspaceRound }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-medium",
        round.handicapImpactTone === "positive" &&
          "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]",
        round.handicapImpactTone === "attention" &&
          "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
      )}
    >
      {round.handicapImpactLabel}
    </Badge>
  );
}

function trendHeadline(change: number | null, count: number) {
  if (count < 2 || change === null)
    return count === 1 ? "First scoring point" : "No scoring trend yet";
  if (Math.abs(change) < 0.5) return "Scoring is holding steady";
  return change < 0
    ? `${Math.abs(change).toFixed(0)} shots better across this view`
    : `${Math.abs(change).toFixed(0)} shots higher across this view`;
}

function trendAriaLabel(rounds: RoundsWorkspaceRound[]) {
  if (rounds.length === 0) return "No completed scoring rounds available.";
  return rounds.map((round) => `${round.dateLabel}, ${round.toParLabel}`).join("; ");
}

function roundTitle(round: RoundsWorkspaceRound) {
  return round.courseName ?? round.fileName ?? "Untitled round";
}

function formatInteger(value: number | null) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}
