"use client";

import { useEffect, useMemo, useState } from "react";

import type { SessionTimelineItem } from "@/app/sessions/session-timeline";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Filter = "all" | "practice" | "round";

export function SessionsCompanionList({
  sessions,
  accountId,
}: {
  sessions: SessionTimelineItem[];
  accountId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(
    () =>
      sessions.filter(
        (session) => filter === "all" || (filter === "round" ? session.isRound : !session.isRound),
      ),
    [filter, sessions],
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
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Your golf history
          </h1>
          <Badge variant="outline">{sessions.length}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Practice, simulator sessions and rounds in one timeline.
        </p>
      </div>
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList className="grid w-full grid-cols-3" aria-label="Session type">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="practice">Practice</TabsTrigger>
          <TabsTrigger value="round">Rounds</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="ios-grouped-list rounded-2xl border bg-card p-3" aria-label="Session history">
        <StatusTimeline
          label="Session timeline"
          className="max-h-none"
          empty={
            <AppEmptyState
              title="No sessions in this view"
              description="Choose another session type or import measured data."
              primaryAction={
                <Button type="button" size="sm" onClick={() => setFilter("all")}>
                  Show all sessions
                </Button>
              }
              className="border-0 bg-transparent p-4 shadow-none"
            />
          }
          items={visible.map((session, index) => ({
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
            status: `${index === 0 ? "Newest · " : ""}${session.resultLabel}`,
            kind: session.isRound ? "round" : session.importedEvidence ? "import" : "practice",
            href: session.isRound ? `/rounds/${session.id}` : `/sessions/${session.id}`,
            featured: index === 0,
          }))}
        />
      </div>
    </div>
  );
}
