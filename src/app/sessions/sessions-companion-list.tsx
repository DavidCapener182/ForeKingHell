"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Database, Flag } from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { SegmentedControl } from "@/components/app/segmented-control";
import type { SessionTimelineItem } from "@/app/sessions/session-timeline";

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
  const recent = visible.slice(0, 10);
  const older = visible.slice(10);

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
      <SegmentedControl
        label="Session type"
        value={filter}
        options={[
          { label: "All", value: "all" },
          { label: "Practice", value: "practice" },
          { label: "Rounds", value: "round" },
        ]}
        onChange={(value) => setFilter(value as Filter)}
      />
      <IOSSectionHeader
        title="Recent sessions"
        description={`${visible.length} ${filter === "all" ? "sessions and rounds" : filter}`}
      />
      <IOSGroupedList label="Session history">
        {recent.length > 0 ? (
          sessionRows(recent)
        ) : (
          <IOSListRow
            label="No sessions in this view"
            detail="Choose another type or import measured data."
          />
        )}
      </IOSGroupedList>
      {older.length > 0 ? (
        <IOSDisclosureGroup
          label="Older sessions"
          items={[
            {
              value: "older",
              title: "Older sessions",
              summary: String(older.length),
              description: "Continue through recent history",
              contentClassName: "px-0 pb-0 pt-0",
              content: (
                <IOSGroupedList label="Older sessions" className="border-0">
                  {sessionRows(older)}
                </IOSGroupedList>
              ),
            },
          ]}
        />
      ) : null}
    </div>
  );
}

function sessionRows(sessions: SessionTimelineItem[]) {
  return sessions.map((session) => {
    const href = session.isRound ? `/rounds/${session.id}` : `/sessions/${session.id}`;
    const Icon = session.isRound ? Flag : Database;

    return (
      <Link
        key={session.id}
        href={href}
        className="ios-grouped-row focus-aaa flex min-h-[4.75rem] min-w-0 items-center gap-3 px-4 py-2.5 outline-none active:bg-secondary"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-[1.125rem]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] font-medium leading-5">{session.title}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            {session.dateLabel} · {session.typeLabel} · {session.shotCount} shots
          </span>
          <span className="mt-0.5 block text-xs font-medium">
            {session.verdict} · {session.evidenceConfidence} confidence
            {session.planLinked ? " · Plan linked" : ""}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    );
  });
}
