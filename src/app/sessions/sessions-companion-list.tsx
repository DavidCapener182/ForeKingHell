"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";

import type { SessionTimelineItem } from "@/app/sessions/session-timeline";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { ChevronRight, Flag, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoryToolbar } from "./history-toolbar";
import { SessionShotPreviewSheet } from "./session-shot-preview";
import { deriveSessionHistoryView } from "@/app/sessions/session-history-view";
import { useSessionHistoryUrlState } from "@/app/sessions/use-session-history-url-state";
import {
  type SessionHistoryFilterPatch,
  type SessionHistoryFilters,
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
      <HistoryToolbar
        sessions={sessions}
        filters={filters}
        count={visible.length}
        onChange={onFiltersChange}
        onClear={onClearFilters}
      />
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
                <div key={session.id} className="grid gap-2 border-b pb-3 last:border-b-0">
                  <Link
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
                        <strong className="block break-words text-base font-semibold">
                          {session.title}
                        </strong>
                        <span className="block text-xs text-muted-foreground">
                          {session.dateLabel}
                          {session.timeLabel ? ` · ${session.timeLabel}` : ""} · {session.typeLabel}{" "}
                          · {session.sourceLabel}
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
                    {session.clubsLabel !== session.title ? (
                      <p className="text-sm text-muted-foreground">{session.clubsLabel}</p>
                    ) : null}
                    {session.verdict !== "Measured review ready" || session.planLinked ? (
                      <p className="border-t border-border pt-2 text-sm">
                        {session.verdict}
                        {session.planLinked ? " · Practice plan linked" : ""}
                      </p>
                    ) : null}
                  </Link>
                  <SessionShotPreviewSheet sessionId={session.id} title={session.title} />
                </div>
              ))}
            </section>
          ) : null;
        })}
      </div>
    </div>
  );
}
