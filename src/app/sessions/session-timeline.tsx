"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, GitCompareArrows } from "lucide-react";

import { StatusTimeline } from "@/components/app/status-timeline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const visible = useMemo(
    () =>
      sessions.filter((session) => {
        if (filter === "round") return session.isRound;
        if (filter === "practice") return !session.isRound;
        return true;
      }),
    [filter, sessions],
  );
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

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= 2 ? [current[1], id] : [...current, id];
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as TimelineFilter)}>
          <TabsList aria-label="Session timeline filters">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="round">Rounds</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">
          {visible.length} {filter === "all" ? "sessions and rounds" : filter}
        </p>
      </div>

      <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Session history">
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
              status: `${session.evidenceConfidence} confidence`,
              kind:
                session.evidenceConfidence === "Low"
                  ? ("warning" as const)
                  : session.isRound
                    ? ("round" as const)
                    : ("practice" as const),
              action: (
                <div className="flex flex-wrap gap-2">
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
      </section>

      <aside
        aria-live="polite"
        className="sticky bottom-4 z-20 flex flex-row items-center justify-between gap-3 rounded-xl border border-primary/25 bg-card/95 p-3 shadow-lg backdrop-blur"
      >
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
      </aside>
    </div>
  );
}
