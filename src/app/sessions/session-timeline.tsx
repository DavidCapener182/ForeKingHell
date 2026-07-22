"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Database, Flag, GitCompareArrows } from "lucide-react";

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
};

type TimelineFilter = "all" | "practice" | "round";

export function SessionTimeline({ sessions }: { sessions: SessionTimelineItem[] }) {
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

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return current.length >= 2 ? [current[1], id] : [...current, id];
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3">
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
        className="overflow-hidden rounded-2xl border border-border bg-card"
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
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-lg backdrop-blur lg:bottom-4 lg:flex-row lg:items-center lg:justify-between"
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
