"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronRight, Database, Flag, GitCompareArrows } from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { SegmentedControl } from "@/components/app/segmented-control";
import { StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SessionTimelineItem = {
  id: string;
  isRound: boolean;
  title: string;
  dateLabel: string;
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
  const recentVisible = visible.slice(0, 10);
  const olderVisible = visible.slice(10);

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

  function mobileRows(items: SessionTimelineItem[], startIndex = 0) {
    return items.map((session, index) => {
      const href = session.isRound ? `/rounds/${session.id}` : `/today?session=${session.id}`;
      const Icon = session.isRound ? Flag : Database;

      return (
        <Link
          key={session.id}
          href={href}
          className="ios-grouped-row focus-aaa flex min-h-[4.75rem] min-w-0 touch-manipulation items-center gap-3 px-4 py-2.5 outline-none active:bg-secondary"
          aria-label={`Open ${session.title}, ${session.dateLabel}`}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-[0.55rem] bg-primary/10 text-primary">
            <Icon className="size-[1.125rem]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-start gap-2">
              <span className="line-clamp-2 text-[15px] font-medium leading-5">
                {session.title}
              </span>
              {startIndex + index === 0 ? (
                <span className="mt-0.5 shrink-0 text-xs font-medium text-primary">Latest</span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground">
              {session.dateLabel} · {session.typeLabel} · {session.shotCount} shot
              {session.shotCount === 1 ? "" : "s"}
            </span>
            <span className="mt-0.5 block text-xs font-medium text-foreground">
              {session.verdict} · {session.evidenceConfidence} confidence
              {session.planLinked ? " · Plan linked" : ""}
            </span>
            {session.equipmentNotes ? (
              <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-300">
                Equipment change
              </span>
            ) : null}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
        </Link>
      );
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:hidden">
        <SegmentedControl
          label="Session type"
          value={filter}
          options={[
            { label: "All", value: "all" },
            { label: "Practice", value: "practice" },
            { label: "Rounds", value: "round" },
          ]}
          onChange={(value) => setFilter(value as TimelineFilter)}
        />

        <IOSSectionHeader
          title="Recent sessions"
          description={`${visible.length} ${filter === "all" ? "sessions and rounds" : filter}`}
        />
        <IOSGroupedList label="Session timeline">
          {recentVisible.length > 0 ? (
            mobileRows(recentVisible)
          ) : (
            <IOSListRow
              label="No sessions in this view"
              detail="Choose another session type or import new measured data."
            />
          )}
        </IOSGroupedList>

        {olderVisible.length > 0 ? (
          <IOSDisclosureGroup
            label="Older session history"
            items={[
              {
                value: "older-sessions",
                title: "Older sessions",
                summary: `${olderVisible.length}`,
                description: "Continue through the archive",
                contentClassName: "px-0 pb-0 pt-0",
                content: (
                  <IOSGroupedList label="Older session rows" className="border-0">
                    {mobileRows(olderVisible, recentVisible.length)}
                  </IOSGroupedList>
                ),
              },
            ]}
          />
        ) : null}
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3 lg:flex">
        <div className="flex flex-wrap gap-2" aria-label="Session timeline filters">
          {(["all", "practice", "round"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "min-h-10 rounded-xl border px-3 text-sm font-semibold capitalize",
                filter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted/55",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Select two comparable sessions, then open the evidence comparison.
        </p>
      </div>

      <section
        aria-label="Session timeline"
        className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block"
      >
        {visible.map((session, index) => {
          const chosen = selected.includes(session.id);
          const href = session.isRound ? `/rounds/${session.id}` : `/today?session=${session.id}`;
          const Icon = session.isRound ? Flag : Database;

          return (
            <article
              key={session.id}
              className="grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:px-5"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{session.title}</h2>
                  {index === 0 ? <StatusPill tone="sky">Latest</StatusPill> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {session.dateLabel} · {session.shotCount} shot
                  {session.shotCount === 1 ? "" : "s"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ["type", session.typeLabel],
                    ["source", session.sourceLabel],
                    ["context", session.contextLabel],
                  ].map(([kind, tag]) => (
                    <span
                      key={`${kind}-${tag}`}
                      className="rounded-full border border-border bg-muted/45 px-2 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {session.equipmentNotes ? (
                    <StatusPill tone="amber">Equipment change</StatusPill>
                  ) : null}
                </div>
                {session.notes ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {session.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => toggle(session.id)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold",
                    chosen
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-card text-muted-foreground hover:bg-muted/55",
                  )}
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
                </button>
                <Button asChild variant="outline" className="min-h-10 rounded-xl">
                  <Link href={href}>
                    Open
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      <aside
        aria-live="polite"
        className="sticky bottom-4 z-20 hidden flex-row items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-lg backdrop-blur lg:flex"
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
            <Button asChild className="min-h-11 rounded-xl">
              <Link href={compareHref}>
                <GitCompareArrows className="size-4" aria-hidden />
                Compare sessions
              </Link>
            </Button>
          ) : (
            <Button type="button" disabled className="min-h-11 rounded-xl">
              Select two sessions
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
