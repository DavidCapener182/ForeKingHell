"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { MobileLargeTitle } from "@/components/app/mobile-screen";

import type { SessionTimelineItem } from "@/app/sessions/session-timeline";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { ChevronRight, Flag, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionHistoryFilterSheet } from "@/app/sessions/session-history-filter-sheet";
import { deriveSessionHistoryView } from "@/app/sessions/session-history-view";
import { useSessionHistoryUrlState } from "@/app/sessions/use-session-history-url-state";
import { formatClubType } from "@/lib/club-format";
import {
  type SessionHistoryFilterPatch,
  type SessionHistoryFilters,
  type SessionDateFilter,
  type SessionTypeFilter,
} from "@/lib/session-history-search-params";

export function SessionsCompanionList({
  sessions,
  accountId,
}: {
  sessions: SessionTimelineItem[];
  accountId: string;
}) {
  const { filters, updateFilters, clearFilters } = useSessionHistoryUrlState(sessions);

  return (
    <SessionsCompanionHistory
      sessions={sessions}
      accountId={accountId}
      filters={filters}
      onFiltersChange={updateFilters}
      onClearFilters={clearFilters}
    />
  );
}

export function SessionsCompanionHistory({
  sessions,
  accountId,
  filters,
  onFiltersChange,
  onClearFilters,
}: {
  sessions: SessionTimelineItem[];
  accountId: string;
  filters: SessionHistoryFilters;
  onFiltersChange: (patch: SessionHistoryFilterPatch) => void;
  onClearFilters: () => void;
}) {
  const { visible, focused } = useMemo(
    () => deriveSessionHistoryView(sessions, filters),
    [filters, sessions],
  );
  const sourceOptions = useMemo(
    () => uniqueOptions(sessions.map((session) => session.sourceLabel)),
    [sessions],
  );
  const clubOptions = useMemo(
    () =>
      uniqueOptions(sessions.flatMap((session) => session.clubs)).map((value) => ({
        value,
        label: formatClubType(value),
      })),
    [sessions],
  );
  const activeControlCount =
    Number(filters.type !== "all") +
    Number(filters.source !== "all") +
    Number(filters.club !== "all") +
    Number(filters.date !== "all") +
    Number(filters.sessionId !== null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `fkh:recent-review:${accountId}`,
        JSON.stringify(
          {
            version: 1,
            storedAt: new Date().toISOString(),
            sessions: sessions.slice(0, 10),
          },
          (key, value) => (key === "points" || key === "importantMetrics" ? undefined : value),
        ),
      );
    } catch {
      // Storage can be unavailable in strict or private browsing modes.
    }
  }, [accountId, sessions]);

  return (
    <div className="grid gap-4">
      <MobileLargeTitle
        title="Sessions"
        detail="Every practice. Every round. Your results."
        action={
          <Link
            href="/import"
            className="flex min-h-11 items-center text-sm font-semibold text-primary"
          >
            Add session
          </Link>
        }
      />
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {visible.length} of {sessions.length} sessions
          </span>
          <span aria-hidden="true">
            <span key={visible.length} className="t-number-pop tabular-nums">
              {visible.length}
            </span>{" "}
            of {sessions.length} sessions
          </span>
        </p>
        <Link href="/progress" className="flex min-h-11 items-center font-semibold text-primary">
          Progress over time →
        </Link>
      </div>
      <MobileSegmentedControl
        value={filters.type}
        onValueChange={(value) => onFiltersChange({ type: value as SessionTypeFilter })}
        ariaLabel="Session type"
        options={[
          { value: "all", label: "All" },
          { value: "practice", label: "Practice" },
          { value: "round", label: "Rounds" },
        ]}
      />
      <details className="rounded-xl bg-card px-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
          Filter sessions{activeControlCount ? ` · ${activeControlCount} active` : ""}
        </summary>
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filter and focus session history"
        >
          <SessionHistoryFilterSheet
            label="Source"
            value={filters.source}
            options={[
              { value: "all", label: "All sources" },
              ...sourceOptions.map((value) => ({ value, label: value })),
            ]}
            onChange={(source) => onFiltersChange({ source })}
          />
          <SessionHistoryFilterSheet
            label="Club"
            value={filters.club}
            options={[{ value: "all", label: "All clubs" }, ...clubOptions]}
            onChange={(club) => onFiltersChange({ club })}
          />
          <SessionHistoryFilterSheet
            label="Date"
            value={filters.date}
            options={[
              { value: "all", label: "Any date" },
              { value: "today", label: "Today" },
              { value: "week", label: "This week" },
              { value: "earlier", label: "Earlier" },
            ]}
            onChange={(date) => onFiltersChange({ date: date as SessionDateFilter })}
          />
          <SessionHistoryFilterSheet
            label="Focus"
            value={filters.sessionId ?? "all"}
            options={[
              { value: "all", label: "Newest session" },
              ...visible.map((session) => ({ value: session.id, label: session.title })),
            ]}
            title="Focus a session"
            description="Highlight one session without hiding the rest of your history."
            onChange={(sessionId) =>
              onFiltersChange({ sessionId: sessionId === "all" ? null : sessionId })
            }
          />
          {activeControlCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
              Clear
            </Button>
          ) : null}
        </div>
      </details>
      <div className="grid gap-5" aria-label="Session history">
        {visible.length === 0 ? (
          <AppEmptyState
            title="No sessions match these filters"
            description="Clear the filters to restore your full golf history."
            primaryAction={<Button onClick={onClearFilters}>Show all sessions</Button>}
          />
        ) : null}
        {(["Today", "This week", "Earlier"] as const).map((group) => {
          const grouped = visible.filter((session) => session.dateGroup === group);
          return grouped.length ? (
            <section key={group} aria-label={group} className="grid gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {group}{" "}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {grouped.length}
                </span>
              </h2>
              {grouped.map((session) => (
                <Link
                  key={session.id}
                  data-session-focused={session.id === focused?.id ? "true" : undefined}
                  href={session.isRound ? `/rounds/${session.id}` : `/sessions/${session.id}`}
                  className={`grid gap-3 rounded-2xl border bg-card p-4 active:bg-secondary ${session.id === focused?.id ? "border-primary/40" : "border-border"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      {session.isRound ? (
                        <Flag className="size-5" aria-hidden />
                      ) : (
                        <Activity className="size-5" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-base font-semibold">{session.title}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {session.dateLabel}
                        {session.timeLabel ? ` · ${session.timeLabel}` : ""} · {session.sourceLabel}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                  {filters.sessionId && session.id === focused?.id ? (
                    <p className="text-xs font-semibold text-primary">
                      Focused · {session.shotCount} shots
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <strong className="text-xl font-semibold tabular-nums">
                      {session.isRound
                        ? (session.roundScoreLabel ?? session.resultLabel)
                        : `${session.shotCount} shots`}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {session.clubs.length} clubs · {session.evidenceConfidence.toLowerCase()}{" "}
                      confidence
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{session.clubsLabel}</p>
                  <p className="border-t border-border pt-2 text-sm">
                    {session.verdict}
                    {session.planLinked ? " · Practice plan linked" : ""}
                  </p>
                </Link>
              ))}
            </section>
          ) : null;
        })}
      </div>
    </div>
  );
}

function uniqueOptions(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
