"use client";

import { useEffect, useMemo, useState } from "react";

import type { SessionTimelineItem } from "@/app/sessions/session-timeline";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
        JSON.stringify({
          version: 1,
          storedAt: new Date().toISOString(),
          sessions: sessions.slice(0, 10),
        }),
      );
    } catch {
      // Storage can be unavailable in strict or private browsing modes.
    }
  }, [accountId, sessions]);

  return (
    <div className="grid gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Recent sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review measured practice and rounds in one timeline.
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={filter}
        variant="outline"
        spacing={0}
        className="grid w-full grid-cols-3"
        aria-label="Session type"
        onValueChange={(value) => {
          if (value) setFilter(value as Filter);
        }}
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="practice">Practice</ToggleGroupItem>
        <ToggleGroupItem value="round">Rounds</ToggleGroupItem>
      </ToggleGroup>
      <Card size="sm" aria-label="Session history">
        <CardContent>
          <StatusTimeline
            label="Session timeline"
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
            items={visible.map((session) => ({
              id: session.id,
              dateGroup: session.dateLabel,
              timestamp: session.timeLabel,
              title: session.title,
              description: `${session.typeLabel} · ${session.shotCount} shot${session.shotCount === 1 ? "" : "s"}`,
              meta: `${session.verdict}${session.planLinked ? " · Plan linked" : ""}`,
              status: session.isRound
                ? (session.roundScoreLabel ?? "Score not recorded")
                : session.importedEvidence
                  ? `Review · ${session.evidenceConfidence}`
                  : `${session.evidenceConfidence} confidence`,
              kind: session.isRound ? "round" : session.importedEvidence ? "import" : "practice",
              href: session.isRound ? `/rounds/${session.id}` : `/sessions/${session.id}`,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
