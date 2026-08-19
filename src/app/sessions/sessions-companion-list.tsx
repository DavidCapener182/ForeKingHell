"use client";

import { useEffect, useMemo } from "react";

import type { SessionTimelineItem } from "@/app/sessions/session-timeline";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Badge } from "@/components/ui/badge";
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
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Your golf history
          </h1>
          <Badge variant="outline">
            {visible.length} of {sessions.length}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice, simulator sessions and rounds in one timeline.
        </p>
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
      <div className="ios-grouped-list rounded-2xl border bg-card p-3" aria-label="Session history">
        <StatusTimeline
          label="Session timeline"
          className="max-h-none"
          empty={
            <AppEmptyState
              title="No sessions match these filters"
              description="Clear the filters to restore your full golf history."
              primaryAction={
                <Button type="button" size="sm" onClick={onClearFilters}>
                  Show all sessions
                </Button>
              }
              className="border-0 bg-transparent p-4 shadow-none"
            />
          }
          items={visible.map((session) => ({
            id: session.id,
            dateGroup: session.dateGroup,
            timestamp: session.timeLabel,
            title: session.title,
            description: `${session.dateLabel} · ${session.typeLabel}${
              session.contextLabel === session.title ? "" : ` · ${session.contextLabel}`
            }`,
            meta: (
              <span className="line-clamp-1">
                {session.verdict} · {session.evidenceConfidence} confidence
                {session.planLinked ? " · Plan linked" : ""}
              </span>
            ),
            status: `${
              session.id === focused?.id ? (filters.sessionId ? "Focused · " : "Newest · ") : ""
            }${session.resultLabel}`,
            kind: session.isRound ? "round" : session.importedEvidence ? "import" : "practice",
            href: session.isRound ? `/rounds/${session.id}` : `/sessions/${session.id}`,
            featured: session.id === focused?.id,
          }))}
        />
      </div>
    </div>
  );
}

function uniqueOptions(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
