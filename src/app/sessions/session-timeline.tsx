"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Eye, GitCompareArrows } from "lucide-react";

import { DataToolbar } from "@/components/app/data-toolbar";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { StatusTimeline } from "@/components/app/status-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SessionTimelineItem = {
  id: string;
  isRound: boolean;
  title: string;
  dateLabel: string;
  timeLabel?: string;
  shotCount: number;
  sourceLabel: string;
  typeLabel: string;
  contextLabel: string;
  notes: string | null;
  equipmentNotes: string | null;
  verdict: string;
  planLinked: boolean;
  importedEvidence: boolean;
  roundScoreLabel: string | null;
  evidenceConfidence: "High" | "Moderate" | "Low";
};

type TimelineFilter = "all" | "practice" | "round";

export function SessionTimeline({
  sessions,
  accountId,
}: {
  sessions: SessionTimelineItem[];
  accountId?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [query, setQuery] = useState("");
  const [activeSessionId, setActiveSessionId] = useState(sessions[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const visible = useMemo(
    () =>
      sessions
        .filter((session) => {
          if (filter === "round") return session.isRound;
          if (filter === "practice") return !session.isRound;
          return true;
        })
        .filter((session) => {
          const normalizedQuery = query.trim().toLowerCase();
          if (!normalizedQuery) return true;
          return [
            session.title,
            session.dateLabel,
            session.typeLabel,
            session.sourceLabel,
            session.contextLabel,
            session.verdict,
          ].some((value) => value.toLowerCase().includes(normalizedQuery));
        }),
    [filter, query, sessions],
  );
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const selectedSessions = selected.flatMap((id) => {
    const session = sessions.find((item) => item.id === id);
    return session ? [session] : [];
  });
  const compareHref =
    selected.length === 2
      ? `/analyse/compare?sessionId=${encodeURIComponent(selected[0])}&baselineSessionId=${encodeURIComponent(selected[1])}`
      : null;

  useEffect(() => {
    if (!accountId) return;
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

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1600px)");
    const update = () => {
      if (query.matches && activeSessionId) setDetailOpen(true);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [activeSessionId]);

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= 2 ? [current[1], id] : [...current, id];
    });
  }

  function inspect(sessionId: string) {
    setActiveSessionId(sessionId);
    setDetailOpen(true);
  }

  return (
    <div className="grid gap-3">
      <DataToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Search sessions, sources or verdicts"
        resultLabel={`${visible.length} ${filter === "all" ? "sessions and rounds" : filter}`}
        filters={
          <ToggleGroup
            type="single"
            value={filter}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Session timeline filters"
            onValueChange={(value) => {
              if (value) setFilter(value as TimelineFilter);
            }}
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="practice">Practice</ToggleGroupItem>
            <ToggleGroupItem value="round">Rounds</ToggleGroupItem>
          </ToggleGroup>
        }
        activeFilters={
          filter === "all"
            ? []
            : [{ id: "session-type", label: filter, onRemove: () => setFilter("all") }]
        }
        onClearFilters={() => {
          setFilter("all");
          setQuery("");
        }}
      />

      <div
        className="grid min-w-0 gap-3 min-[1600px]:grid-cols-[minmax(0,1fr)_minmax(22rem,0.35fr)]"
        data-session-master-detail
      >
        <Card className="shadow-sm" aria-label="Session history" data-session-history-card>
          <CardContent className="p-4 sm:p-5">
            <StatusTimeline
              label="Session timeline"
              items={visible.map((session) => {
                const chosen = selected.includes(session.id);
                const href = session.isRound ? `/rounds/${session.id}` : `/sessions/${session.id}`;
                return {
                  id: session.id,
                  dateGroup: session.dateLabel,
                  timestamp: session.timeLabel,
                  title: session.title,
                  description: `${session.typeLabel} · ${session.shotCount} shot${session.shotCount === 1 ? "" : "s"} · ${session.sourceLabel}`,
                  meta: (
                    <span>
                      {session.verdict}
                      {session.planLinked ? " · Plan linked" : ""}
                      {session.equipmentNotes ? " · Equipment change" : ""}
                    </span>
                  ),
                  status: session.isRound
                    ? (session.roundScoreLabel ?? "Score not recorded")
                    : session.importedEvidence
                      ? `Review · ${session.evidenceConfidence}`
                      : `${session.evidenceConfidence} confidence`,
                  kind: session.isRound
                    ? ("round" as const)
                    : session.importedEvidence
                      ? ("import" as const)
                      : ("practice" as const),
                  action: (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => inspect(session.id)}
                      >
                        <Eye className="size-4" aria-hidden />
                        Inspect
                      </Button>
                      <Button
                        type="button"
                        variant={chosen ? "secondary" : "outline"}
                        size="sm"
                        aria-pressed={chosen}
                        onClick={() => toggle(session.id)}
                      >
                        <span
                          className={cn(
                            "grid size-4 place-items-center rounded border",
                            chosen
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                          aria-hidden
                        >
                          {chosen ? <Check className="size-3" /> : null}
                        </span>
                        Compare
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={href}>Open review</Link>
                      </Button>
                    </div>
                  ),
                };
              })}
            />
          </CardContent>
        </Card>
        <ResponsiveDetailPanel
          open={detailOpen}
          onOpenChange={setDetailOpen}
          title={activeSession?.title ?? "Session details"}
          description={
            activeSession
              ? `${activeSession.dateLabel} · ${activeSession.typeLabel} · ${activeSession.sourceLabel}`
              : "Choose a session from the timeline."
          }
          inlineAtUltrawide
          contentClassName="grid gap-3"
          footer={
            activeSession ? (
              <Button asChild className="w-full">
                <Link
                  href={
                    activeSession.isRound
                      ? `/rounds/${activeSession.id}`
                      : `/sessions/${activeSession.id}`
                  }
                >
                  Open full review
                </Link>
              </Button>
            ) : null
          }
        >
          {activeSession ? (
            <>
              <ConnectedMetricBar
                label="Selected session metrics"
                className="xl:grid-cols-2"
                embedded
                metrics={[
                  { label: "Shots", value: activeSession.shotCount },
                  {
                    label: "Evidence",
                    value: activeSession.evidenceConfidence,
                    detail: activeSession.importedEvidence ? "Imported rows" : "Session record",
                  },
                  { label: "Type", value: activeSession.typeLabel },
                  {
                    label: "Score",
                    value: activeSession.roundScoreLabel ?? "Not applicable",
                  },
                ]}
              />
              <Item variant="muted" size="sm">
                <ItemContent>
                  <ItemTitle>Verdict</ItemTitle>
                  <ItemDescription className="overflow-visible whitespace-normal text-clip">
                    {activeSession.verdict}
                  </ItemDescription>
                </ItemContent>
              </Item>
              <Item variant="muted" size="sm">
                <ItemContent>
                  <ItemTitle>Context</ItemTitle>
                  <ItemDescription className="overflow-visible whitespace-normal text-clip">
                    {activeSession.contextLabel}
                    {activeSession.planLinked ? " · Practice plan linked" : ""}
                  </ItemDescription>
                </ItemContent>
              </Item>
              {activeSession.equipmentNotes || activeSession.notes ? (
                <Item variant="muted" size="sm">
                  <ItemContent>
                    <ItemTitle>Recorded notes</ItemTitle>
                    <ItemDescription className="overflow-visible whitespace-normal text-clip">
                      {[activeSession.equipmentNotes, activeSession.notes]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ) : null}
              <Button type="button" variant="outline" onClick={() => toggle(activeSession.id)}>
                {selected.includes(activeSession.id) ? "Remove from compare" : "Add to compare"}
              </Button>
            </>
          ) : null}
        </ResponsiveDetailPanel>
      </div>

      <Card
        aria-live="polite"
        className="sticky bottom-4 z-20 border-primary/25 bg-card/95 shadow-lg backdrop-blur"
        data-session-compare-tray
      >
        <CardContent className="flex flex-row items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="font-semibold">Compare tray · {selected.length}/2 selected</p>
            <p className="truncate text-sm text-muted-foreground">
              {selectedSessions.length > 0
                ? selectedSessions.map((session) => session.title).join(" versus ")
                : "Choose two sessions from the timeline."}
            </p>
          </div>
          <div className="flex gap-2">
            {selected.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            ) : null}
            {compareHref ? (
              <Button asChild>
                <Link href={compareHref}>
                  <GitCompareArrows className="size-4" aria-hidden />
                  Compare
                </Link>
              </Button>
            ) : (
              <Button type="button" disabled>
                Select two
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
